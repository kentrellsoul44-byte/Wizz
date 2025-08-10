


import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { MenuIcon } from './components/icons/MenuIcon';
import { SettingsModal } from './components/SettingsModal';
import { useAuth } from './auth/useAuth';
import { LoginView } from './components/LoginView';
import { SessionProvider, useSession } from './contexts/SessionContext';
import * as db from './services/supabaseService';
import type { UserPreferences } from './services/supabaseService';

const ConfigErrorScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-brand-bg text-text-primary p-4 text-center">
        <div className="w-20 h-20 bg-accent-red rounded-full mb-6 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
        </div>
        <h1 className="text-3xl font-bold text-text-primary">Configuration Error</h1>
        <p className="text-lg text-text-secondary mt-2 max-w-lg">
            The application's backend is not configured. Please ensure the Supabase URL and anonymous key are correctly set in the environment variables.
        </p>
    </div>
);

const AppContent: React.FC = () => {
    const { user } = useAuth();
    const { activeSession, sessions, isLoading: isSessionLoading, clearAllUserSessions, updateSessionTitle, deleteSession, selectSession, newSession } = useSession();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const [preferences, setPreferences] = useState<UserPreferences>({ theme: 'dark', default_ultra_mode: false });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(preferences.theme);
    }, [preferences.theme]);

    useEffect(() => {
        if (user) {
            db.getUserPreferences(user.id).then(setPreferences);
        } else {
            setPreferences({ theme: 'dark', default_ultra_mode: false }); // Reset to default on logout
        }
    }, [user]);

    const handleUpdatePreferences = useCallback(async (newPrefs: Partial<UserPreferences>) => {
        if (!user) return;
        
        const updatedPrefs = { ...preferences, ...newPrefs };
        setPreferences(updatedPrefs);
        
        try {
            await db.updateUserPreferences(user.id, updatedPrefs);
        } catch (error) {
            console.error("Failed to update preferences:", error);
            // Revert on failure
            setPreferences(preferences);
        }
    }, [preferences, user]);
    
    const handleUpdateProfile = useCallback(async (updates: { name?: string, avatar_url?: string}) => {
        const { updateUserMetadata } = useAuth.getState();
        const { error } = await updateUserMetadata(updates);
        if (error) {
            console.error("Failed to update profile", error);
            throw error;
        }
    }, []);

    const handleClearAllData = useCallback(async () => {
        if (window.confirm('Are you sure you want to clear all chat history for your account? This action cannot be undone.')) {
            await clearAllUserSessions();
            setIsSettingsOpen(false);
        }
    }, [clearAllUserSessions]);

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to log out?')) {
            const { signOut } = useAuth.getState();
            await signOut();
        }
    }
    
    return (
        <>
            <div className="flex h-screen w-full bg-brand-bg text-text-primary font-sans">
                <Sidebar
                    isOpen={isSidebarOpen}
                    sessions={sessions}
                    activeSessionId={activeSession?.id ?? null}
                    onNewSession={newSession}
                    onSelectSession={selectSession}
                    onDeleteSession={deleteSession}
                    onRenameSession={updateSessionTitle}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    user={user!}
                    theme={preferences.theme}
                    onToggleTheme={() => handleUpdatePreferences({ theme: preferences.theme === 'light' ? 'dark' : 'light'})}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onLogout={handleLogout}
                />
                <main className="flex flex-1 flex-col transition-all duration-300 ease-in-out">
                    <div className="flex items-center p-2 border-b border-border-color bg-sidebar-bg h-14">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 rounded-md hover:bg-input-bg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                            aria-label="Toggle sidebar"
                        >
                            <MenuIcon className="h-6 w-6 text-text-secondary" />
                        </button>
                        <h1 className="text-lg font-semibold ml-4">{activeSession?.title || 'Wizz'}</h1>
                    </div>
                    {activeSession ? (
                        <ChatView
                            key={activeSession.id}
                            defaultUltraMode={preferences.default_ultra_mode}
                            defaultQuickProfitMode={preferences.quick_profit_mode}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            {isSessionLoading ? (
                                <div className="h-6 w-6 border-2 border-t-transparent border-accent-blue rounded-full animate-spin"></div>
                            ) : (
                                <p className="text-text-secondary">Select an analysis or start a new one.</p>
                            )}
                        </div>
                    )}
                </main>
            </div>
            {isSettingsOpen && (
                 <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onClearAllData={handleClearAllData}
                    user={user!}
                    preferences={preferences}
                    onUpdatePreferences={handleUpdatePreferences}
                    onUpdateProfile={handleUpdateProfile}
                />
            )}
        </>
    );
}


const App: React.FC = () => {
  if (!db.supabaseReady) {
    return <ConfigErrorScreen />;
  }

  const { user, loading: authLoading, signInWithGoogle, signOut, signInWithEmail, signUpWithEmail } = useAuth();
  
  if (authLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-brand-bg">
            <div className="h-8 w-8 border-4 border-t-transparent border-accent-blue rounded-full animate-spin"></div>
        </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        onGoogleLogin={signInWithGoogle}
        onEmailLogin={signInWithEmail}
        onEmailSignUp={signUpWithEmail}
      />
    );
  }
  
  // By placing SessionProvider here, we ensure it re-initializes on user change
  // and has access to the authenticated user.
  return (
    <SessionProvider user={user}>
        <AppContent />
    </SessionProvider>
  );
};

export default App;