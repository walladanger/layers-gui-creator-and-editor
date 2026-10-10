import type { ReactNode } from 'react';

export interface StatusBarProps {
  children?: ReactNode;
}

export function StatusBar({ children = 'Ready' }: StatusBarProps) {
  return <footer className="status-bar">{children}</footer>;
}
