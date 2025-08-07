
import React, { useState } from 'react';
import { GoogleIcon } from './icons/GoogleIcon';
import type { AuthError } from '@supabase/supabase-js';

interface LoginViewProps {
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (credentials: { email: string, password: string }) => Promise<{ error: AuthError | null }>;
  onEmailSignUp: (credentials: { email: string, password: string }) => Promise<{ error: AuthError | null }>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onGoogleLogin, onEmailLogin, onEmailSignUp }) => {
  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const credentials = { email, password };
    let result;

    if (view === 'signin') {
      result = await onEmailLogin(credentials);
    } else {
      result = await onEmailSignUp(credentials);
      if (!result.error) {
        setMessage('Check your email for the confirmation link!');
        setPassword('');
      }
    }

    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  };

  const toggleView = () => {
    setView(view === 'signin' ? 'signup' : 'signin');
    setError(null);
    setMessage(null);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-brand-bg text-text-primary p-4">
      <div className="max-w-sm w-full text-center">
        <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-accent-blue rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                </svg>
            </div>
        </div>
        <h1 className="text-3xl font-bold text-text-primary">{view === 'signin' ? 'Sign In to Wizz' : 'Create an Account'}</h1>
        <p className="text-md text-text-secondary mt-2">
            Your AI Crypto Chart Analyzer.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
            <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-input-bg border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                aria-label="Email address"
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 bg-input-bg border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                aria-label="Password"
            />
            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-blue disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {loading ? <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : (view === 'signin' ? 'Sign In' : 'Sign Up')}
            </button>
            {error && <p className="text-sm text-accent-red mt-2 text-center">{error}</p>}
            {message && <p className="text-sm text-accent-green mt-2 text-center">{message}</p>}
        </form>

        <div className="my-6 flex items-center">
            <div className="border-t border-border-color flex-grow"></div>
            <span className="mx-4 text-sm text-text-secondary flex-shrink-0">OR</span>
            <div className="border-t border-border-color flex-grow"></div>
        </div>

        <button
            onClick={onGoogleLogin}
            className="flex items-center justify-center gap-3 w-full px-6 py-2.5 font-semibold text-text-primary bg-input-bg border border-border-color rounded-lg shadow-sm hover:bg-border-color focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-blue focus:ring-offset-brand-bg transition-colors"
        >
            <GoogleIcon className="h-5 w-5" />
            <span>Sign In with Google</span>
        </button>

        <p className="mt-8 text-sm text-center text-text-secondary">
            {view === 'signin' ? "Don't have an account?" : "Already have an account?"}
            <button onClick={toggleView} className="font-medium text-accent-blue hover:underline ml-1 focus:outline-none">
                {view === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
        </p>
      </div>
    </div>
  );
}
