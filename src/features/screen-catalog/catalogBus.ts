import type { ScreenEntry } from '../../services/projectSource';

/** Hands a picked screen from the catalog window to the canvas. */
type Listener = (screen: ScreenEntry) => void;
const listeners = new Set<Listener>();

export function openScreen(screen: ScreenEntry) { listeners.forEach((l) => l(screen)); }
export function onOpenScreen(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
