import { create } from 'zustand';
import { supabase, supabaseReady } from '../services/supabaseService';
import type { User } from '../types';
import type { AuthError } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    signInWithEmail: (credentials: { email: string, password: string }) => Promise<{ error: AuthError | null }>;
    signUpWithEmail: (credentials: { email: string, password: string }) => Promise<{ error: AuthError | null }>;
    updateUserMetadata: (metadata: { name?: string, avatar_url?: string }) => Promise<{ error: AuthError | null }>;
    _setUser: (user: User | null) => void;
    _setLoading: (loading: boolean) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
    user: null,
    loading: true,
    _setUser: (user) => set({ user }),
    _setLoading: (loading) => set({ loading }),

    signInWithGoogle: async () => {
        if (!supabaseReady) {
            console.error("Cannot sign in: Supabase is not configured.");
            return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) {
            console.error('Error logging in with Google:', error);
        }
    },

    signOut: async () => {
        if (!supabaseReady) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
        }
    },

    signInWithEmail: async (credentials: { email: string, password: string }) => {
        if (!supabaseReady) {
            return { error: { name: 'AuthError', message: 'Supabase not configured.' } as AuthError };
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
        return { error };
    },

    signUpWithEmail: async (credentials: { email: string, password: string }) => {
        if (!supabaseReady) {
            return { error: { name: 'AuthError', message: 'Supabase not configured.' } as AuthError };
        }
        const { data, error } = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                emailRedirectTo: window.location.origin,
            },
        });
        return { error };
    },

    updateUserMetadata: async (metadata: { name?: string; avatar_url?: string }) => {
        if (!supabaseReady) {
             return { error: { name: 'AuthError', message: 'Supabase not configured.' } as AuthError };
        }
        
        // Filter out undefined/null values so we only update what's provided.
        const updateData = Object.fromEntries(
            Object.entries(metadata).filter(([_, v]) => v !== undefined && v !== null)
        );

        if (Object.keys(updateData).length === 0) {
            return { error: null }; // Nothing to update
        }

        const { data, error } = await supabase.auth.updateUser({ data: updateData });

        if (data.user) {
            set({ user: data.user });
        }
        
        return { error };
    },
}));

// Initialize auth state
if (supabaseReady) {
    // Check for an active session on initial load.
    supabase.auth.getSession().then(({ data: { session } }) => {
        useAuth.getState()._setUser(session?.user ?? null);
        useAuth.getState()._setLoading(false);
    });

    // Listen for changes in authentication state (login/logout).
    supabase.auth.onAuthStateChange((_event, session) => {
        useAuth.getState()._setUser(session?.user ?? null);
    });
} else {
    // If Supabase is not configured, we stop loading and do nothing.
    useAuth.getState()._setLoading(false);
}