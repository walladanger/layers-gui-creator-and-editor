const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIONS: Record<string, string> = {
  rewrite: 'Rewrite the task as a short, clear title (max 12 words) and a few plain steps. Return {"title": string, "notes": string}.',
  subtasks: 'Break the task into 2-6 small, concrete sub-tasks. Return {"subtasks": string[]}.',
  priority: 'Suggest a kind (one of Bug, Improvement, Change, Idea, Question) and priority (high, normal or low) with a one-sentence reason. Return {"kind": string, "priority": string, "reason": string}.',
  donecheck: 'Write a short checklist describing how to confirm this task is finished. Return {"notes": string}.',
  questions: 'List the 1-5 most important unclear points to ask before building this. Return {"questions": string[]}.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { action, task } = await req.json();
    const instruction = ACTIONS[action];
    if (!instruction || !task || typeof task !== 'object') {
      return new Response(JSON.stringify({ error: 'Unknown review option.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) throw new Error('AI is not configured');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You review production tasks for a visual GUI editor. The user is not a programmer; use plain words. You only suggest. ${instruction} Reply with JSON only.` },
          { role: 'user', content: JSON.stringify(task).slice(0, 8000) },
        ],
      }),
    });
    if (res.status === 429) return new Response(JSON.stringify({ error: 'Too many requests right now. Try again in a moment.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (res.status === 402) return new Response(JSON.stringify({ error: 'AI credits have run out. Add credits in your workspace to keep using reviews.' }), { status: 402, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? '{}';
    const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    return new Response(JSON.stringify({ suggestion: json }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Review failed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
