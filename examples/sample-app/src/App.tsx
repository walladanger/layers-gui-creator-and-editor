import { useEffect, useState } from 'react';

const TASKS = [
  { id: 1, title: 'Design the onboarding flow', owner: 'Ari', status: 'In progress' },
  { id: 2, title: 'Fix the login timeout', owner: 'Sam', status: 'Blocked' },
  { id: 3, title: 'Write release notes', owner: 'Jo', status: 'Done' },
  { id: 4, title: 'Tidy the settings page', owner: 'Ari', status: 'To do' },
  { id: 5, title: 'Add dark mode toggle', owner: 'Kai', status: 'To do' },
  { id: 6, title: 'Profile the dashboard', owner: 'Sam', status: 'In progress' },
];

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const go = (to: string) => { history.pushState(null, '', to); setPath(to); };
  return [path, go] as const;
}

function NavBar({ path, go }: { path: string; go(to: string): void }) {
  return (
    <header className="nav">
      <span className="nav__brand">Orbit Tasks</span>
      <nav>
        <button className={path === '/' ? 'nav__link is-active' : 'nav__link'} onClick={() => go('/')}>Board</button>
        <button className={path === '/settings' ? 'nav__link is-active' : 'nav__link'} onClick={() => go('/settings')}>Settings</button>
      </nav>
    </header>
  );
}

function TaskCard({ title, owner, status }: { title: string; owner: string; status: string }) {
  return (
    <article className="card">
      <h3 className="card__title">{title}</h3>
      <p className="card__meta">Owner: {owner}</p>
      <span className="card__status" data-status={status}>{status}</span>
    </article>
  );
}

function Board() {
  return (
    <main className="page">
      <section className="hero">
        <h1>This week</h1>
        <p>Six tasks across four people. Click anything in Layers to comment on it.</p>
        <button className="primary">New task</button>
      </section>
      <div className="grid">
        {TASKS.map((t) => <TaskCard key={t.id} {...t} />)}
      </div>
      <section className="activity">
        <h2>Activity</h2>
        <ul className="activity__list">
          {Array.from({ length: 24 }, (_, i) => <li key={i}>Update {i + 1}: a task moved column</li>)}
        </ul>
      </section>
    </main>
  );
}

function Settings() {
  return (
    <main className="page">
      <h1>Settings</h1>
      <form className="settings" onSubmit={(e) => e.preventDefault()}>
        <label>Team name<input defaultValue="Orbit" /></label>
        <label>Email updates<select defaultValue="weekly"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
        <button className="primary" type="submit">Save</button>
      </form>
    </main>
  );
}

export function App() {
  const [path, go] = usePath();
  return (
    <div className="app">
      <NavBar path={path} go={go} />
      {path === '/settings' ? <Settings /> : <Board />}
    </div>
  );
}
