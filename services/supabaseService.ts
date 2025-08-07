

import { createClient } from '@supabase/supabase-js';
import type { Session, Database, ChatMessage, User, Json } from '../types';

const supabaseUrl = "https://pxmubamvtgwafzfjpkdx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4bXViYW12dGd3YWZ6Zmpwa2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MjMxMDQsImV4cCI6MjA3MDA5OTEwNH0.Jmv_IxT2ct0zsu5ohrzh7rvMc3CYnXZs2teOEV2MFxI";

export const supabaseReady = !!(supabaseUrl && supabaseAnonKey);

if (!supabaseReady) {
  // This warning is helpful for developers.
  console.warn('Supabase URL and/or Anon Key are not provided. Backend features will be disabled.');
}

// Initialize with dummy values if not provided, to prevent crashes on import.
// The supabaseReady flag will prevent any calls from being made.
export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'dummy-key'
);

const supabaseNotConfiguredError = new Error("Supabase is not configured. Please check your environment variables.");

// --- User Preferences ---

export interface UserPreferences {
  theme: 'light' | 'dark';
  default_ultra_mode: boolean;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  default_ultra_mode: false,
};

export const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
  if (!supabaseReady) return { ...defaultPreferences };

  // This "upsert" with "ignoreDuplicates" acts as an atomic "INSERT ... ON CONFLICT DO NOTHING".
  // It ensures that a preference row exists for the user without causing errors if one is created
  // by a concurrent request. It uses the default preferences for the initial creation.
  const { error: upsertError } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...defaultPreferences }, { 
      onConflict: 'user_id', 
      ignoreDuplicates: true 
    });

  if (upsertError) {
    // We log this error but don't immediately fail. It might be a transient issue,
    // or an RLS policy issue that still allows SELECTs. The select below is the real source of truth.
    console.error('Error attempting to create default preferences:', upsertError);
  }
  
  // Now, fetch the user's preferences. We use single() because after the upsert,
  // a row should exist (unless the upsert failed due to a policy and no row existed before).
  const { data, error: selectError } = await supabase
    .from('user_preferences')
    .select('theme, default_ultra_mode')
    .eq('user_id', userId)
    .single();

  if (selectError) {
    // This is the critical error. If we can't read the preferences, we must fall back to defaults.
    console.error('Error fetching preferences:', selectError);
    return { ...defaultPreferences };
  }

  return {
    theme: data.theme === 'light' ? 'light' : 'dark',
    default_ultra_mode: data.default_ultra_mode ?? false,
  };
};

export const updateUserPreferences = async (userId: string, prefs: Partial<UserPreferences>) => {
  if (!supabaseReady) throw supabaseNotConfiguredError;
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' });
  
  if (error) {
    console.error('Error updating preferences:', error);
    throw error;
  }
};


// --- Sessions ---

export const getSessions = async (userId: string): Promise<Session[]> => {
  if (!supabaseReady) return []; // Return empty array
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
  // The 'messages' column is stored as JSON, but we want to work with ChatMessage[] in the app.
  // We need to cast it back.
  const sessions = data.map(s => ({
      ...s,
      messages: s.messages as unknown as ChatMessage[],
  }));
  return sessions as Session[];
};

export const createSession = async (userId: string, sessionData: Pick<Session, 'title' | 'messages'>): Promise<Session> => {
  if (!supabaseReady) throw supabaseNotConfiguredError;
  const { data, error } = await supabase
    .from('sessions')
    .insert([{
      user_id: userId,
      title: sessionData.title,
      messages: sessionData.messages as unknown as Json,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw error;
  }
  // Cast the returned session's messages back to ChatMessage[]
  return { ...data, messages: data.messages as unknown as ChatMessage[] } as Session;
};

export const updateSession = async (sessionId: string, updates: Partial<Pick<Session, 'title' | 'messages'>>) => {
  if (!supabaseReady) throw supabaseNotConfiguredError;

  // The 'messages' property needs to be cast to 'Json' if it exists in the update.
  const payload = {
    ...updates,
    ...(updates.messages && { messages: updates.messages as unknown as Json }),
  };

  const { error } = await supabase
    .from('sessions')
    .update(payload)
    .eq('id', sessionId);
  
  if (error) {
    console.error('Error updating session:', error);
    throw error;
  }
};

export const deleteSession = async (sessionId: string) => {
  if (!supabaseReady) throw supabaseNotConfiguredError;
  const { data, error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .select(); // Check what was deleted
  
  if (error) {
    console.error('Error deleting session:', error);
    throw error;
  }

  if (!data || data.length === 0) {
      // This can happen if RLS prevents the delete but doesn't return an error.
      // Throw an error to trigger the UI revert logic.
      const noRowError = new Error("Session not found or permission denied.");
      console.error(noRowError.message, `ID: ${sessionId}`);
      throw noRowError;
  }
};

export const deleteAllUserSessions = async (userId: string) => {
    if (!supabaseReady) throw supabaseNotConfiguredError;
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId);

    if (error) {
        console.error('Error deleting all user sessions:', error);
        throw error;
    }
}