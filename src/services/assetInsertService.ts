// Holds the asset picked in the Assets window until it is placed in a connected app, places it
// through the bridge (`preview.insert`), records a Production task for the agent, and puts the
// previews back after the app reloads. Nothing is written to the app's files.
import type { BridgeNode, BridgeService } from './bridgeService';
import { recordInsertTask } from './commentTasks';
import type { InsertPosition, TaskInsert } from './taskTracker';
import type { AssetEntry } from '../features/assets/catalog';
import { assetLabel } from '../features/assets/catalog';
import type { InsertNode } from '../features/assets/snapshot';

export interface PendingInsert { asset: AssetEntry; tree: InsertNode; usage: string }
interface Placed { id: string; tree: InsertNode; anchor: BridgeNode; position: InsertPosition }
interface Attachment { bridge: BridgeService; placed: Placed[]; unsubscribe(): void }
export interface PlaceInput {
  frameId: string; projectId: string; route: string; anchor: BridgeNode; position: InsertPosition; px: number; py: number;
}

class AssetInsertService {
  private pending: PendingInsert | null = null;
  private listeners = new Set<() => void>();
  private attachments = new Map<string, Attachment>();
  getPending = () => this.pending;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach((l) => l()); }
  /** Picks an asset to place; the canvas switches to the Insert tool. */
  arm(asset: AssetEntry, tree: InsertNode, usage = asset.usage) { this.pending = { asset, tree, usage }; this.emit(); }
  cancel() { if (this.pending) { this.pending = null; this.emit(); } }

  attach(frameId: string, bridge: BridgeService) {
    const a: Attachment = { bridge, placed: this.attachments.get(frameId)?.placed ?? [], unsubscribe: () => undefined };
    // After the app reloads its previews are gone, so each insert is put back next to its anchor.
    a.unsubscribe = bridge.subscribe((m) => { if (m.type === 'ready') void this.replay(a); });
    this.attachments.set(frameId, a);
    return () => { a.unsubscribe(); if (this.attachments.get(frameId) === a) this.attachments.set(frameId, { ...a, unsubscribe: () => undefined }); };
  }
  private async replay(a: Attachment) {
    for (const p of a.placed) {
      try {
        const { node } = await a.bridge.request<{ node: BridgeNode | null }>('node.find', { rid: p.anchor.rid, instanceIndex: p.anchor.instanceIndex, selector: p.anchor.selector });
        if (node) await a.bridge.request('preview.insert', { anchorNid: node.nid, position: p.position, tree: p.tree, insertId: p.id });
      } catch { /* the anchor is gone in this version of the app; the task is kept */ }
    }
  }

  /** Places the pending asset next to `anchor`, then records the task. Resolves to an error message, or null. */
  async place(bridge: BridgeService, input: PlaceInput): Promise<string | null> {
    const pending = this.pending;
    if (!pending) return 'Pick a component or icon in Assets first.';
    if (!bridge.supports('preview.insert')) return 'This app’s bridge is too old to insert. Update radium-bridge and reload the app.';
    const id = crypto.randomUUID();
    try {
      const { node } = await bridge.request<{ node: BridgeNode }>('preview.insert', { anchorNid: input.anchor.nid, position: input.position, tree: pending.tree, insertId: id });
      const shot = await bridge.screenshot(node.nid);
      const a = this.attachments.get(input.frameId);
      a?.placed.push({ id, tree: pending.tree, anchor: input.anchor, position: input.position });
      this.pending = null; this.emit();
      const insert: TaskInsert = { library: pending.asset.library, name: pending.asset.name, position: input.position, install: pending.asset.install, importLine: pending.asset.importLine, usage: pending.usage };
      await recordInsertTask({
        insertId: id, projectId: input.projectId, frameId: input.frameId, route: input.route, label: assetLabel(pending.asset), insert,
        anchor: { label: input.anchor.label, selector: input.anchor.selector, rid: input.anchor.rid, comp: input.anchor.comp, tag: input.anchor.tag, text: input.anchor.text },
        px: input.px, py: input.py, rect: shot?.rect,
        shots: shot ? { element: shot.dataUrl, view: shot.viewDataUrl, viewport: shot.viewport } : undefined,
      });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'The app did not accept the insert.';
    }
  }
}

export const assetInsertService = new AssetInsertService();
