import React, { useState, useEffect } from 'react';
import { intelligentCache, getCacheSummary, isCacheHealthy } from '../services/intelligentCacheService';
import type { CacheMetrics, CacheConfig } from '../services/intelligentCacheService';

interface CacheManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CacheManagement: React.FC<CacheManagementProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [config, setConfig] = useState<CacheConfig | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof getCacheSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refresh cache data
  const refreshData = () => {
    setMetrics(intelligentCache.getMetrics());
    setConfig(intelligentCache.getConfig());
    setSummary(getCacheSummary());
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      
      // Auto-refresh every 5 seconds when open
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleClearNamespace = async (namespace: string) => {
    setIsLoading(true);
    try {
      const cleared = intelligentCache.clearNamespace(namespace);
      alert(`Cleared ${cleared} entries from ${namespace} namespace`);
      refreshData();
    } catch (error) {
      alert('Error clearing namespace: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all cache data? This cannot be undone.')) return;
    
    setIsLoading(true);
    try {
      intelligentCache.clearAll();
      alert('All cache data cleared successfully');
      refreshData();
    } catch (error) {
      alert('Error clearing cache: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceCleanup = async () => {
    setIsLoading(true);
    try {
      const cleaned = intelligentCache.forceCleanup();
      alert(`Cleanup completed. Removed ${cleaned} expired entries.`);
      refreshData();
    } catch (error) {
      alert('Error during cleanup: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number): string => {
    return (value * 100).toFixed(1) + '%';
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card-bg border border-border-color rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">Cache Management</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Cache Health Status */}
        {summary && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-text-primary">Cache Health</h3>
              <span className={`px-2 py-1 rounded text-sm font-medium ${
                summary.health === 'HEALTHY' ? 'bg-green-500/20 text-green-400' :
                summary.health === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {summary.health}
              </span>
            </div>
            
            {summary.recommendations.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
                <h4 className="font-medium text-yellow-400 mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
                  {summary.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Cache Metrics */}
        {metrics && config && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-sidebar-bg border border-border-color rounded p-4">
              <h4 className="font-medium text-text-secondary mb-2">Hit Rate</h4>
              <div className="text-2xl font-bold text-text-primary">
                {formatPercentage(metrics.hitRate)}
              </div>
              <div className="text-sm text-text-secondary">
                {metrics.hits} hits / {metrics.misses} misses
              </div>
            </div>

            <div className="bg-sidebar-bg border border-border-color rounded p-4">
              <h4 className="font-medium text-text-secondary mb-2">Cache Size</h4>
              <div className="text-2xl font-bold text-text-primary">
                {formatBytes(metrics.totalSize)}
              </div>
              <div className="text-sm text-text-secondary">
                {formatPercentage(metrics.totalSize / config.maxSize)} of {formatBytes(config.maxSize)}
              </div>
              <div className="w-full bg-border-color rounded-full h-2 mt-2">
                <div 
                  className="bg-accent-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (metrics.totalSize / config.maxSize) * 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-sidebar-bg border border-border-color rounded p-4">
              <h4 className="font-medium text-text-secondary mb-2">Entries</h4>
              <div className="text-2xl font-bold text-text-primary">
                {metrics.entryCount.toLocaleString()}
              </div>
              <div className="text-sm text-text-secondary">
                {metrics.evictions} evicted
              </div>
            </div>

            <div className="bg-sidebar-bg border border-border-color rounded p-4">
              <h4 className="font-medium text-text-secondary mb-2">Avg Access Time</h4>
              <div className="text-2xl font-bold text-text-primary">
                {metrics.avgAccessTime.toFixed(2)}ms
              </div>
              <div className="text-sm text-text-secondary">
                Last cleanup: {formatDuration(Date.now() - metrics.lastCleanup)} ago
              </div>
            </div>
          </div>
        )}

        {/* Cache Configuration */}
        {config && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-sidebar-bg border border-border-color rounded p-4">
                <h4 className="font-medium text-text-secondary mb-2">Storage Settings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Backend:</span>
                    <span className="text-text-primary font-medium">{config.storageBackend}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Max Size:</span>
                    <span className="text-text-primary font-medium">{formatBytes(config.maxSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Compression:</span>
                    <span className="text-text-primary font-medium">{config.enableCompression ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-sidebar-bg border border-border-color rounded p-4">
                <h4 className="font-medium text-text-secondary mb-2">Timing Settings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Default TTL:</span>
                    <span className="text-text-primary font-medium">{formatDuration(config.defaultTTL)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Cleanup Interval:</span>
                    <span className="text-text-primary font-medium">{formatDuration(config.cleanupInterval)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Metrics:</span>
                    <span className="text-text-primary font-medium">{config.enableMetrics ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cache Namespaces */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Cache Namespaces</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(intelligentCache.constructor.NAMESPACES || {}).map(([name, namespace]) => (
              <div key={namespace} className="bg-sidebar-bg border border-border-color rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-text-primary">{name}</h4>
                  <button
                    onClick={() => handleClearNamespace(namespace)}
                    disabled={isLoading}
                    className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="text-sm text-text-secondary">
                  Namespace: <code className="text-accent-blue">{namespace}</code>
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  TTL: {formatDuration((intelligentCache.constructor as any).DEFAULT_TTL?.[name] || config?.defaultTTL || 0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-border-color">
          <button
            onClick={handleForceCleanup}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Force Cleanup'}
          </button>
          
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            Refresh Data
          </button>
          
          <button
            onClick={handleClearAll}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            Clear All Cache
          </button>
          
          <div className="flex-1" />
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-border-color text-text-primary rounded hover:bg-text-secondary/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};