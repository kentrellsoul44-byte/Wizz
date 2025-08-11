import type { 
  AnalysisResult, 
  TimeframeType, 
  SMCAnalysisContext, 
  AdvancedPatternContext,
  MultiTimeframeContext
} from '../types';

export interface ConfidenceFactors {
  technicalConfluence: number;      // 0-100: Multi-timeframe technical alignment
  historicalPatternSuccess: number; // 0-100: Success rate of similar patterns
  marketConditions: number;         // 0-100: Current market environment favorability
  volatilityAdjustment: number;     // 0-100: Volatility-adjusted confidence
  volumeConfirmation: number;       // 0-100: Volume confirmation strength
  structuralIntegrity: number;      // 0-100: SMC structure alignment
}

export interface ConfidenceWeights {
  technicalConfluence: number;      // Default: 0.25
  historicalPatternSuccess: number; // Default: 0.20
  marketConditions: number;         // Default: 0.15
  volatilityAdjustment: number;     // Default: 0.15
  volumeConfirmation: number;       // Default: 0.15
  structuralIntegrity: number;      // Default: 0.10
}

export interface ConfidenceInterval {
  centerValue: number;              // Main confidence score (0-100)
  lowerBound: number;               // Lower confidence bound
  upperBound: number;               // Upper confidence bound
  uncertainty: number;              // ±uncertainty range
  reliability: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}

export interface CalibratedConfidence {
  overallScore: number;             // Final calibrated score (0-100)
  factors: ConfidenceFactors;       // Individual factor scores
  weights: ConfidenceWeights;       // Applied weights
  interval: ConfidenceInterval;     // Confidence interval with uncertainty
  breakdown: {
    factorContributions: Record<string, number>;
    qualityMetrics: {
      dataQuality: number;          // 0-100: Quality of input data
      signalClarity: number;        // 0-100: How clear the signal is
      marketNoise: number;          // 0-100: Current market noise level
    };
  };
  historicalContext: {
    similarPatternCount: number;    // Number of similar historical patterns
    successRate: number;           // Success rate of similar patterns
    avgReturnOnSuccess: number;    // Average return when successful
    avgLossOnFailure: number;      // Average loss when failed
  };
  riskAdjustments: {
    volatilityPenalty: number;     // Penalty due to high volatility
    liquidityDiscount: number;     // Discount due to poor liquidity
    newsRisk: number;              // Risk due to upcoming news/events
  };
}

/**
 * Advanced Confidence Calibration Service
 * Implements multi-factor confidence scoring with statistical rigor
 */
export class ConfidenceCalibrationService {
  
  private static readonly DEFAULT_WEIGHTS: ConfidenceWeights = {
    technicalConfluence: 0.25,
    historicalPatternSuccess: 0.20,
    marketConditions: 0.15,
    volatilityAdjustment: 0.15,
    volumeConfirmation: 0.15,
    structuralIntegrity: 0.10
  };

  private static readonly ULTRA_MODE_WEIGHTS: ConfidenceWeights = {
    technicalConfluence: 0.30,
    historicalPatternSuccess: 0.25,
    marketConditions: 0.15,
    volatilityAdjustment: 0.10,
    volumeConfirmation: 0.15,
    structuralIntegrity: 0.05
  };

  /**
   * Main calibration method - replaces basic 0-100 scoring
   */
  static calibrateConfidence(
    analysisResult: AnalysisResult,
    isUltraMode: boolean = false,
    customWeights?: Partial<ConfidenceWeights>
  ): CalibratedConfidence {
    
    // Determine weights for this analysis
    const baseWeights = isUltraMode ? this.ULTRA_MODE_WEIGHTS : this.DEFAULT_WEIGHTS;
    const weights: ConfidenceWeights = { ...baseWeights, ...customWeights };

    // Calculate individual confidence factors
    const factors = this.calculateConfidenceFactors(analysisResult);
    
    // Calculate weighted confidence score
    const overallScore = this.calculateWeightedScore(factors, weights);
    
    // Calculate confidence interval with uncertainty
    const interval = this.calculateConfidenceInterval(factors, overallScore, analysisResult);
    
    // Generate detailed breakdown
    const breakdown = this.generateConfidenceBreakdown(factors, weights, analysisResult);
    
    // Gather historical context
    const historicalContext = this.gatherHistoricalContext(analysisResult);
    
    // Calculate risk adjustments
    const riskAdjustments = this.calculateRiskAdjustments(analysisResult);

    return {
      overallScore: this.applyFinalAdjustments(overallScore, riskAdjustments, isUltraMode),
      factors,
      weights,
      interval,
      breakdown,
      historicalContext,
      riskAdjustments
    };
  }

  /**
   * Calculate individual confidence factors
   */
  private static calculateConfidenceFactors(analysisResult: AnalysisResult): ConfidenceFactors {
    
    const technicalConfluence = this.calculateTechnicalConfluence(analysisResult);
    const historicalPatternSuccess = this.calculateHistoricalPatternSuccess(analysisResult);
    const marketConditions = this.calculateMarketConditionsFactor(analysisResult);
    const volatilityAdjustment = this.calculateVolatilityAdjustment(analysisResult);
    const volumeConfirmation = this.calculateVolumeConfirmation(analysisResult);
    const structuralIntegrity = this.calculateStructuralIntegrity(analysisResult);

    return {
      technicalConfluence,
      historicalPatternSuccess,
      marketConditions,
      volatilityAdjustment,
      volumeConfirmation,
      structuralIntegrity
    };
  }

  /**
   * Calculate technical confluence weight
   */
  private static calculateTechnicalConfluence(analysisResult: AnalysisResult): number {
    let confluenceScore = 50; // Base score
    
    // Multi-timeframe analysis bonus
    if (analysisResult.multiTimeframeContext) {
      const mtfContext = analysisResult.multiTimeframeContext;
      confluenceScore += mtfContext.confluenceScore * 0.4; // Up to +40 points
      
      // Reduce score for conflicting signals
      if (mtfContext.conflictingSignals && mtfContext.conflictingSignals.length > 0) {
        confluenceScore -= mtfContext.conflictingSignals.length * 5;
      }
      
      // Bonus for overall trend alignment
      if (mtfContext.overallTrend !== 'MIXED') {
        confluenceScore += 10;
      }
    }
    
    // Pattern analysis confluence
    if (analysisResult.patternAnalysis) {
      const patternContext = analysisResult.patternAnalysis;
      
      // Pattern confluence bonus
      confluenceScore += (patternContext.patternConfluence.confidenceScore - 50) * 0.3;
      
      // Reduce for conflicting patterns
      if (patternContext.conflictingPatterns.length > 0) {
        confluenceScore -= patternContext.conflictingPatterns.length * 3;
      }
      
      // Bonus for clear market condition
      if (patternContext.marketCondition.trend.includes('STRONG')) {
        confluenceScore += 5;
      }
    }
    
    // SMC confluence
    if (analysisResult.smcAnalysis) {
      const smcContext = analysisResult.smcAnalysis;
      
      // Structural alignment bonus
      if (smcContext.tradingBias.direction !== 'NEUTRAL') {
        confluenceScore += smcContext.tradingBias.confidence * 0.2;
      }
      
      // Liquidity confluence bonus
      if (smcContext.confluences.liquidityConfluence.length > 2) {
        confluenceScore += 8;
      }
      
      // Order block confluence bonus
      if (smcContext.confluences.orderBlockConfluence.length > 1) {
        confluenceScore += 6;
      }
    }
    
    return Math.max(0, Math.min(100, confluenceScore));
  }

  /**
   * Calculate historical pattern success rate
   */
  private static calculateHistoricalPatternSuccess(analysisResult: AnalysisResult): number {
    // Simulated historical pattern analysis
    // In production, this would query a historical pattern database
    
    let successScore = 60; // Base historical success rate
    
    // Signal strength adjustment
    if (analysisResult.signal !== 'NEUTRAL') {
      if (analysisResult.overallConfidenceScore >= 80) {
        successScore += 15; // Strong signals historically more successful
      } else if (analysisResult.overallConfidenceScore >= 60) {
        successScore += 8;
      } else {
        successScore -= 10; // Weak signals historically less successful
      }
    }
    
    // Pattern-specific historical performance
    if (analysisResult.patternAnalysis) {
      const patterns = analysisResult.patternAnalysis;
      
      // Classic patterns have known success rates
      if (patterns.classicPatterns.length > 0) {
        const avgReliability = patterns.classicPatterns.reduce((sum, p) => sum + p.reliability, 0) / patterns.classicPatterns.length;
        successScore += (avgReliability - 50) * 0.4;
      }
      
      // Harmonic patterns generally reliable
      if (patterns.harmonicPatterns.length > 0) {
        const completedPatterns = patterns.harmonicPatterns.filter(p => p.status === 'COMPLETED');
        if (completedPatterns.length > 0) {
          const avgValidity = completedPatterns.reduce((sum, p) => sum + p.validity, 0) / completedPatterns.length;
          successScore += (avgValidity - 50) * 0.3;
        }
      }
    }
    
    // Multi-timeframe historical bonus
    if (analysisResult.multiTimeframeContext) {
      const mtf = analysisResult.multiTimeframeContext;
      if (mtf.overallTrend !== 'MIXED' && mtf.confluenceScore > 70) {
        successScore += 12; // Multi-timeframe confluence historically strong
      }
    }
    
    return Math.max(0, Math.min(100, successScore));
  }

  /**
   * Calculate market conditions factor
   */
  private static calculateMarketConditionsFactor(analysisResult: AnalysisResult): number {
    let conditionsScore = 50; // Neutral market conditions
    

    
    // Pattern-based market condition assessment
    if (analysisResult.patternAnalysis) {
      const pattern = analysisResult.patternAnalysis;
      
      // Market phase adjustment
      switch (pattern.marketCondition.phase) {
        case 'MARKUP':
        case 'ACCUMULATION': conditionsScore += 10; break;
        case 'DISTRIBUTION':
        case 'MARKDOWN': conditionsScore -= 5; break;
        case 'REACCUMULATION':
        case 'REDISTRIBUTION': conditionsScore += 3; break;
      }
      
      // Volatility adjustment from patterns
      switch (pattern.marketCondition.volatility) {
        case 'LOW': conditionsScore += 8; break;
        case 'MEDIUM': conditionsScore += 2; break;
        case 'HIGH': conditionsScore -= 5; break;
        case 'EXTREME': conditionsScore -= 12; break;
      }
    }
    
    return Math.max(0, Math.min(100, conditionsScore));
  }

  /**
   * Calculate volatility adjustment
   */
  private static calculateVolatilityAdjustment(analysisResult: AnalysisResult): number {
    let volatilityScore = 70; // Base score assuming moderate volatility is acceptable
    
    // Extract volatility indicators from various sources
    let detectedVolatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'MEDIUM';
    
    if (analysisResult.patternAnalysis) {
      detectedVolatility = analysisResult.patternAnalysis.marketCondition.volatility;
    }
    
    // Adjust score based on volatility
    switch (detectedVolatility) {
      case 'LOW':
        volatilityScore = 85; // Low volatility is favorable
        break;
      case 'MEDIUM':
        volatilityScore = 70; // Medium volatility is acceptable
        break;
      case 'HIGH':
        volatilityScore = 45; // High volatility reduces confidence
        break;
      case 'EXTREME':
        volatilityScore = 25; // Extreme volatility significantly reduces confidence
        break;
    }
    
    // Additional adjustments based on confidence score
    if (analysisResult.overallConfidenceScore < 60 && (detectedVolatility === 'HIGH' || detectedVolatility === 'EXTREME')) {
      volatilityScore -= 15; // Extra penalty for low confidence in high volatility
    }
    
    // Time-based volatility considerations
    // (In production, this would use real volatility data)
    const currentHour = new Date().getHours();
    if (currentHour >= 2 && currentHour <= 6) { // Low activity hours
      volatilityScore += 5;
    } else if (currentHour >= 8 && currentHour <= 16) { // High activity hours
      volatilityScore -= 3;
    }
    
    return Math.max(0, Math.min(100, volatilityScore));
  }

  /**
   * Calculate volume confirmation strength
   */
  private static calculateVolumeConfirmation(analysisResult: AnalysisResult): number {
    let volumeScore = 50; // Base score
    
    // Volume profile analysis
    if (analysisResult.patternAnalysis?.volumeProfile) {
      const vp = analysisResult.patternAnalysis.volumeProfile;
      
      // Market structure from volume
      if (vp.marketStructure.balanced) volumeScore += 8;
      if (vp.marketStructure.trending) volumeScore += 12;
      if (vp.marketStructure.rotational) volumeScore -= 5;
      
      // Trading implications
      if (vp.tradingImplications.acceptance) volumeScore += 10;
      if (vp.tradingImplications.support.length > 2) volumeScore += 6;
      if (vp.tradingImplications.resistance.length > 2) volumeScore += 6;
    }
    
    // Classic pattern volume confirmation
    if (analysisResult.patternAnalysis?.classicPatterns) {
      const patterns = analysisResult.patternAnalysis.classicPatterns;
      
      for (const pattern of patterns) {
        if (pattern.volume.breakoutVolume === 'CONFIRMED') {
          volumeScore += 15;
        } else if (pattern.volume.breakoutVolume === 'WEAK') {
          volumeScore -= 8;
        }
        
        if (pattern.volume.patternVolume === 'INCREASING') {
          volumeScore += 8;
        } else if (pattern.volume.patternVolume === 'DECREASING') {
          volumeScore -= 5;
        }
      }
    }
    
    // Wyckoff volume analysis
    if (analysisResult.patternAnalysis?.wyckoffAnalysis) {
      const wyckoff = analysisResult.patternAnalysis.wyckoffAnalysis;
      
      if (wyckoff.volumeCharacteristics.climacticVolume) volumeScore += 12;
      if (wyckoff.volumeCharacteristics.volumeConfirmation) volumeScore += 15;
      if (wyckoff.volumeCharacteristics.volumeDrying) volumeScore -= 8;
    }
    
    return Math.max(0, Math.min(100, volumeScore));
  }

  /**
   * Calculate structural integrity from SMC analysis
   */
  private static calculateStructuralIntegrity(analysisResult: AnalysisResult): number {
    let structureScore = 50; // Base score
    
    if (!analysisResult.smcAnalysis) {
      return structureScore; // No SMC data available
    }
    
    const smc = analysisResult.smcAnalysis;
    
    // Overall structure strength
    switch (smc.overallStructure) {
      case 'BULLISH_STRUCTURE':
      case 'BEARISH_STRUCTURE':
        structureScore += 20; // Clear structure is good
        break;
      case 'RANGING':
        structureScore += 5; // Ranging can be tradeable
        break;
      case 'TRANSITIONAL':
        structureScore -= 10; // Transitional structure is risky
        break;
    }
    
    // Trading bias confidence
    structureScore += (smc.tradingBias.confidence - 50) * 0.4;
    
    // Critical levels analysis
    const criticalLevels = smc.criticalLevels;
    if (criticalLevels.highestProbabilityZones.length > 2) {
      structureScore += 8;
    }
    if (criticalLevels.liquidityTargets.length > 1) {
      structureScore += 6;
    }
    if (criticalLevels.structuralSupports.length + criticalLevels.structuralResistances.length > 3) {
      structureScore += 5;
    }
    
    // Confluence analysis
    const confluences = smc.confluences;
    if (confluences.orderBlockConfluence.length > 1) structureScore += 8;
    if (confluences.fvgConfluence.length > 0) structureScore += 5;
    if (confluences.liquidityConfluence.length > 1) structureScore += 7;
    
    // Risk assessment
    const risks = smc.riskAssessment;
    structureScore -= risks.liquidityRisks.length * 3;
    structureScore -= risks.structuralRisks.length * 4;
    
    return Math.max(0, Math.min(100, structureScore));
  }

  /**
   * Calculate weighted confidence score
   */
  private static calculateWeightedScore(factors: ConfidenceFactors, weights: ConfidenceWeights): number {
    const weightedSum = 
      factors.technicalConfluence * weights.technicalConfluence +
      factors.historicalPatternSuccess * weights.historicalPatternSuccess +
      factors.marketConditions * weights.marketConditions +
      factors.volatilityAdjustment * weights.volatilityAdjustment +
      factors.volumeConfirmation * weights.volumeConfirmation +
      factors.structuralIntegrity * weights.structuralIntegrity;
    
    return Math.round(weightedSum);
  }

  /**
   * Calculate confidence interval with uncertainty bounds
   */
  private static calculateConfidenceInterval(
    factors: ConfidenceFactors, 
    centerValue: number, 
    analysisResult: AnalysisResult
  ): ConfidenceInterval {
    
    // Calculate uncertainty based on factor variance
    const factorValues = Object.values(factors);
    const mean = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
    const variance = factorValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / factorValues.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Base uncertainty from factor variance
    let uncertainty = Math.min(25, standardDeviation * 0.6);
    
    // Adjust uncertainty based on data quality
    const dataQuality = this.assessDataQuality(analysisResult);
    uncertainty += (100 - dataQuality) * 0.15;
    
    // Adjust uncertainty based on signal clarity
    const signalClarity = this.assessSignalClarity(analysisResult);
    uncertainty += (100 - signalClarity) * 0.1;
    
    // Market noise adjustment
    const marketNoise = this.assessMarketNoise(analysisResult);
    uncertainty += marketNoise * 0.08;
    
    // Ensure reasonable bounds
    uncertainty = Math.max(5, Math.min(30, uncertainty));
    
    const lowerBound = Math.max(0, centerValue - uncertainty);
    const upperBound = Math.min(100, centerValue + uncertainty);
    
    // Determine reliability based on uncertainty
    let reliability: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    if (uncertainty <= 8) reliability = 'VERY_HIGH';
    else if (uncertainty <= 15) reliability = 'HIGH';
    else if (uncertainty <= 22) reliability = 'MEDIUM';
    else reliability = 'LOW';
    
    return {
      centerValue,
      lowerBound,
      upperBound,
      uncertainty: Math.round(uncertainty),
      reliability
    };
  }

  /**
   * Generate detailed confidence breakdown
   */
  private static generateConfidenceBreakdown(
    factors: ConfidenceFactors, 
    weights: ConfidenceWeights, 
    analysisResult: AnalysisResult
  ): CalibratedConfidence['breakdown'] {
    
    const factorContributions: Record<string, number> = {};
    
    // Calculate each factor's contribution to final score
    Object.entries(factors).forEach(([factorName, value]) => {
      const weight = weights[factorName as keyof ConfidenceWeights];
      factorContributions[factorName] = Math.round(value * weight);
    });
    
    return {
      factorContributions,
      qualityMetrics: {
        dataQuality: this.assessDataQuality(analysisResult),
        signalClarity: this.assessSignalClarity(analysisResult),
        marketNoise: this.assessMarketNoise(analysisResult)
      }
    };
  }

  /**
   * Gather historical context for similar patterns
   */
  private static gatherHistoricalContext(analysisResult: AnalysisResult): CalibratedConfidence['historicalContext'] {
    // Simulated historical data - in production this would query actual historical database
    
    let similarPatternCount = 50; // Base assumption
    let successRate = 65; // Base success rate
    let avgReturnOnSuccess = 8.5;
    let avgLossOnFailure = -4.2;
    
    // Adjust based on signal type and strength
    if (analysisResult.signal !== 'NEUTRAL') {
      if (analysisResult.overallConfidenceScore >= 80) {
        similarPatternCount += 20;
        successRate += 15;
        avgReturnOnSuccess += 3.2;
        avgLossOnFailure -= 1.1;
      } else if (analysisResult.overallConfidenceScore >= 60) {
        similarPatternCount += 10;
        successRate += 8;
        avgReturnOnSuccess += 1.5;
        avgLossOnFailure -= 0.5;
      }
    }
    
    // Pattern-specific adjustments
    if (analysisResult.patternAnalysis?.harmonicPatterns.length) {
      successRate += 5; // Harmonic patterns typically more reliable
      avgReturnOnSuccess += 1.2;
    }
    
    if (analysisResult.multiTimeframeContext?.confluenceScore && analysisResult.multiTimeframeContext.confluenceScore > 70) {
      successRate += 10; // Multi-timeframe confluence increases success rate
      avgReturnOnSuccess += 2.1;
    }
    
    return {
      similarPatternCount: Math.round(similarPatternCount),
      successRate: Math.round(successRate),
      avgReturnOnSuccess: Math.round(avgReturnOnSuccess * 100) / 100,
      avgLossOnFailure: Math.round(avgLossOnFailure * 100) / 100
    };
  }

  /**
   * Calculate risk adjustments
   */
  private static calculateRiskAdjustments(analysisResult: AnalysisResult): CalibratedConfidence['riskAdjustments'] {
    let volatilityPenalty = 0;
    let liquidityDiscount = 0;
    let newsRisk = 0;
    

    
    // Liquidity discount (simulated)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour <= 6) { // Low liquidity hours
      liquidityDiscount = 5;
    }
    
    // News risk (simulated - would integrate with news calendar)
    const isWeekday = ![0, 6].includes(new Date().getDay());
    if (isWeekday && currentHour >= 8 && currentHour <= 10) { // Market open hours
      newsRisk = 3;
    }
    
    return {
      volatilityPenalty,
      liquidityDiscount,
      newsRisk
    };
  }

  /**
   * Apply final adjustments to the confidence score
   */
  private static applyFinalAdjustments(
    baseScore: number, 
    riskAdjustments: CalibratedConfidence['riskAdjustments'],
    isUltraMode: boolean
  ): number {
    let finalScore = baseScore;
    
    // Apply risk adjustments
    finalScore -= riskAdjustments.volatilityPenalty;
    finalScore -= riskAdjustments.liquidityDiscount;
    finalScore -= riskAdjustments.newsRisk;
    
    // Ultra mode is more conservative
    if (isUltraMode) {
      finalScore *= 0.95; // 5% more conservative
    }
    
    return Math.max(0, Math.min(100, Math.round(finalScore)));
  }

  /**
   * Assess data quality
   */
  private static assessDataQuality(analysisResult: AnalysisResult): number {
    let quality = 70; // Base quality
    
    if (analysisResult.multiTimeframeContext) quality += 15;
    if (analysisResult.smcAnalysis) quality += 10;
    if (analysisResult.patternAnalysis) quality += 10;

    
    return Math.min(100, quality);
  }

  /**
   * Assess signal clarity
   */
  private static assessSignalClarity(analysisResult: AnalysisResult): number {
    let clarity = 50; // Base clarity
    
    if (analysisResult.signal !== 'NEUTRAL') {
      clarity += 20;
      
      if (analysisResult.overallConfidenceScore >= 75) {
        clarity += 20;
      } else if (analysisResult.overallConfidenceScore >= 50) {
        clarity += 10;
      }
    }
    
    if (analysisResult.multiTimeframeContext?.overallTrend && analysisResult.multiTimeframeContext.overallTrend !== 'MIXED') {
      clarity += 15;
    }
    
    return Math.min(100, clarity);
  }

  /**
   * Assess current market noise level
   */
  private static assessMarketNoise(analysisResult: AnalysisResult): number {
    let noise = 30; // Base noise level
    

    
    // Pattern analysis can reduce perceived noise
    if (analysisResult.patternAnalysis?.patternConfluence.confidenceScore > 70) {
      noise -= 8;
    }
    
    return Math.max(0, Math.min(100, noise));
  }

  /**
   * Format confidence for display with intervals
   */
  static formatConfidenceDisplay(calibratedConfidence: CalibratedConfidence): string {
    const { overallScore, interval } = calibratedConfidence;
    const uncertaintyStr = interval.uncertainty > 0 ? ` ±${interval.uncertainty}%` : '';
    const reliabilityStr = interval.reliability.toLowerCase();
    
    return `${overallScore}%${uncertaintyStr} (${reliabilityStr} reliability)`;
  }

  /**
   * Get confidence level based on calibrated score
   */
  static getConfidenceLevel(calibratedConfidence: CalibratedConfidence, isUltraMode: boolean = false): 'HIGH' | 'LOW' {
    const threshold = isUltraMode ? 85 : 75;
    return calibratedConfidence.overallScore >= threshold ? 'HIGH' : 'LOW';
  }
}