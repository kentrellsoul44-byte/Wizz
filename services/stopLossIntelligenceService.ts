import type {
  StopLossIntelligence,
  StopLossOptimizationRequest,
  StopLossType,
  StopAdjustmentReason,
  ATRMetrics,
  SupportResistanceLevel,
  LiquidityPool,
  TimeBasedStopAdjustment,
  TimeframeType,
  StopLossPerformanceMetrics
} from '../types';

import { SupportResistanceAnalysisService } from './supportResistanceAnalysisService';
import { LiquidityPoolDetectionService } from './liquidityPoolDetectionService';
import { TimeBasedStopAdjustmentService } from './timeBasedStopAdjustmentService';

export class StopLossIntelligenceService {
  private static instance: StopLossIntelligenceService;
  private performanceHistory: Map<string, StopLossPerformanceMetrics> = new Map();
  
  public static getInstance(): StopLossIntelligenceService {
    if (!StopLossIntelligenceService.instance) {
      StopLossIntelligenceService.instance = new StopLossIntelligenceService();
    }
    return StopLossIntelligenceService.instance;
  }

  /**
   * Main entry point for stop-loss optimization
   */
  public async optimizeStopLoss(request: StopLossOptimizationRequest): Promise<StopLossIntelligence> {
    const timestamp = new Date().toISOString();
    const id = this.generateStopLossId(request);
    
    // Calculate basic invalidation level
    const basicStop = this.calculateBasicStop(request);
    
    // Perform ATR analysis
    const atrAnalysis = this.performATRAnalysis(request);
    
    // Analyze support/resistance levels
    const supportResistanceAnalysis = this.analyzeSupportResistance(request);
    
    // Detect and analyze liquidity pools
    const liquidityAnalysis = this.analyzeLiquidityPools(request);
    
    // Calculate time-based adjustments
    const timeAdjustments = this.calculateTimeAdjustments(request);
    
    // Apply AI optimization
    const aiOptimization = await this.applyAIOptimization(request, {
      basicStop,
      atrAnalysis,
      supportResistanceAnalysis,
      liquidityAnalysis,
      timeAdjustments
    });
    
    // Generate final recommendation
    const finalRecommendation = this.generateFinalRecommendation({
      basicStop,
      atrAnalysis,
      supportResistanceAnalysis,
      liquidityAnalysis,
      timeAdjustments,
      aiOptimization
    }, request);
    
    // Assess overall risk
    const riskAssessment = this.assessRisk({
      basicStop,
      atrAnalysis,
      supportResistanceAnalysis,
      liquidityAnalysis,
      timeAdjustments,
      finalRecommendation
    });

    return {
      id,
      timestamp,
      currentPrice: request.currentPrice,
      entryPrice: request.entryPrice,
      tradeDirection: request.tradeDirection,
      basicStop,
      atrAnalysis,
      supportResistanceAnalysis,
      liquidityAnalysis,
      timeAdjustments,
      aiOptimization,
      finalRecommendation,
      riskAssessment
    };
  }

  /**
   * Advanced ATR-based dynamic stop calculation
   */
  private performATRAnalysis(request: StopLossOptimizationRequest): StopLossIntelligence['atrAnalysis'] {
    const priceData = request.marketData.priceHistory;
    
    // Calculate comprehensive ATR metrics
    const metrics = this.calculateAdvancedATRMetrics(priceData);
    
    // Determine optimal ATR multiplier based on market conditions
    const multiplier = this.calculateOptimalATRMultiplier(metrics, request);
    
    // Calculate recommended stop using ATR
    const atrDistance = metrics.current * multiplier;
    const recommendedStop = request.tradeDirection === 'BUY' 
      ? request.entryPrice - atrDistance
      : request.entryPrice + atrDistance;
    
    // Calculate confidence based on ATR stability and market conditions
    const confidence = this.calculateATRConfidence(metrics, request);
    
    const basicStopDistance = Math.abs(request.entryPrice - this.calculateBasicStop(request).price);
    const adjustmentFromBasic = Math.abs(recommendedStop - request.entryPrice) - basicStopDistance;

    return {
      metrics,
      recommendedStop,
      multiplier,
      confidence,
      adjustmentFromBasic
    };
  }

  /**
   * Calculate advanced ATR metrics with multiple timeframes and trends
   */
  private calculateAdvancedATRMetrics(priceData: Array<{
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>): ATRMetrics {
    if (priceData.length < 20) {
      throw new Error('Insufficient data for ATR calculation');
    }

    // Calculate current ATR (14-period)
    const current = this.calculateATR(priceData, 14);
    
    // Calculate historical ATR (50-period for context)
    const historical = this.calculateATR(priceData, Math.min(50, priceData.length - 1));
    
    // Calculate ATR percentile (current vs historical distribution)
    const percentile = this.calculateATRPercentile(current, priceData);
    
    // Determine ATR trend
    const trend = this.calculateATRTrend(priceData);
    
    // Calculate expansion rate
    const expansionRate = this.calculateATRExpansionRate(priceData);
    
    // Session-based ATR calculations
    const sessionATR = this.calculateSessionATR(priceData);
    const dailyATR = this.calculateDailyATR(priceData);
    const weeklyATR = this.calculateWeeklyATR(priceData);
    
    // Normalized ATR (ATR/Price ratio)
    const normalizedATR = current / priceData[priceData.length - 1].close;

    return {
      current,
      historical,
      percentile,
      trend,
      expansionRate,
      sessionATR,
      dailyATR,
      weeklyATR,
      normalizedATR
    };
  }

  /**
   * Enhanced ATR calculation with multiple periods
   */
  private calculateATR(priceData: Array<{ high: number; low: number; close: number }>, period: number): number {
    if (priceData.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < priceData.length; i++) {
      const high = priceData[i].high;
      const low = priceData[i].low;
      const prevClose = priceData[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Use EMA for smoother ATR calculation
    return this.calculateEMA(trueRanges.slice(-period), period);
  }

  /**
   * Calculate ATR percentile relative to historical distribution
   */
  private calculateATRPercentile(currentATR: number, priceData: Array<{ high: number; low: number; close: number }>): number {
    const atrValues: number[] = [];
    const windowSize = 14;
    
    for (let i = windowSize; i < priceData.length; i++) {
      const window = priceData.slice(i - windowSize, i + 1);
      atrValues.push(this.calculateATR(window, windowSize));
    }
    
    atrValues.sort((a, b) => a - b);
    const rank = atrValues.findIndex(atr => atr >= currentATR);
    
    return rank === -1 ? 100 : (rank / atrValues.length) * 100;
  }

  /**
   * Determine ATR trend (expanding, contracting, stable)
   */
  private calculateATRTrend(priceData: Array<{ high: number; low: number; close: number }>): ATRMetrics['trend'] {
    const recentATR = this.calculateATR(priceData.slice(-20), 14);
    const olderATR = this.calculateATR(priceData.slice(-40, -20), 14);
    
    const change = (recentATR - olderATR) / olderATR;
    
    if (change > 0.15) return 'EXPANDING';
    if (change < -0.15) return 'CONTRACTING';
    return 'STABLE';
  }

  /**
   * Calculate ATR expansion/contraction rate
   */
  private calculateATRExpansionRate(priceData: Array<{ high: number; low: number; close: number }>): number {
    const currentATR = this.calculateATR(priceData.slice(-14), 14);
    const previousATR = this.calculateATR(priceData.slice(-28, -14), 14);
    
    return (currentATR - previousATR) / previousATR;
  }

  /**
   * Calculate session-specific ATR
   */
  private calculateSessionATR(priceData: Array<{ timestamp: string; high: number; low: number; close: number }>): number {
    // Get current session data (simplified - would need timezone handling in real implementation)
    const currentHour = new Date(priceData[priceData.length - 1].timestamp).getUTCHours();
    const sessionStart = this.getSessionStart(currentHour);
    
    const sessionData = priceData.filter(candle => {
      const candleHour = new Date(candle.timestamp).getUTCHours();
      return candleHour >= sessionStart;
    });
    
    return sessionData.length > 1 ? this.calculateATR(sessionData, Math.min(14, sessionData.length - 1)) : 0;
  }

  /**
   * Calculate daily ATR
   */
  private calculateDailyATR(priceData: Array<{ timestamp: string; high: number; low: number; close: number }>): number {
    // Group by day and calculate daily ranges
    const dailyRanges: number[] = [];
    const grouped = this.groupByDay(priceData);
    
    Object.values(grouped).forEach(dayData => {
      if (dayData.length > 0) {
        const high = Math.max(...dayData.map(d => d.high));
        const low = Math.min(...dayData.map(d => d.low));
        dailyRanges.push(high - low);
      }
    });
    
    return dailyRanges.length > 0 ? this.calculateEMA(dailyRanges.slice(-14), Math.min(14, dailyRanges.length)) : 0;
  }

  /**
   * Calculate weekly ATR
   */
  private calculateWeeklyATR(priceData: Array<{ timestamp: string; high: number; low: number; close: number }>): number {
    // Group by week and calculate weekly ranges
    const weeklyRanges: number[] = [];
    const grouped = this.groupByWeek(priceData);
    
    Object.values(grouped).forEach(weekData => {
      if (weekData.length > 0) {
        const high = Math.max(...weekData.map(d => d.high));
        const low = Math.min(...weekData.map(d => d.low));
        weeklyRanges.push(high - low);
      }
    });
    
    return weeklyRanges.length > 0 ? this.calculateEMA(weeklyRanges.slice(-8), Math.min(8, weeklyRanges.length)) : 0;
  }

  /**
   * Calculate optimal ATR multiplier based on market conditions
   */
  private calculateOptimalATRMultiplier(metrics: ATRMetrics, request: StopLossOptimizationRequest): number {
    let baseMultiplier = 2.0; // Default ATR multiplier
    
    // Adjust based on volatility regime
    if (metrics.percentile > 80) {
      baseMultiplier *= 1.2; // Higher multiplier in high volatility
    } else if (metrics.percentile < 20) {
      baseMultiplier *= 0.8; // Lower multiplier in low volatility
    }
    
    // Adjust based on ATR trend
    if (metrics.trend === 'EXPANDING') {
      baseMultiplier *= 1.15;
    } else if (metrics.trend === 'CONTRACTING') {
      baseMultiplier *= 0.9;
    }
    
    // Adjust based on user risk tolerance
    switch (request.preferences.riskTolerance) {
      case 'CONSERVATIVE':
        baseMultiplier *= 1.3;
        break;
      case 'AGGRESSIVE':
        baseMultiplier *= 0.8;
        break;
      default: // MODERATE
        break;
    }
    
    // Adjust based on timeframe
    const timeframeMultipliers: Record<TimeframeType, number> = {
      '1M': 0.5,
      '5M': 0.7,
      '15M': 0.9,
      '30M': 1.0,
      '1H': 1.1,
      '4H': 1.3,
      '12H': 1.5,
      '1D': 1.7,
      '3D': 2.0,
      '1W': 2.5,
      '1M_MONTHLY': 3.0
    };
    
    baseMultiplier *= timeframeMultipliers[request.timeframe] || 1.0;
    
    return Math.max(0.5, Math.min(5.0, baseMultiplier)); // Clamp between 0.5 and 5.0
  }

  /**
   * Calculate confidence in ATR-based stop
   */
  private calculateATRConfidence(metrics: ATRMetrics, request: StopLossOptimizationRequest): number {
    let confidence = 70; // Base confidence
    
    // Higher confidence for stable ATR
    if (metrics.trend === 'STABLE') {
      confidence += 10;
    } else if (metrics.trend === 'EXPANDING') {
      confidence -= 5;
    }
    
    // Adjust based on ATR percentile
    if (metrics.percentile > 20 && metrics.percentile < 80) {
      confidence += 10; // Normal volatility range
    } else {
      confidence -= 5; // Extreme volatility
    }
    
    // Higher confidence with more data
    if (request.marketData.priceHistory.length > 100) {
      confidence += 5;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Analyze support and resistance levels for stop placement
   */
  private analyzeSupportResistance(request: StopLossOptimizationRequest): StopLossIntelligence['supportResistanceAnalysis'] {
    const srService = SupportResistanceAnalysisService.getInstance();
    const priceData = request.marketData.priceHistory;
    const currentPrice = request.currentPrice;
    
    // Use specialized service to identify S/R levels
    const allLevels = srService.identifySupportResistanceLevels(priceData, currentPrice, request.timeframe);
    
    // Filter levels relevant to stop placement
    const relevantLevels = this.filterRelevantLevels(allLevels, request);
    
    // Find the most critical level for stop placement
    const criticalLevel = this.findCriticalLevel(relevantLevels, request);
    
    // Calculate recommended stop based on S/R analysis
    const { recommendedStop, safetyBuffer } = this.calculateSRBasedStop(criticalLevel, request);
    
    // Calculate confidence based on level strength and confluence
    const confidence = this.calculateSRConfidence(criticalLevel, relevantLevels);

    return {
      nearbyLevels: relevantLevels,
      criticalLevel,
      recommendedStop,
      safetyBuffer,
      confidence
    };
  }

  /**
   * Identify key support and resistance levels
   */
  private identifySupportResistanceLevels(
    priceData: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }>,
    currentPrice: number
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const lookback = Math.min(200, priceData.length);
    const recentData = priceData.slice(-lookback);
    
    // Find swing highs and lows
    const swingPoints = this.findSwingPoints(recentData);
    
    // Convert swing points to S/R levels
    swingPoints.forEach(point => {
      const isSupport = point.type === 'LOW';
      const touches = this.countTouches(recentData, point.price, 0.001); // 0.1% tolerance
      
      if (touches >= 2) { // Minimum 2 touches to be considered S/R
        const level: SupportResistanceLevel = {
          id: `sr_${point.timestamp}_${point.price}`,
          price: point.price,
          type: isSupport ? 'SUPPORT' : 'RESISTANCE',
          strength: this.calculateLevelStrength(touches, point.volume || 0),
          touches,
          lastTouch: point.timestamp,
          timeframe: '1H', // Would be dynamic in real implementation
          confluence: this.analyzeConfluence(point.price, recentData),
          distance: Math.abs(currentPrice - point.price),
          penetrationHistory: this.analyzePenetrationHistory(recentData, point.price),
          reliability: this.calculateLevelReliability(recentData, point.price, touches)
        };
        
        levels.push(level);
      }
    });
    
    // Add psychological levels (round numbers)
    levels.push(...this.identifyPsychologicalLevels(currentPrice));
    
    return levels.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Analyze liquidity pools for stop placement optimization
   */
  private analyzeLiquidityPools(request: StopLossOptimizationRequest): StopLossIntelligence['liquidityAnalysis'] {
    const liquidityService = LiquidityPoolDetectionService.getInstance();
    const priceData = request.marketData.priceHistory;
    const currentPrice = request.currentPrice;
    
    // Use specialized service to detect liquidity pools
    const pools = liquidityService.detectLiquidityPools(priceData, currentPrice, request.timeframe);
    
    // Identify pools that pose risk for stop hunting
    const riskPools = pools.filter(pool => 
      pool.sweepProbability > 70 && 
      pool.proximity < this.calculateRelevantDistance(request)
    );
    
    // Calculate recommended stop to avoid liquidity pools
    const { recommendedStop, avoidanceAdjustment } = this.calculateLiquidityAvoidingStop(pools, request);
    
    // Calculate confidence based on liquidity analysis
    const confidence = this.calculateLiquidityConfidence(pools, riskPools);

    return {
      nearbyPools: pools,
      riskPools,
      recommendedStop,
      avoidanceAdjustment,
      confidence
    };
  }

  /**
   * Detect various types of liquidity pools
   */
  private detectLiquidityPools(
    priceData: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }>,
    currentPrice: number
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    
    // Detect equal highs and lows
    pools.push(...this.detectEqualHighsLows(priceData, currentPrice));
    
    // Detect previous significant highs/lows
    pools.push(...this.detectPreviousHighsLows(priceData, currentPrice));
    
    // Detect round number levels
    pools.push(...this.detectRoundNumberPools(currentPrice));
    
    // Sort by proximity to current price
    return pools.sort((a, b) => a.proximity - b.proximity);
  }

  /**
   * Calculate time-based stop adjustments
   */
  private calculateTimeAdjustments(request: StopLossOptimizationRequest): StopLossIntelligence['timeAdjustments'] {
    const timeService = TimeBasedStopAdjustmentService.getInstance();
    const timestamp = new Date().toISOString();
    
    // Get current session adjustment
    const currentSession = timeService.getCurrentSessionAdjustment(timestamp, request.asset);
    
    // Calculate upcoming session changes
    const upcomingChanges = timeService.getUpcomingSessionChanges(timestamp, request.asset);
    
    // Calculate recommended stop with time adjustments
    const basicStop = this.calculateBasicStop(request);
    const recommendedStop = timeService.calculateTimeAdjustedStop(
      request.entryPrice,
      basicStop.price,
      request.tradeDirection,
      timestamp,
      request.asset
    );
    
    // Determine if dynamic adjustment is recommended
    const dynamicAdjustment = timeService.shouldUseDynamicAdjustment(timestamp, request.asset);

    return {
      currentSession,
      upcomingChanges,
      recommendedStop,
      dynamicAdjustment
    };
  }

  /**
   * Apply AI-powered optimization to stop-loss placement
   */
  private async applyAIOptimization(
    request: StopLossOptimizationRequest,
    analyses: {
      basicStop: any;
      atrAnalysis: any;
      supportResistanceAnalysis: any;
      liquidityAnalysis: any;
      timeAdjustments: any;
    }
  ): Promise<StopLossIntelligence['aiOptimization']> {
    // Prepare inputs for AI model
    const inputs = {
      marketConditions: {
        volatility: analyses.atrAnalysis.metrics.percentile,
        trend: analyses.atrAnalysis.metrics.trend,
        timeframe: request.timeframe,
        session: analyses.timeAdjustments.currentSession.sessionType
      },
      historicalPerformance: this.getHistoricalPerformance(request.asset),
      patternContext: request.context
    };
    
    // Generate AI recommendation (simplified - would use actual ML model)
    const aiRecommendation = this.generateAIRecommendation(inputs, analyses, request);
    
    return {
      modelVersion: '1.0.0',
      inputs,
      recommendedStop: aiRecommendation.stop,
      confidence: aiRecommendation.confidence,
      reasoning: aiRecommendation.reasoning,
      alternativeScenarios: aiRecommendation.alternatives
    };
  }

  /**
   * Generate final stop-loss recommendation
   */
  private generateFinalRecommendation(
    analyses: {
      basicStop: any;
      atrAnalysis: any;
      supportResistanceAnalysis: any;
      liquidityAnalysis: any;
      timeAdjustments: any;
      aiOptimization: any;
    },
    request: StopLossOptimizationRequest
  ): StopLossIntelligence['finalRecommendation'] {
    // Weight different analysis types based on confidence and relevance
    const weights = this.calculateAnalysisWeights(analyses, request);
    
    // Calculate weighted average stop price
    const weightedStop = this.calculateWeightedStop(analyses, weights);
    
    // Determine primary stop type used
    const primaryType = this.determinePrimaryStopType(weights);
    
    // Calculate final metrics
    const distance = Math.abs(weightedStop - request.entryPrice);
    const riskRewardRatio = this.calculateRiskReward(weightedStop, request);
    
    // Generate comprehensive reasoning
    const reasoning = this.generateStopRecommendationReasoning(analyses, weights, primaryType);
    
    // Set up monitoring rules for dynamic adjustment
    const monitoringRules = this.setupMonitoringRules(analyses, request);
    
    return {
      type: primaryType,
      price: weightedStop,
      distance,
      riskRewardRatio,
      confidence: this.calculateOverallConfidence(analyses, weights),
      reasoning,
      adjustmentHistory: [],
      monitoringRules
    };
  }

  /**
   * Assess overall risk of the stop-loss placement
   */
  private assessRisk(data: {
    basicStop: any;
    atrAnalysis: any;
    supportResistanceAnalysis: any;
    liquidityAnalysis: any;
    timeAdjustments: any;
    finalRecommendation: any;
  }): StopLossIntelligence['riskAssessment'] {
    // Assess different risk categories
    const stopHuntingRisk = this.assessStopHuntingRisk(data.liquidityAnalysis, data.supportResistanceAnalysis);
    const gapRisk = this.assessGapRisk(data.atrAnalysis, data.timeAdjustments);
    const liquidityRisk = this.assessLiquidityRisk(data.liquidityAnalysis, data.timeAdjustments);
    const volatilityRisk = this.assessVolatilityRisk(data.atrAnalysis);
    
    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk({
      stopHuntingRisk,
      gapRisk,
      liquidityRisk,
      volatilityRisk
    });
    
    // Generate mitigation strategies
    const mitigationStrategies = this.generateMitigationStrategies({
      stopHuntingRisk,
      gapRisk,
      liquidityRisk,
      volatilityRisk,
      overallRisk
    });

    return {
      stopHuntingRisk,
      gapRisk,
      liquidityRisk,
      volatilityRisk,
      overallRisk,
      mitigationStrategies
    };
  }

  // Utility methods
  private generateStopLossId(request: StopLossOptimizationRequest): string {
    return `sl_${request.asset}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateBasicStop(request: StopLossOptimizationRequest): StopLossIntelligence['basicStop'] {
    // Simplified basic stop calculation - would integrate with existing invalidation logic
    const invalidationLevel = request.context?.smcAnalysis?.tradingBias.invalidationLevel || 0;
    const distance = Math.abs(request.entryPrice - invalidationLevel);
    const riskRewardRatio = distance > 0 ? (Math.abs(request.currentPrice - request.entryPrice) * 2) / distance : 0;
    
    return {
      price: invalidationLevel,
      invalidationLevel,
      distance,
      riskRewardRatio
    };
  }

  private calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
      ema = (values[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private getSessionStart(currentHour: number): number {
    // Simplified session detection
    if (currentHour >= 0 && currentHour < 8) return 0; // Asian
    if (currentHour >= 8 && currentHour < 16) return 8; // London
    return 16; // New York
  }

  private groupByDay(priceData: Array<{ timestamp: string; high: number; low: number; close: number }>): Record<string, typeof priceData> {
    const grouped: Record<string, typeof priceData> = {};
    
    priceData.forEach(candle => {
      const date = new Date(candle.timestamp).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(candle);
    });
    
    return grouped;
  }

  private groupByWeek(priceData: Array<{ timestamp: string; high: number; low: number; close: number }>): Record<string, typeof priceData> {
    const grouped: Record<string, typeof priceData> = {};
    
    priceData.forEach(candle => {
      const date = new Date(candle.timestamp);
      const week = this.getWeekKey(date);
      if (!grouped[week]) grouped[week] = [];
      grouped[week].push(candle);
    });
    
    return grouped;
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week}`;
  }

  // Additional helper methods would be implemented here for:
  // - Support/resistance analysis
  // - Liquidity pool detection
  // - Time-based adjustments
  // - AI optimization
  // - Risk assessment
  // These are simplified in this implementation for brevity

  private findSwingPoints(priceData: any[]): any[] {
    // Simplified swing point detection
    return [];
  }

  private countTouches(priceData: any[], price: number, tolerance: number): number {
    // Count how many times price touched a level
    return 0;
  }

  private calculateLevelStrength(touches: number, volume: number): SupportResistanceLevel['strength'] {
    if (touches >= 4) return 'VERY_STRONG';
    if (touches >= 3) return 'STRONG';
    if (touches >= 2) return 'MODERATE';
    return 'WEAK';
  }

  private analyzeConfluence(price: number, priceData: any[]): SupportResistanceLevel['confluence'] {
    return {
      fibonacci: false,
      pivot: false,
      psychological: false,
      volumeProfile: false,
      orderBlock: false,
      fairValueGap: false
    };
  }

  private analyzePenetrationHistory(priceData: any[], price: number): SupportResistanceLevel['penetrationHistory'] {
    return [];
  }

  private calculateLevelReliability(priceData: any[], price: number, touches: number): number {
    return touches * 20; // Simplified calculation
  }

  private identifyPsychologicalLevels(currentPrice: number): SupportResistanceLevel[] {
    return [];
  }

  private filterRelevantLevels(levels: SupportResistanceLevel[], request: StopLossOptimizationRequest): SupportResistanceLevel[] {
    return levels.filter(level => level.distance < currentPrice * 0.05); // Within 5% of current price
  }

  private findCriticalLevel(levels: SupportResistanceLevel[], request: StopLossOptimizationRequest): SupportResistanceLevel | undefined {
    return levels[0]; // Simplified - return closest level
  }

  private calculateSRBasedStop(level: SupportResistanceLevel | undefined, request: StopLossOptimizationRequest): { recommendedStop: number; safetyBuffer: number } {
    if (!level) {
      return { recommendedStop: request.entryPrice, safetyBuffer: 0 };
    }

    const buffer = level.price * 0.001; // 0.1% buffer
    const recommendedStop = request.tradeDirection === 'BUY' 
      ? level.price - buffer
      : level.price + buffer;

    return { recommendedStop, safetyBuffer: buffer };
  }

  private calculateSRConfidence(level: SupportResistanceLevel | undefined, allLevels: SupportResistanceLevel[]): number {
    if (!level) return 0;
    return Math.min(100, level.reliability + (level.touches * 10));
  }

  private detectEqualHighsLows(priceData: any[], currentPrice: number): LiquidityPool[] {
    return [];
  }

  private detectPreviousHighsLows(priceData: any[], currentPrice: number): LiquidityPool[] {
    return [];
  }

  private detectRoundNumberPools(currentPrice: number): LiquidityPool[] {
    return [];
  }

  private calculateRelevantDistance(request: StopLossOptimizationRequest): number {
    return request.currentPrice * 0.02; // 2% of current price
  }

  private calculateLiquidityAvoidingStop(pools: LiquidityPool[], request: StopLossOptimizationRequest): { recommendedStop: number; avoidanceAdjustment: number } {
    return { recommendedStop: request.entryPrice, avoidanceAdjustment: 0 };
  }

  private calculateLiquidityConfidence(pools: LiquidityPool[], riskPools: LiquidityPool[]): number {
    return Math.max(0, 100 - (riskPools.length * 20));
  }

  private getCurrentSession(hour: number): TimeBasedStopAdjustment {
    let sessionType: TimeBasedStopAdjustment['sessionType'] = 'ASIAN';
    if (hour >= 8 && hour < 16) sessionType = 'LONDON';
    else if (hour >= 16 && hour < 24) sessionType = 'NEW_YORK';

    return {
      sessionType,
      adjustmentFactor: 1.0,
      reasoning: `Current ${sessionType} session`,
      volatilityExpectation: 'MEDIUM',
      liquidityExpectation: 'MEDIUM',
      newsEvents: []
    };
  }

  private getUpcomingSessionChanges(currentTime: Date): TimeBasedStopAdjustment[] {
    return [];
  }

  private calculateTimeAdjustedStop(session: TimeBasedStopAdjustment, request: StopLossOptimizationRequest): number {
    return request.entryPrice * session.adjustmentFactor;
  }

  private shouldUseDynamicAdjustment(session: TimeBasedStopAdjustment, upcoming: TimeBasedStopAdjustment[]): boolean {
    return upcoming.length > 0;
  }

  private getHistoricalPerformance(asset: string): any {
    return this.performanceHistory.get(asset) || {};
  }

  private generateAIRecommendation(inputs: any, analyses: any, request: StopLossOptimizationRequest): any {
    return {
      stop: request.entryPrice,
      confidence: 75,
      reasoning: 'AI-optimized stop placement',
      alternatives: []
    };
  }

  private calculateAnalysisWeights(analyses: any, request: StopLossOptimizationRequest): Record<string, number> {
    return {
      basic: 0.2,
      atr: 0.3,
      supportResistance: 0.25,
      liquidity: 0.15,
      time: 0.05,
      ai: 0.05
    };
  }

  private calculateWeightedStop(analyses: any, weights: Record<string, number>): number {
    return analyses.basicStop.price; // Simplified
  }

  private determinePrimaryStopType(weights: Record<string, number>): StopLossType {
    const maxWeight = Math.max(...Object.values(weights));
    const primaryKey = Object.keys(weights).find(key => weights[key] === maxWeight);
    
    switch (primaryKey) {
      case 'atr': return 'ATR_DYNAMIC';
      case 'supportResistance': return 'SUPPORT_RESISTANCE';
      case 'liquidity': return 'LIQUIDITY_AVOIDANCE';
      case 'time': return 'TIME_ADJUSTED';
      case 'ai': return 'AI_OPTIMIZED';
      default: return 'BASIC_INVALIDATION';
    }
  }

  private calculateRiskReward(stopPrice: number, request: StopLossOptimizationRequest): number {
    const risk = Math.abs(request.entryPrice - stopPrice);
    const reward = Math.abs(request.currentPrice - request.entryPrice) * 2; // Simplified 2:1 target
    return risk > 0 ? reward / risk : 0;
  }

  private generateStopRecommendationReasoning(analyses: any, weights: any, primaryType: StopLossType): string {
    return `Primary recommendation based on ${primaryType} analysis with supporting factors from other methods.`;
  }

  private setupMonitoringRules(analyses: any, request: StopLossOptimizationRequest): StopLossIntelligence['finalRecommendation']['monitoringRules'] {
    return {
      atrThreshold: 20, // 20% ATR change
      proximityThreshold: 0.005, // 0.5% proximity to S/R
      timeThreshold: 240, // 4 hours
      volatilityThreshold: 30 // 30% volatility spike
    };
  }

  private calculateOverallConfidence(analyses: any, weights: Record<string, number>): number {
    const weightedConfidence = 
      (analyses.atrAnalysis.confidence * weights.atr) +
      (analyses.supportResistanceAnalysis.confidence * weights.supportResistance) +
      (analyses.liquidityAnalysis.confidence * weights.liquidity) +
      (analyses.aiOptimization.confidence * weights.ai) +
      (75 * weights.basic) + // Basic confidence
      (70 * weights.time); // Time confidence
    
    return Math.round(weightedConfidence);
  }

  private assessStopHuntingRisk(liquidityAnalysis: any, srAnalysis: any): StopLossIntelligence['riskAssessment']['stopHuntingRisk'] {
    const riskPools = liquidityAnalysis.riskPools?.length || 0;
    if (riskPools >= 3) return 'EXTREME';
    if (riskPools >= 2) return 'HIGH';
    if (riskPools >= 1) return 'MEDIUM';
    return 'LOW';
  }

  private assessGapRisk(atrAnalysis: any, timeAnalysis: any): StopLossIntelligence['riskAssessment']['gapRisk'] {
    if (atrAnalysis.metrics.percentile > 80) return 'HIGH';
    if (atrAnalysis.metrics.percentile > 60) return 'MEDIUM';
    return 'LOW';
  }

  private assessLiquidityRisk(liquidityAnalysis: any, timeAnalysis: any): StopLossIntelligence['riskAssessment']['liquidityRisk'] {
    if (timeAnalysis.currentSession.liquidityExpectation === 'LOW') return 'HIGH';
    if (timeAnalysis.currentSession.liquidityExpectation === 'MEDIUM') return 'MEDIUM';
    return 'LOW';
  }

  private assessVolatilityRisk(atrAnalysis: any): StopLossIntelligence['riskAssessment']['volatilityRisk'] {
    if (atrAnalysis.metrics.trend === 'EXPANDING') return 'HIGH';
    if (atrAnalysis.metrics.percentile > 75) return 'HIGH';
    if (atrAnalysis.metrics.percentile > 50) return 'MEDIUM';
    return 'LOW';
  }

  private calculateOverallRisk(risks: {
    stopHuntingRisk: string;
    gapRisk: string;
    liquidityRisk: string;
    volatilityRisk: string;
  }): StopLossIntelligence['riskAssessment']['overallRisk'] {
    const riskValues = Object.values(risks);
    const highRisks = riskValues.filter(r => r === 'HIGH' || r === 'EXTREME').length;
    const mediumRisks = riskValues.filter(r => r === 'MEDIUM').length;
    
    if (riskValues.includes('EXTREME') || highRisks >= 3) return 'EXTREME';
    if (highRisks >= 2) return 'HIGH';
    if (highRisks >= 1 || mediumRisks >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private generateMitigationStrategies(riskAssessment: any): string[] {
    const strategies: string[] = [];
    
    if (riskAssessment.stopHuntingRisk === 'HIGH' || riskAssessment.stopHuntingRisk === 'EXTREME') {
      strategies.push('Consider placing stop beyond obvious liquidity pools');
      strategies.push('Use dynamic stop adjustment to avoid stop hunting');
    }
    
    if (riskAssessment.volatilityRisk === 'HIGH') {
      strategies.push('Increase stop distance to account for volatility');
      strategies.push('Consider volatility-based position sizing');
    }
    
    if (riskAssessment.liquidityRisk === 'HIGH') {
      strategies.push('Avoid trading during low liquidity periods');
      strategies.push('Use smaller position sizes during illiquid sessions');
    }
    
    if (riskAssessment.gapRisk === 'HIGH') {
      strategies.push('Consider overnight gap risk in position sizing');
      strategies.push('Monitor news events that could cause gaps');
    }
    
    return strategies;
  }
}