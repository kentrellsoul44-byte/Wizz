

import React, { createContext, useContext, useEffect } from 'react';
import { create } from 'zustand';
import type { Session, User, ChatMessage } from '../types';
import * as db from '../services/supabaseService';

interface SessionState {
    sessions: Session[];
    activeSession: Session | null;
    activeSessionId: string | null;
    isLoading: boolean;
    user: User | null; // Keep track of the user for whom sessions are loaded

    setSessions: (sessions: Session[]) => void;
    setActiveSessionId: (id: string | null) => void;
    loadSessions: (user: User) => Promise<void>;
    newSession: () => Promise<void>;
    selectSession: (id: string) => void;
    updateSession: (id: string, updates: Partial<Pick<Session, 'messages'>>) => Promise<void>;
    updateSessionTitle: (id: string, title: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    clearAllUserSessions: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
    sessions: [],
    activeSession: null,
    activeSessionId: null,
    isLoading: true,
    user: null,

    setSessions: (sessions) => set({ sessions }),
    setActiveSessionId: (id) => set({ activeSessionId: id }),
    
    loadSessions: async (user) => {
        set({ isLoading: true, user });
        try {
            const userSessions = await db.getSessions(user.id);
            set({ sessions: userSessions });
            if (userSessions.length > 0) {
                set({ activeSessionId: userSessions[0].id });
            } else {
                await get().newSession(); // Create a new session if none exist
            }
        } catch (error) {
            console.error("Error loading user sessions:", error);
            set({ sessions: [], activeSessionId: null });
        } finally {
            set({ isLoading: false });
        }
    },

    newSession: async () => {
        const user = get().user;
        if (!user) return;
        try {
            const newSession = await db.createSession(user.id, { title: 'New Analysis', messages: [] });
            set(state => ({
                sessions: [newSession, ...state.sessions],
                activeSessionId: newSession.id
            }));
        } catch (error) {
            console.error("Error creating new session:", error);
        }
    },

    selectSession: (id) => {
        set({ activeSessionId: id });
    },

    updateSession: async (id, updates) => {
        set(state => ({
            sessions: state.sessions.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
        try {
            await db.updateSession(id, updates);
        } catch (error) {
            console.error("Error updating session:", error);
            // Optionally revert state here
        }
    },

    updateSessionTitle: async (id, title) => {
        set(state => ({
            sessions: state.sessions.map(s => s.id === id ? { ...s, title } : s)
        }));
        try {
            await db.updateSession(id, { title });
        } catch (error) {
            console.error("Error renaming session:", error);
        }
    },

    deleteSession: async (idToDelete) => {
        const user = get().user;
        if (!user) return;

        const originalSessions = get().sessions;
        const originalActiveId = get().activeSessionId;

        // Optimistically update UI
        set(state => {
            const remainingSessions = state.sessions.filter(s => s.id !== idToDelete);
            let newActiveSessionId = state.activeSessionId;
            if (state.activeSessionId === idToDelete) {
                newActiveSessionId = remainingSessions.length > 0 ? remainingSessions[0].id : null;
            }
            return { sessions: remainingSessions, activeSessionId: newActiveSessionId };
        });

        try {
            await db.deleteSession(idToDelete);
            // If deletion was successful and we're left with no sessions, create a new one.
            if (get().sessions.length === 0) {
                await get().newSession();
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            // On failure, revert to the original state
            set({ sessions: originalSessions, activeSessionId: originalActiveId });
        }
    },

    clearAllUserSessions: async () => {
        const user = get().user;
        if (!user) return;
        try {
            await db.deleteAllUserSessions(user.id);
            set({ sessions: [], activeSessionId: null });
            await get().newSession();
        } catch (error) {
            console.error("Error clearing all sessions:", error);
        }
    },
}));

// Add a computed property 'activeSession' outside the store definition
useSession.subscribe(
    (state) => {
      const activeSession = state.sessions.find(s => s.id === state.activeSessionId) || null;
      // This is a common pattern to add derived state to a Zustand store
      // We mutate the state object directly here, which is fine for derived properties
      (state as any).activeSession = activeSession;
    }
);


// --- Provider Component ---

interface SessionProviderProps {
    children: React.ReactNode;
    user: User;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children, user }) => {
    const { loadSessions, user: storedUser } = useSession();

    useEffect(() => {
        // Load sessions if a user is present and is different from the one we already loaded for.
        if (user && user.id !== storedUser?.id) {
            loadSessions(user);
        }
    }, [user, storedUser, loadSessions]);
    
    return <>{children}</>;
}