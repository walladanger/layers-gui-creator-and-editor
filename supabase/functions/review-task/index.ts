const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const str = { type: 'string' };
const list = { type: 'array', items: str };
const obj = (props: Record<string, unknown>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const ACTIONS: Record<string, { instruction: string; schema: Record<string, unknown> }> = {
  rewrite: { instruction: 'Rewrite the task as a short, clear title (max 12 words) and a few plain steps in notes.', schema: obj({ title: str, notes: str }) },
  subtasks: { instruction: 'Break the task into 2-6 small, concrete sub-tasks.', schema: obj({ subtasks: list }) },
  priority: { instruction: 'Suggest a kind (Bug, Improvement, Change, Idea or Question) and priority (high, normal or low) with a one-sentence reason.', schema: obj({ kind: { type: 'string', enum: ['Bug', 'Improvement', 'Change', 'Idea', 'Question'] }, priority: { type: 'string', enum: ['high', 'normal', 'low'] }, reason: str }) },
  donecheck: { instruction: 'Write a short checklist describing how to confirm this task is finished.', schema: obj({ notes: str }) },
  questions: { instruction: 'List the 1-5 most important unclear points to ask before building this.', schema: obj({ questions: list }) },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { action, task } = await req.json();
    const spec = ACTIONS[action];
    if (!spec || !task || typeof task !== 'object') return json({ error: 'Unknown review option.' }, 400);
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) throw new Error('AI is not configured');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Lovable-API-Key': key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        instructions: `You review production tasks for a visual GUI editor. The user is not a programmer; use plain words. You only suggest. ${spec.instruction}`,
        input: JSON.stringify(task).slice(0, 8000),
        text: { format: { type: 'json_schema', name: `review_${action}`, strict: true, schema: spec.schema } },
      }),
    });
    if (res.status === 429) return json({ error: 'Too many requests right now. Try again in a moment.' }, 429);
    if (res.status === 402) return json({ error: 'AI credits have run out. Add credits in your workspace to keep using reviews.' }, 402);
    if (!res.ok || !res.body) throw new Error(`AI error ${res.status}`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '', out = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === 'response.output_text.delta') out += ev.delta ?? '';
          if (ev.type === 'response.failed' || ev.type === 'error') throw new Error('AI review failed');
        } catch (err) { if (err instanceof Error && err.message === 'AI review failed') throw err; }
      }
    }
    return json({ suggestion: JSON.parse(out) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Review failed' }, 500);
  }
});
