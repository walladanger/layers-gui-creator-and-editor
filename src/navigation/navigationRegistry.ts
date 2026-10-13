import { Bot, CircleHelp, FolderKanban, ListChecks, MessageSquare, Palette, Settings, SquareDashedMousePointer } from 'lucide-react';
import type { NavigationRegistry } from './navigationTypes';

export const navigationRegistry: NavigationRegistry = [
  { id: 'projects', label: 'Projects', icon: FolderKanban, route: 'projects' },
  { id: 'production', label: 'Production', icon: ListChecks, route: 'production', shortcut: 'P' },
  { id: 'canvas', label: 'Canvas', icon: SquareDashedMousePointer, route: 'canvas', parentId: 'production' },
  { id: 'comments', label: 'Comments', icon: MessageSquare, route: 'comments', parentId: 'production' },
  { id: 'design-system', label: 'Design system', icon: Palette, route: 'design-system', parentId: 'production' },
  { id: 'agents', label: 'Agents', icon: Bot, route: 'agents' },
  { id: 'settings', label: 'Settings', icon: Settings, route: 'settings' },
  { id: 'about', label: 'About', icon: CircleHelp, route: 'about' },
];
