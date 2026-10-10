import type { LucideIcon } from 'lucide-react';

export type ShellRoute =
  | 'projects'
  | 'canvas'
  | 'production'
  | 'comments'
  | 'design-system'
  | 'agents'
  | 'settings'
  | 'about';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: ShellRoute;
  shortcut?: string;
  visible?: boolean;
}

export type NavigationRegistry = readonly NavigationItem[];
