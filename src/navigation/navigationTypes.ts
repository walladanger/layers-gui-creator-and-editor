import type { LucideIcon } from 'lucide-react';

export type ShellRoute =
  | 'projects'
  | 'canvas'
  | 'production'
  | 'comments'
  | 'agents'
  | 'settings'
  | 'about';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: ShellRoute;
  parentId?: string;
  shortcut?: string;
  visible?: boolean;
}

export type NavigationRegistry = readonly NavigationItem[];
