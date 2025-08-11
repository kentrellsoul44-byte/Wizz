import type { 
  MarketRegimeContext, 
  VolatilityMetrics, 
  TrendMetrics, 
  RangingMetrics, 
  MomentumMetrics,
  RegimeDetectionConfig,
  RegimeTransition,
  TimeframeType,
  MarketTrendRegime,
  MarketDirectionRegime,
  VolatilityRegime,
  MomentumRegime
} from '../types';

export class MarketRegimeDetectionService {
  private config: RegimeDetectionConfig;
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private regimeHistory: MarketRegimeContext[] = [];
  
  constructor(config?: Partial<RegimeDetectionConfig>) {
    this.config = {
      lookbackPeriod: config?.lookbackPeriod ?? 30,
      updateFrequency: config?.updateFrequency ?? 15,
      volatilityWindow: config?.volatilityWindow ?? 14,
      trendWindow: config?.trendWindow ?? 20,
      momentumWindow: config?.momentumWindow ?? 14,
      thresholds: {
        volatility: {
          low: config?.thresholds?.volatility?.low ?? 0.5,
          normal: config?.thresholds?.volatility?.normal ?? 1.5,
          high: config?.thresholds?.volatility?.high ?? 3.0,
        },
        trend: {
          weak: config?.thresholds?.trend?.weak ?? 25,
          moderate: config?.thresholds?.trend?.moderate ?? 40,
          strong: config?.thresholds?.trend?.strong ?? 60,
        },
        ranging: {
          efficiency: config?.thresholds?.ranging?.efficiency ?? 30,
          consolidation: config?.thresholds?.ranging?.consolidation ?? 70,
        },
      },
      ...config,
    };
  }

  /**
   * Main method to detect current market regime from price data
   */
  async detectMarketRegime(
    priceData: number[], 
    volumeData: number[], 
    timeframe: TimeframeType = '1H'
  ): Promise<MarketRegimeContext> {
    if (priceData.length < this.config.volatilityWindow) {
      throw new Error('Insufficient price data for regime detection');
    }

    // Update internal history
    this.priceHistory = priceData;
    this.volumeHistory = volumeData;

    // Calculate core metrics
    const volatilityMetrics = this.calculateVolatilityMetrics(priceData);
    const trendMetrics = this.calculateTrendMetrics(priceData);
    const rangingMetrics = this.calculateRangingMetrics(priceData);
    const momentumMetrics = this.calculateMomentumMetrics(priceData);

    // Determine regime classifications
    const trendRegime = this.classifyTrendRegime(trendMetrics, momentumMetrics);
    const directionRegime = this.classifyDirectionRegime(trendMetrics, rangingMetrics);
    const volatilityRegime = volatilityMetrics.regime;
    const momentumRegime = momentumMetrics.regime;

    // Calculate overall regime
    const overallRegime = this.determineOverallRegime(
      trendRegime, 
      directionRegime, 
      volatilityRegime, 
      momentumRegime
    );

    // Calculate confidence and stability
    const confidence = this.calculateConfidence(
      volatilityMetrics, 
      trendMetrics, 
      rangingMetrics, 
      momentumMetrics
    );
    const stability = this.calculateStability();

    // Generate analysis adjustments
    const analysisAdjustments = this.generateAnalysisAdjustments(
      overallRegime, 
      volatilityRegime, 
      trendRegime, 
      momentumRegime
    );

    // Get historical context
    const regimeHistory = this.getRegimeHistory();

    // Generate warnings and opportunities
    const { warnings, opportunities } = this.generateInsights(
      overallRegime, 
      volatilityMetrics, 
      trendMetrics, 
      momentumMetrics
    );

    const regimeContext: MarketRegimeContext = {
      timestamp: new Date().toISOString(),
      timeframe,
      trendRegime,
      directionRegime,
      volatilityRegime,
      momentumRegime,
      volatilityMetrics,
      trendMetrics,
      rangingMetrics,
      momentumMetrics,
      overallRegime,
      confidence,
      stability,
      analysisAdjustments,
      regimeHistory,
      warnings,
      opportunities,
      nextReviewTime: new Date(Date.now() + this.config.updateFrequency * 60000).toISOString(),
    };

    // Store in history
    this.regimeHistory.push(regimeContext);
    if (this.regimeHistory.length > 100) {
      this.regimeHistory = this.regimeHistory.slice(-100);
    }

    return regimeContext;
  }

  /**
   * Calculate volatility metrics using multiple methods
   */
  private calculateVolatilityMetrics(prices: number[]): VolatilityMetrics {
    const returns = this.calculateReturns(prices);
    const atr = this.calculateATR(prices);
    const atrNormalized = (atr / prices[prices.length - 1]) * 100;
    const standardDeviation = this.calculateStandardDeviation(returns);
    const volatilityPercentile = this.calculateVolatilityPercentile(standardDeviation);
    
    // Determine volatility regime
    let regime: VolatilityRegime;
    if (atrNormalized < this.config.thresholds.volatility.low) {
      regime = 'LOW';
    } else if (atrNormalized < this.config.thresholds.volatility.normal) {
      regime = 'NORMAL';
    } else if (atrNormalized < this.config.thresholds.volatility.high) {
      regime = 'HIGH';
    } else {
      regime = 'EXTREME';
    }

    // Detect volatility clustering
    const isVolatilityCluster = this.detectVolatilityCluster(returns);

    return {
      atr,
      atrNormalized,
      standardDeviation,
      volatilityPercentile,
      regime,
      isVolatilityCluster,
    };
  }

  /**
   * Calculate trend metrics using ADX and other indicators
   */
  private calculateTrendMetrics(prices: number[]): TrendMetrics {
    const adx = this.calculateADX(prices);
    const direction = this.determineTrendDirection(prices);
    const consistency = this.calculateTrendConsistency(prices);
    const trendAge = this.calculateTrendAge(prices);
    
    // Determine trend strength
    let trendStrength: TrendMetrics['trendStrength'];
    if (adx < 20) {
      trendStrength = 'VERY_WEAK';
    } else if (adx < this.config.thresholds.trend.weak) {
      trendStrength = 'WEAK';
    } else if (adx < this.config.thresholds.trend.moderate) {
      trendStrength = 'MODERATE';
    } else if (adx < this.config.thresholds.trend.strong) {
      trendStrength = 'STRONG';
    } else {
      trendStrength = 'VERY_STRONG';
    }

    // This will be set by the parent function
    const regime: MarketTrendRegime = 'NEUTRAL';

    return {
      adx,
      trendStrength,
      direction,
      consistency,
      trendAge,
      regime,
    };
  }

  /**
   * Calculate ranging market metrics
   */
  private calculateRangingMetrics(prices: number[]): RangingMetrics {
    const efficiency = this.calculatePriceEfficiency(prices);
    const consolidationStrength = this.calculateConsolidationStrength(prices);
    const breakoutProbability = this.calculateBreakoutProbability(prices);
    const supportResistanceStrength = this.calculateSRStrength(prices);
    
    let rangeQuality: RangingMetrics['rangeQuality'];
    if (consolidationStrength > 80) {
      rangeQuality = 'EXCELLENT';
    } else if (consolidationStrength > 60) {
      rangeQuality = 'GOOD';
    } else if (consolidationStrength > 40) {
      rangeQuality = 'FAIR';
    } else {
      rangeQuality = 'POOR';
    }

    return {
      efficiency,
      consolidationStrength,
      breakoutProbability,
      rangeQuality,
      supportResistanceStrength,
    };
  }

  /**
   * Calculate momentum metrics
   */
  private calculateMomentumMetrics(prices: number[]): MomentumMetrics {
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const roc = this.calculateROC(prices);
    const divergenceDetected = this.detectDivergence(prices, rsi);
    const momentumShift = this.detectMomentumShift(rsi, macd);
    
    // Determine momentum regime
    let regime: MomentumRegime;
    if (Math.abs(macd.histogram) > Math.abs(this.getHistoricalAverage(this.getMACDHistory(), 10)) * 1.5) {
      regime = 'ACCELERATING';
    } else if (Math.abs(macd.histogram) < Math.abs(this.getHistoricalAverage(this.getMACDHistory(), 10)) * 0.5) {
      regime = 'DECELERATING';
    } else if (this.calculateVolatility(this.getROCHistory()) < 0.5) {
      regime = 'STABLE';
    } else {
      regime = 'CHOPPY';
    }

    return {
      rsi,
      macd,
      roc,
      divergenceDetected,
      regime,
      momentumShift,
    };
  }

  /**
   * Classify the overall trend regime
   */
  private classifyTrendRegime(
    trendMetrics: TrendMetrics, 
    momentumMetrics: MomentumMetrics
  ): MarketTrendRegime {
    const { adx, direction, consistency } = trendMetrics;
    const { rsi, momentumShift } = momentumMetrics;

    if (direction === 'UP') {
      if (adx > 50 && rsi > 60 && consistency > 70 && momentumShift === 'BULLISH') {
        return 'STRONG_BULL';
      } else if (adx > 25 && rsi > 50) {
        return 'WEAK_BULL';
      }
    } else if (direction === 'DOWN') {
      if (adx > 50 && rsi < 40 && consistency > 70 && momentumShift === 'BEARISH') {
        return 'STRONG_BEAR';
      } else if (adx > 25 && rsi < 50) {
        return 'WEAK_BEAR';
      }
    }

    return 'NEUTRAL';
  }

  /**
   * Classify direction regime (trending vs ranging)
   */
  private classifyDirectionRegime(
    trendMetrics: TrendMetrics, 
    rangingMetrics: RangingMetrics
  ): MarketDirectionRegime {
    const { adx, trendStrength } = trendMetrics;
    const { efficiency, consolidationStrength } = rangingMetrics;

    if (adx > 40 && efficiency > 60) {
      return 'TRENDING';
    } else if (adx < 20 && consolidationStrength > this.config.thresholds.ranging.consolidation) {
      return 'RANGING';
    } else {
      return 'TRANSITIONAL';
    }
  }

  /**
   * Determine overall market regime
   */
  private determineOverallRegime(
    trendRegime: MarketTrendRegime,
    directionRegime: MarketDirectionRegime,
    volatilityRegime: VolatilityRegime,
    momentumRegime: MomentumRegime
  ): MarketRegimeContext['overallRegime'] {
    if (directionRegime === 'TRANSITIONAL' || volatilityRegime === 'EXTREME') {
      return 'TRANSITIONAL';
    }

    if (trendRegime === 'STRONG_BULL' || trendRegime === 'WEAK_BULL') {
      return directionRegime === 'TRENDING' ? 'BULL_TRENDING' : 'BULL_RANGING';
    } else if (trendRegime === 'STRONG_BEAR' || trendRegime === 'WEAK_BEAR') {
      return directionRegime === 'TRENDING' ? 'BEAR_TRENDING' : 'BEAR_RANGING';
    } else {
      return directionRegime === 'TRENDING' ? 'NEUTRAL_TRENDING' : 'NEUTRAL_RANGING';
    }
  }

  /**
   * Calculate confidence in regime detection
   */
  private calculateConfidence(
    volatilityMetrics: VolatilityMetrics,
    trendMetrics: TrendMetrics,
    rangingMetrics: RangingMetrics,
    momentumMetrics: MomentumMetrics
  ): number {
    let confidence = 50; // Base confidence

    // Volatility confidence
    if (volatilityMetrics.volatilityPercentile > 80 || volatilityMetrics.volatilityPercentile < 20) {
      confidence += 15;
    }

    // Trend confidence
    if (trendMetrics.adx > 40) {
      confidence += 20;
    } else if (trendMetrics.adx < 20) {
      confidence += 10;
    }

    // Consistency bonus
    if (trendMetrics.consistency > 70) {
      confidence += 10;
    }

    // Momentum alignment
    if (!momentumMetrics.divergenceDetected) {
      confidence += 10;
    }

    // Range quality
    if (rangingMetrics.rangeQuality === 'EXCELLENT') {
      confidence += 15;
    }

    return Math.min(95, Math.max(20, confidence));
  }

  /**
   * Calculate regime stability
   */
  private calculateStability(): number {
    if (this.regimeHistory.length < 3) return 50;

    const recentRegimes = this.regimeHistory.slice(-5);
    const uniqueRegimes = new Set(recentRegimes.map(r => r.overallRegime));
    
    // More stable if fewer regime changes
    const stabilityScore = Math.max(20, 100 - (uniqueRegimes.size - 1) * 20);
    
    return stabilityScore;
  }

  /**
   * Generate context-aware analysis adjustments
   */
  private generateAnalysisAdjustments(
    overallRegime: MarketRegimeContext['overallRegime'],
    volatilityRegime: VolatilityRegime,
    trendRegime: MarketTrendRegime,
    momentumRegime: MomentumRegime
  ): MarketRegimeContext['analysisAdjustments'] {
    let riskMultiplier = 1.0;
    let stopLossAdjustment = 1.0;
    let takeProfitAdjustment = 1.0;
    let timeframeBias: 'LOWER' | 'HIGHER' | 'NONE' = 'NONE';
    let entryApproach: 'AGGRESSIVE' | 'CONSERVATIVE' | 'PATIENT' | 'SCALPING' = 'CONSERVATIVE';

    // Volatility adjustments
    switch (volatilityRegime) {
      case 'LOW':
        riskMultiplier = 1.2;
        stopLossAdjustment = 0.8;
        entryApproach = 'PATIENT';
        break;
      case 'HIGH':
        riskMultiplier = 0.7;
        stopLossAdjustment = 1.3;
        timeframeBias = 'LOWER';
        entryApproach = 'CONSERVATIVE';
        break;
      case 'EXTREME':
        riskMultiplier = 0.5;
        stopLossAdjustment = 1.5;
        timeframeBias = 'LOWER';
        entryApproach = 'SCALPING';
        break;
    }

    // Trend adjustments
    switch (trendRegime) {
      case 'STRONG_BULL':
      case 'STRONG_BEAR':
        takeProfitAdjustment = 1.4;
        timeframeBias = 'HIGHER';
        entryApproach = 'AGGRESSIVE';
        break;
      case 'WEAK_BULL':
      case 'WEAK_BEAR':
        takeProfitAdjustment = 1.1;
        break;
    }

    // Regime-specific adjustments
    switch (overallRegime) {
      case 'BULL_TRENDING':
      case 'BEAR_TRENDING':
        riskMultiplier *= 1.1;
        break;
      case 'NEUTRAL_RANGING':
        takeProfitAdjustment = 0.8;
        entryApproach = 'SCALPING';
        break;
      case 'TRANSITIONAL':
        riskMultiplier *= 0.8;
        entryApproach = 'PATIENT';
        break;
    }

    return {
      riskMultiplier,
      stopLossAdjustment,
      takeProfitAdjustment,
      timeframeBias,
      entryApproach,
    };
  }

  /**
   * Get regime history summary
   */
  private getRegimeHistory(): MarketRegimeContext['regimeHistory'] {
    if (this.regimeHistory.length === 0) {
      return {
        previousRegime: 'UNKNOWN',
        timeInCurrentRegime: 0,
        averageRegimeDuration: 0,
        recentRegimeChanges: 0,
      };
    }

    const currentRegime = this.regimeHistory[this.regimeHistory.length - 1];
    const previousRegime = this.regimeHistory.length > 1 
      ? this.regimeHistory[this.regimeHistory.length - 2].overallRegime 
      : 'UNKNOWN';

    // Calculate time in current regime
    const regimeStart = this.findRegimeStart(currentRegime.overallRegime);
    const timeInCurrentRegime = regimeStart ? 
      (Date.now() - new Date(regimeStart).getTime()) / (1000 * 60 * 60) : 0;

    // Calculate average regime duration
    const averageRegimeDuration = this.calculateAverageRegimeDuration();

    // Count recent regime changes
    const recentRegimeChanges = this.countRecentRegimeChanges();

    return {
      previousRegime,
      timeInCurrentRegime,
      averageRegimeDuration,
      recentRegimeChanges,
    };
  }

  /**
   * Generate insights, warnings, and opportunities
   */
  private generateInsights(
    overallRegime: MarketRegimeContext['overallRegime'],
    volatilityMetrics: VolatilityMetrics,
    trendMetrics: TrendMetrics,
    momentumMetrics: MomentumMetrics
  ): { warnings: string[]; opportunities: string[] } {
    const warnings: string[] = [];
    const opportunities: string[] = [];

    // Volatility warnings
    if (volatilityMetrics.regime === 'EXTREME') {
      warnings.push('Extreme volatility detected - consider reducing position sizes');
    }
    if (volatilityMetrics.isVolatilityCluster) {
      warnings.push('Volatility clustering detected - expect continued high volatility');
    }

    // Trend warnings
    if (trendMetrics.trendAge > 30) {
      warnings.push('Trend is mature - watch for potential reversal signals');
    }
    if (trendMetrics.consistency < 40) {
      warnings.push('Trend lacks consistency - be cautious of false breakouts');
    }

    // Momentum warnings
    if (momentumMetrics.divergenceDetected) {
      warnings.push('Price-momentum divergence detected - potential trend weakness');
    }

    // Regime-specific opportunities
    switch (overallRegime) {
      case 'BULL_TRENDING':
        opportunities.push('Strong bullish trend - consider trend-following strategies');
        opportunities.push('Look for pullback entries on higher timeframes');
        break;
      case 'BEAR_TRENDING':
        opportunities.push('Strong bearish trend - consider short positions');
        opportunities.push('Watch for bounce-shorting opportunities');
        break;
      case 'NEUTRAL_RANGING':
        opportunities.push('Range-bound market - consider mean-reversion strategies');
        opportunities.push('Trade range boundaries with tight stops');
        break;
      case 'TRANSITIONAL':
        opportunities.push('Market in transition - wait for clearer direction');
        opportunities.push('Focus on lower timeframes for scalping opportunities');
        break;
    }

    // Volatility opportunities
    if (volatilityMetrics.regime === 'LOW') {
      opportunities.push('Low volatility environment - consider breakout strategies');
    }

    return { warnings, opportunities };
  }

  // Technical indicator calculation methods
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateATR(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i];
      const low = prices[i];
      const prevClose = prices[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    return this.calculateSMA(trueRanges.slice(-period));
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateVolatilityPercentile(currentVol: number): number {
    // Simplified percentile calculation - in practice, use historical data
    const historicalVols = this.getHistoricalVolatilities();
    if (historicalVols.length === 0) return 50;
    
    const sorted = [...historicalVols].sort((a, b) => a - b);
    const rank = sorted.filter(vol => vol <= currentVol).length;
    return (rank / sorted.length) * 100;
  }

  private detectVolatilityCluster(returns: number[]): boolean {
    if (returns.length < 10) return false;
    
    const recentReturns = returns.slice(-5);
    const avgRecent = this.calculateStandardDeviation(recentReturns);
    const avgHistorical = this.calculateStandardDeviation(returns.slice(-20, -5));
    
    return avgRecent > avgHistorical * 1.5;
  }

  private calculateADX(prices: number[], period: number = 14): number {
    // Simplified ADX calculation
    if (prices.length < period * 2) return 0;
    
    const trendStrength = this.calculateTrendStrength(prices, period);
    return Math.min(100, trendStrength * 100);
  }

  private determineTrendDirection(prices: number[]): 'UP' | 'DOWN' | 'SIDEWAYS' {
    if (prices.length < 20) return 'SIDEWAYS';
    
    const recent = prices.slice(-10);
    const earlier = prices.slice(-20, -10);
    
    const recentAvg = this.calculateSMA(recent);
    const earlierAvg = this.calculateSMA(earlier);
    
    const change = (recentAvg - earlierAvg) / earlierAvg;
    
    if (change > 0.02) return 'UP';
    if (change < -0.02) return 'DOWN';
    return 'SIDEWAYS';
  }

  private calculateTrendConsistency(prices: number[]): number {
    if (prices.length < 10) return 0;
    
    const direction = this.determineTrendDirection(prices);
    if (direction === 'SIDEWAYS') return 0;
    
    let consistentPeriods = 0;
    const isUpTrend = direction === 'UP';
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if ((isUpTrend && change > 0) || (!isUpTrend && change < 0)) {
        consistentPeriods++;
      }
    }
    
    return (consistentPeriods / (prices.length - 1)) * 100;
  }

  private calculateTrendAge(prices: number[]): number {
    // Simplified trend age calculation - count periods since last major reversal
    const direction = this.determineTrendDirection(prices);
    if (direction === 'SIDEWAYS') return 0;
    
    const isUpTrend = direction === 'UP';
    let age = 0;
    
    for (let i = prices.length - 1; i > 0; i--) {
      const change = prices[i] - prices[i - 1];
      if ((isUpTrend && change > 0) || (!isUpTrend && change < 0)) {
        age++;
      } else {
        break;
      }
    }
    
    return age;
  }

  private calculatePriceEfficiency(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const netMovement = Math.abs(prices[prices.length - 1] - prices[0]);
    let totalMovement = 0;
    
    for (let i = 1; i < prices.length; i++) {
      totalMovement += Math.abs(prices[i] - prices[i - 1]);
    }
    
    return totalMovement > 0 ? (netMovement / totalMovement) * 100 : 0;
  }

  private calculateConsolidationStrength(prices: number[]): number {
    if (prices.length < 10) return 0;
    
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min;
    const currentPrice = prices[prices.length - 1];
    
    // Check how well price respects the range
    const rangeRespect = prices.filter(price => 
      price >= min + range * 0.1 && price <= max - range * 0.1
    ).length / prices.length;
    
    return rangeRespect * 100;
  }

  private calculateBreakoutProbability(prices: number[]): number {
    // Simplified breakout probability based on consolidation time and volatility
    const consolidationStrength = this.calculateConsolidationStrength(prices);
    const volatility = this.calculateStandardDeviation(this.calculateReturns(prices));
    
    // Lower consolidation strength and higher volatility = higher breakout probability
    return Math.min(100, Math.max(0, 100 - consolidationStrength + volatility * 1000));
  }

  private calculateSRStrength(prices: number[]): number {
    // Simplified support/resistance strength calculation
    const levels = this.findKeyLevels(prices);
    return levels.length * 20; // More levels = stronger S/R
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    const changes = this.calculateReturns(prices);
    const recentChanges = changes.slice(-period);
    
    const gains = recentChanges.filter(change => change > 0);
    const losses = recentChanges.filter(change => change < 0).map(loss => Math.abs(loss));
    
    const avgGain = gains.length > 0 ? gains.reduce((sum, gain) => sum + gain, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, loss) => sum + loss, 0) / losses.length : 0;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { line: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    // For simplicity, using SMA for signal line instead of EMA
    const macdHistory = this.getMACDHistory();
    macdHistory.push(macdLine);
    const signal = this.calculateSMA(macdHistory.slice(-9));
    
    const histogram = macdLine - signal;
    
    return { line: macdLine, signal, histogram };
  }

  private calculateROC(prices: number[], period: number = 10): number {
    if (prices.length < period + 1) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    
    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  private detectDivergence(prices: number[], rsi: number): boolean {
    // Simplified divergence detection
    if (prices.length < 20) return false;
    
    const recentPrices = prices.slice(-10);
    const earlierPrices = prices.slice(-20, -10);
    
    const priceDirection = this.calculateSMA(recentPrices) > this.calculateSMA(earlierPrices);
    const rsiDirection = rsi > 50;
    
    return priceDirection !== rsiDirection;
  }

  private detectMomentumShift(rsi: number, macd: any): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (rsi > 60 && macd.histogram > 0) return 'BULLISH';
    if (rsi < 40 && macd.histogram < 0) return 'BEARISH';
    return 'NEUTRAL';
  }

  // Helper methods
  private calculateSMA(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateTrendStrength(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const sma = this.calculateSMA(prices.slice(-period));
    const currentPrice = prices[prices.length - 1];
    
    return Math.abs(currentPrice - sma) / sma;
  }

  private findKeyLevels(prices: number[]): number[] {
    // Simplified key level detection
    const levels: number[] = [];
    const tolerance = 0.001; // 0.1% tolerance
    
    for (let i = 1; i < prices.length - 1; i++) {
      const current = prices[i];
      const prev = prices[i - 1];
      const next = prices[i + 1];
      
      // Local high
      if (current > prev && current > next) {
        levels.push(current);
      }
      // Local low
      if (current < prev && current < next) {
        levels.push(current);
      }
    }
    
    return levels.filter((level, index, arr) => 
      arr.findIndex(l => Math.abs(l - level) / level < tolerance) === index
    );
  }

  private findRegimeStart(regime: string): string | null {
    for (let i = this.regimeHistory.length - 1; i >= 0; i--) {
      if (this.regimeHistory[i].overallRegime !== regime) {
        return i < this.regimeHistory.length - 1 ? this.regimeHistory[i + 1].timestamp : null;
      }
    }
    return this.regimeHistory.length > 0 ? this.regimeHistory[0].timestamp : null;
  }

  private calculateAverageRegimeDuration(): number {
    if (this.regimeHistory.length < 2) return 0;
    
    const durations: number[] = [];
    let currentRegime = this.regimeHistory[0].overallRegime;
    let regimeStart = new Date(this.regimeHistory[0].timestamp).getTime();
    
    for (let i = 1; i < this.regimeHistory.length; i++) {
      if (this.regimeHistory[i].overallRegime !== currentRegime) {
        const duration = (new Date(this.regimeHistory[i].timestamp).getTime() - regimeStart) / (1000 * 60 * 60);
        durations.push(duration);
        currentRegime = this.regimeHistory[i].overallRegime;
        regimeStart = new Date(this.regimeHistory[i].timestamp).getTime();
      }
    }
    
    return durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
  }

  private countRecentRegimeChanges(): number {
    if (this.regimeHistory.length < 2) return 0;
    
    const recentHistory = this.regimeHistory.slice(-10);
    let changes = 0;
    
    for (let i = 1; i < recentHistory.length; i++) {
      if (recentHistory[i].overallRegime !== recentHistory[i - 1].overallRegime) {
        changes++;
      }
    }
    
    return changes;
  }

  private getHistoricalVolatilities(): number[] {
    // In a real implementation, this would fetch from a database
    return [];
  }

  private getMACDHistory(): number[] {
    // In a real implementation, this would maintain MACD history
    return [];
  }

  private getROCHistory(): number[] {
    // In a real implementation, this would maintain ROC history
    return [];
  }

  private getHistoricalAverage(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  }

  private calculateVolatility(values: number[]): number {
    return this.calculateStandardDeviation(values);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RegimeDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RegimeDetectionConfig {
    return { ...this.config };
  }

  /**
   * Reset detection history
   */
  resetHistory(): void {
    this.regimeHistory = [];
    this.priceHistory = [];
    this.volumeHistory = [];
  }

  /**
   * Get regime history
   */
  getRegimeHistoryData(): MarketRegimeContext[] {
    return [...this.regimeHistory];
  }
}