

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import type { UserPreferences } from '../services/supabaseService';
import * as db from '../services/supabaseService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllData: () => Promise<void>;
  user: User;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  onUpdateProfile: (updates: { name?: string, avatar_url?: string}) => Promise<void>;
}

const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onClearAllData, user, preferences, onUpdatePreferences, onUpdateProfile }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(user.user_metadata?.name || user.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      // Reset form fields when modal is opened
      setName(user.user_metadata?.name || user.user_metadata?.full_name || '');
      setAvatarUrl(user.user_metadata?.avatar_url || '');
      setAvatarFile(null);
      setAvatarPreview(null);
      setProfileMessage(null);
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, user]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Crop image to centered square and export to JPEG blob
  const cropToSquare = (image: HTMLImageElement, size = 256): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - minSide) / 2;
    const sy = (image.naturalHeight - minSide) / 2;
    ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, size, size);
    return canvas;
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        // Create cropped square and upload
        const img = new Image();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          img.onload = () => {
            const canvas = cropToSquare(img, 256);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          };
          img.onerror = reject;
          img.src = avatarPreview || '';
        });
        const blob = await (await fetch(dataUrl)).blob();
        const publicUrl = await db.uploadAvatar(user.id, blob);
        finalAvatarUrl = publicUrl;
        setAvatarUrl(publicUrl);
      }
      await onUpdateProfile({ name: name, avatar_url: finalAvatarUrl });
      setProfileMessage({type: 'success', text: 'Profile saved successfully!'});
    } catch (error) {
      setProfileMessage({type: 'error', text: 'Failed to save profile. Please try again.'});
    } finally {
      setIsSavingProfile(false);
      setTimeout(() => setProfileMessage(null), 3000);
    }
  };

  const handleToggleUltraMode = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePreferences({ default_ultra_mode: e.target.checked });
  };



  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 transition-opacity"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-sidebar-bg rounded-lg shadow-2xl w-full max-w-md m-4 border border-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-color">
          <h2 id="settings-title" className="text-lg font-semibold text-text-primary">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-input-bg" aria-label="Close settings">
            <CloseIcon className="h-6 w-6 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Profile Settings */}
          <form onSubmit={handleProfileUpdate}>
            <h3 className="font-medium text-text-primary mb-3">Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-border-color overflow-hidden flex items-center justify-center">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="New avatar preview" className="h-16 w-16 object-cover" />
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-16 w-16 object-cover" />
                    ) : (
                      <span className="text-text-primary">{(user.user_metadata?.name || user.email || '?')[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <input type="file" accept="image/*" onChange={handleAvatarFileChange} />
                    <p className="text-xs text-text-secondary">Upload an image, it will be auto-cropped to a square.</p>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="display-name" className="block text-sm font-medium text-text-secondary mb-1">Display Name</label>
                <input
                  id="display-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-input-bg border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label htmlFor="avatar-url" className="block text-sm font-medium text-text-secondary mb-1">Avatar URL</label>
                <input
                  id="avatar-url"
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-input-bg border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                 {profileMessage && <span className={`text-sm ${profileMessage.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}>{profileMessage.text}</span>}
                 <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-4 py-2 text-sm font-medium text-white bg-accent-blue hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-blue focus:ring-offset-sidebar-bg disabled:bg-gray-500"
                 >
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                 </button>
              </div>
            </div>
          </form>
          
          <div className="border-t border-border-color" />

          {/* Preferences */}
          <div>
            <h3 className="font-medium text-text-primary mb-3">Preferences</h3>
            <div className="flex items-center justify-between bg-input-bg-50 p-3 rounded-lg">
                <div>
                    <label htmlFor="ultra-default" className="font-medium text-text-primary text-sm">Set Ultra Mode as default</label>
                    <p className="text-xs text-text-secondary">Start new analyses with Ultra Mode enabled (includes SMC & Advanced Patterns).</p>
                </div>
                 <label htmlFor="ultra-default-toggle" className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="ultra-default-toggle" className="sr-only peer" checked={preferences.default_ultra_mode} onChange={handleToggleUltraMode} />
                    <div className="w-11 h-6 bg-border-color peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-accent-blue peer-focus:ring-offset-sidebar-bg rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                </label>
            </div>
            

          </div>
          
          <div className="border-t border-border-color" />

          {/* Clear Data */}
          <div>
            <h3 className="font-medium text-text-primary mb-2">Manage Data</h3>
            <p className="text-sm text-text-secondary mb-3">
              This will permanently delete all your chat sessions from your account across all devices. This action cannot be undone.
            </p>
            <button
              onClick={onClearAllData}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-accent-red hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-red focus:ring-offset-sidebar-bg"
            >
              Clear All My Chat History
            </button>
          </div>
        </div>

        <div className="px-4 py-3 bg-chat-bg border-t border-border-color rounded-b-lg text-right">
           <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-primary bg-input-bg border border-border-color rounded-md hover:bg-border-color transition-colors">
             Done
           </button>
        </div>
      </div>
    </div>
  );
}