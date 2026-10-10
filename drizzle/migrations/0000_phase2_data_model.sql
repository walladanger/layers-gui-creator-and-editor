-- Phase 2: §5 data model with row-level security.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  target_url text,
  target_mode text NOT NULL DEFAULT 'live' CHECK (target_mode IN ('live','demo','snapshot')),
  repo_url text,
  framework text,
  design_md text
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor','commenter')),
  UNIQUE (project_id, user_id)
);

CREATE TABLE public.frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  route text NOT NULL DEFAULT '/',
  label text,
  width integer NOT NULL DEFAULT 1440,
  height integer NOT NULL DEFAULT 900,
  canvas_x double precision NOT NULL DEFAULT 0,
  canvas_y double precision NOT NULL DEFAULT 0,
  breakpoint text NOT NULL DEFAULT 'desktop' CHECK (breakpoint IN ('desktop','tablet','mobile','custom'))
);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','compiled','archived')),
  parent_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  base_commit text
);

CREATE TABLE public.change_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  frame_id uuid REFERENCES public.frames(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('style','text','move','resize','reorder','hide','delete','insert','token','motion','state-style','note')),
  target jsonb NOT NULL DEFAULT '{}'::jsonb,
  before jsonb,
  after jsonb,
  css text,
  tailwind_hint text,
  screenshot_before text,
  screenshot_after text,
  superseded_by uuid REFERENCES public.change_records(id) ON DELETE SET NULL
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  frame_id uuid REFERENCES public.frames(id) ON DELETE SET NULL,
  target jsonb NOT NULL DEFAULT '{}'::jsonb,
  px double precision,
  py double precision,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  author_kind text NOT NULL DEFAULT 'user' CHECK (author_kind IN ('user','agent'))
);

CREATE TABLE public.comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  author_kind text NOT NULL DEFAULT 'user' CHECK (author_kind IN ('user','agent')),
  author_id uuid DEFAULT auth.uid(),
  text text NOT NULL
);

CREATE TABLE public.annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  frame_id uuid NOT NULL REFERENCES public.frames(id) ON DELETE CASCADE,
  shapes jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text
);

CREATE TABLE public.production_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  markdown text,
  json jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','handed-off','done'))
);

CREATE TABLE public.production_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  list_id uuid NOT NULL REFERENCES public.production_lists(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  title text NOT NULL,
  file text,
  line integer,
  component text,
  instructions text,
  acceptance text[] NOT NULL DEFAULT '{}',
  change_record_ids uuid[] NOT NULL DEFAULT '{}',
  priority text NOT NULL DEFAULT 'p2' CHECK (priority IN ('p1','p2','p3')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in-progress','done','rejected','needs-info')),
  agent text,
  agent_note text,
  pr_url text
);

CREATE TABLE public.design_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  "group" text NOT NULL CHECK ("group" IN ('color','radius','space','shadow','font','motion')),
  source text NOT NULL DEFAULT 'imported' CHECK (source IN ('imported','edited'))
);

CREATE TABLE public.looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  edits jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  token_hash text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.project_members, public.frames, public.sessions,
  public.change_records, public.comments, public.comment_replies, public.annotations, public.production_lists,
  public.production_items, public.design_tokens, public.looks, public.agent_tokens TO authenticated;
GRANT ALL ON public.projects, public.project_members, public.frames, public.sessions,
  public.change_records, public.comments, public.comment_replies, public.annotations, public.production_lists,
  public.production_items, public.design_tokens, public.looks, public.agent_tokens TO service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['projects','project_members','frames','sessions','change_records','comments','comment_replies','annotations','production_lists','production_items','design_tokens','looks','agent_tokens'] LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = auth.uid() AND m.role IN ('owner','editor'));
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.session_project(_session_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT project_id FROM public.sessions WHERE id = _session_id;
$$;
CREATE OR REPLACE FUNCTION public.frame_project(_frame_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT project_id FROM public.frames WHERE id = _frame_id;
$$;
CREATE OR REPLACE FUNCTION public.comment_project(_comment_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT project_id FROM public.comments WHERE id = _comment_id;
$$;
CREATE OR REPLACE FUNCTION public.list_project(_list_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.project_id FROM public.production_lists l JOIN public.sessions s ON s.id = l.session_id WHERE l.id = _list_id;
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_project(uuid), public.can_edit_project(uuid), public.is_project_owner(uuid),
  public.session_project(uuid), public.frame_project(uuid), public.comment_project(uuid), public.list_project(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_project(uuid), public.can_edit_project(uuid), public.is_project_owner(uuid),
  public.session_project(uuid), public.frame_project(uuid), public.comment_project(uuid), public.list_project(uuid) TO authenticated;

CREATE POLICY "Members read projects" ON public.projects FOR SELECT TO authenticated USING (public.can_read_project(id));
CREATE POLICY "Users create own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Editors update projects" ON public.projects FOR UPDATE TO authenticated USING (public.can_edit_project(id)) WITH CHECK (public.can_edit_project(id));
CREATE POLICY "Owners delete projects" ON public.projects FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members read members" ON public.project_members FOR SELECT TO authenticated USING (public.can_read_project(project_id));
CREATE POLICY "Owners add members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owners update members" ON public.project_members FOR UPDATE TO authenticated USING (public.is_project_owner(project_id)) WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owners remove members" ON public.project_members FOR DELETE TO authenticated USING (public.is_project_owner(project_id));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['frames','sessions','design_tokens','looks'] LOOP
    EXECUTE format('CREATE POLICY "Members read" ON public.%I FOR SELECT TO authenticated USING (public.can_read_project(project_id))', t);
    EXECUTE format('CREATE POLICY "Editors insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(project_id))', t);
    EXECUTE format('CREATE POLICY "Editors update" ON public.%I FOR UPDATE TO authenticated USING (public.can_edit_project(project_id)) WITH CHECK (public.can_edit_project(project_id))', t);
    EXECUTE format('CREATE POLICY "Editors delete" ON public.%I FOR DELETE TO authenticated USING (public.can_edit_project(project_id))', t);
  END LOOP;
END $$;

CREATE POLICY "Members read" ON public.comments FOR SELECT TO authenticated USING (public.can_read_project(project_id));
CREATE POLICY "Members insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (public.can_read_project(project_id));
CREATE POLICY "Members update" ON public.comments FOR UPDATE TO authenticated USING (public.can_read_project(project_id)) WITH CHECK (public.can_read_project(project_id));
CREATE POLICY "Members delete" ON public.comments FOR DELETE TO authenticated USING (public.can_read_project(project_id));

CREATE POLICY "Members read" ON public.comment_replies FOR SELECT TO authenticated USING (public.can_read_project(public.comment_project(comment_id)));
CREATE POLICY "Members insert" ON public.comment_replies FOR INSERT TO authenticated WITH CHECK (public.can_read_project(public.comment_project(comment_id)) AND (author_id IS NULL OR author_id = auth.uid()));
CREATE POLICY "Authors update" ON public.comment_replies FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or editors delete" ON public.comment_replies FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.can_edit_project(public.comment_project(comment_id)));

CREATE POLICY "Members read" ON public.annotations FOR SELECT TO authenticated USING (public.can_read_project(public.frame_project(frame_id)));
CREATE POLICY "Members insert" ON public.annotations FOR INSERT TO authenticated WITH CHECK (public.can_read_project(public.frame_project(frame_id)));
CREATE POLICY "Members update" ON public.annotations FOR UPDATE TO authenticated USING (public.can_read_project(public.frame_project(frame_id))) WITH CHECK (public.can_read_project(public.frame_project(frame_id)));
CREATE POLICY "Members delete" ON public.annotations FOR DELETE TO authenticated USING (public.can_read_project(public.frame_project(frame_id)));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['change_records','production_lists'] LOOP
    EXECUTE format('CREATE POLICY "Members read" ON public.%I FOR SELECT TO authenticated USING (public.can_read_project(public.session_project(session_id)))', t);
    EXECUTE format('CREATE POLICY "Editors insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(public.session_project(session_id)))', t);
    EXECUTE format('CREATE POLICY "Editors update" ON public.%I FOR UPDATE TO authenticated USING (public.can_edit_project(public.session_project(session_id))) WITH CHECK (public.can_edit_project(public.session_project(session_id)))', t);
    EXECUTE format('CREATE POLICY "Editors delete" ON public.%I FOR DELETE TO authenticated USING (public.can_edit_project(public.session_project(session_id)))', t);
  END LOOP;
END $$;

CREATE POLICY "Members read" ON public.production_items FOR SELECT TO authenticated USING (public.can_read_project(public.list_project(list_id)));
CREATE POLICY "Editors insert" ON public.production_items FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(public.list_project(list_id)));
CREATE POLICY "Editors update" ON public.production_items FOR UPDATE TO authenticated USING (public.can_edit_project(public.list_project(list_id))) WITH CHECK (public.can_edit_project(public.list_project(list_id)));
CREATE POLICY "Editors delete" ON public.production_items FOR DELETE TO authenticated USING (public.can_edit_project(public.list_project(list_id)));

CREATE POLICY "Owners read tokens" ON public.agent_tokens FOR SELECT TO authenticated USING (public.is_project_owner(project_id));
CREATE POLICY "Owners create tokens" ON public.agent_tokens FOR INSERT TO authenticated WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owners update tokens" ON public.agent_tokens FOR UPDATE TO authenticated USING (public.is_project_owner(project_id)) WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owners delete tokens" ON public.agent_tokens FOR DELETE TO authenticated USING (public.is_project_owner(project_id));

CREATE OR REPLACE FUNCTION public.add_project_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER projects_add_owner_member AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.add_project_owner_member();

CREATE OR REPLACE FUNCTION public.seed_demo_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.projects (owner_id, name, target_url, target_mode, framework)
  VALUES (NEW.id, 'Demo: Radium Ollama', '/targets/radium-mock.html', 'demo', 'unknown');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_seed_demo AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.seed_demo_project();

REVOKE EXECUTE ON FUNCTION public.add_project_owner_member(), public.seed_demo_project(), public.set_updated_at() FROM anon, authenticated, public;

CREATE POLICY "Members read screenshots" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'screenshots' AND public.can_read_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Editors upload screenshots" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'screenshots' AND public.can_edit_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Editors update screenshots" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'screenshots' AND public.can_edit_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Editors delete screenshots" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'screenshots' AND public.can_edit_project(((storage.foldername(name))[1])::uuid));
