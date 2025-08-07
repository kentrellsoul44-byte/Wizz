
import React, { useState, useRef, useEffect } from 'react';
import type { User } from '../types';
import { SettingsIcon } from './icons/SettingsIcon';
import { LogoutIcon } from './icons/LogoutIcon';

const SunIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>
);

const MoonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);

interface UserProfileProps {
  user: User;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, theme, onToggleTheme, onOpenSettings, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email;
  const avatarUrl = user.user_metadata?.avatar_url;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(prev => !prev)}
        className="flex items-center w-full gap-3 text-left p-2 rounded-md text-text-secondary hover:bg-input-bg hover:text-text-primary transition-colors"
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
      >
        {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full bg-border-color" />
        ) : (
            <span className="h-8 w-8 rounded-full bg-border-color flex items-center justify-center text-text-primary font-bold text-sm">
                {userName?.charAt(0).toUpperCase() || '?'}
            </span>
        )}
        <div className="flex-1 overflow-hidden">
            <span className="text-sm font-medium text-text-primary truncate block">{userName}</span>
            <span className="text-xs text-text-secondary truncate block">{user.email}</span>
        </div>
      </button>

      {isMenuOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-sidebar-bg border border-border-color rounded-lg shadow-xl z-10">
          <div className="p-1">
            <button
              onClick={() => { onToggleTheme(); setIsMenuOpen(false); }}
              className="flex items-center gap-3 w-full text-left p-2 text-sm rounded-md text-text-secondary hover:bg-input-bg hover:text-text-primary transition-colors"
            >
              {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
            </button>
            <button
              onClick={() => { onOpenSettings(); setIsMenuOpen(false); }}
              className="flex items-center gap-3 w-full text-left p-2 text-sm rounded-md text-text-secondary hover:bg-input-bg hover:text-text-primary transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
             <div className="my-1 h-px bg-border-color" />
            <button
              onClick={() => { onLogout(); setIsMenuOpen(false); }}
              className="flex items-center gap-3 w-full text-left p-2 text-sm rounded-md text-accent-red hover:bg-red-500/10 transition-colors"
            >
              <LogoutIcon className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
