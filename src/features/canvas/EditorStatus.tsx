import { useSyncExternalStore } from 'react';
import { usePendingCount } from '../../services/ServicesProvider';

let bridgeConnected = false;
const listeners = new Set<() => void>();
/** The canvas reports whether any frame's bridge is connected. */
export function setBridgeConnected(next: boolean) {
  if (next === bridgeConnected) return;
  bridgeConnected = next; listeners.forEach((l) => l());
}
function useBridgeConnected() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => bridgeConnected);
}

export interface EditorStatusProps {
  bridge?: 'connected' | 'disconnected';
  unsynced?: number;
  sessionName?: string | null;
}

export function EditorStatus({ bridge = 'disconnected', unsynced = 0, sessionName = null }: EditorStatusProps) {
  return (
    <div className="editor-status">
      <span aria-label="Bridge status" data-state={bridge}>
        <span className="editor-status__dot" aria-hidden="true" />
        {bridge === 'connected' ? 'App connected' : 'No app connected'}
      </span>
      <span aria-label="Unsynced changes">{unsynced} unsynced</span>
      <span aria-label="Session">{sessionName ?? 'No session'}</span>
    </div>
  );
}

/** Status bar wired to the live services: the unsynced count is the queued writer's pending writes. */
export function ConnectedEditorStatus() {
  const unsynced = usePendingCount();
  const connected = useBridgeConnected();
  return <EditorStatus unsynced={unsynced} bridge={connected ? 'connected' : 'disconnected'} />;
}
