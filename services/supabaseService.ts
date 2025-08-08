

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

function isNetworkFetchError(err: unknown): boolean {
  const message = typeof err === 'object' && err !== null ? (err as any).message : String(err);
  return typeof message === 'string' && /Failed to fetch|NetworkError|TypeError: Failed to fetch/i.test(message);
}

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
  // Avoid sending columns that may not exist in the DB schema (e.g., default_ultra_mode) on initial upsert.
  const initialPayload: { user_id: string; theme: 'light' | 'dark' } = {
    user_id: userId,
    theme: defaultPreferences.theme,
  };
  const { error: upsertError } = await supabase
    .from('user_preferences')
    .upsert(initialPayload, {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    });

  if (upsertError) {
    // If network is unavailable, silently fall back to defaults to avoid noisy logs on startup.
    if (isNetworkFetchError(upsertError)) {
      return { ...defaultPreferences };
    }
    // Otherwise warn but continue to attempt a SELECT as source of truth.
    console.warn('Error attempting to create default preferences:', upsertError);
  }
  
  // Now, fetch the user's preferences. We use single() because after the upsert,
  // a row should exist (unless the upsert failed due to a policy and no row existed before).
  let select = supabase
    .from('user_preferences')
    .select('theme, default_ultra_mode')
    .eq('user_id', userId)
    .single();

  let { data, error: selectError } = await select;

  // If the column doesn't exist (42703), retry without it and fall back to default.
  if (selectError && (selectError as any).code === '42703') {
    const retry = await supabase
      .from('user_preferences')
      .select('theme')
      .eq('user_id', userId)
      .single();
    if (retry.error) {
      if (isNetworkFetchError(retry.error)) {
        return { ...defaultPreferences };
      }
      console.error('Error fetching preferences:', retry.error);
      return { ...defaultPreferences };
    }
    return {
      theme: retry.data.theme === 'light' ? 'light' : 'dark',
      default_ultra_mode: false,
    };
  }

  if (selectError) {
    // If we can't read preferences, fall back to defaults. Suppress logs on network errors.
    if (!isNetworkFetchError(selectError)) {
      console.error('Error fetching preferences:', selectError);
    }
    return { ...defaultPreferences };
  }

  return {
    theme: data!.theme === 'light' ? 'light' : 'dark',
    default_ultra_mode: (data as any).default_ultra_mode ?? false,
  };
};

export const updateUserPreferences = async (userId: string, prefs: Partial<UserPreferences>) => {
  if (!supabaseReady) throw supabaseNotConfiguredError;

  // Build payload only with known, supported columns
  const payload: { user_id: string; theme?: 'light' | 'dark'; default_ultra_mode?: boolean } = {
    user_id: userId,
  };
  if (typeof prefs.theme !== 'undefined') payload.theme = prefs.theme;
  if (typeof prefs.default_ultra_mode !== 'undefined') payload.default_ultra_mode = prefs.default_ultra_mode;

  let { error } = await supabase
    .from('user_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  // If the DB doesn't have default_ultra_mode, retry without that column
  if (error && (error as any).code === '42703' && 'default_ultra_mode' in payload) {
    const retryPayload: { user_id: string; theme?: 'light' | 'dark' } = {
      user_id: userId,
      ...(typeof payload.theme !== 'undefined' ? { theme: payload.theme } : {}),
    };
    const retry = await supabase
      .from('user_preferences')
      .upsert(retryPayload, { onConflict: 'user_id' });
    if (retry.error) {
      console.error('Error updating preferences:', retry.error);
      throw retry.error;
    }
    return;
  }
  
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

// --- Storage: Avatar Upload ---

/**
 * Uploads a user's avatar image to Supabase Storage ('avatars' bucket) and returns a public URL.
 * Expects RLS and bucket policies to allow the authenticated user to upload to 'avatars'.
 */
export const uploadAvatar = async (userId: string, file: Blob): Promise<string> => {
  if (!supabaseReady) throw supabaseNotConfiguredError;
  const fileExt = 'jpg';
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (uploadError) {
    console.error('Error uploading avatar:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
};