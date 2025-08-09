import React, { useState, useRef } from 'react';
import type { TimeframeImageData, TimeframeType, ImageData } from '../types';
import { canonicalizeImageToPngBytes, computeSha256Hex } from '../services/determinismService';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { TrashIcon } from './icons/TrashIcon';

interface MultiTimeframeInputProps {
  onTimeframeImagesChange: (images: TimeframeImageData[]) => void;
  disabled?: boolean;
}

const TIMEFRAME_OPTIONS: { value: TimeframeType; label: string }[] = [
  { value: '1M', label: '1 Minute' },
  { value: '5M', label: '5 Minutes' },
  { value: '15M', label: '15 Minutes' },
  { value: '30M', label: '30 Minutes' },
  { value: '1H', label: '1 Hour' },
  { value: '4H', label: '4 Hours' },
  { value: '12H', label: '12 Hours' },
  { value: '1D', label: '1 Day' },
  { value: '3D', label: '3 Days' },
  { value: '1W', label: '1 Week' },
  { value: '1M_MONTHLY', label: '1 Month' },
];

const fileToImageData = async (file: File): Promise<ImageData> => {
  const bytes = await canonicalizeImageToPngBytes(file);
  const hash = await computeSha256Hex(bytes);

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

export const MultiTimeframeInput: React.FC<MultiTimeframeInputProps> = ({
  onTimeframeImagesChange,
  disabled = false,
}) => {
  const [timeframeImages, setTimeframeImages] = useState<TimeframeImageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      const newTimeframeImages: TimeframeImageData[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const imageData = await fileToImageData(file);
          
          // Default timeframe based on common patterns or user can change later
          const defaultTimeframe: TimeframeType = i === 0 ? '1H' : i === 1 ? '4H' : '1D';
          
          newTimeframeImages.push({
            imageData,
            timeframe: defaultTimeframe,
            label: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          });
        }
      }

      const updatedImages = [...timeframeImages, ...newTimeframeImages];
      setTimeframeImages(updatedImages);
      onTimeframeImagesChange(updatedImages);
    } catch (error) {
      console.error('Error processing images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTimeframe = (index: number, timeframe: TimeframeType) => {
    const updated = [...timeframeImages];
    updated[index] = { ...updated[index], timeframe };
    setTimeframeImages(updated);
    onTimeframeImagesChange(updated);
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...timeframeImages];
    updated[index] = { ...updated[index], label };
    setTimeframeImages(updated);
    onTimeframeImagesChange(updated);
  };

  const removeImage = (index: number) => {
    const updated = timeframeImages.filter((_, i) => i !== index);
    setTimeframeImages(updated);
    onTimeframeImagesChange(updated);
  };

  const getImagePreviewUrl = (imageData: ImageData): string => {
    return `data:${imageData.mimeType};base64,${imageData.data}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text-primary">Multi-Timeframe Analysis</h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-accent-blue hover:text-blue-700 disabled:opacity-50"
        >
          <PaperclipIcon className="h-4 w-4 mr-1" />
          Add Charts
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png, image/jpeg, image/webp"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 border-2 border-t-transparent border-accent-blue rounded-full animate-spin"></div>
          <span className="ml-2 text-sm text-text-secondary">Processing images...</span>
        </div>
      )}

      {timeframeImages.length > 0 && (
        <div className="space-y-3">
          {timeframeImages.map((tfImage, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-input-bg-50 rounded-lg border border-border-color"
            >
              <div className="flex-shrink-0">
                <img
                  src={getImagePreviewUrl(tfImage.imageData)}
                  alt={`Chart ${index + 1}`}
                  className="h-16 w-16 object-cover rounded border border-border-color"
                />
              </div>
              
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Chart Label
                  </label>
                  <input
                    type="text"
                    value={tfImage.label || ''}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    placeholder="e.g., Bitcoin 4H Chart"
                    className="w-full px-2 py-1 text-sm bg-input-bg border border-border-color rounded focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    disabled={disabled}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Timeframe
                  </label>
                  <select
                    value={tfImage.timeframe}
                    onChange={(e) => updateTimeframe(index, e.target.value as TimeframeType)}
                    className="w-full px-2 py-1 text-sm bg-input-bg border border-border-color rounded focus:outline-none focus:ring-1 focus:ring-accent-blue"
                    disabled={disabled}
                  >
                    {TIMEFRAME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={disabled}
                className="flex-shrink-0 p-1 text-text-secondary hover:text-accent-red transition-colors disabled:opacity-50"
                aria-label="Remove chart"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {timeframeImages.length === 0 && !isLoading && (
        <div className="text-center py-8 bg-input-bg-50 rounded-lg border-2 border-dashed border-border-color">
          <PaperclipIcon className="h-8 w-8 mx-auto text-text-secondary mb-2" />
          <p className="text-sm text-text-secondary">
            Upload multiple chart images for multi-timeframe analysis
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Add charts from different timeframes (1H, 4H, 1D, etc.) for better confluence
          </p>
        </div>
      )}

      {timeframeImages.length > 0 && (
        <div className="text-xs text-text-secondary">
          <p>
            <strong>Tip:</strong> Include different timeframes (e.g., 1H, 4H, 1D) for better analysis confluence.
            Higher timeframes provide trend context while lower timeframes refine entry timing.
          </p>
        </div>
      )}
    </div>
  );
};