import React, { useState, useRef, useEffect } from 'react';
import type { ImageData, TimeframeImageData } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { TuneIcon } from './icons/TuneIcon';
import { canonicalizeImageToPngBytes, computeSha256Hex } from '../services/determinismService';
import { MultiTimeframeInput } from './MultiTimeframeInput';

interface ChatInputProps {
  onSendMessage: (prompt: string, images: ImageData[]) => void;
  onSendMultiTimeframeMessage?: (prompt: string, timeframeImages: TimeframeImageData[]) => void;
  onSendSMCMessage?: (prompt: string, images: ImageData[]) => void;
  onSendAdvancedPatternMessage?: (prompt: string, images: ImageData[]) => void;
  isLoading: boolean;
  onStopGeneration: () => void;
  initialPrompt?: string;
  isUltraMode: boolean;
  onToggleUltraMode: () => void;
}

const fileToImageData = async (file: File): Promise<ImageData> => {
    const bytes = await canonicalizeImageToPngBytes(file);
    const hash = await computeSha256Hex(bytes);

    // Convert to base64 safely without spreading large arrays
    const blob = new Blob([bytes], { type: 'image/png' });
    const base64Data: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
    });

    return {
        mimeType: 'image/png',
        data: base64Data,
        hash,
    };
};


export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onSendMultiTimeframeMessage,
  onSendSMCMessage,
  onSendAdvancedPatternMessage,
  isLoading, 
  onStopGeneration, 
  initialPrompt, 
  isUltraMode, 
  onToggleUltraMode 
}) => {
  const [prompt, setPrompt] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUltraMenuOpen, setIsUltraMenuOpen] = useState(false);
  const [isMultiTimeframeMode, setIsMultiTimeframeMode] = useState(false);
  const [isSMCMode, setIsSMCMode] = useState(false);
  const [isAdvancedPatternMode, setIsAdvancedPatternMode] = useState(false);
  const [timeframeImages, setTimeframeImages] = useState<TimeframeImageData[]>([]);
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

  const addFiles = (files: FileList | File[]) => {
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    const existingNames = new Set(imageFiles.map(f => f.name + f.size));
    const arr = Array.from(files);
    for (const file of arr) {
      if (!file.type.startsWith('image/')) continue;
      const key = file.name + file.size;
      if (existingNames.has(key)) continue; // avoid simple duplicates
      newFiles.push(file);
    }
    if (newFiles.length === 0) return;
    // Generate previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    setImageFiles(prev => [...prev, ...newFiles]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
    }
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handlePaste: React.ClipboardEventHandler<HTMLDivElement> = (e) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) files.push(file);
      }
    }
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const handleSend = async () => {
    if (isMultiTimeframeMode) {
      if ((!prompt.trim() && timeframeImages.length === 0) || isLoading) return;
      
      if (onSendMultiTimeframeMessage) {
        onSendMultiTimeframeMessage(prompt.trim(), timeframeImages);
        setPrompt('');
        setTimeframeImages([]);
      }
    } else if (isSMCMode) {
      if ((!prompt.trim() && imageFiles.length === 0) || isLoading) return;

      let imagesData: ImageData[] = [];
      if (imageFiles.length > 0) {
          imagesData = await Promise.all(imageFiles.map(fileToImageData));
      }
      
      if (onSendSMCMessage) {
        onSendSMCMessage(prompt, imagesData);
        setPrompt('');
        setImageFiles([]);
        setImagePreviews([]);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    } else if (isAdvancedPatternMode) {
      if ((!prompt.trim() && imageFiles.length === 0) || isLoading) return;

      let imagesData: ImageData[] = [];
      if (imageFiles.length > 0) {
          imagesData = await Promise.all(imageFiles.map(fileToImageData));
      }
      
      if (onSendAdvancedPatternMessage) {
        onSendAdvancedPatternMessage(prompt, imagesData);
        setPrompt('');
        setImageFiles([]);
        setImagePreviews([]);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    } else {
      if ((!prompt.trim() && imageFiles.length === 0) || isLoading) return;

      let imagesData: ImageData[] = [];
      if (imageFiles.length > 0) {
          imagesData = await Promise.all(imageFiles.map(fileToImageData));
      }
      
      onSendMessage(prompt, imagesData);
      setPrompt('');
      setImageFiles([]);
      setImagePreviews([]);
      if(fileInputRef.current) {
          fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const removeImageAt = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if(fileInputRef.current && imageFiles.length === 1) {
        fileInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-input-bg border border-border-color rounded-lg p-2 flex flex-col"
         onDrop={handleDrop}
         onDragOver={(e) => e.preventDefault()}
         onPaste={handlePaste}
    >
      {!isMultiTimeframeMode && imagePreviews.length > 0 && (
        <div className="p-2 grid grid-cols-3 gap-2">
            {imagePreviews.map((src, idx) => (
              <div className="relative" key={idx}>
                <img src={src} alt={`Image preview ${idx+1}`} className="max-h-24 w-full object-cover rounded-md" />
                <button onClick={() => removeImageAt(idx)} className="absolute top-0 right-0 m-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">&times;</button>
              </div>
            ))}
        </div>
      )}
      
      {isMultiTimeframeMode && (
        <div className="p-3 border-b border-border-color">
          <MultiTimeframeInput
            onTimeframeImagesChange={setTimeframeImages}
            disabled={isLoading}
          />
        </div>
      )}
      <div className="flex items-start">
        {!isMultiTimeframeMode && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-text-secondary hover:text-text-primary self-center"
            disabled={isLoading}
            aria-label="Attach images"
          >
            <PaperclipIcon className="h-5 w-5" />
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
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
                    <div className="space-y-3">
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
                        
                                                 <div className="flex items-center justify-between border-t border-border-color pt-3">
                             <div>
                                 <h4 className="font-semibold text-text-primary">Multi-Timeframe</h4>
                                 <p className="text-xs text-text-secondary">Analyze multiple timeframes</p>
                             </div>
                             <label htmlFor="multi-timeframe-toggle" className="relative inline-flex items-center cursor-pointer">
                                 <input 
                                     type="checkbox" 
                                     id="multi-timeframe-toggle" 
                                     className="sr-only peer" 
                                     checked={isMultiTimeframeMode} 
                                     onChange={(e) => {
                                       setIsMultiTimeframeMode(e.target.checked);
                                       if (e.target.checked) {
                                         setIsSMCMode(false);
                                         setIsAdvancedPatternMode(false);
                                       }
                                     }} 
                                 />
                                 <div className="w-11 h-6 bg-border-color peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-accent-blue peer-focus:ring-offset-sidebar-bg rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                             </label>
                         </div>
                         
                                                   <div className="flex items-center justify-between border-t border-border-color pt-3">
                              <div>
                                  <h4 className="font-semibold text-text-primary">Smart Money Concepts</h4>
                                  <p className="text-xs text-text-secondary">Advanced SMC analysis</p>
                              </div>
                              <label htmlFor="smc-toggle" className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      id="smc-toggle" 
                                      className="sr-only peer" 
                                      checked={isSMCMode} 
                                      onChange={(e) => {
                                        setIsSMCMode(e.target.checked);
                                        if (e.target.checked) {
                                          setIsMultiTimeframeMode(false);
                                          setIsAdvancedPatternMode(false);
                                        }
                                      }} 
                                  />
                                  <div className="w-11 h-6 bg-border-color peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-accent-blue peer-focus:ring-offset-sidebar-bg rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                              </label>
                          </div>
                          
                          <div className="flex items-center justify-between border-t border-border-color pt-3">
                              <div>
                                  <h4 className="font-semibold text-text-primary">Advanced Patterns</h4>
                                  <p className="text-xs text-text-secondary">Wyckoff, Elliott Wave, Harmonics</p>
                              </div>
                              <label htmlFor="pattern-toggle" className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      id="pattern-toggle" 
                                      className="sr-only peer" 
                                      checked={isAdvancedPatternMode} 
                                      onChange={(e) => {
                                        setIsAdvancedPatternMode(e.target.checked);
                                        if (e.target.checked) {
                                          setIsMultiTimeframeMode(false);
                                          setIsSMCMode(false);
                                        }
                                      }} 
                                  />
                                  <div className="w-11 h-6 bg-border-color peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-accent-blue peer-focus:ring-offset-sidebar-bg rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                              </label>
                          </div>
                    </div>
                                         <p className="text-xs text-text-secondary mt-2 border-t border-border-color pt-2">
                         {isMultiTimeframeMode 
                             ? 'Upload charts from different timeframes (1H, 4H, 1D) for better confluence analysis.'
                             : isSMCMode
                             ? 'Advanced Smart Money Concepts analysis with order blocks, FVGs, and liquidity detection.'
                             : isAdvancedPatternMode
                             ? 'Institutional-grade pattern recognition: Wyckoff Method, Elliott Wave, Harmonic Patterns, and Volume Profile.'
                             : 'Provides a more detailed, multi-pass analysis for higher accuracy.'
                         }
                     </p>
                </div>
            )}
        </div>
        <textarea
          ref={textAreaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the chart or ask a question... (you can also paste or drag-and-drop images)"
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
                    disabled={!prompt.trim() && imageFiles.length === 0}
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