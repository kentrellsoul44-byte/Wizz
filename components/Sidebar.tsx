
import React, { useState, useRef, useEffect } from 'react';
import type { Session, User } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { UserProfile } from './UserProfile';
import { SearchIcon } from './icons/SearchIcon';

// --- Helper Icons ---
const PencilIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
);

const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.036-2.134H8.718c-1.126 0-2.037.955-2.037 2.134v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);


// --- Session List Item Component ---
interface SessionListItemProps {
  session: Session;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

const SessionListItem: React.FC<SessionListItemProps> = ({ session, isActive, onSelect, onDelete, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    setIsEditing(false);
    if (title.trim() && title.trim() !== session.title) {
        onRename(session.id, title.trim());
    } else {
        setTitle(session.title); // revert if empty or unchanged
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${session.title}"?`)) {
        onDelete(session.id);
    }
  };

  return (
    <div
      onClick={() => onSelect(session.id)}
      className={`group relative flex items-center w-full text-left rounded-md cursor-pointer transition-colors ${
          isActive
            ? 'bg-accent-blue text-white'
            : 'text-text-secondary hover:bg-input-bg hover:text-text-primary'
        }`}
    >
      {isEditing ? (
        <input
            ref={inputRef}
            type="text"
            value={title}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setTitle(session.title);
                }
            }}
            className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none"
        />
      ) : (
        <span className="flex-1 px-4 py-2 text-sm truncate">
          {session.title}
        </span>
      )}
      
      {!isEditing && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-inherit rounded-md">
            <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className={`p-1 ${isActive ? 'hover:bg-blue-400' : 'hover:bg-border-color'} rounded`}
                aria-label="Rename session"
            >
                <PencilIcon className="h-4 w-4" />
            </button>
            <button
                onClick={handleDelete}
                className={`p-1 ${isActive ? 'hover:bg-blue-400' : 'hover:bg-border-color'} rounded`}
                aria-label="Delete session"
            >
                <TrashIcon className="h-4 w-4" />
            </button>
        </div>
      )}
    </div>
  );
};


// --- Main Sidebar Component ---
interface SidebarProps {
  isOpen: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  user: User;
  theme: 'light' | 'dark';
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onToggle: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  sessions,
  activeSessionId,
  user,
  theme,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onToggleTheme,
  onOpenSettings,
  onLogout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(session => 
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside
      className={`bg-sidebar-bg flex flex-col transition-all duration-300 ease-in-out border-r border-border-color ${
        isOpen ? 'w-64' : 'w-0'
      } overflow-hidden`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border-color h-14">
        <h2 className="text-xl font-bold whitespace-nowrap text-text-primary">History</h2>
        <button
          onClick={onNewSession}
          className="p-2 rounded-md hover:bg-input-bg focus:outline-none focus:ring-2 focus:ring-accent-blue"
          aria-label="Create new analysis"
        >
          <PlusIcon className="h-6 w-6 text-text-secondary" />
        </button>
      </div>

      <div className="p-2 border-b border-border-color">
          <div className="relative">
              <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-input-bg border border-transparent rounded-md pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <SearchIcon className="h-4 w-4 text-text-secondary" />
              </div>
          </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSessions.map(session => (
          <SessionListItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
            onRename={onRenameSession}
          />
        ))}
      </nav>
      <div className="p-2 border-t border-border-color">
         <UserProfile
            user={user}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenSettings={onOpenSettings}
            onLogout={onLogout}
          />
      </div>
    </aside>
  );
}
