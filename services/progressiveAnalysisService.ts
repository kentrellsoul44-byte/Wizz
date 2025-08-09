import type { 
  AnalysisResult, 
  AnalysisPhase, 
  ProgressiveAnalysisResult,
  ProgressiveAnalysisConfig,
  ProgressiveStreamEvent,
  ProgressiveAnalysisState,
  ProgressiveAnalysisPhase,
  ImageData,
  ChatMessage,
  TimeframeImageData
} from '../types';

import { intelligentCache } from './intelligentCacheService';
import { applyPostProcessingGates } from './postProcessingService';
import { analyzeChartStream, analyzeMultiTimeframeStream, analyzeSMCStream, analyzeAdvancedPatternsStream } from './geminiService';

// ========================================
// PROGRESSIVE ANALYSIS ORCHESTRATOR
// ========================================

export class ProgressiveAnalysisOrchestrator {
  private activeAnalyses: Map<string, ProgressiveAnalysisState> = new Map();
  private config: ProgressiveAnalysisConfig;
  private eventListeners: Map<string, Set<(event: ProgressiveStreamEvent) => void>> = new Map();

  // Default configuration for progressive analysis
  static readonly DEFAULT_CONFIG: ProgressiveAnalysisConfig = {
    enableProgressive: true,
    phaseTimeouts: {
      overview: 15000, // 15 seconds for quick overview
      detailed: 45000, // 45 seconds for detailed analysis
      verification: 30000 // 30 seconds for final verification
    },
    confidenceThresholds: {
      overview: 30, // 30% confidence for overview
      detailed: 70, // 70% confidence for detailed
      verification: 95 // 95% confidence for final
    },
    allowPhaseSkipping: true,
    enablePhasePreview: true,
    cachePhasesIndependently: true
  };

  constructor(config: Partial<ProgressiveAnalysisConfig> = {}) {
    this.config = { ...ProgressiveAnalysisOrchestrator.DEFAULT_CONFIG, ...config };
  }

  /**
   * Start progressive analysis with streaming updates
   */
  async *startProgressiveAnalysis(
    analysisType: 'STANDARD' | 'MULTI_TIMEFRAME' | 'SMC' | 'ADVANCED_PATTERN',
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): AsyncGenerator<ProgressiveStreamEvent> {
    
    const analysisId = this.generateAnalysisId();
    const startTime = Date.now();
    
    // Initialize progressive analysis state
    const state: ProgressiveAnalysisState = {
      analysisId,
      isActive: true,
      currentPhase: 'OVERVIEW',
      phases: {
        overview: { status: 'PENDING', confidence: 0 },
        detailed: { status: 'PENDING', confidence: 0 },
        verification: { status: 'PENDING', confidence: 0 }
      },
      overallProgress: 0,
      estimatedTotalTime: this.estimateAnalysisTime(analysisType, isUltraMode)
    };

    this.activeAnalyses.set(analysisId, state);

    try {
      // Phase 1: Quick Overview (30% confidence)
      yield* this.executeOverviewPhase(
        analysisId, analysisType, prompt, images, timeframeImages, history, isUltraMode, signal
      );

      if (signal.aborted) return;

      // Phase 2: Detailed Analysis (70% confidence)
      yield* this.executeDetailedPhase(
        analysisId, analysisType, prompt, images, timeframeImages, history, isUltraMode, signal
      );

      if (signal.aborted) return;

      // Phase 3: Final Verification (100% confidence)
      yield* this.executeVerificationPhase(
        analysisId, analysisType, prompt, images, timeframeImages, history, isUltraMode, signal
      );

      // Mark analysis as complete
      const finalState = this.activeAnalyses.get(analysisId);
      if (finalState) {
        finalState.isActive = false;
        finalState.actualTotalTime = Date.now() - startTime;
        finalState.overallProgress = 100;
      }

      yield {
        type: 'ANALYSIS_COMPLETE',
        phase: 'VERIFICATION',
        progress: 100,
        confidence: this.config.confidenceThresholds.verification,
        timestamp: Date.now(),
        metadata: {
          processingTime: Date.now() - startTime,
          dataSize: JSON.stringify({ prompt, images }).length,
          cacheHit: false
        }
      };

    } catch (error) {
      yield {
        type: 'PHASE_ERROR',
        phase: state.currentPhase,
        progress: state.overallProgress,
        confidence: 0,
        timestamp: Date.now(),
        metadata: {
          processingTime: Date.now() - startTime,
          dataSize: 0,
          cacheHit: false,
          errorDetails: error instanceof Error ? error.message : String(error)
        }
      };
    } finally {
      this.activeAnalyses.delete(analysisId);
    }
  }

  /**
   * Phase 1: Quick Overview Analysis
   */
  private async *executeOverviewPhase(
    analysisId: string,
    analysisType: string,
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): AsyncGenerator<ProgressiveStreamEvent> {
    
    const state = this.activeAnalyses.get(analysisId);
    if (!state) return;

    const phaseStartTime = Date.now();
    state.currentPhase = 'OVERVIEW';
    state.phases.overview.status = 'IN_PROGRESS';
    state.phases.overview.startTime = phaseStartTime;

    yield {
      type: 'PHASE_START',
      phase: 'OVERVIEW',
      progress: 0,
      confidence: 0,
      timestamp: phaseStartTime,
      metadata: {
        processingTime: 0,
        dataSize: JSON.stringify({ prompt, images }).length,
        cacheHit: false
      }
    };

    try {
      // Check cache for overview phase
      const cacheKey = this.buildPhaseCacheKey(analysisId, 'OVERVIEW', images, prompt);
      const cachedOverview = this.getCachedPhaseResult(cacheKey, 'OVERVIEW');
      
      if (cachedOverview) {
        state.phases.overview.result = cachedOverview;
        state.phases.overview.confidence = this.config.confidenceThresholds.overview;
        state.phases.overview.status = 'COMPLETED';
        state.phases.overview.endTime = Date.now();
        state.overallProgress = 33;

        yield {
          type: 'PHASE_COMPLETE',
          phase: 'OVERVIEW',
          data: cachedOverview,
          progress: 33,
          confidence: this.config.confidenceThresholds.overview,
          timestamp: Date.now(),
          metadata: {
            processingTime: Date.now() - phaseStartTime,
            dataSize: JSON.stringify(cachedOverview).length,
            cacheHit: true
          }
        };
        return;
      }

      // Generate quick overview analysis
      const overviewPrompt = this.generateOverviewPrompt(prompt, analysisType);
      const overviewResult = await this.runQuickAnalysis(
        analysisType, overviewPrompt, images, timeframeImages, history, false, signal // Force normal mode for speed
      );

      if (signal.aborted) return;

      // Process and validate overview result
      const processedOverview = this.processOverviewResult(overviewResult);
      
      state.phases.overview.result = processedOverview;
      state.phases.overview.confidence = this.config.confidenceThresholds.overview;
      state.phases.overview.status = 'COMPLETED';
      state.phases.overview.endTime = Date.now();
      state.overallProgress = 33;

      // Cache overview result
      if (this.config.cachePhasesIndependently) {
        this.cachePhaseResult(cacheKey, processedOverview, 'OVERVIEW');
      }

      yield {
        type: 'PHASE_COMPLETE',
        phase: 'OVERVIEW',
        data: processedOverview,
        progress: 33,
        confidence: this.config.confidenceThresholds.overview,
        timestamp: Date.now(),
        metadata: {
          processingTime: Date.now() - phaseStartTime,
          dataSize: JSON.stringify(processedOverview).length,
          cacheHit: false
        }
      };

    } catch (error) {
      state.phases.overview.status = 'ERROR';
      throw error;
    }
  }

  /**
   * Phase 2: Detailed Analysis
   */
  private async *executeDetailedPhase(
    analysisId: string,
    analysisType: string,
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): AsyncGenerator<ProgressiveStreamEvent> {
    
    const state = this.activeAnalyses.get(analysisId);
    if (!state) return;

    const phaseStartTime = Date.now();
    state.currentPhase = 'DETAILED';
    state.phases.detailed.status = 'IN_PROGRESS';
    state.phases.detailed.startTime = phaseStartTime;

    yield {
      type: 'PHASE_START',
      phase: 'DETAILED',
      progress: 33,
      confidence: this.config.confidenceThresholds.overview,
      timestamp: phaseStartTime,
      metadata: {
        processingTime: 0,
        dataSize: JSON.stringify({ prompt, images }).length,
        cacheHit: false
      }
    };

    try {
      // Check cache for detailed phase
      const cacheKey = this.buildPhaseCacheKey(analysisId, 'DETAILED', images, prompt);
      const cachedDetailed = this.getCachedPhaseResult(cacheKey, 'DETAILED');
      
      if (cachedDetailed) {
        state.phases.detailed.result = cachedDetailed;
        state.phases.detailed.confidence = this.config.confidenceThresholds.detailed;
        state.phases.detailed.status = 'COMPLETED';
        state.phases.detailed.endTime = Date.now();
        state.overallProgress = 66;

        yield {
          type: 'PHASE_COMPLETE',
          phase: 'DETAILED',
          data: cachedDetailed,
          progress: 66,
          confidence: this.config.confidenceThresholds.detailed,
          timestamp: Date.now(),
          metadata: {
            processingTime: Date.now() - phaseStartTime,
            dataSize: JSON.stringify(cachedDetailed).length,
            cacheHit: true
          }
        };
        return;
      }

      // Generate detailed analysis using overview context
      const detailedPrompt = this.generateDetailedPrompt(prompt, analysisType, state.phases.overview.result);
      const detailedResult = await this.runDetailedAnalysis(
        analysisType, detailedPrompt, images, timeframeImages, history, isUltraMode, signal
      );

      if (signal.aborted) return;

      // Process and validate detailed result
      const processedDetailed = this.processDetailedResult(detailedResult, state.phases.overview.result);
      
      state.phases.detailed.result = processedDetailed;
      state.phases.detailed.confidence = this.config.confidenceThresholds.detailed;
      state.phases.detailed.status = 'COMPLETED';
      state.phases.detailed.endTime = Date.now();
      state.overallProgress = 66;

      // Cache detailed result
      if (this.config.cachePhasesIndependently) {
        this.cachePhaseResult(cacheKey, processedDetailed, 'DETAILED');
      }

      yield {
        type: 'PHASE_COMPLETE',
        phase: 'DETAILED',
        data: processedDetailed,
        progress: 66,
        confidence: this.config.confidenceThresholds.detailed,
        timestamp: Date.now(),
        metadata: {
          processingTime: Date.now() - phaseStartTime,
          dataSize: JSON.stringify(processedDetailed).length,
          cacheHit: false
        }
      };

    } catch (error) {
      state.phases.detailed.status = 'ERROR';
      throw error;
    }
  }

  /**
   * Phase 3: Final Verification
   */
  private async *executeVerificationPhase(
    analysisId: string,
    analysisType: string,
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): AsyncGenerator<ProgressiveStreamEvent> {
    
    const state = this.activeAnalyses.get(analysisId);
    if (!state) return;

    const phaseStartTime = Date.now();
    state.currentPhase = 'VERIFICATION';
    state.phases.verification.status = 'IN_PROGRESS';
    state.phases.verification.startTime = phaseStartTime;

    yield {
      type: 'PHASE_START',
      phase: 'VERIFICATION',
      progress: 66,
      confidence: this.config.confidenceThresholds.detailed,
      timestamp: phaseStartTime,
      metadata: {
        processingTime: 0,
        dataSize: JSON.stringify({ prompt, images }).length,
        cacheHit: false
      }
    };

    try {
      // Check cache for verification phase
      const cacheKey = this.buildPhaseCacheKey(analysisId, 'VERIFICATION', images, prompt);
      const cachedVerification = this.getCachedPhaseResult(cacheKey, 'VERIFICATION');
      
      if (cachedVerification) {
        state.phases.verification.result = cachedVerification as AnalysisResult;
        state.phases.verification.confidence = this.config.confidenceThresholds.verification;
        state.phases.verification.status = 'COMPLETED';
        state.phases.verification.endTime = Date.now();
        state.overallProgress = 100;

        yield {
          type: 'PHASE_COMPLETE',
          phase: 'VERIFICATION',
          data: cachedVerification,
          progress: 100,
          confidence: this.config.confidenceThresholds.verification,
          timestamp: Date.now(),
          metadata: {
            processingTime: Date.now() - phaseStartTime,
            dataSize: JSON.stringify(cachedVerification).length,
            cacheHit: true
          }
        };
        return;
      }

      // Generate final verification analysis
      const verificationPrompt = this.generateVerificationPrompt(
        prompt, analysisType, state.phases.overview.result, state.phases.detailed.result
      );
      const verificationResult = await this.runFullAnalysis(
        analysisType, verificationPrompt, images, timeframeImages, history, isUltraMode, signal
      );

      if (signal.aborted) return;

      // Apply post-processing gates for final result
      const finalResult = applyPostProcessingGates(verificationResult, isUltraMode);
      
      state.phases.verification.result = finalResult;
      state.phases.verification.confidence = this.config.confidenceThresholds.verification;
      state.phases.verification.status = 'COMPLETED';
      state.phases.verification.endTime = Date.now();
      state.overallProgress = 100;

      // Cache verification result
      if (this.config.cachePhasesIndependently) {
        this.cachePhaseResult(cacheKey, finalResult, 'VERIFICATION');
      }

      yield {
        type: 'PHASE_COMPLETE',
        phase: 'VERIFICATION',
        data: finalResult,
        progress: 100,
        confidence: this.config.confidenceThresholds.verification,
        timestamp: Date.now(),
        metadata: {
          processingTime: Date.now() - phaseStartTime,
          dataSize: JSON.stringify(finalResult).length,
          cacheHit: false
        }
      };

    } catch (error) {
      state.phases.verification.status = 'ERROR';
      throw error;
    }
  }

  // ========================================
  // PROMPT GENERATION FOR PHASES
  // ========================================

  private generateOverviewPrompt(originalPrompt: string, analysisType: string): string {
    const phaseContext = `
**QUICK OVERVIEW ANALYSIS (Phase 1/3)**

You are providing a RAPID initial assessment with ~30% confidence. Focus on:
- Immediate visual patterns and obvious signals
- Basic trend direction and momentum
- Key support/resistance levels
- Simple risk assessment

Keep analysis concise and focus on the most apparent technical indicators.
Time limit: 15 seconds maximum.

Original request: ${originalPrompt}
`;

    return phaseContext;
  }

  private generateDetailedPrompt(
    originalPrompt: string, 
    analysisType: string, 
    overviewResult?: Partial<AnalysisResult>
  ): string {
    const overviewSummary = overviewResult ? 
      `Previous overview found: ${overviewResult.summary || 'Basic analysis completed'}` : 
      'No previous overview available';

    const phaseContext = `
**DETAILED ANALYSIS (Phase 2/3)**

Building on the initial overview with ~70% confidence. Focus on:
- Comprehensive technical indicator analysis
- Multiple timeframe correlation
- Advanced pattern recognition
- Detailed risk/reward calculations
- Market structure analysis

${overviewSummary}

Expand and refine the analysis with deeper technical insights.
Time limit: 45 seconds maximum.

Original request: ${originalPrompt}
`;

    return phaseContext;
  }

  private generateVerificationPrompt(
    originalPrompt: string,
    analysisType: string,
    overviewResult?: Partial<AnalysisResult>,
    detailedResult?: Partial<AnalysisResult>
  ): string {
    const previousAnalysis = `
Overview phase: ${overviewResult?.summary || 'Not available'}
Detailed phase: ${detailedResult?.summary || 'Not available'}
`;

    const phaseContext = `
**FINAL VERIFICATION (Phase 3/3)**

Final verification with ~95% confidence. Focus on:
- Cross-validation of previous phases
- Error checking and consistency verification
- Final confidence assessment
- Risk management optimization
- Complete trade setup verification

Previous analysis summary:
${previousAnalysis}

Provide the most accurate and verified analysis possible.
Time limit: 30 seconds maximum.

Original request: ${originalPrompt}
`;

    return phaseContext;
  }

  // ========================================
  // ANALYSIS EXECUTION METHODS
  // ========================================

  private async runQuickAnalysis(
    analysisType: string,
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): Promise<AnalysisResult> {
    
    let fullResponse = '';
    
    // Choose appropriate analysis stream based on type
    let stream: AsyncGenerator<string>;
    
    switch (analysisType) {
      case 'MULTI_TIMEFRAME':
        if (!timeframeImages) throw new Error('Timeframe images required for multi-timeframe analysis');
        stream = analyzeMultiTimeframeStream(history, prompt, timeframeImages, signal, isUltraMode);
        break;
      case 'SMC':
        stream = analyzeSMCStream(history, prompt, images, signal, isUltraMode);
        break;
      case 'ADVANCED_PATTERN':
        stream = analyzeAdvancedPatternsStream(history, prompt, images, signal, isUltraMode);
        break;
      default:
        stream = analyzeChartStream(history, prompt, images, signal, isUltraMode);
    }
    
    // Collect streaming response
    for await (const chunk of stream) {
      if (signal.aborted) break;
      fullResponse += chunk;
    }
    
    // Parse JSON response
    const cleanedResponse = this.sanitizeJsonResponse(fullResponse);
    return JSON.parse(cleanedResponse) as AnalysisResult;
  }

  private async runDetailedAnalysis(
    analysisType: string,
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): Promise<AnalysisResult> {
    // Same as runQuickAnalysis but with more processing time allowed
    return this.runQuickAnalysis(analysisType, prompt, images, timeframeImages, history, isUltraMode, signal);
  }

  private async runFullAnalysis(
    analysisType: string,
    prompt: string,
    images: ImageData[],
    timeframeImages: TimeframeImageData[] | null,
    history: ChatMessage[],
    isUltraMode: boolean,
    signal: AbortSignal
  ): Promise<AnalysisResult> {
    // Full analysis with all features enabled
    return this.runQuickAnalysis(analysisType, prompt, images, timeframeImages, history, isUltraMode, signal);
  }

  // ========================================
  // RESULT PROCESSING METHODS
  // ========================================

  private processOverviewResult(result: AnalysisResult): Partial<AnalysisResult> {
    // Extract key information for overview phase
    return {
      summary: result.summary,
      signal: result.signal,
      confidence: 'LOW', // Override to LOW confidence
      overallConfidenceScore: Math.min(result.overallConfidenceScore || 0, this.config.confidenceThresholds.overview),
      thinkingProcess: this.truncateThinkingProcess(result.thinkingProcess, 500),
      timeframe: result.timeframe
    };
  }

  private processDetailedResult(
    result: AnalysisResult, 
    overviewResult?: Partial<AnalysisResult>
  ): Partial<AnalysisResult> {
    // Combine overview with detailed analysis
    return {
      ...result,
      confidence: 'HIGH',
      overallConfidenceScore: Math.min(result.overallConfidenceScore || 0, this.config.confidenceThresholds.detailed),
      thinkingProcess: this.truncateThinkingProcess(result.thinkingProcess, 1500),
      // Preserve overview insights
      previousPhaseInsights: overviewResult?.summary
    };
  }

  // ========================================
  // CACHING METHODS
  // ========================================

  private buildPhaseCacheKey(
    analysisId: string,
    phase: AnalysisPhase,
    images: ImageData[],
    prompt: string
  ): string {
    const imageHashes = images.map(img => img.hash || '').filter(Boolean);
    const promptHash = btoa(prompt).slice(0, 16);
    return `progressive_${phase.toLowerCase()}_${promptHash}_${imageHashes.join('_')}`;
  }

  private getCachedPhaseResult(cacheKey: string, phase: AnalysisPhase): Partial<AnalysisResult> | null {
    if (!this.config.cachePhasesIndependently) return null;
    
    try {
      return intelligentCache.get(cacheKey, `progressive_${phase.toLowerCase()}`);
    } catch (error) {
      console.warn('Failed to get cached phase result:', error);
      return null;
    }
  }

  private cachePhaseResult(
    cacheKey: string, 
    result: Partial<AnalysisResult>, 
    phase: AnalysisPhase
  ): void {
    if (!this.config.cachePhasesIndependently) return;
    
    try {
      const ttl = phase === 'OVERVIEW' ? 30 * 60 * 1000 : // 30 minutes
                  phase === 'DETAILED' ? 60 * 60 * 1000 : // 1 hour
                  24 * 60 * 60 * 1000; // 24 hours for verification
      
      intelligentCache.set(cacheKey, result, `progressive_${phase.toLowerCase()}`, {
        ttl,
        priority: phase === 'VERIFICATION' ? 'HIGH' : 'MEDIUM',
        tags: ['progressive', phase.toLowerCase()]
      });
    } catch (error) {
      console.warn('Failed to cache phase result:', error);
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private generateAnalysisId(): string {
    return `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateAnalysisTime(analysisType: string, isUltraMode: boolean): number {
    const baseTime = analysisType === 'STANDARD' ? 60000 : 90000; // 1-1.5 minutes
    const ultraMultiplier = isUltraMode ? 1.5 : 1;
    return baseTime * ultraMultiplier;
  }

  private truncateThinkingProcess(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '\n\n[Analysis continues in next phase...]';
  }

  private sanitizeJsonResponse(text: string): string {
    // Find JSON content between first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw new Error('No valid JSON found in response');
    }
    
    return text.substring(firstBrace, lastBrace + 1);
  }

  // ========================================
  // PUBLIC API METHODS
  // ========================================

  /**
   * Get current state of progressive analysis
   */
  getAnalysisState(analysisId: string): ProgressiveAnalysisState | null {
    return this.activeAnalyses.get(analysisId) || null;
  }

  /**
   * Get all active analyses
   */
  getActiveAnalyses(): ProgressiveAnalysisState[] {
    return Array.from(this.activeAnalyses.values());
  }

  /**
   * Cancel progressive analysis
   */
  cancelAnalysis(analysisId: string): boolean {
    const state = this.activeAnalyses.get(analysisId);
    if (state) {
      state.isActive = false;
      this.activeAnalyses.delete(analysisId);
      return true;
    }
    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ProgressiveAnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ProgressiveAnalysisConfig {
    return { ...this.config };
  }

  /**
   * Clear phase caches
   */
  clearPhaseCache(phase?: AnalysisPhase): number {
    const namespace = phase ? `progressive_${phase.toLowerCase()}` : 'progressive';
    return intelligentCache.clearNamespace(namespace);
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

export const progressiveAnalysis = new ProgressiveAnalysisOrchestrator();

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Create a progressive analysis result from phase results
 */
export function createProgressiveResult(
  phases: {
    overview?: Partial<AnalysisResult>;
    detailed?: Partial<AnalysisResult>;
    verification?: AnalysisResult;
  },
  currentPhase: AnalysisPhase,
  progress: number
): ProgressiveAnalysisResult {
  const baseResult = phases.verification || phases.detailed || phases.overview || {};
  
  return {
    ...baseResult,
    isProgressive: true,
    currentPhase,
    phaseHistory: [], // Will be populated by orchestrator
    overallProgress: progress,
    overviewData: phases.overview,
    detailedData: phases.detailed,
    verifiedData: phases.verification,
    phaseConfidence: {
      overview: phases.overview ? ProgressiveAnalysisOrchestrator.DEFAULT_CONFIG.confidenceThresholds.overview : 0,
      detailed: phases.detailed ? ProgressiveAnalysisOrchestrator.DEFAULT_CONFIG.confidenceThresholds.detailed : 0,
      verified: phases.verification ? ProgressiveAnalysisOrchestrator.DEFAULT_CONFIG.confidenceThresholds.verification : 0
    },
    streamingStatus: progress >= 100 ? 'COMPLETED' : 'STREAMING',
    nextPhaseAvailable: progress < 100,
    canSkipToFinal: ProgressiveAnalysisOrchestrator.DEFAULT_CONFIG.allowPhaseSkipping
  } as ProgressiveAnalysisResult;
}

/**
 * Check if progressive analysis is supported for analysis type
 */
export function isProgressiveSupported(analysisType: string): boolean {
  const supportedTypes = ['STANDARD', 'MULTI_TIMEFRAME', 'SMC', 'ADVANCED_PATTERN'];
  return supportedTypes.includes(analysisType);
}

/**
 * Calculate estimated completion time for phase
 */
export function estimatePhaseTime(phase: AnalysisPhase, analysisType: string, isUltraMode: boolean): number {
  const config = ProgressiveAnalysisOrchestrator.DEFAULT_CONFIG;
  const baseTime = config.phaseTimeouts[phase.toLowerCase() as keyof typeof config.phaseTimeouts];
  
  const analysisMultiplier = analysisType === 'STANDARD' ? 1 : 1.3;
  const ultraMultiplier = isUltraMode ? 1.4 : 1;
  
  return baseTime * analysisMultiplier * ultraMultiplier;
}