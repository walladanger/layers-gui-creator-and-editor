import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { navigationRegistry } from '../navigation/navigationRegistry';
import type { NavigationRegistry, ShellRoute } from '../navigation/navigationTypes';
import { renderRoute as defaultRenderRoute } from '../features/pages/RoutePages';
import { Navigation } from './Navigation';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { WindowManagerWorkspace } from '../windows/WindowManagerProvider';
import { useOptionalSettings } from '../settings/settingsStore';
import './shell.css';

export interface AppShellProps {
  navigation?: NavigationRegistry;
  children?: ReactNode;
  statusContent?: ReactNode;
  settingsContent?: ReactNode;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  initialRoute?: ShellRoute;
  /** Route that stays mounted behind every page, so the canvas is always viewable. */
  persistentRoute?: ShellRoute;
  renderRoute?: (route: ShellRoute) => ReactNode;
}

export function AppShell({
  navigation = navigationRegistry,
  children,
  statusContent,
  settingsContent,
  onMinimize,
  onToggleMaximize,
  onClose,
  initialRoute = 'canvas',
  persistentRoute = 'canvas',
  renderRoute = defaultRenderRoute,
}: AppShellProps) {
  const settings = useOptionalSettings();
  const [collapsed, setCollapsed] = useState(settings?.settings.navigationCollapsed ?? false);
  const [activeRoute, setActiveRoute] = useState<ShellRoute>(initialRoute);
  useEffect(() => {
    const go = (e: Event) => { const route = (e as CustomEvent<{ route?: ShellRoute }>).detail?.route; if (route) setActiveRoute(route); };
    window.addEventListener('layers:navigate', go);
    return () => window.removeEventListener('layers:navigate', go);
  }, []);
  useEffect(() => { if (settings) setCollapsed(settings.settings.navigationCollapsed); }, [settings?.settings.navigationCollapsed]);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void settings?.update({ navigationCollapsed: next });
  };
  const pageOpen = activeRoute !== persistentRoute;

  return (
    <div className="app-shell">
      <TitleBar onMinimize={onMinimize} onToggleMaximize={onToggleMaximize} onClose={onClose} />
      <Navigation
        items={navigation}
        activeRoute={activeRoute}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onNavigate={setActiveRoute}
        settingsContent={settingsContent}
      />
      <main className="app-shell__workspace">
        <WindowManagerWorkspace navigationKey={activeRoute}>
          <div className="app-shell__workspace-content" data-route={activeRoute}>
            {children !== undefined ? (
              <div className="app-shell__page-layer">
                <div className="app-shell__page-panel">{children}</div>
              </div>
            ) : (
              <>
                <div className="app-shell__canvas-layer">{renderRoute(persistentRoute)}</div>
                {pageOpen && (
                  <div className="app-shell__page-layer">
                    <div className="app-shell__page-panel">
                      <button
                        type="button"
                        className="app-shell__page-close"
                        aria-label="Close page"
                        title="Close this page and show the full canvas"
                        onClick={() => setActiveRoute(persistentRoute)}
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                      {renderRoute(activeRoute)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </WindowManagerWorkspace>
      </main>
      <StatusBar>{statusContent}</StatusBar>
    </div>
  );
}
