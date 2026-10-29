// The asset stage: renders one live demo, picked by the address hash (`#shadcn:button`).
// The Assets window shows it in a same-origin frame and snapshots `[data-asset-root]` to insert it.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from './ui/tooltip';
import { DEMOS } from './demos';
import './stage.css';

const readHash = () => decodeURIComponent(location.hash.slice(1));
const readTheme = () => new URLSearchParams(location.search).get('theme') === 'dark';

function Stage() {
  const [id, setId] = useState(readHash);
  const [dark, setDark] = useState(readTheme);
  useEffect(() => {
    const onHash = () => setId(readHash());
    const onMessage = (e: MessageEvent) => {
      // Only the studio that framed this page (same origin) can switch the theme.
      if (e.origin === location.origin && e.data?.type === 'asset-stage.theme') setDark(e.data.dark === true);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('message', onMessage);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('message', onMessage); };
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  const demo = DEMOS[id];
  if (!demo) return <p className="p-6 text-sm text-muted-foreground">Pick a component to see it live.</p>;
  return (
    <TooltipProvider>
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
        <div data-asset-root key={id}>{demo.main()}</div>
        {demo.more ? <div className="flex flex-col items-center gap-3 opacity-90">{demo.more()}</div> : null}
      </main>
    </TooltipProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Stage /></StrictMode>);
