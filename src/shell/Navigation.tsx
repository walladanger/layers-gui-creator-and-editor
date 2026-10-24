import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { NavigationItem, NavigationRegistry, ShellRoute } from '../navigation/navigationTypes';

export interface NavigationProps {
  items: NavigationRegistry;
  activeRoute: ShellRoute;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: (route: ShellRoute) => void;
  settingsContent?: ReactNode;
}

export function Navigation({
  items,
  activeRoute,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  settingsContent,
}: NavigationProps) {
  const toggleLabel = collapsed ? 'Expand navigation' : 'Collapse navigation';
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('layers.navigationWidth'));
    return Number.isFinite(saved) && saved >= 180 && saved <= 480 ? saved : 220;
  });
  const [resizing, setResizing] = useState(false);
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(new Set());
  const visibleItems = items.filter((item) => item.visible !== false);
  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const selected = item.route === activeRoute;
    return (
      <button
        type="button"
        className="navigation__item"
        aria-label={item.label}
        aria-current={selected ? 'page' : undefined}
        data-tooltip={collapsed ? item.label : undefined}
        data-active={selected}
        onClick={() => {
          setClosedGroups((previous) => {
            const next = new Set(previous);
            next.delete(item.id);
            return next;
          });
          onNavigate?.(item.route);
        }}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        <span className="navigation__label">{item.label}</span>
        {!collapsed && item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
      </button>
    );
  };

  return (
    <nav className="navigation" aria-label="Primary navigation" data-collapsed={collapsed}
      data-resizing={resizing} style={{ '--navigation-width': `${width}px` } as CSSProperties}>
      <div className="navigation__controls">
        <button
          type="button"
          className="navigation__toggle"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          data-tooltip={toggleLabel}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" size={18} /> : <PanelLeftClose aria-hidden="true" size={18} />}
        </button>
      </div>
      <div className="navigation__scroll">
      <div id="canvas-left-controls" className="navigation__effect-controls" />
      <div className="navigation__items">
        {visibleItems.filter((item) => !item.parentId).map((item) => {
          const children = visibleItems.filter((child) => child.parentId === item.id);
          const expanded = !closedGroups.has(item.id);
          return (
            <div key={item.id} className="navigation__group">
              <div className="navigation__parent">
                {renderItem(item)}
                {children.length > 0 && !collapsed ? (
                  <button
                    type="button"
                    className="navigation__toggle navigation__branch-toggle"
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
                    aria-expanded={expanded}
                    aria-controls={`navigation-children-${item.id}`}
                    onClick={() => setClosedGroups((previous) => {
                      const next = new Set(previous);
                      if (expanded) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })}
                  >
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : null}
              </div>
              {children.length > 0 ? (
                <div id={`navigation-children-${item.id}`} className="navigation__children" role="group" aria-label={`${item.label} folders`} hidden={!expanded}>
                  {children.map((child) => <div key={child.id}>{renderItem(child)}</div>)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {settingsContent ? <div className="navigation__settings">{settingsContent}</div> : null}
      </div>
      <div className="navigation__resize" role="separator" aria-label="Resize left menu"
        aria-orientation="vertical" aria-valuemin={180} aria-valuemax={480} aria-valuenow={collapsed ? 60 : width}
        tabIndex={0}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          if (collapsed) onToggleCollapsed();
          const next = Math.max(180, Math.min(480, width + (event.key === 'ArrowRight' ? 20 : -20)));
          setWidth(next);
          localStorage.setItem('layers.navigationWidth', String(next));
        }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizing(true);
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const left = event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
          const next = Math.max(180, Math.min(480, window.innerWidth * 0.45, event.clientX - left));
          if (collapsed && event.clientX - left > 75) onToggleCollapsed();
          setWidth(next);
          localStorage.setItem('layers.navigationWidth', String(next));
        }}
        onPointerUp={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setResizing(false);
        }}
        onLostPointerCapture={() => setResizing(false)}
      />
    </nav>
  );
}
