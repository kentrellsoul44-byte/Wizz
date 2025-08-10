import type {
  LiquidityPool,
  TimeframeType
} from '../types';

export class LiquidityPoolDetectionService {
  private static instance: LiquidityPoolDetectionService;
  
  public static getInstance(): LiquidityPoolDetectionService {
    if (!LiquidityPoolDetectionService.instance) {
      LiquidityPoolDetectionService.instance = new LiquidityPoolDetectionService();
    }
    return LiquidityPoolDetectionService.instance;
  }

  /**
   * Comprehensive liquidity pool detection
   */
  public detectLiquidityPools(
    priceData: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    currentPrice: number,
    timeframe: TimeframeType = '1H'
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    
    // Detect equal highs and lows
    pools.push(...this.detectEqualHighsLows(priceData, currentPrice, timeframe));
    
    // Detect stop loss clusters
    pools.push(...this.detectStopLossClusters(priceData, currentPrice, timeframe));
    
    // Detect round number levels
    pools.push(...this.detectRoundNumberPools(currentPrice, timeframe));
    
    // Detect previous significant highs/lows
    pools.push(...this.detectPreviousHighsLows(priceData, currentPrice, timeframe));
    
    // Detect option strike levels (if applicable)
    pools.push(...this.detectOptionStrikeLevels(currentPrice, timeframe));
    
    // Remove duplicates and merge similar pools
    const mergedPools = this.mergeSimilarPools(pools);
    
    // Calculate sweep probabilities
    mergedPools.forEach(pool => {
      pool.sweepProbability = this.calculateSweepProbability(pool, priceData, currentPrice);
    });
    
    // Sort by proximity to current price
    return mergedPools.sort((a, b) => a.proximity - b.proximity);
  }

  /**
   * Detect equal highs and lows - classic liquidity pools
   */
  private detectEqualHighsLows(
    priceData: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    currentPrice: number,
    timeframe: TimeframeType
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    const tolerance = this.getEqualLevelTolerance(currentPrice);
    const lookback = this.getLookbackPeriod(timeframe);
    
    const recentData = priceData.slice(-lookback);
    
    // Find equal highs
    const highs = this.extractHighs(recentData);
    const equalHighGroups = this.groupEqualLevels(highs, tolerance);
    
    equalHighGroups.forEach(group => {
      if (group.length >= 2) { // At least 2 equal highs
        const avgPrice = group.reduce((sum, h) => sum + h.price, 0) / group.length;
        const estimatedLiquidity = this.estimateLiquidityAtLevel(group, 'HIGH');
        
        pools.push(this.createLiquidityPool({
          price: avgPrice,
          type: 'EQUAL_HIGHS',
          intensity: this.calculatePoolIntensity(group.length, estimatedLiquidity),
          timeframe,
          estimatedLiquidity,
          currentPrice,
          touches: group.length,
          lastTouch: group[group.length - 1].timestamp
        }));
      }
    });
    
    // Find equal lows
    const lows = this.extractLows(recentData);
    const equalLowGroups = this.groupEqualLevels(lows, tolerance);
    
    equalLowGroups.forEach(group => {
      if (group.length >= 2) { // At least 2 equal lows
        const avgPrice = group.reduce((sum, l) => sum + l.price, 0) / group.length;
        const estimatedLiquidity = this.estimateLiquidityAtLevel(group, 'LOW');
        
        pools.push(this.createLiquidityPool({
          price: avgPrice,
          type: 'EQUAL_LOWS',
          intensity: this.calculatePoolIntensity(group.length, estimatedLiquidity),
          timeframe,
          estimatedLiquidity,
          currentPrice,
          touches: group.length,
          lastTouch: group[group.length - 1].timestamp
        }));
      }
    });
    
    return pools;
  }

  /**
   * Detect stop loss clusters based on technical patterns
   */
  private detectStopLossClusters(
    priceData: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    currentPrice: number,
    timeframe: TimeframeType
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    
    // Detect break of structure points where stops would be placed
    const structureBreaks = this.identifyStructureBreaks(priceData);
    
    structureBreaks.forEach(breakPoint => {
      const stopLevel = this.calculateTypicalStopLevel(breakPoint, priceData);
      const estimatedStops = this.estimateStopOrdersAtLevel(breakPoint, priceData);
      
      if (estimatedStops > this.getMinimumStopThreshold()) {
        pools.push(this.createLiquidityPool({
          price: stopLevel,
          type: 'STOP_CLUSTER',
          intensity: this.calculateStopClusterIntensity(estimatedStops),
          timeframe,
          estimatedLiquidity: estimatedStops,
          currentPrice,
          touches: 1,
          lastTouch: breakPoint.timestamp
        }));
      }
    });
    
    return pools;
  }

  /**
   * Detect round number liquidity pools
   */
  private detectRoundNumberPools(
    currentPrice: number,
    timeframe: TimeframeType
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    const range = currentPrice * 0.15; // 15% range around current price
    
    // Determine significant round numbers based on price level
    const roundNumbers = this.generateSignificantRoundNumbers(currentPrice, range);
    
    roundNumbers.forEach(price => {
      const psychological_strength = this.calculatePsychologicalStrength(price, currentPrice);
      const estimatedLiquidity = this.estimateRoundNumberLiquidity(price, currentPrice);
      
      pools.push(this.createLiquidityPool({
        price,
        type: 'ROUND_NUMBER',
        intensity: psychological_strength,
        timeframe,
        estimatedLiquidity,
        currentPrice,
        touches: 1,
        lastTouch: new Date().toISOString()
      }));
    });
    
    return pools;
  }

  /**
   * Detect previous significant highs and lows
   */
  private detectPreviousHighsLows(
    priceData: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    currentPrice: number,
    timeframe: TimeframeType
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    const lookback = this.getLookbackPeriod(timeframe) * 2; // Extended lookback for historical levels
    
    const historicalData = priceData.slice(-lookback);
    
    // Find significant swing highs
    const swingHighs = this.findSignificantSwingHighs(historicalData, timeframe);
    swingHighs.forEach(high => {
      const estimatedLiquidity = this.estimateLiquidityAtHistoricalLevel(high, historicalData);
      
      pools.push(this.createLiquidityPool({
        price: high.price,
        type: 'PREVIOUS_HIGH_LOW',
        intensity: this.calculateHistoricalLevelIntensity(high, currentPrice),
        timeframe,
        estimatedLiquidity,
        currentPrice,
        touches: high.touches || 1,
        lastTouch: high.timestamp
      }));
    });
    
    // Find significant swing lows
    const swingLows = this.findSignificantSwingLows(historicalData, timeframe);
    swingLows.forEach(low => {
      const estimatedLiquidity = this.estimateLiquidityAtHistoricalLevel(low, historicalData);
      
      pools.push(this.createLiquidityPool({
        price: low.price,
        type: 'PREVIOUS_HIGH_LOW',
        intensity: this.calculateHistoricalLevelIntensity(low, currentPrice),
        timeframe,
        estimatedLiquidity,
        currentPrice,
        touches: low.touches || 1,
        lastTouch: low.timestamp
      }));
    });
    
    return pools;
  }

  /**
   * Detect option strike levels (for assets with options)
   */
  private detectOptionStrikeLevels(
    currentPrice: number,
    timeframe: TimeframeType
  ): LiquidityPool[] {
    const pools: LiquidityPool[] = [];
    
    // This would integrate with options data in a real implementation
    // For now, we'll generate common strike intervals
    const strikeInterval = this.calculateStrikeInterval(currentPrice);
    const range = currentPrice * 0.1; // 10% range
    
    for (let strike = currentPrice - range; strike <= currentPrice + range; strike += strikeInterval) {
      const roundedStrike = Math.round(strike / strikeInterval) * strikeInterval;
      
      if (Math.abs(roundedStrike - currentPrice) > strikeInterval * 0.1) { // Not too close to current price
        const estimatedLiquidity = this.estimateOptionStrikeLiquidity(roundedStrike, currentPrice);
        
        pools.push(this.createLiquidityPool({
          price: roundedStrike,
          type: 'OPTION_STRIKE',
          intensity: this.calculateOptionStrikeIntensity(roundedStrike, currentPrice),
          timeframe,
          estimatedLiquidity,
          currentPrice,
          touches: 1,
          lastTouch: new Date().toISOString()
        }));
      }
    }
    
    return pools;
  }

  /**
   * Create a liquidity pool with full analysis
   */
  private createLiquidityPool(params: {
    price: number;
    type: LiquidityPool['type'];
    intensity: LiquidityPool['intensity'];
    timeframe: TimeframeType;
    estimatedLiquidity: number;
    currentPrice: number;
    touches: number;
    lastTouch: string;
  }): LiquidityPool {
    const {
      price,
      type,
      intensity,
      timeframe,
      estimatedLiquidity,
      currentPrice,
      touches,
      lastTouch
    } = params;
    
    const proximity = Math.abs(currentPrice - price);
    const bufferPips = this.calculateOptimalBuffer(price, type, intensity);
    
    return {
      id: `lp_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      price,
      type,
      intensity,
      timeframe,
      estimatedLiquidity,
      sweepProbability: 0, // Will be calculated later
      proximity,
      avoidanceZone: {
        upper: price + bufferPips,
        lower: price - bufferPips,
        bufferPips
      }
    };
  }

  /**
   * Calculate sweep probability for a liquidity pool
   */
  private calculateSweepProbability(
    pool: LiquidityPool,
    priceData: Array<{
      timestamp: string;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    currentPrice: number
  ): number {
    let probability = 30; // Base probability
    
    // Higher probability for higher intensity pools
    switch (pool.intensity) {
      case 'EXTREME':
        probability += 40;
        break;
      case 'HIGH':
        probability += 25;
        break;
      case 'MEDIUM':
        probability += 10;
        break;
      case 'LOW':
        probability += 0;
        break;
    }
    
    // Higher probability for pools close to current price
    const distancePercent = pool.proximity / currentPrice;
    if (distancePercent < 0.01) probability += 20;       // Within 1%
    else if (distancePercent < 0.02) probability += 15;  // Within 2%
    else if (distancePercent < 0.05) probability += 10;  // Within 5%
    else if (distancePercent > 0.1) probability -= 20;   // Far from price
    
    // Type-specific adjustments
    switch (pool.type) {
      case 'EQUAL_HIGHS':
      case 'EQUAL_LOWS':
        probability += 15; // Classic liquidity pools
        break;
      case 'STOP_CLUSTER':
        probability += 20; // High probability targets
        break;
      case 'ROUND_NUMBER':
        probability += 10; // Psychological levels
        break;
      case 'PREVIOUS_HIGH_LOW':
        probability += 12; // Historical levels
        break;
      case 'OPTION_STRIKE':
        probability += 8; // Option-related
        break;
    }
    
    // Market volatility adjustment
    const recentVolatility = this.calculateRecentVolatility(priceData);
    if (recentVolatility > 0.03) probability += 15; // High volatility increases sweep probability
    else if (recentVolatility < 0.01) probability -= 10; // Low volatility decreases probability
    
    // Time-based adjustment
    const timeSinceLastTouch = this.calculateTimeSinceLastTouch(pool.lastTouch);
    if (timeSinceLastTouch < 24 * 60) probability += 10; // Recent touch increases probability
    
    return Math.max(0, Math.min(100, probability));
  }

  /**
   * Merge similar liquidity pools
   */
  private mergeSimilarPools(pools: LiquidityPool[]): LiquidityPool[] {
    const merged: LiquidityPool[] = [];
    const tolerance = 0.001; // 0.1% tolerance for merging
    
    pools.forEach(pool => {
      const existingPool = merged.find(existing => 
        Math.abs(existing.price - pool.price) / pool.price < tolerance
      );
      
      if (existingPool) {
        // Merge pools - combine liquidity and keep higher intensity
        existingPool.estimatedLiquidity += pool.estimatedLiquidity;
        if (this.getIntensityValue(pool.intensity) > this.getIntensityValue(existingPool.intensity)) {
          existingPool.intensity = pool.intensity;
        }
        
        // Update type to most significant
        if (this.getTypeSignificance(pool.type) > this.getTypeSignificance(existingPool.type)) {
          existingPool.type = pool.type;
        }
      } else {
        merged.push(pool);
      }
    });
    
    return merged;
  }

  // Utility methods for liquidity pool detection

  private getEqualLevelTolerance(currentPrice: number): number {
    // Dynamic tolerance based on price level
    if (currentPrice >= 1000) return 0.001;    // 0.1% for high prices
    if (currentPrice >= 100) return 0.0015;    // 0.15% for medium prices
    if (currentPrice >= 10) return 0.002;      // 0.2% for lower prices
    return 0.003; // 0.3% for very low prices
  }

  private getLookbackPeriod(timeframe: TimeframeType): number {
    const periods: Record<TimeframeType, number> = {
      '1M': 500,
      '5M': 200,
      '15M': 100,
      '30M': 75,
      '1H': 50,
      '4H': 30,
      '12H': 20,
      '1D': 15,
      '3D': 10,
      '1W': 8,
      '1M_MONTHLY': 6
    };
    
    return periods[timeframe] || 50;
  }

  private extractHighs(priceData: Array<{ timestamp: string; high: number; volume: number }>): Array<{ price: number; timestamp: string; volume: number }> {
    return priceData.map(candle => ({
      price: candle.high,
      timestamp: candle.timestamp,
      volume: candle.volume
    }));
  }

  private extractLows(priceData: Array<{ timestamp: string; low: number; volume: number }>): Array<{ price: number; timestamp: string; volume: number }> {
    return priceData.map(candle => ({
      price: candle.low,
      timestamp: candle.timestamp,
      volume: candle.volume
    }));
  }

  private groupEqualLevels(
    levels: Array<{ price: number; timestamp: string; volume: number }>,
    tolerance: number
  ): Array<Array<{ price: number; timestamp: string; volume: number }>> {
    const groups: Array<Array<{ price: number; timestamp: string; volume: number }>> = [];
    
    levels.forEach(level => {
      let assigned = false;
      
      for (const group of groups) {
        const groupAvg = group.reduce((sum, l) => sum + l.price, 0) / group.length;
        if (Math.abs(level.price - groupAvg) / groupAvg <= tolerance) {
          group.push(level);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        groups.push([level]);
      }
    });
    
    return groups;
  }

  private estimateLiquidityAtLevel(
    levels: Array<{ price: number; volume: number }>,
    type: 'HIGH' | 'LOW'
  ): number {
    // Estimate liquidity based on volume and number of touches
    const totalVolume = levels.reduce((sum, l) => sum + l.volume, 0);
    const touchCount = levels.length;
    
    // Simple liquidity estimation - would be more sophisticated in real implementation
    return totalVolume * touchCount * 0.1; // 10% of volume as estimated stops
  }

  private calculatePoolIntensity(touchCount: number, estimatedLiquidity: number): LiquidityPool['intensity'] {
    let score = touchCount * 10 + Math.log10(estimatedLiquidity + 1) * 5;
    
    if (score >= 40) return 'EXTREME';
    if (score >= 25) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  }

  private identifyStructureBreaks(
    priceData: Array<{
      timestamp: string;
      high: number;
      low: number;
      close: number;
    }>
  ): Array<{ price: number; timestamp: string; type: 'BULLISH_BREAK' | 'BEARISH_BREAK' }> {
    const breaks: Array<{ price: number; timestamp: string; type: 'BULLISH_BREAK' | 'BEARISH_BREAK' }> = [];
    
    // Simplified structure break detection
    for (let i = 10; i < priceData.length - 5; i++) {
      const current = priceData[i];
      const previous = priceData.slice(i - 10, i);
      
      // Check for bullish break (breaking above recent highs)
      const recentHigh = Math.max(...previous.map(c => c.high));
      if (current.close > recentHigh) {
        breaks.push({
          price: recentHigh,
          timestamp: current.timestamp,
          type: 'BULLISH_BREAK'
        });
      }
      
      // Check for bearish break (breaking below recent lows)
      const recentLow = Math.min(...previous.map(c => c.low));
      if (current.close < recentLow) {
        breaks.push({
          price: recentLow,
          timestamp: current.timestamp,
          type: 'BEARISH_BREAK'
        });
      }
    }
    
    return breaks;
  }

  private calculateTypicalStopLevel(
    breakPoint: { price: number; type: string },
    priceData: Array<{ high: number; low: number }>
  ): number {
    // Calculate where typical stop losses would be placed
    const buffer = this.calculateTypicalStopBuffer(breakPoint.price);
    
    if (breakPoint.type === 'BULLISH_BREAK') {
      return breakPoint.price - buffer; // Stops below the broken level
    } else {
      return breakPoint.price + buffer; // Stops above the broken level
    }
  }

  private calculateTypicalStopBuffer(price: number): number {
    // Typical buffer traders use for stops
    return price * 0.005; // 0.5% buffer
  }

  private estimateStopOrdersAtLevel(
    breakPoint: { price: number; type: string },
    priceData: Array<{ volume: number }>
  ): number {
    // Estimate number of stop orders at a level
    const avgVolume = priceData.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    
    // Simplified estimation
    return avgVolume * 0.15; // 15% of average volume as estimated stops
  }

  private getMinimumStopThreshold(): number {
    return 1000; // Minimum estimated stops to consider significant
  }

  private calculateStopClusterIntensity(estimatedStops: number): LiquidityPool['intensity'] {
    if (estimatedStops >= 10000) return 'EXTREME';
    if (estimatedStops >= 5000) return 'HIGH';
    if (estimatedStops >= 2000) return 'MEDIUM';
    return 'LOW';
  }

  private generateSignificantRoundNumbers(currentPrice: number, range: number): number[] {
    const numbers: number[] = [];
    
    // Determine appropriate intervals based on price level
    let intervals: number[];
    if (currentPrice >= 1000) {
      intervals = [100, 50, 25]; // Major round numbers for high prices
    } else if (currentPrice >= 100) {
      intervals = [10, 5, 2.5]; // Medium prices
    } else if (currentPrice >= 10) {
      intervals = [1, 0.5, 0.25]; // Lower prices
    } else {
      intervals = [0.1, 0.05, 0.01]; // Very low prices
    }
    
    intervals.forEach(interval => {
      for (let price = currentPrice - range; price <= currentPrice + range; price += interval) {
        const rounded = Math.round(price / interval) * interval;
        if (Math.abs(rounded - currentPrice) > interval * 0.1) { // Not too close to current
          numbers.push(Number(rounded.toFixed(4)));
        }
      }
    });
    
    return [...new Set(numbers)].sort((a, b) => a - b); // Remove duplicates and sort
  }

  private calculatePsychologicalStrength(price: number, currentPrice: number): LiquidityPool['intensity'] {
    const distance = Math.abs(price - currentPrice) / currentPrice;
    
    // Check if it's a major round number
    const isMajorRound = this.isMajorRoundNumber(price);
    
    if (isMajorRound && distance < 0.02) return 'EXTREME';
    if (isMajorRound && distance < 0.05) return 'HIGH';
    if (distance < 0.01) return 'HIGH';
    if (distance < 0.03) return 'MEDIUM';
    return 'LOW';
  }

  private isMajorRoundNumber(price: number): boolean {
    // Check if price is a major round number
    if (price >= 1000) return price % 100 === 0;
    if (price >= 100) return price % 10 === 0;
    if (price >= 10) return price % 1 === 0;
    return price % 0.1 === 0;
  }

  private estimateRoundNumberLiquidity(price: number, currentPrice: number): number {
    const distance = Math.abs(price - currentPrice) / currentPrice;
    const isMajor = this.isMajorRoundNumber(price);
    
    let baseEstimate = 1000;
    if (isMajor) baseEstimate *= 3;
    if (distance < 0.01) baseEstimate *= 2;
    if (distance < 0.05) baseEstimate *= 1.5;
    
    return baseEstimate;
  }

  private findSignificantSwingHighs(
    priceData: Array<{
      timestamp: string;
      high: number;
      volume: number;
    }>,
    timeframe: TimeframeType
  ): Array<{ price: number; timestamp: string; touches?: number }> {
    const strength = this.getSwingStrength(timeframe);
    const swings: Array<{ price: number; timestamp: string; touches?: number }> = [];
    
    for (let i = strength; i < priceData.length - strength; i++) {
      const current = priceData[i];
      let isSwingHigh = true;
      
      for (let j = i - strength; j <= i + strength; j++) {
        if (j !== i && priceData[j].high >= current.high) {
          isSwingHigh = false;
          break;
        }
      }
      
      if (isSwingHigh) {
        swings.push({
          price: current.high,
          timestamp: current.timestamp,
          touches: 1
        });
      }
    }
    
    return swings;
  }

  private findSignificantSwingLows(
    priceData: Array<{
      timestamp: string;
      low: number;
      volume: number;
    }>,
    timeframe: TimeframeType
  ): Array<{ price: number; timestamp: string; touches?: number }> {
    const strength = this.getSwingStrength(timeframe);
    const swings: Array<{ price: number; timestamp: string; touches?: number }> = [];
    
    for (let i = strength; i < priceData.length - strength; i++) {
      const current = priceData[i];
      let isSwingLow = true;
      
      for (let j = i - strength; j <= i + strength; j++) {
        if (j !== i && priceData[j].low <= current.low) {
          isSwingLow = false;
          break;
        }
      }
      
      if (isSwingLow) {
        swings.push({
          price: current.low,
          timestamp: current.timestamp,
          touches: 1
        });
      }
    }
    
    return swings;
  }

  private getSwingStrength(timeframe: TimeframeType): number {
    const strengthMap: Record<TimeframeType, number> = {
      '1M': 5,
      '5M': 5,
      '15M': 7,
      '30M': 10,
      '1H': 12,
      '4H': 15,
      '12H': 20,
      '1D': 25,
      '3D': 30,
      '1W': 35,
      '1M_MONTHLY': 40
    };
    
    return strengthMap[timeframe] || 10;
  }

  private estimateLiquidityAtHistoricalLevel(
    level: { price: number; timestamp: string },
    priceData: Array<{ volume: number }>
  ): number {
    // Estimate liquidity at historical levels
    const avgVolume = priceData.slice(-50).reduce((sum, c) => sum + c.volume, 0) / 50;
    return avgVolume * 0.08; // 8% of average volume
  }

  private calculateHistoricalLevelIntensity(
    level: { price: number },
    currentPrice: number
  ): LiquidityPool['intensity'] {
    const distance = Math.abs(level.price - currentPrice) / currentPrice;
    
    if (distance < 0.01) return 'HIGH';
    if (distance < 0.03) return 'MEDIUM';
    if (distance < 0.08) return 'LOW';
    return 'LOW';
  }

  private calculateStrikeInterval(currentPrice: number): number {
    // Common option strike intervals
    if (currentPrice >= 1000) return 50;
    if (currentPrice >= 500) return 25;
    if (currentPrice >= 100) return 10;
    if (currentPrice >= 50) return 5;
    if (currentPrice >= 10) return 1;
    return 0.5;
  }

  private estimateOptionStrikeLiquidity(strike: number, currentPrice: number): number {
    const distance = Math.abs(strike - currentPrice) / currentPrice;
    
    // Closer strikes have more liquidity
    if (distance < 0.02) return 3000;
    if (distance < 0.05) return 2000;
    if (distance < 0.1) return 1000;
    return 500;
  }

  private calculateOptionStrikeIntensity(strike: number, currentPrice: number): LiquidityPool['intensity'] {
    const distance = Math.abs(strike - currentPrice) / currentPrice;
    
    if (distance < 0.01) return 'HIGH';
    if (distance < 0.03) return 'MEDIUM';
    return 'LOW';
  }

  private calculateOptimalBuffer(
    price: number,
    type: LiquidityPool['type'],
    intensity: LiquidityPool['intensity']
  ): number {
    let buffer = price * 0.002; // Base 0.2% buffer
    
    // Adjust based on pool type
    switch (type) {
      case 'EQUAL_HIGHS':
      case 'EQUAL_LOWS':
        buffer *= 1.5;
        break;
      case 'STOP_CLUSTER':
        buffer *= 2.0;
        break;
      case 'ROUND_NUMBER':
        buffer *= 1.2;
        break;
      default:
        break;
    }
    
    // Adjust based on intensity
    switch (intensity) {
      case 'EXTREME':
        buffer *= 2.5;
        break;
      case 'HIGH':
        buffer *= 2.0;
        break;
      case 'MEDIUM':
        buffer *= 1.5;
        break;
      case 'LOW':
        buffer *= 1.0;
        break;
    }
    
    return buffer;
  }

  private calculateRecentVolatility(priceData: Array<{ high: number; low: number; close: number }>): number {
    if (priceData.length < 2) return 0;
    
    const recentData = priceData.slice(-20); // Last 20 periods
    let volatility = 0;
    
    for (let i = 1; i < recentData.length; i++) {
      const change = Math.abs(recentData[i].close - recentData[i - 1].close) / recentData[i - 1].close;
      volatility += change;
    }
    
    return volatility / (recentData.length - 1);
  }

  private calculateTimeSinceLastTouch(lastTouch: string): number {
    const now = new Date().getTime();
    const touch = new Date(lastTouch).getTime();
    return (now - touch) / (1000 * 60); // Minutes
  }

  private getIntensityValue(intensity: LiquidityPool['intensity']): number {
    switch (intensity) {
      case 'EXTREME': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
    }
  }

  private getTypeSignificance(type: LiquidityPool['type']): number {
    switch (type) {
      case 'STOP_CLUSTER': return 6;
      case 'EQUAL_HIGHS': return 5;
      case 'EQUAL_LOWS': return 5;
      case 'PREVIOUS_HIGH_LOW': return 4;
      case 'ROUND_NUMBER': return 3;
      case 'OPTION_STRIKE': return 2;
    }
  }
}