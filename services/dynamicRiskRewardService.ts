import type { TimeframeType, AnalysisResult } from "../types";

// Market volatility metrics
export interface VolatilityMetrics {
  currentVolatility: number; // Current volatility (0-1 scale)
  historicalVolatility: number; // Historical average volatility
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  volatilityTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  atrValue?: number; // Average True Range if available
  bollingerBandWidth?: number; // Bollinger Band width as volatility indicator
}

// Asset type classification
export interface AssetProfile {
  assetType: 'CRYPTO' | 'FOREX' | 'STOCKS' | 'COMMODITIES' | 'INDICES';
  volatilityProfile: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  typicalRRRange: {
    min: number;
    max: number;
    optimal: number;
  };
  marketHours: {
    is24h: boolean;
    activeHours?: number[];
    activeDays?: number[];
  };
}

// Historical success rate data
export interface HistoricalPerformance {
  totalTrades: number;
  successfulTrades: number;
  successRate: number; // 0-1
  averageRR: number;
  volatilityBasedSuccess: {
    lowVol: { trades: number; successRate: number };
    mediumVol: { trades: number; successRate: number };
    highVol: { trades: number; successRate: number };
    extremeVol: { trades: number; successRate: number };
  };
  timeBasedSuccess: {
    hourly: { [hour: number]: { trades: number; successRate: number } };
    daily: { [day: number]: { trades: number; successRate: number } };
  };
  assetTypeSuccess: {
    [assetType: string]: { trades: number; successRate: number };
  };
}

// Time-based patterns
export interface TimePatterns {
  currentHour: number;
  currentDay: number; // 0-6 (Sunday-Saturday)
  isActiveTradingTime: boolean;
  timeBasedVolatility: number; // 0-1, typical volatility for this time
  sessionStrength: 'WEAK' | 'MODERATE' | 'STRONG';
  marketSession: 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'CRYPTO_24H' | 'STOCK_MARKET';
}

// Dynamic R:R calculation result
export interface DynamicRRResult {
  baseRR: number; // Original fixed R:R requirement
  adjustedRR: number; // Final dynamic R:R requirement
  adjustmentFactors: {
    volatilityAdjustment: number;
    assetTypeAdjustment: number;
    historicalSuccessAdjustment: number;
    timePatternAdjustment: number;
    confidenceAdjustment: number;
  };
  reasoning: string[];
  finalRecommendation: {
    minRR: number;
    optimalRR: number;
    maxRR: number;
    confidence: number;
  };
}

export class DynamicRiskRewardService {
  private static instance: DynamicRiskRewardService;
  private historicalData: Map<string, HistoricalPerformance> = new Map();
  private assetProfiles: Map<string, AssetProfile> = new Map();

  private constructor() {
    this.initializeDefaultAssetProfiles();
  }

  public static getInstance(): DynamicRiskRewardService {
    if (!DynamicRiskRewardService.instance) {
      DynamicRiskRewardService.instance = new DynamicRiskRewardService();
    }
    return DynamicRiskRewardService.instance;
  }

  /**
   * Calculate dynamic risk/reward ratio based on multiple factors
   */
  public calculateDynamicRR(
    baseRR: number,
    volatilityMetrics: VolatilityMetrics,
    assetProfile: AssetProfile,
    historicalPerformance: HistoricalPerformance,
    timePatterns: TimePatterns,
    analysisConfidence: number,
    isUltraMode: boolean = false
  ): DynamicRRResult {
    const adjustments = this.calculateAdjustmentFactors(
      volatilityMetrics,
      assetProfile,
      historicalPerformance,
      timePatterns,
      analysisConfidence,
      isUltraMode
    );

    const totalAdjustment = Object.values(adjustments).reduce((sum, adj) => sum + adj, 0);
    const adjustedRR = Math.max(1.0, baseRR + totalAdjustment);

    const reasoning = this.generateReasoning(adjustments, volatilityMetrics, assetProfile, timePatterns);

    return {
      baseRR,
      adjustedRR,
      adjustmentFactors: adjustments,
      reasoning,
      finalRecommendation: this.generateFinalRecommendation(adjustedRR, analysisConfidence, isUltraMode)
    };
  }

  /**
   * Calculate volatility metrics from price data
   */
  public calculateVolatilityMetrics(
    priceData: Array<{ high: number; low: number; close: number; timestamp: string }>,
    timeframe: TimeframeType
  ): VolatilityMetrics {
    if (priceData.length < 20) {
      return this.getDefaultVolatilityMetrics();
    }

    const returns = this.calculateReturns(priceData);
    const currentVolatility = this.calculateCurrentVolatility(returns);
    const historicalVolatility = this.calculateHistoricalVolatility(returns);
    const volatilityTrend = this.calculateVolatilityTrend(returns);
    const atrValue = this.calculateATR(priceData);
    const bbWidth = this.calculateBollingerBandWidth(priceData);

    const volatilityRegime = this.classifyVolatilityRegime(currentVolatility);

    return {
      currentVolatility,
      historicalVolatility,
      volatilityRegime,
      volatilityTrend,
      atrValue,
      bollingerBandWidth: bbWidth
    };
  }

  /**
   * Analyze time-based patterns
   */
  public analyzeTimePatterns(
    timestamp: string,
    assetType: string
  ): TimePatterns {
    const date = new Date(timestamp);
    const currentHour = date.getUTCHours();
    const currentDay = date.getUTCDay();
    
    const assetProfile = this.getAssetProfile(assetType);
    const isActiveTradingTime = this.isActiveTradingTime(currentHour, currentDay, assetProfile);
    const timeBasedVolatility = this.getTimeBasedVolatility(currentHour, currentDay, assetType);
    const sessionStrength = this.getSessionStrength(currentHour, assetType);
    const marketSession = this.getMarketSession(currentHour, assetType);

    return {
      currentHour,
      currentDay,
      isActiveTradingTime,
      timeBasedVolatility,
      sessionStrength,
      marketSession
    };
  }

  /**
   * Update historical performance data
   */
  public updateHistoricalPerformance(
    assetType: string,
    timeframe: TimeframeType,
    tradeResult: {
      success: boolean;
      rr: number;
      volatility: number;
      hour: number;
      day: number;
    }
  ): void {
    const key = `${assetType}_${timeframe}`;
    const current = this.historicalData.get(key) || this.getDefaultHistoricalPerformance();
    
    // Update basic metrics
    current.totalTrades++;
    if (tradeResult.success) current.successfulTrades++;
    current.successRate = current.successfulTrades / current.totalTrades;
    current.averageRR = (current.averageRR * (current.totalTrades - 1) + tradeResult.rr) / current.totalTrades;

    // Update volatility-based success
    const volCategory = this.classifyVolatilityRegime(tradeResult.volatility);
    const volKey = `${volCategory.toLowerCase()}Vol` as keyof typeof current.volatilityBasedSuccess;
    current.volatilityBasedSuccess[volKey].trades++;
    if (tradeResult.success) {
      current.volatilityBasedSuccess[volKey].successRate = 
        (current.volatilityBasedSuccess[volKey].successRate * (current.volatilityBasedSuccess[volKey].trades - 1) + 1) / 
        current.volatilityBasedSuccess[volKey].trades;
    }

    // Update time-based success
    if (!current.timeBasedSuccess.hourly[tradeResult.hour]) {
      current.timeBasedSuccess.hourly[tradeResult.hour] = { trades: 0, successRate: 0 };
    }
    current.timeBasedSuccess.hourly[tradeResult.hour].trades++;
    if (tradeResult.success) {
      const hourly = current.timeBasedSuccess.hourly[tradeResult.hour];
      hourly.successRate = (hourly.successRate * (hourly.trades - 1) + 1) / hourly.trades;
    }

    if (!current.timeBasedSuccess.daily[tradeResult.day]) {
      current.timeBasedSuccess.daily[tradeResult.day] = { trades: 0, successRate: 0 };
    }
    current.timeBasedSuccess.daily[tradeResult.day].trades++;
    if (tradeResult.success) {
      const daily = current.timeBasedSuccess.daily[tradeResult.day];
      daily.successRate = (daily.successRate * (daily.trades - 1) + 1) / daily.trades;
    }

    // Update asset type success
    if (!current.assetTypeSuccess[assetType]) {
      current.assetTypeSuccess[assetType] = { trades: 0, successRate: 0 };
    }
    current.assetTypeSuccess[assetType].trades++;
    if (tradeResult.success) {
      const assetTypeData = current.assetTypeSuccess[assetType];
      assetTypeData.successRate = (assetTypeData.successRate * (assetTypeData.trades - 1) + 1) / assetTypeData.trades;
    }

    this.historicalData.set(key, current);
  }

  /**
   * Get asset profile for a given asset type
   */
  public getAssetProfile(assetType: string): AssetProfile {
    return this.assetProfiles.get(assetType) || this.getDefaultAssetProfile();
  }

  // Private helper methods

  private calculateAdjustmentFactors(
    volatilityMetrics: VolatilityMetrics,
    assetProfile: AssetProfile,
    historicalPerformance: HistoricalPerformance,
    timePatterns: TimePatterns,
    analysisConfidence: number,
    isUltraMode: boolean
  ): DynamicRRResult['adjustmentFactors'] {
    const volatilityAdjustment = this.calculateVolatilityAdjustment(volatilityMetrics);
    const assetTypeAdjustment = this.calculateAssetTypeAdjustment(assetProfile);
    const historicalSuccessAdjustment = this.calculateHistoricalSuccessAdjustment(historicalPerformance, timePatterns);
    const timePatternAdjustment = this.calculateTimePatternAdjustment(timePatterns);
    const confidenceAdjustment = this.calculateConfidenceAdjustment(analysisConfidence, isUltraMode);

    return {
      volatilityAdjustment,
      assetTypeAdjustment,
      historicalSuccessAdjustment,
      timePatternAdjustment,
      confidenceAdjustment
    };
  }

  private calculateVolatilityAdjustment(volatilityMetrics: VolatilityMetrics): number {
    const { currentVolatility, volatilityRegime, volatilityTrend } = volatilityMetrics;
    
    let adjustment = 0;
    
    // Base adjustment based on volatility regime
    switch (volatilityRegime) {
      case 'LOW':
        adjustment += 0.2; // Lower R:R requirement in low volatility
        break;
      case 'MEDIUM':
        adjustment += 0.0; // No adjustment for medium volatility
        break;
      case 'HIGH':
        adjustment -= 0.3; // Higher R:R requirement in high volatility
        break;
      case 'EXTREME':
        adjustment -= 0.5; // Much higher R:R requirement in extreme volatility
        break;
    }

    // Trend adjustment
    if (volatilityTrend === 'INCREASING') {
      adjustment -= 0.1; // Increasing volatility requires higher R:R
    } else if (volatilityTrend === 'DECREASING') {
      adjustment += 0.1; // Decreasing volatility allows lower R:R
    }

    return adjustment;
  }

  private calculateAssetTypeAdjustment(assetProfile: AssetProfile): number {
    let adjustment = 0;
    
    switch (assetProfile.volatilityProfile) {
      case 'LOW':
        adjustment += 0.1;
        break;
      case 'MEDIUM':
        adjustment += 0.0;
        break;
      case 'HIGH':
        adjustment -= 0.2;
        break;
      case 'EXTREME':
        adjustment -= 0.4;
        break;
    }

    // Adjust based on typical R:R range
    const { optimal } = assetProfile.typicalRRRange;
    if (optimal > 2.5) {
      adjustment -= 0.1; // Assets that typically need higher R:R
    } else if (optimal < 1.8) {
      adjustment += 0.1; // Assets that can work with lower R:R
    }

    return adjustment;
  }

  private calculateHistoricalSuccessAdjustment(
    historicalPerformance: HistoricalPerformance,
    timePatterns: TimePatterns
  ): number {
    if (historicalPerformance.totalTrades < 10) {
      return 0; // Not enough data
    }

    let adjustment = 0;
    
    // Overall success rate adjustment
    if (historicalPerformance.successRate > 0.7) {
      adjustment += 0.1; // High success rate allows lower R:R
    } else if (historicalPerformance.successRate < 0.5) {
      adjustment -= 0.2; // Low success rate requires higher R:R
    }

    // Volatility-based success adjustment
    const volCategory = timePatterns.timeBasedVolatility > 0.7 ? 'highVol' : 
                       timePatterns.timeBasedVolatility > 0.4 ? 'mediumVol' : 'lowVol';
    const volSuccess = historicalPerformance.volatilityBasedSuccess[volCategory];
    
    if (volSuccess.trades > 5) {
      if (volSuccess.successRate > 0.7) {
        adjustment += 0.1;
      } else if (volSuccess.successRate < 0.5) {
        adjustment -= 0.1;
      }
    }

    // Time-based success adjustment
    const hourlySuccess = historicalPerformance.timeBasedSuccess.hourly[timePatterns.currentHour];
    if (hourlySuccess && hourlySuccess.trades > 3) {
      if (hourlySuccess.successRate > 0.7) {
        adjustment += 0.05;
      } else if (hourlySuccess.successRate < 0.5) {
        adjustment -= 0.05;
      }
    }

    return adjustment;
  }

  private calculateTimePatternAdjustment(timePatterns: TimePatterns): number {
    let adjustment = 0;
    
    // Session strength adjustment
    switch (timePatterns.sessionStrength) {
      case 'STRONG':
        adjustment += 0.1; // Strong sessions allow lower R:R
        break;
      case 'MODERATE':
        adjustment += 0.0;
        break;
      case 'WEAK':
        adjustment -= 0.1; // Weak sessions require higher R:R
        break;
    }

    // Active trading time adjustment
    if (timePatterns.isActiveTradingTime) {
      adjustment += 0.05; // Active times allow lower R:R
    } else {
      adjustment -= 0.1; // Inactive times require higher R:R
    }

    // Time-based volatility adjustment
    if (timePatterns.timeBasedVolatility > 0.7) {
      adjustment -= 0.1;
    } else if (timePatterns.timeBasedVolatility < 0.3) {
      adjustment += 0.05;
    }

    return adjustment;
  }

  private calculateConfidenceAdjustment(analysisConfidence: number, isUltraMode: boolean): number {
    let adjustment = 0;
    
    // Confidence-based adjustment
    if (analysisConfidence >= 85) {
      adjustment += 0.1; // High confidence allows lower R:R
    } else if (analysisConfidence < 70) {
      adjustment -= 0.2; // Low confidence requires higher R:R
    }

    // Ultra mode adjustment
    if (isUltraMode) {
      adjustment -= 0.1; // Ultra mode requires higher R:R
    }

    return adjustment;
  }

  private generateReasoning(
    adjustments: DynamicRRResult['adjustmentFactors'],
    volatilityMetrics: VolatilityMetrics,
    assetProfile: AssetProfile,
    timePatterns: TimePatterns
  ): string[] {
    const reasoning: string[] = [];

    if (adjustments.volatilityAdjustment !== 0) {
      reasoning.push(`Volatility adjustment: ${adjustments.volatilityAdjustment > 0 ? '+' : ''}${adjustments.volatilityAdjustment.toFixed(2)} (${volatilityMetrics.volatilityRegime} volatility regime)`);
    }

    if (adjustments.assetTypeAdjustment !== 0) {
      reasoning.push(`Asset type adjustment: ${adjustments.assetTypeAdjustment > 0 ? '+' : ''}${adjustments.assetTypeAdjustment.toFixed(2)} (${assetProfile.volatilityProfile} volatility profile)`);
    }

    if (adjustments.historicalSuccessAdjustment !== 0) {
      reasoning.push(`Historical success adjustment: ${adjustments.historicalSuccessAdjustment > 0 ? '+' : ''}${adjustments.historicalSuccessAdjustment.toFixed(2)} (based on past performance)`);
    }

    if (adjustments.timePatternAdjustment !== 0) {
      reasoning.push(`Time pattern adjustment: ${adjustments.timePatternAdjustment > 0 ? '+' : ''}${adjustments.timePatternAdjustment.toFixed(2)} (${timePatterns.sessionStrength} session, ${timePatterns.isActiveTradingTime ? 'active' : 'inactive'} trading time)`);
    }

    if (adjustments.confidenceAdjustment !== 0) {
      reasoning.push(`Confidence adjustment: ${adjustments.confidenceAdjustment > 0 ? '+' : ''}${adjustments.confidenceAdjustment.toFixed(2)} (analysis confidence factor)`);
    }

    return reasoning;
  }

  private generateFinalRecommendation(
    adjustedRR: number,
    analysisConfidence: number,
    isUltraMode: boolean
  ): DynamicRRResult['finalRecommendation'] {
    const baseMin = adjustedRR;
    const optimal = adjustedRR + 0.3;
    const max = adjustedRR + 0.6;
    
    // Adjust confidence based on mode and analysis confidence
    let confidence = Math.min(95, analysisConfidence + (isUltraMode ? 5 : 0));

    return {
      minRR: Math.max(1.0, baseMin),
      optimalRR: Math.max(1.3, optimal),
      maxRR: Math.max(1.6, max),
      confidence
    };
  }

  // Volatility calculation methods

  private calculateReturns(priceData: Array<{ close: number }>): number[] {
    const returns: number[] = [];
    for (let i = 1; i < priceData.length; i++) {
      const return_ = (priceData[i].close - priceData[i - 1].close) / priceData[i - 1].close;
      returns.push(return_);
    }
    return returns;
  }

  private calculateCurrentVolatility(returns: number[]): number {
    const recentReturns = returns.slice(-20);
    const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
    return Math.sqrt(variance);
  }

  private calculateHistoricalVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateVolatilityTrend(returns: number[]): VolatilityMetrics['volatilityTrend'] {
    if (returns.length < 40) return 'STABLE';
    
    const firstHalf = returns.slice(0, Math.floor(returns.length / 2));
    const secondHalf = returns.slice(Math.floor(returns.length / 2));
    
    const firstVol = this.calculateCurrentVolatility(firstHalf);
    const secondVol = this.calculateCurrentVolatility(secondHalf);
    
    const change = (secondVol - firstVol) / firstVol;
    
    if (change > 0.2) return 'INCREASING';
    if (change < -0.2) return 'DECREASING';
    return 'STABLE';
  }

  private calculateATR(priceData: Array<{ high: number; low: number; close: number }>): number {
    if (priceData.length < 14) return 0;
    
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
    
    const recentTR = trueRanges.slice(-14);
    return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
  }

  private calculateBollingerBandWidth(priceData: Array<{ close: number }>): number {
    if (priceData.length < 20) return 0;
    
    const closes = priceData.map(p => p.close);
    const recentCloses = closes.slice(-20);
    const sma = recentCloses.reduce((sum, c) => sum + c, 0) / recentCloses.length;
    
    const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / recentCloses.length;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);
    
    return (upperBand - lowerBand) / sma; // Normalized bandwidth
  }

  private classifyVolatilityRegime(volatility: number): VolatilityMetrics['volatilityRegime'] {
    if (volatility < 0.01) return 'LOW';
    if (volatility < 0.025) return 'MEDIUM';
    if (volatility < 0.05) return 'HIGH';
    return 'EXTREME';
  }

  // Time pattern analysis methods

  private isActiveTradingTime(hour: number, day: number, assetProfile: AssetProfile): boolean {
    if (assetProfile.marketHours.is24h) return true;
    
    // For non-24h markets, check if current time is within active hours
    if (assetProfile.marketHours.activeHours && assetProfile.marketHours.activeHours.includes(hour)) {
      return true;
    }
    
    return false;
  }

  private getTimeBasedVolatility(hour: number, day: number, assetType: string): number {
    // Simplified time-based volatility calculation
    // In a real implementation, this would be based on historical data
    
    // Higher volatility during major market opens/closes
    if (hour === 8 || hour === 16) return 0.7; // London/NY opens
    if (hour === 0 || hour === 12) return 0.6; // Asian session
    
    // Lower volatility during off-hours
    if (hour >= 22 || hour <= 6) return 0.3;
    
    return 0.5; // Default medium volatility
  }

  private getSessionStrength(hour: number, assetType: string): TimePatterns['sessionStrength'] {
    // Determine session strength based on hour and asset type
    if (assetType.includes('CRYPTO')) return 'STRONG'; // 24h market
    
    // For traditional markets
    if (hour >= 8 && hour <= 16) return 'STRONG'; // Main trading hours
    if (hour >= 6 && hour <= 18) return 'MODERATE'; // Extended hours
    return 'WEAK'; // Off-hours
  }

  private getMarketSession(hour: number, assetType: string): TimePatterns['marketSession'] {
    if (assetType.includes('CRYPTO')) return 'CRYPTO_24H';
    
    if (hour >= 0 && hour < 8) return 'ASIAN';
    if (hour >= 8 && hour < 16) return 'LONDON';
    if (hour >= 13 && hour < 21) return 'NEW_YORK';
    
    return 'ASIAN'; // Default
  }

  // Default data methods

  private getDefaultVolatilityMetrics(): VolatilityMetrics {
    return {
      currentVolatility: 0.02,
      historicalVolatility: 0.02,
      volatilityRegime: 'MEDIUM',
      volatilityTrend: 'STABLE'
    };
  }

  private getDefaultAssetProfile(): AssetProfile {
    return {
      assetType: 'CRYPTO',
      volatilityProfile: 'HIGH',
      typicalRRRange: { min: 1.8, max: 3.0, optimal: 2.2 },
      marketHours: { is24h: true }
    };
  }

  private getDefaultHistoricalPerformance(): HistoricalPerformance {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      successRate: 0,
      averageRR: 2.0,
      volatilityBasedSuccess: {
        lowVol: { trades: 0, successRate: 0 },
        mediumVol: { trades: 0, successRate: 0 },
        highVol: { trades: 0, successRate: 0 },
        extremeVol: { trades: 0, successRate: 0 }
      },
      timeBasedSuccess: {
        hourly: {},
        daily: {}
      },
      assetTypeSuccess: {}
    };
  }

  private initializeDefaultAssetProfiles(): void {
    // Crypto assets
    this.assetProfiles.set('BTC', {
      assetType: 'CRYPTO',
      volatilityProfile: 'HIGH',
      typicalRRRange: { min: 1.8, max: 3.5, optimal: 2.2 },
      marketHours: { is24h: true }
    });

    this.assetProfiles.set('ETH', {
      assetType: 'CRYPTO',
      volatilityProfile: 'HIGH',
      typicalRRRange: { min: 1.8, max: 3.5, optimal: 2.2 },
      marketHours: { is24h: true }
    });

    // Forex pairs
    this.assetProfiles.set('EURUSD', {
      assetType: 'FOREX',
      volatilityProfile: 'MEDIUM',
      typicalRRRange: { min: 1.5, max: 2.8, optimal: 2.0 },
      marketHours: { is24h: false, activeHours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] }
    });

    // Stocks
    this.assetProfiles.set('AAPL', {
      assetType: 'STOCKS',
      volatilityProfile: 'MEDIUM',
      typicalRRRange: { min: 1.5, max: 2.5, optimal: 1.8 },
      marketHours: { is24h: false, activeHours: [13, 14, 15, 16, 17, 18, 19, 20, 21] }
    });

    // Commodities
    this.assetProfiles.set('GOLD', {
      assetType: 'COMMODITIES',
      volatilityProfile: 'MEDIUM',
      typicalRRRange: { min: 1.6, max: 2.8, optimal: 2.0 },
      marketHours: { is24h: false, activeHours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] }
    });
  }
}