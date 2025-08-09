import type { 
  AnalysisResult, 
  AdvancedPatternContext, 
  SMCAnalysisContext, 
  MultiTimeframeContext,
  TimeframeType 
} from '../types';

// ========================================
// CACHE TYPE DEFINITIONS
// ========================================

export interface CacheMetadata {
  key: string;
  namespace: string;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccess: number;
  size: number; // Estimated size in bytes
  version: string;
  priority: CachePriority;
  dependencies?: string[]; // Cache keys this depends on
  tags?: string[]; // For bulk invalidation
}

export type CachePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CacheEntry<T = any> {
  data: T;
  metadata: CacheMetadata;
}

// Analysis-specific cache interfaces
export interface AnalysisCacheEntry extends CacheEntry<AnalysisResult> {
  analysisType: 'STANDARD' | 'MULTI_TIMEFRAME' | 'SMC' | 'ADVANCED_PATTERN';
  imageHashes: string[];
  modelVersion: string;
  promptVersion: string;
  ultraMode: boolean;
}

export interface PatternCacheEntry extends CacheEntry<AdvancedPatternContext> {
  timeframe: TimeframeType;
  dataHash: string; // Hash of price/volume data
  patternTypes: string[]; // Which patterns were analyzed
  lookbackPeriods: number;
}

export interface IndicatorCacheEntry extends CacheEntry {
  indicatorType: string;
  parameters: Record<string, any>;
  dataHash: string;
  timeframe: TimeframeType;
  periods: number;
}

export interface MarketStructureCacheEntry extends CacheEntry<SMCAnalysisContext> {
  dataHash: string;
  timeframe: TimeframeType;
  structureTypes: string[]; // Order blocks, FVGs, etc.
  analysisDepth: number;
}

// Cache configuration
export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  enableCompression: boolean;
  enableMetrics: boolean;
  storageBackend: 'localStorage' | 'indexedDB' | 'memory';
}

// Cache metrics
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  evictions: number;
  avgAccessTime: number;
  lastCleanup: number;
}

// ========================================
// INTELLIGENT CACHE MANAGER
// ========================================

export class IntelligentCacheManager {
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private cleanupTimer?: NodeJS.Timeout;
  private storage: Map<string, CacheEntry> = new Map();

  // Cache namespaces for different data types
  static readonly NAMESPACES = {
    ANALYSIS: 'analysis_v2',
    PATTERN: 'pattern_v1',
    INDICATOR: 'indicator_v1',
    MARKET_STRUCTURE: 'smc_v1',
    IMAGE_HASH: 'image_v1',
    METADATA: 'meta_v1'
  } as const;

  // Default TTL values (in milliseconds)
  static readonly DEFAULT_TTL = {
    ANALYSIS: 24 * 60 * 60 * 1000, // 24 hours
    PATTERN: 12 * 60 * 60 * 1000, // 12 hours
    INDICATOR: 6 * 60 * 60 * 1000, // 6 hours
    MARKET_STRUCTURE: 8 * 60 * 60 * 1000, // 8 hours
    IMAGE_HASH: 7 * 24 * 60 * 60 * 1000, // 7 days
    METADATA: 30 * 60 * 1000 // 30 minutes
  } as const;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB default
      defaultTTL: IntelligentCacheManager.DEFAULT_TTL.ANALYSIS,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableCompression: false, // Disabled for simplicity
      enableMetrics: true,
      storageBackend: 'localStorage',
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      evictions: 0,
      avgAccessTime: 0,
      lastCleanup: Date.now()
    };

    this.initializeStorage();
    this.startCleanupTimer();
  }

  // ========================================
  // CORE CACHE OPERATIONS
  // ========================================

  /**
   * Get cache entry with automatic cleanup and metrics
   */
  get<T>(key: string, namespace: string = IntelligentCacheManager.NAMESPACES.ANALYSIS): T | null {
    const startTime = performance.now();
    const fullKey = this.buildFullKey(namespace, key);
    
    try {
      const entry = this.getFromStorage(fullKey);
      
      if (!entry) {
        this.recordMiss();
        return null;
      }

      // Check if expired
      if (this.isExpired(entry.metadata)) {
        this.remove(key, namespace);
        this.recordMiss();
        return null;
      }

      // Update access statistics
      entry.metadata.accessCount++;
      entry.metadata.lastAccess = Date.now();
      this.saveToStorage(fullKey, entry);

      this.recordHit(performance.now() - startTime);
      return entry.data as T;
    } catch (error) {
      console.warn('Cache get error:', error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * Set cache entry with intelligent metadata
   */
  set<T>(
    key: string, 
    data: T, 
    namespace: string = IntelligentCacheManager.NAMESPACES.ANALYSIS,
    options: Partial<CacheMetadata> = {}
  ): boolean {
    try {
      const fullKey = this.buildFullKey(namespace, key);
      const size = this.estimateSize(data);
      
      // Check if we need to evict entries
      if (this.metrics.totalSize + size > this.config.maxSize) {
        this.evictEntries(size);
      }

      const metadata: CacheMetadata = {
        key,
        namespace,
        timestamp: Date.now(),
        ttl: this.getTTLForNamespace(namespace),
        accessCount: 1,
        lastAccess: Date.now(),
        size,
        version: '1.0',
        priority: 'MEDIUM',
        ...options
      };

      const entry: CacheEntry<T> = { data, metadata };
      
      this.saveToStorage(fullKey, entry);
      this.updateMetrics(size, 1);
      
      return true;
    } catch (error) {
      console.warn('Cache set error:', error);
      return false;
    }
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string, namespace: string = IntelligentCacheManager.NAMESPACES.ANALYSIS): boolean {
    try {
      const fullKey = this.buildFullKey(namespace, key);
      const entry = this.getFromStorage(fullKey);
      
      if (entry) {
        this.removeFromStorage(fullKey);
        this.updateMetrics(-entry.metadata.size, -1);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Cache remove error:', error);
      return false;
    }
  }

  /**
   * Clear entire namespace
   */
  clearNamespace(namespace: string): number {
    let cleared = 0;
    
    try {
      const keys = this.getKeysForNamespace(namespace);
      
      for (const key of keys) {
        if (this.remove(key.replace(`${namespace}:`, ''), namespace)) {
          cleared++;
        }
      }
    } catch (error) {
      console.warn('Cache clearNamespace error:', error);
    }
    
    return cleared;
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    
    try {
      const allKeys = this.getAllKeys();
      
      for (const fullKey of allKeys) {
        const entry = this.getFromStorage(fullKey);
        if (entry?.metadata.tags) {
          const hasMatchingTag = tags.some(tag => entry.metadata.tags?.includes(tag));
          if (hasMatchingTag) {
            this.removeFromStorage(fullKey);
            this.updateMetrics(-entry.metadata.size, -1);
            invalidated++;
          }
        }
      }
    } catch (error) {
      console.warn('Cache invalidateByTags error:', error);
    }
    
    return invalidated;
  }

  // ========================================
  // SPECIALIZED CACHE OPERATIONS
  // ========================================

  /**
   * Cache analysis result with comprehensive metadata
   */
  cacheAnalysis(
    imageHashes: string[],
    promptVersion: string,
    modelVersion: string,
    ultraMode: boolean,
    analysisType: AnalysisCacheEntry['analysisType'],
    result: AnalysisResult
  ): string {
    const key = this.buildAnalysisKey(imageHashes, promptVersion, modelVersion, ultraMode);
    
    const metadata: Partial<CacheMetadata> = {
      priority: ultraMode ? 'HIGH' : 'MEDIUM',
      ttl: IntelligentCacheManager.DEFAULT_TTL.ANALYSIS,
      tags: ['analysis', analysisType.toLowerCase(), modelVersion, promptVersion],
      dependencies: imageHashes
    };

    this.set(key, result, IntelligentCacheManager.NAMESPACES.ANALYSIS, metadata);
    return key;
  }

  /**
   * Get cached analysis result
   */
  getCachedAnalysis(
    imageHashes: string[],
    promptVersion: string,
    modelVersion: string,
    ultraMode: boolean
  ): AnalysisResult | null {
    const key = this.buildAnalysisKey(imageHashes, promptVersion, modelVersion, ultraMode);
    return this.get<AnalysisResult>(key, IntelligentCacheManager.NAMESPACES.ANALYSIS);
  }

  /**
   * Cache pattern analysis with pattern-specific metadata
   */
  cachePatternAnalysis(
    dataHash: string,
    timeframe: TimeframeType,
    lookbackPeriods: number,
    patternTypes: string[],
    result: AdvancedPatternContext
  ): string {
    const key = this.buildPatternKey(dataHash, timeframe, lookbackPeriods, patternTypes);
    
    const metadata: Partial<CacheMetadata> = {
      priority: 'HIGH',
      ttl: IntelligentCacheManager.DEFAULT_TTL.PATTERN,
      tags: ['pattern', timeframe, ...patternTypes],
      dependencies: [dataHash]
    };

    this.set(key, result, IntelligentCacheManager.NAMESPACES.PATTERN, metadata);
    return key;
  }

  /**
   * Get cached pattern analysis
   */
  getCachedPatternAnalysis(
    dataHash: string,
    timeframe: TimeframeType,
    lookbackPeriods: number,
    patternTypes: string[]
  ): AdvancedPatternContext | null {
    const key = this.buildPatternKey(dataHash, timeframe, lookbackPeriods, patternTypes);
    return this.get<AdvancedPatternContext>(key, IntelligentCacheManager.NAMESPACES.PATTERN);
  }

  /**
   * Cache indicator calculation
   */
  cacheIndicator(
    indicatorType: string,
    parameters: Record<string, any>,
    dataHash: string,
    timeframe: TimeframeType,
    result: any
  ): string {
    const key = this.buildIndicatorKey(indicatorType, parameters, dataHash, timeframe);
    
    const metadata: Partial<CacheMetadata> = {
      priority: 'MEDIUM',
      ttl: IntelligentCacheManager.DEFAULT_TTL.INDICATOR,
      tags: ['indicator', indicatorType, timeframe],
      dependencies: [dataHash]
    };

    this.set(key, result, IntelligentCacheManager.NAMESPACES.INDICATOR, metadata);
    return key;
  }

  /**
   * Get cached indicator calculation
   */
  getCachedIndicator(
    indicatorType: string,
    parameters: Record<string, any>,
    dataHash: string,
    timeframe: TimeframeType
  ): any {
    const key = this.buildIndicatorKey(indicatorType, parameters, dataHash, timeframe);
    return this.get(key, IntelligentCacheManager.NAMESPACES.INDICATOR);
  }

  /**
   * Cache market structure analysis
   */
  cacheMarketStructure(
    dataHash: string,
    timeframe: TimeframeType,
    structureTypes: string[],
    analysisDepth: number,
    result: SMCAnalysisContext
  ): string {
    const key = this.buildMarketStructureKey(dataHash, timeframe, structureTypes, analysisDepth);
    
    const metadata: Partial<CacheMetadata> = {
      priority: 'HIGH',
      ttl: IntelligentCacheManager.DEFAULT_TTL.MARKET_STRUCTURE,
      tags: ['market_structure', 'smc', timeframe, ...structureTypes],
      dependencies: [dataHash]
    };

    this.set(key, result, IntelligentCacheManager.NAMESPACES.MARKET_STRUCTURE, metadata);
    return key;
  }

  /**
   * Get cached market structure analysis
   */
  getCachedMarketStructure(
    dataHash: string,
    timeframe: TimeframeType,
    structureTypes: string[],
    analysisDepth: number
  ): SMCAnalysisContext | null {
    const key = this.buildMarketStructureKey(dataHash, timeframe, structureTypes, analysisDepth);
    return this.get<SMCAnalysisContext>(key, IntelligentCacheManager.NAMESPACES.MARKET_STRUCTURE);
  }

  // ========================================
  // CACHE KEY BUILDERS
  // ========================================

  private buildAnalysisKey(
    imageHashes: string[],
    promptVersion: string,
    modelVersion: string,
    ultraMode: boolean
  ): string {
    const sortedHashes = [...imageHashes].sort();
    return [
      'analysis',
      modelVersion,
      promptVersion,
      ultraMode ? 'ultra' : 'normal',
      ...sortedHashes
    ].join('|');
  }

  private buildPatternKey(
    dataHash: string,
    timeframe: TimeframeType,
    lookbackPeriods: number,
    patternTypes: string[]
  ): string {
    const sortedTypes = [...patternTypes].sort();
    return [
      'pattern',
      dataHash,
      timeframe,
      lookbackPeriods.toString(),
      ...sortedTypes
    ].join('|');
  }

  private buildIndicatorKey(
    indicatorType: string,
    parameters: Record<string, any>,
    dataHash: string,
    timeframe: TimeframeType
  ): string {
    const paramString = JSON.stringify(parameters, Object.keys(parameters).sort());
    return [
      'indicator',
      indicatorType,
      dataHash,
      timeframe,
      btoa(paramString) // Base64 encode parameters
    ].join('|');
  }

  private buildMarketStructureKey(
    dataHash: string,
    timeframe: TimeframeType,
    structureTypes: string[],
    analysisDepth: number
  ): string {
    const sortedTypes = [...structureTypes].sort();
    return [
      'market_structure',
      dataHash,
      timeframe,
      analysisDepth.toString(),
      ...sortedTypes
    ].join('|');
  }

  private buildFullKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  // ========================================
  // STORAGE ABSTRACTION
  // ========================================

  private initializeStorage(): void {
    if (this.config.storageBackend === 'localStorage') {
      this.loadMetricsFromStorage();
    }
    // Initialize other storage backends as needed
  }

  private getFromStorage(fullKey: string): CacheEntry | null {
    try {
      if (this.config.storageBackend === 'memory') {
        return this.storage.get(fullKey) || null;
      } else if (this.config.storageBackend === 'localStorage') {
        const item = localStorage.getItem(fullKey);
        return item ? JSON.parse(item) : null;
      }
      return null;
    } catch (error) {
      console.warn('Storage get error:', error);
      return null;
    }
  }

  private saveToStorage(fullKey: string, entry: CacheEntry): void {
    try {
      if (this.config.storageBackend === 'memory') {
        this.storage.set(fullKey, entry);
      } else if (this.config.storageBackend === 'localStorage') {
        localStorage.setItem(fullKey, JSON.stringify(entry));
      }
    } catch (error) {
      console.warn('Storage save error:', error);
      // Handle quota exceeded errors
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
      }
    }
  }

  private removeFromStorage(fullKey: string): void {
    try {
      if (this.config.storageBackend === 'memory') {
        this.storage.delete(fullKey);
      } else if (this.config.storageBackend === 'localStorage') {
        localStorage.removeItem(fullKey);
      }
    } catch (error) {
      console.warn('Storage remove error:', error);
    }
  }

  private getAllKeys(): string[] {
    try {
      if (this.config.storageBackend === 'memory') {
        return Array.from(this.storage.keys());
      } else if (this.config.storageBackend === 'localStorage') {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) keys.push(key);
        }
        return keys;
      }
      return [];
    } catch (error) {
      console.warn('Storage getAllKeys error:', error);
      return [];
    }
  }

  private getKeysForNamespace(namespace: string): string[] {
    const prefix = `${namespace}:`;
    return this.getAllKeys().filter(key => key.startsWith(prefix));
  }

  // ========================================
  // CACHE MANAGEMENT & OPTIMIZATION
  // ========================================

  private evictEntries(requiredSpace: number): void {
    // Implement LRU + Priority-based eviction
    const entries = this.getAllCacheEntries();
    
    // Sort by priority (lowest first) and last access (oldest first)
    entries.sort((a, b) => {
      const priorityOrder = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3 };
      const priorityDiff = priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return a.metadata.lastAccess - b.metadata.lastAccess;
    });

    let freedSpace = 0;
    let evicted = 0;
    
    for (const entry of entries) {
      if (freedSpace >= requiredSpace) break;
      if (entry.metadata.priority === 'CRITICAL') continue; // Never evict critical entries
      
      const fullKey = this.buildFullKey(entry.metadata.namespace, entry.metadata.key);
      this.removeFromStorage(fullKey);
      freedSpace += entry.metadata.size;
      evicted++;
    }
    
    this.metrics.evictions += evicted;
    this.updateMetrics(-freedSpace, -evicted);
  }

  private getAllCacheEntries(): CacheEntry[] {
    const entries: CacheEntry[] = [];
    const keys = this.getAllKeys();
    
    for (const fullKey of keys) {
      const entry = this.getFromStorage(fullKey);
      if (entry) entries.push(entry);
    }
    
    return entries;
  }

  private handleQuotaExceeded(): void {
    // Aggressive cleanup when quota is exceeded
    console.warn('Storage quota exceeded, performing aggressive cleanup');
    this.evictEntries(this.config.maxSize * 0.3); // Free 30% of max size
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    const keys = this.getAllKeys();
    for (const fullKey of keys) {
      const entry = this.getFromStorage(fullKey);
      if (entry && this.isExpired(entry.metadata)) {
        this.removeFromStorage(fullKey);
        this.updateMetrics(-entry.metadata.size, -1);
        cleaned++;
      }
    }
    
    this.metrics.lastCleanup = now;
    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private isExpired(metadata: CacheMetadata): boolean {
    return Date.now() > (metadata.timestamp + metadata.ttl);
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1000; // Default size if estimation fails
    }
  }

  private getTTLForNamespace(namespace: string): number {
    switch (namespace) {
      case IntelligentCacheManager.NAMESPACES.ANALYSIS:
        return IntelligentCacheManager.DEFAULT_TTL.ANALYSIS;
      case IntelligentCacheManager.NAMESPACES.PATTERN:
        return IntelligentCacheManager.DEFAULT_TTL.PATTERN;
      case IntelligentCacheManager.NAMESPACES.INDICATOR:
        return IntelligentCacheManager.DEFAULT_TTL.INDICATOR;
      case IntelligentCacheManager.NAMESPACES.MARKET_STRUCTURE:
        return IntelligentCacheManager.DEFAULT_TTL.MARKET_STRUCTURE;
      case IntelligentCacheManager.NAMESPACES.IMAGE_HASH:
        return IntelligentCacheManager.DEFAULT_TTL.IMAGE_HASH;
      case IntelligentCacheManager.NAMESPACES.METADATA:
        return IntelligentCacheManager.DEFAULT_TTL.METADATA;
      default:
        return this.config.defaultTTL;
    }
  }

  private recordHit(accessTime: number): void {
    this.metrics.hits++;
    this.updateHitRate();
    this.updateAvgAccessTime(accessTime);
  }

  private recordMiss(): void {
    this.metrics.misses++;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  private updateAvgAccessTime(accessTime: number): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.avgAccessTime = ((this.metrics.avgAccessTime * (total - 1)) + accessTime) / total;
  }

  private updateMetrics(sizeChange: number, countChange: number): void {
    this.metrics.totalSize = Math.max(0, this.metrics.totalSize + sizeChange);
    this.metrics.entryCount = Math.max(0, this.metrics.entryCount + countChange);
    
    if (this.config.enableMetrics) {
      this.saveMetricsToStorage();
    }
  }

  private loadMetricsFromStorage(): void {
    try {
      const metricsKey = 'wizz_cache_metrics_v1';
      const stored = localStorage.getItem(metricsKey);
      if (stored) {
        this.metrics = { ...this.metrics, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load cache metrics:', error);
    }
  }

  private saveMetricsToStorage(): void {
    try {
      const metricsKey = 'wizz_cache_metrics_v1';
      localStorage.setItem(metricsKey, JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Failed to save cache metrics:', error);
    }
  }

  // ========================================
  // PUBLIC API
  // ========================================

  /**
   * Get cache statistics and metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }

  /**
   * Force cache cleanup
   */
  forceCleanup(): number {
    const beforeCount = this.metrics.entryCount;
    this.cleanup();
    return beforeCount - this.metrics.entryCount;
  }

  /**
   * Clear all cache data
   */
  clearAll(): void {
    try {
      for (const namespace of Object.values(IntelligentCacheManager.NAMESPACES)) {
        this.clearNamespace(namespace);
      }
      
      this.metrics = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalSize: 0,
        entryCount: 0,
        evictions: 0,
        avgAccessTime: 0,
        lastCleanup: Date.now()
      };
      
      if (this.config.storageBackend === 'memory') {
        this.storage.clear();
      }
    } catch (error) {
      console.warn('Cache clearAll error:', error);
    }
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    if (this.config.storageBackend === 'memory') {
      this.storage.clear();
    }
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

// Create and export singleton instance
export const intelligentCache = new IntelligentCacheManager({
  maxSize: 200 * 1024 * 1024, // 200MB
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
  cleanupInterval: 10 * 60 * 1000, // 10 minutes
  enableCompression: false,
  enableMetrics: true,
  storageBackend: 'localStorage'
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Generate data hash for price/volume data
 */
export function generateDataHash(data: any[]): string {
  const dataString = JSON.stringify(data, Object.keys(data[0] || {}).sort());
  return btoa(dataString).slice(0, 32); // Truncated base64 hash
}

/**
 * Create cache-friendly analysis key
 */
export function createAnalysisCacheKey(
  imageHashes: string[],
  promptVersion: string,
  modelVersion: string,
  ultraMode: boolean
): string {
  return intelligentCache['buildAnalysisKey'](imageHashes, promptVersion, modelVersion, ultraMode);
}

/**
 * Check if cache is healthy (not over quota)
 */
export function isCacheHealthy(): boolean {
  const metrics = intelligentCache.getMetrics();
  const config = intelligentCache.getConfig();
  return metrics.totalSize < (config.maxSize * 0.9); // Less than 90% of max size
}

/**
 * Get cache summary for debugging
 */
export function getCacheSummary(): {
  metrics: CacheMetrics;
  health: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  recommendations: string[];
} {
  const metrics = intelligentCache.getMetrics();
  const config = intelligentCache.getConfig();
  const sizeRatio = metrics.totalSize / config.maxSize;
  
  let health: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  const recommendations: string[] = [];
  
  if (sizeRatio > 0.9) {
    health = 'CRITICAL';
    recommendations.push('Cache is near capacity. Consider clearing old entries or increasing max size.');
  } else if (sizeRatio > 0.7) {
    health = 'WARNING';
    recommendations.push('Cache usage is high. Monitor for performance impact.');
  }
  
  if (metrics.hitRate < 0.3) {
    recommendations.push('Low hit rate detected. Consider adjusting TTL values or cache strategy.');
  }
  
  if (metrics.avgAccessTime > 10) {
    recommendations.push('High average access time. Consider optimizing storage backend.');
  }
  
  return {
    metrics,
    health,
    recommendations
  };
}