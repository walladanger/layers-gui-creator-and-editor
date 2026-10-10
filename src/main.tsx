import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createSupabaseRuntime } from './services/supabaseRuntime';
import './styles/index.css';

const runtime = createSupabaseRuntime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App runtime={runtime} />
  </StrictMode>,
);
