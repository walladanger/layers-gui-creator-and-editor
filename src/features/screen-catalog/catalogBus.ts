import type { ScreenEntry } from '../../services/projectSource';
import type { ScreenSelection } from '../../services/screenSnapshots';

/** Hands a picked screen from the catalog window to the canvas. */
type Listener = (selection: ScreenSelection) => void;
const listeners = new Set<Listener>();
let revision = 0;

export function openScreen(screen: ScreenEntry, sourceKey = '') { listeners.forEach((l) => l({ screen, sourceKey, revision: ++revision })); }
export function onOpenScreen(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
