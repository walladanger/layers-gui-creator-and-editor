import { Bot, CircleHelp, FolderKanban, ListChecks, MessageSquare, Settings } from 'lucide-react';
import type { NavigationRegistry } from './navigationTypes';

export const navigationRegistry: NavigationRegistry = [
  { id: 'projects', label: 'Projects', icon: FolderKanban, route: 'projects' },
  { id: 'production', label: 'Production', icon: ListChecks, route: 'production', shortcut: 'P' },
  { id: 'comments', label: 'Comments', icon: MessageSquare, route: 'comments', parentId: 'production' },
  { id: 'agents', label: 'Agents', icon: Bot, route: 'agents' },
  { id: 'settings', label: 'Settings', icon: Settings, route: 'settings' },
  { id: 'about', label: 'About', icon: CircleHelp, route: 'about' },
];
