import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useDialogs } from '../../dialogs/DialogProvider';
import { useOptionalServices } from '../../services/ServicesProvider';
import { validateProjectInput } from '../../services/services';
import type { Project, TargetMode } from '../../services/types';
import '../auth/auth.css';
import './projects.css';

const modeLabels: Record<TargetMode, string> = { live: 'Live app', demo: 'Demo', snapshot: 'Snapshot' };

export function ProjectsPage() {
  const ctx = useOptionalServices();
  if (!ctx) {
    return <section className="route-page" data-route="projects"><h1 id="route-projects">Projects</h1><p className="editor-empty__text">Sign in to see your projects.</p></section>;
  }
  return <ProjectsList />;
}

function ProjectsList() {
  const ctx = useOptionalServices()!;
  const dialogs = useDialogs();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TargetMode>('live');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const projectService = ctx.runtime.services.projects;

  const load = useCallback(async () => {
    try { setProjects(await projectService.list()); setLoadError(null); } catch { setLoadError('Projects could not load. Your changes are kept and will sync.'); setProjects((p) => p ?? []); }
  }, [projectService]);
  useEffect(() => { void load(); }, [load, ctx.user?.id]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const input = { name, target_mode: mode, target_url: url };
    const problem = validateProjectInput(input);
    if (problem) { setFormError(problem); return; }
    const project = await projectService.create(input);
    setProjects((list) => [...(list ?? []), project]);
    setName(''); setUrl(''); setFormError(null);
  };

  const saveRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !editing.name.trim()) return;
    await projectService.rename(editing.id, editing.name);
    setProjects((list) => list?.map((p) => (p.id === editing.id ? { ...p, name: editing.name.trim() } : p)) ?? null);
    setEditing(null);
  };

  const remove = async (project: Project) => {
    const confirmed = await dialogs.confirm({
      title: `Delete ${project.name}?`,
      description: 'This removes the project with its sessions, changes and comments.',
      confirmLabel: 'Delete', tone: 'danger',
    });
    if (!confirmed) return;
    await projectService.remove(project.id);
    setProjects((list) => list?.filter((p) => p.id !== project.id) ?? null);
  };

  return (
    <section className="route-page projects-page" aria-labelledby="route-projects" data-route="projects">
      <header className="projects-page__header">
        <div>
          <h1 id="route-projects">Projects</h1>
          <p className="editor-empty__text">Each project points at one app you are building.</p>
        </div>
        <div className="projects-page__account">
          <span>{ctx.user?.email}</span>
          <button type="button" onClick={() => void ctx.runtime.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <form className="projects-page__form" onSubmit={create} aria-label="New project" noValidate>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="My app" /></label>
        <label>Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as TargetMode)}>
            {(Object.keys(modeLabels) as TargetMode[]).map((m) => <option key={m} value={m}>{modeLabels[m]}</option>)}
          </select>
        </label>
        <label>App address<input value={mode === 'demo' ? '' : url} disabled={mode === 'demo'} onChange={(e) => setUrl(e.target.value)} placeholder={mode === 'demo' ? 'Uses the demo app' : 'http://localhost:5173'} /></label>
        <button type="submit" className="projects-page__primary">Create project</button>
        {formError ? <p role="alert" className="projects-page__error">{formError}</p> : null}
      </form>

      {loadError ? <p role="status" className="projects-page__error">{loadError}</p> : null}
      {projects === null ? <p className="editor-empty__text">Loading projects…</p> : projects.length === 0 ? (
        <div className="editor-empty"><p className="editor-empty__title">No projects yet</p><p className="editor-empty__text">Create one above to get started.</p></div>
      ) : (
        <ul className="projects-page__list" aria-label="Your projects">
          {projects.map((project) => (
            <li key={project.id}>
              {editing?.id === project.id ? (
                <form className="projects-page__rename" onSubmit={saveRename}>
                  <input aria-label="Project name" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <button type="submit" className="projects-page__primary">Save</button>
                  <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <div className="projects-page__info">
                    <span className="projects-page__name">{project.name}</span>
                    <span className="projects-page__meta">{modeLabels[project.target_mode]}{project.target_url && project.target_mode !== 'demo' ? ` · ${project.target_url}` : ''}</span>
                  </div>
                  <button type="button" aria-label={`Rename ${project.name}`} onClick={() => setEditing({ id: project.id, name: project.name })}><Pencil aria-hidden="true" size={14} /></button>
                  <button type="button" aria-label={`Delete ${project.name}`} onClick={() => void remove(project)}><Trash2 aria-hidden="true" size={14} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
