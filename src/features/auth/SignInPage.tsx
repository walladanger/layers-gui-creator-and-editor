import { useState, type FormEvent } from 'react';
import { PRODUCT_NAME } from '../../app/brand';
import { LogoMark } from '../../shell/LogoMark';
import { useServices } from '../../services/ServicesProvider';
import './auth.css';

export function SignInPage({ onSkip }: { onSkip?: () => void }) {
  const { runtime } = useServices();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = mode === 'sign-in' ? await runtime.auth.signIn(email, password) : await runtime.auth.signUp(email, password);
    setBusy(false);
    if (result.kind === 'failure') setMessage({ tone: 'error', text: result.message });
    else if (result.needsConfirmation) setMessage({ tone: 'info', text: 'Check your email to confirm your account, then sign in.' });
  };

  const google = async () => {
    setMessage(null);
    const result = await runtime.auth.signInWithGoogle();
    if (result.kind === 'failure') setMessage({ tone: 'error', text: result.message });
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__brand"><LogoMark /><span>{PRODUCT_NAME}</span></div>
        <h1 id="auth-title">{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</h1>
        <button type="button" className="auth-card__google" onClick={google}>Continue with Google</button>
        <div className="auth-card__divider"><span>or</span></div>
        <form onSubmit={submit}>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {message ? <p role={message.tone === 'error' ? 'alert' : 'status'} className={`auth-card__message auth-card__message--${message.tone}`}>{message.text}</p> : null}
          <button type="submit" className="auth-card__primary" disabled={busy}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button type="button" className="auth-card__switch" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(null); }}>
          {mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        {onSkip ? (
          <button type="button" className="auth-card__switch" onClick={onSkip}>
            Continue without an account
          </button>
        ) : null}
      </section>
    </main>
  );
}
