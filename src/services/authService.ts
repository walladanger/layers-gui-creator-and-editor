import { seedDemoProject, type MemoryDatabase } from './memoryAdapter';

export interface AuthUser { id: string; email: string | null }
export type AuthResult = { kind: 'success'; needsConfirmation?: boolean } | { kind: 'failure'; message: string };

export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signOut(): Promise<void>;
}

/** Test/offline auth. Signing up mirrors the server's demo-project seed. */
export function createMemoryAuthService(db?: MemoryDatabase, initialUser: AuthUser | null = null): AuthService & { setUser(user: AuthUser | null): void } {
  let user = initialUser;
  const accounts = new Map<string, { id: string; password: string }>();
  const listeners = new Set<(user: AuthUser | null) => void>();
  const set = (next: AuthUser | null) => { user = next; listeners.forEach((listener) => listener(user)); };
  return {
    async getUser() { return user; },
    onChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async signIn(email, password) {
      const account = accounts.get(email);
      if (!account || account.password !== password) return { kind: 'failure', message: 'Wrong email or password.' };
      set({ id: account.id, email });
      return { kind: 'success' };
    },
    async signUp(email, password) {
      if (accounts.has(email)) return { kind: 'failure', message: 'That email already has an account.' };
      const id = crypto.randomUUID();
      accounts.set(email, { id, password });
      if (db) seedDemoProject(db, id);
      set({ id, email });
      return { kind: 'success' };
    },
    async signInWithGoogle() { return { kind: 'failure', message: 'Google sign-in is not available offline.' }; },
    async signOut() { set(null); },
    setUser: set,
  };
}
