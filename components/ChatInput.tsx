import React, { useState, useRef, useEffect } from 'react';
import type { ImageData } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { TuneIcon } from './icons/TuneIcon';

interface ChatInputProps {
  onSendMessage: (prompt: string, image: ImageData | null) => void;
  isLoading: boolean;
  onStopGeneration: () => void;
  initialPrompt?: string;
  isUltraMode: boolean;
  onToggleUltraMode: () => void;
}

const fileToImageData = (file: File): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                const dataUrl = event.target.result;
                const base64Data = dataUrl.split(',')[1];
                resolve({
                    mimeType: file.type,
                    data: base64Data,
                });
            } else {
                reject(new Error('Failed to read file as data URL.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};


export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, onStopGeneration, initialPrompt, isUltraMode, onToggleUltraMode }) => {
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUltraMenuOpen, setIsUltraMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const ultraMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      textAreaRef.current?.focus();
    }
  }, [initialPrompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (ultraMenuRef.current && !ultraMenuRef.current.contains(event.target as Node)) {
            setIsUltraMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!prompt.trim() && !imageFile) || isLoading) return;

    let imageData: ImageData | null = null;
    if (imageFile) {
        imageData = await fileToImageData(imageFile);
    }
    
    onSendMessage(prompt, imageData);
    setPrompt('');
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-input-bg border border-border-color rounded-lg p-2 flex flex-col">
      {imagePreview && (
        <div className="p-2 relative">
            <img src={imagePreview} alt="Image preview" className="max-h-24 rounded-md" />
            <button onClick={removeImage} className="absolute top-0 right-0 m-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">&times;</button>
        </div>
      )}
      <div className="flex items-start">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-text-secondary hover:text-text-primary self-center"
          disabled={isLoading}
          aria-label="Attach image"
        >
          <PaperclipIcon className="h-5 w-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
        />
        <div className="relative self-center" ref={ultraMenuRef}>
            <button
                onClick={() => setIsUltraMenuOpen(prev => !prev)}
                className={`p-2 text-text-secondary hover:text-text-primary transition-colors ${isUltraMode ? 'text-accent-blue' : ''}`}
                disabled={isLoading}
                aria-label="Wizz Ultra Settings"
            >
                <TuneIcon className="h-5 w-5" />
            </button>
            {isUltraMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-sidebar-bg border border-border-color rounded-lg shadow-xl z-10 p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-text-primary">Wizz Ultra</h4>
                            <p className="text-xs text-text-secondary">Advanced analysis mode</p>
                        </div>
                        <label htmlFor="ultra-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="ultra-toggle" className="sr-only peer" checked={isUltraMode} onChange={onToggleUltraMode} />
                            <div className="w-11 h-6 bg-border-color peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-accent-blue peer-focus:ring-offset-sidebar-bg rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                        </label>
                    </div>
                    <p className="text-xs text-text-secondary mt-2 border-t border-border-color pt-2">Provides a more detailed, multi-pass analysis for higher accuracy.</p>
                </div>
            )}
        </div>
        <textarea
          ref={textAreaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the chart or ask a question..."
          className="flex-1 bg-transparent resize-none focus:outline-none text-text-primary placeholder-text-secondary px-2 pt-1.5 max-h-28"
          rows={1}
          disabled={isLoading}
        />
        <div className="self-center">
            {isLoading ? (
                <button
                    onClick={onStopGeneration}
                    className="p-2 rounded-md bg-accent-red text-white"
                    aria-label="Stop generation"
                >
                    <StopIcon className="h-5 w-5" />
                </button>
            ) : (
                <button
                    onClick={handleSend}
                    disabled={!prompt.trim() && !imageFile}
                    className="p-2 rounded-md bg-accent-blue text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                    aria-label="Send message"
                >
                    <SendIcon className="h-5 w-5" />
                </button>
            )}
        </div>
      </div>
    </div>
  );
}