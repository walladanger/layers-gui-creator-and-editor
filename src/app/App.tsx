import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { DialogProvider } from '../dialogs/DialogProvider';
import { ColorProfilePopover } from '../design-system/ColorProfilePopover';
import { ThemeProvider, useTheme } from '../design-system/themeStore';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { AppShell } from '../shell/AppShell';
import { ConnectedEditorStatus } from '../features/canvas/EditorStatus';
import { ServicesProvider, useServices } from '../services/ServicesProvider';
import { createMemoryRuntime, type StudioRuntime } from '../services/runtime';
import { guestUserId, loadGuestDatabase, setGuestUserId, startGuestPersistence } from '../services/guestPersistence';
import { SettingsProvider } from '../settings/settingsStore';
import { WindowManagerProvider } from '../windows/WindowManagerProvider';
import { ExternalWindowRoute, selectExternalFeature } from '../external-windows/ExternalWindowRoute';
import { windowRegistry } from '../windows/windowRegistry';
import { startCommentTaskSync } from '../services/commentTasks';
import { useNativeWindowStateLifecycle } from '../windows/windowState';

function ColorProfileControl() {
  const [open, setOpen] = useState(false);
  const { selection, setSelection } = useTheme();

  return (
    <div className="color-profile-control">
      <button
        type="button"
        aria-label="Color profile settings"
        aria-expanded={open}
        data-tooltip="Color profile settings"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings aria-hidden="true" size={18} />
        <span className="navigation__label">Appearance</span>
      </button>
      {open ? (
        <ColorProfilePopover value={selection} onChange={setSelection} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

function AppContent({ onSkip }: { onSkip: () => void }) {
  const externalFeature = typeof window === 'undefined' ? null : selectExternalFeature(window.location.search, windowRegistry);
  useNativeWindowStateLifecycle(externalFeature ? `feature:${externalFeature.id}` : 'main');

  const { user, loading } = useServices();
  const started = useRef(false);
  useEffect(() => {
    if (!loading && !user && !started.current) { started.current = true; onSkip(); }
  }, [loading, user, onSkip]);

  useEffect(() => startCommentTaskSync(), []);

  if (loading || !user) return null;
  if (externalFeature) return <ExternalWindowRoute feature={externalFeature} />;

  return <AppShell settingsContent={<ColorProfileControl />} statusContent={<ConnectedEditorStatus />} />;
}

/** Start a guest runtime: in-memory services persisted to localStorage, demo project seeded on first run. */
async function createGuestRuntime(): Promise<StudioRuntime> {
  const saved = loadGuestDatabase();
  if (saved && saved.projects.size > 0) {
    startGuestPersistence(saved);
    return createMemoryRuntime({ db: saved, user: { id: guestUserId(), email: 'guest@radium.local' } });
  }
  const guest = createMemoryRuntime();
  await guest.memoryAuth.signUp('guest@radium.local', crypto.randomUUID());
  const user = await guest.memoryAuth.getUser();
  if (user) setGuestUserId(user.id);
  startGuestPersistence(guest.db);
  return guest;
}

export function App({ runtime }: { runtime: StudioRuntime }) {
  const [activeRuntime, setActiveRuntime] = useState(runtime);
  const skipSignIn = () => { void createGuestRuntime().then(setActiveRuntime); };
  return (
    <ServicesProvider runtime={activeRuntime}>
    <SettingsProvider>
      <ThemeProvider>
        <NotificationProvider>
          <DialogProvider>
            <WindowManagerProvider>
              <AppContent onSkip={skipSignIn} />
            </WindowManagerProvider>
          </DialogProvider>
        </NotificationProvider>
      </ThemeProvider>
    </SettingsProvider>
    </ServicesProvider>
  );
}
