import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createStartupRuntime } from './services/startupRuntime';
import './styles/index.css';

void createStartupRuntime().then((runtime) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App runtime={runtime} />
    </StrictMode>,
  );
});
