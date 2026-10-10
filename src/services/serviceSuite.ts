import { expect, test } from 'vitest';
import type { StudioServices } from './services';
import type { QueuedWriter } from './queuedWriter';

export interface SuiteContext {
  services: StudioServices;
  writer: QueuedWriter;
  /** Signs in a fresh user; returns its id. */
  signInAs(label: 'alice' | 'bob'): Promise<string>;
  cleanup?(): Promise<void>;
}

/**
 * One behaviour suite for every adapter. The in-memory run is in services.memory.test.ts;
 * the Lovable Cloud run is in services.live.test.ts (needs test accounts).
 */
export function runServiceSuite(name: string, makeContext: () => Promise<SuiteContext>) {
  const withCtx = (title: string, body: (ctx: SuiteContext) => Promise<void>) =>
    test(`${name}: ${title}`, async () => {
      const ctx = await makeContext();
      try { await body(ctx); } finally { await ctx.cleanup?.(); }
    });

  withCtx('projects: create, list, rename, delete', async ({ services, writer, signInAs }) => {
    await signInAs('alice');
    const project = await services.projects.create({ name: 'Suite app', target_mode: 'live', target_url: 'http://localhost:5173' });
    await writer.flush();
    expect((await services.projects.list()).map((p) => p.id)).toContain(project.id);
    await services.projects.rename(project.id, 'Renamed');
    await writer.flush();
    expect((await services.projects.get(project.id))?.name).toBe('Renamed');
    await services.projects.remove(project.id);
    await writer.flush();
    expect(await services.projects.get(project.id)).toBeNull();
  });

  withCtx('projects: rejects a missing name or address', async ({ services, signInAs }) => {
    await signInAs('alice');
    await expect(services.projects.create({ name: ' ', target_mode: 'demo' })).rejects.toThrow('Give the project a name.');
    await expect(services.projects.create({ name: 'X', target_mode: 'live', target_url: 'localhost' })).rejects.toThrow(/http/);
  });

  withCtx('sessions, changes, comments, production, tokens and looks round-trip', async ({ services, writer, signInAs }) => {
    await signInAs('alice');
    const project = await services.projects.create({ name: 'Round trip', target_mode: 'demo' });
    const session = await services.sessions.create(project.id, 'Polish');
    const branch = await services.sessions.branch(session, 'Polish (branch)');
    const change = await services.changes.record({
      session_id: session.id, kind: 'style', target: { rid: 'src/A.tsx:1:1', instanceScope: 'all' },
      before: { 'border-radius': '8px' }, after: { 'border-radius': '12px' }, css: 'border-radius: 12px;',
    });
    const comment = await services.comments.add({ project_id: project.id, session_id: session.id, text: 'Rounder please' });
    await services.comments.reply(comment.id, 'Done');
    const list = await services.production.createList({ session_id: session.id, version: 1, markdown: '# List' });
    const item = await services.production.addItem({ list_id: list.id, seq: 1, title: 'Round rows', change_record_ids: [change.id], acceptance: ['12px corners'] });
    await services.production.updateItem(item.id, { status: 'done', agent: 'claude' });
    await services.tokens.add({ project_id: project.id, name: '--radius-md', value: '8px', group: 'radius' });
    const { plaintext } = await services.tokens.createAgentToken(project.id, 'CLI');
    await services.looks.save({ project_id: project.id, name: 'Glow', style: { 'box-shadow': '0 0 18px' } });
    await writer.flush();
    expect(writer.pendingCount).toBe(0);

    expect((await services.sessions.list(project.id)).find((s) => s.id === branch.id)?.parent_session_id).toBe(session.id);
    expect((await services.changes.list(session.id))[0].target.rid).toBe('src/A.tsx:1:1');
    expect((await services.comments.replies(comment.id))[0].text).toBe('Done');
    const items = await services.production.items(list.id);
    expect(items[0]).toMatchObject({ status: 'done', agent: 'claude', acceptance: ['12px corners'], change_record_ids: [change.id] });
    expect((await services.tokens.list(project.id))[0].name).toBe('--radius-md');
    const agentTokens = await services.tokens.agentTokens(project.id);
    expect(agentTokens[0].token_hash).not.toBe(plaintext);
    expect(agentTokens[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await services.looks.list(project.id))[0].name).toBe('Glow');

    await services.projects.remove(project.id);
    await writer.flush();
  });

  withCtx('row-level security: another user cannot see or change my rows', async ({ services, writer, signInAs }) => {
    await signInAs('alice');
    const project = await services.projects.create({ name: 'Private', target_mode: 'demo' });
    const session = await services.sessions.create(project.id, 'Secret session');
    await writer.flush();

    await signInAs('bob');
    expect((await services.projects.list()).map((p) => p.id)).not.toContain(project.id);
    expect(await services.projects.get(project.id)).toBeNull();
    expect(await services.sessions.list(project.id)).toEqual([]);
    await services.sessions.create(project.id, 'Intruder');
    await services.projects.rename(project.id, 'Hacked');
    await services.projects.remove(project.id);
    await writer.flush();
    expect(writer.failedCount).toBeGreaterThanOrEqual(2); // insert + update denied, kept aside

    await signInAs('alice');
    expect((await services.projects.get(project.id))?.name).toBe('Private');
    expect((await services.sessions.list(project.id)).map((s) => s.name)).toEqual(['Secret session']);
    await services.projects.remove(project.id);
    await writer.flush();
  });
}
