import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import type { AuthUser } from './authService';
import type { StudioRuntime } from './runtime';

interface ServicesValue { runtime: StudioRuntime; user: AuthUser | null; loading: boolean }

const ServicesContext = createContext<ServicesValue | null>(null);

export function ServicesProvider({ runtime, children }: PropsWithChildren<{ runtime: StudioRuntime }>) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const apply = (next: AuthUser | null) => { runtime.setCurrentUser(next); if (active) { setUser(next); setLoading(false); } };
    const unsubscribe = runtime.auth.onChange(apply);
    void runtime.auth.getUser().then(apply);
    return () => { active = false; unsubscribe(); };
  }, [runtime]);
  return <ServicesContext.Provider value={{ runtime, user, loading }}>{children}</ServicesContext.Provider>;
}

export function useOptionalServices() { return useContext(ServicesContext); }

export function useServices() {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('useServices must be used inside ServicesProvider.');
  return value;
}

/** Number of writes still waiting to reach the server. */
export function usePendingCount() {
  const value = useContext(ServicesContext);
  const writer = value?.runtime.writer;
  return useSyncExternalStore(
    (listener) => writer?.subscribe(listener) ?? (() => undefined),
    () => (writer ? writer.pendingCount + writer.failedCount : 0),
  );
}
