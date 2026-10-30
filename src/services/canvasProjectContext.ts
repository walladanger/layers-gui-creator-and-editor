/** The project currently open on the canvas, scoped to this app session. */
class CanvasProjectContext {
  private projectId: string | null = null;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.projectId;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setProject = (projectId: string | null) => {
    if (this.projectId === projectId) return;
    this.projectId = projectId;
    this.listeners.forEach(listener => listener());
  };
}

export const canvasProjectContext = new CanvasProjectContext();
