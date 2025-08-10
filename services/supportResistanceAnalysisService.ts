import type {
  SupportResistanceLevel,
  TimeframeType
} from '../types';

export class SupportResistanceAnalysisService {
  private static instance: SupportResistanceAnalysisService;
  
  public static getInstance(): SupportResistanceAnalysisService {
    if (!SupportResistanceAnalysisService.instance) {
      SupportResistanceAnalysisService.instance = new SupportResistanceAnalysisService();
    }
    return SupportResistanceAnalysisService.instance;
  }

  /**
   * Comprehensive support and resistance level identification
   */
  public identifySupportResistanceLevels(
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
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    
    // Find swing-based levels
    levels.push(...this.findSwingBasedLevels(priceData, currentPrice, timeframe));
    
    // Find volume-based levels
    levels.push(...this.findVolumeBasedLevels(priceData, currentPrice, timeframe));
    
    // Find psychological levels
    levels.push(...this.findPsychologicalLevels(currentPrice, timeframe));
    
    // Find pivot point levels
    levels.push(...this.findPivotPointLevels(priceData, currentPrice, timeframe));
    
    // Merge similar levels and remove duplicates
    const mergedLevels = this.mergeSimilarLevels(levels);
    
    // Sort by distance from current price
    return mergedLevels.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Find support/resistance levels based on swing highs and lows
   */
  private findSwingBasedLevels(
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
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const swingStrength = this.getSwingStrength(timeframe);
    
    // Find swing highs
    const swingHighs = this.findSwingHighs(priceData, swingStrength);
    swingHighs.forEach(swing => {
      const touches = this.countLevelTouches(priceData, swing.price, 0.002); // 0.2% tolerance
      if (touches >= 2) {
        levels.push(this.createSupportResistanceLevel({
          price: swing.price,
          type: 'RESISTANCE',
          touches,
          timestamp: swing.timestamp,
          volume: swing.volume,
          currentPrice,
          timeframe,
          priceData
        }));
      }
    });
    
    // Find swing lows
    const swingLows = this.findSwingLows(priceData, swingStrength);
    swingLows.forEach(swing => {
      const touches = this.countLevelTouches(priceData, swing.price, 0.002); // 0.2% tolerance
      if (touches >= 2) {
        levels.push(this.createSupportResistanceLevel({
          price: swing.price,
          type: 'SUPPORT',
          touches,
          timestamp: swing.timestamp,
          volume: swing.volume,
          currentPrice,
          timeframe,
          priceData
        }));
      }
    });
    
    return levels;
  }

  /**
   * Find support/resistance levels based on high volume areas
   */
  private findVolumeBasedLevels(
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
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    
    // Calculate volume profile
    const volumeProfile = this.calculateVolumeProfile(priceData);
    
    // Find high volume nodes
    const highVolumeNodes = volumeProfile
      .filter(node => node.volume > this.calculateVolumeThreshold(volumeProfile))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10); // Top 10 volume nodes
    
    highVolumeNodes.forEach(node => {
      const touches = this.countLevelTouches(priceData, node.price, 0.001);
      const isSupport = currentPrice > node.price;
      
      levels.push(this.createSupportResistanceLevel({
        price: node.price,
        type: isSupport ? 'SUPPORT' : 'RESISTANCE',
        touches: Math.max(2, touches), // Minimum 2 for volume-based levels
        timestamp: node.timestamp,
        volume: node.volume,
        currentPrice,
        timeframe,
        priceData,
        isVolumeBased: true
      }));
    });
    
    return levels;
  }

  /**
   * Find psychological levels (round numbers)
   */
  private findPsychologicalLevels(
    currentPrice: number,
    timeframe: TimeframeType
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const range = currentPrice * 0.1; // 10% range around current price
    
    // Determine significant digits based on price level
    const decimalPlaces = this.getSignificantDecimalPlaces(currentPrice);
    const roundingFactor = Math.pow(10, -decimalPlaces);
    
    // Generate round number levels
    const roundNumbers = this.generateRoundNumbers(currentPrice, range, roundingFactor);
    
    roundNumbers.forEach(price => {
      const isSupport = currentPrice > price;
      levels.push({
        id: `psych_${price}_${timeframe}`,
        price,
        type: isSupport ? 'SUPPORT' : 'RESISTANCE',
        strength: this.calculatePsychologicalStrength(price, currentPrice),
        touches: 1, // Psychological levels start with base touch count
        lastTouch: new Date().toISOString(),
        timeframe,
        confluence: {
          fibonacci: false,
          pivot: false,
          psychological: true,
          volumeProfile: false,
          orderBlock: false,
          fairValueGap: false
        },
        distance: Math.abs(currentPrice - price),
        penetrationHistory: [],
        reliability: this.calculatePsychologicalReliability(price, currentPrice)
      });
    });
    
    return levels;
  }

  /**
   * Find pivot point levels (traditional pivot points)
   */
  private findPivotPointLevels(
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
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    
    if (priceData.length < 1) return levels;
    
    // Get previous period data for pivot calculation
    const previousPeriodData = this.getPreviousPeriodData(priceData, timeframe);
    if (!previousPeriodData) return levels;
    
    const { high, low, close } = previousPeriodData;
    
    // Calculate pivot points
    const pivot = (high + low + close) / 3;
    const r1 = (2 * pivot) - low;
    const s1 = (2 * pivot) - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);
    
    const pivotLevels = [
      { price: pivot, type: 'PIVOT' },
      { price: r1, type: 'RESISTANCE' },
      { price: r2, type: 'RESISTANCE' },
      { price: r3, type: 'RESISTANCE' },
      { price: s1, type: 'SUPPORT' },
      { price: s2, type: 'SUPPORT' },
      { price: s3, type: 'SUPPORT' }
    ];
    
    pivotLevels.forEach((level, index) => {
      const isSupport = level.type === 'SUPPORT' || (level.type === 'PIVOT' && currentPrice > level.price);
      levels.push({
        id: `pivot_${level.type}_${index}_${timeframe}`,
        price: level.price,
        type: isSupport ? 'SUPPORT' : 'RESISTANCE',
        strength: this.calculatePivotStrength(level.type),
        touches: 1,
        lastTouch: new Date().toISOString(),
        timeframe,
        confluence: {
          fibonacci: false,
          pivot: true,
          psychological: false,
          volumeProfile: false,
          orderBlock: false,
          fairValueGap: false
        },
        distance: Math.abs(currentPrice - level.price),
        penetrationHistory: [],
        reliability: this.calculatePivotReliability(level.type)
      });
    });
    
    return levels;
  }

  /**
   * Create a support/resistance level with full analysis
   */
  private createSupportResistanceLevel(params: {
    price: number;
    type: 'SUPPORT' | 'RESISTANCE';
    touches: number;
    timestamp: string;
    volume: number;
    currentPrice: number;
    timeframe: TimeframeType;
    priceData: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    isVolumeBased?: boolean;
  }): SupportResistanceLevel {
    const {
      price,
      type,
      touches,
      timestamp,
      volume,
      currentPrice,
      timeframe,
      priceData,
      isVolumeBased = false
    } = params;
    
    return {
      id: `sr_${type.toLowerCase()}_${timestamp}_${price}`,
      price,
      type,
      strength: this.calculateLevelStrength(touches, volume, isVolumeBased),
      touches,
      lastTouch: timestamp,
      timeframe,
      confluence: this.analyzeConfluence(price, priceData),
      distance: Math.abs(currentPrice - price),
      penetrationHistory: this.analyzePenetrationHistory(priceData, price),
      reliability: this.calculateLevelReliability(priceData, price, touches, type)
    };
  }

  /**
   * Find swing highs in price data
   */
  private findSwingHighs(
    priceData: Array<{
      timestamp: string;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    strength: number
  ): Array<{ price: number; timestamp: string; volume: number }> {
    const swings: Array<{ price: number; timestamp: string; volume: number }> = [];
    
    for (let i = strength; i < priceData.length - strength; i++) {
      const current = priceData[i];
      let isSwingHigh = true;
      
      // Check if current high is higher than surrounding candles
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
          volume: current.volume
        });
      }
    }
    
    return swings;
  }

  /**
   * Find swing lows in price data
   */
  private findSwingLows(
    priceData: Array<{
      timestamp: string;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    strength: number
  ): Array<{ price: number; timestamp: string; volume: number }> {
    const swings: Array<{ price: number; timestamp: string; volume: number }> = [];
    
    for (let i = strength; i < priceData.length - strength; i++) {
      const current = priceData[i];
      let isSwingLow = true;
      
      // Check if current low is lower than surrounding candles
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
          volume: current.volume
        });
      }
    }
    
    return swings;
  }

  /**
   * Count how many times a level has been touched
   */
  private countLevelTouches(
    priceData: Array<{ high: number; low: number; close: number }>,
    level: number,
    tolerance: number
  ): number {
    let touches = 0;
    const threshold = level * tolerance;
    
    priceData.forEach(candle => {
      // Check if high, low, or close touched the level
      if (Math.abs(candle.high - level) <= threshold ||
          Math.abs(candle.low - level) <= threshold ||
          Math.abs(candle.close - level) <= threshold) {
        touches++;
      }
    });
    
    return touches;
  }

  /**
   * Calculate volume profile for price levels
   */
  private calculateVolumeProfile(
    priceData: Array<{
      high: number;
      low: number;
      close: number;
      volume: number;
      timestamp: string;
    }>
  ): Array<{ price: number; volume: number; timestamp: string }> {
    const profile: Map<number, { volume: number; timestamp: string }> = new Map();
    
    priceData.forEach(candle => {
      // Distribute volume across the price range of the candle
      const priceStep = (candle.high - candle.low) / 10; // 10 price levels per candle
      const volumePerLevel = candle.volume / 10;
      
      for (let i = 0; i < 10; i++) {
        const price = Math.round((candle.low + (i * priceStep)) * 10000) / 10000; // Round to 4 decimals
        const existing = profile.get(price) || { volume: 0, timestamp: candle.timestamp };
        profile.set(price, {
          volume: existing.volume + volumePerLevel,
          timestamp: candle.timestamp
        });
      }
    });
    
    return Array.from(profile.entries()).map(([price, data]) => ({
      price,
      volume: data.volume,
      timestamp: data.timestamp
    }));
  }

  /**
   * Calculate volume threshold for significant levels
   */
  private calculateVolumeThreshold(volumeProfile: Array<{ volume: number }>): number {
    const volumes = volumeProfile.map(node => node.volume);
    volumes.sort((a, b) => b - a);
    
    // Use 80th percentile as threshold
    const index = Math.floor(volumes.length * 0.2);
    return volumes[index] || 0;
  }

  /**
   * Calculate level strength based on touches and volume
   */
  private calculateLevelStrength(
    touches: number,
    volume: number,
    isVolumeBased: boolean = false
  ): SupportResistanceLevel['strength'] {
    let score = touches * 10;
    
    if (isVolumeBased) {
      score += 10; // Bonus for volume-based levels
    }
    
    // Volume-based scoring
    if (volume > 0) {
      score += Math.min(20, Math.log10(volume) * 2);
    }
    
    if (score >= 40) return 'VERY_STRONG';
    if (score >= 30) return 'STRONG';
    if (score >= 20) return 'MODERATE';
    return 'WEAK';
  }

  /**
   * Analyze confluence factors at a price level
   */
  private analyzeConfluence(
    price: number,
    priceData: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  ): SupportResistanceLevel['confluence'] {
    return {
      fibonacci: this.checkFibonacciConfluence(price, priceData),
      pivot: this.checkPivotConfluence(price, priceData),
      psychological: this.checkPsychologicalConfluence(price),
      volumeProfile: this.checkVolumeProfileConfluence(price, priceData),
      orderBlock: this.checkOrderBlockConfluence(price, priceData),
      fairValueGap: this.checkFairValueGapConfluence(price, priceData)
    };
  }

  /**
   * Analyze penetration history of a level
   */
  private analyzePenetrationHistory(
    priceData: Array<{
      timestamp: string;
      high: number;
      low: number;
      close: number;
    }>,
    level: number
  ): SupportResistanceLevel['penetrationHistory'] {
    const history: SupportResistanceLevel['penetrationHistory'] = [];
    const tolerance = level * 0.001; // 0.1% tolerance
    
    let inPenetration = false;
    let penetrationStart: string | null = null;
    let maxDepth = 0;
    
    priceData.forEach((candle, index) => {
      const penetrated = Math.min(candle.low, candle.close) < level - tolerance ||
                        Math.max(candle.high, candle.close) > level + tolerance;
      
      if (penetrated && !inPenetration) {
        // Start of penetration
        inPenetration = true;
        penetrationStart = candle.timestamp;
        maxDepth = Math.abs(candle.close - level);
      } else if (penetrated && inPenetration) {
        // Continue penetration, update max depth
        maxDepth = Math.max(maxDepth, Math.abs(candle.close - level));
      } else if (!penetrated && inPenetration) {
        // End of penetration
        if (penetrationStart) {
          const duration = this.calculateDuration(penetrationStart, candle.timestamp);
          history.push({
            timestamp: penetrationStart,
            depth: maxDepth,
            duration,
            recovered: true
          });
        }
        inPenetration = false;
        penetrationStart = null;
        maxDepth = 0;
      }
    });
    
    return history;
  }

  /**
   * Calculate level reliability based on historical behavior
   */
  private calculateLevelReliability(
    priceData: Array<{
      timestamp: string;
      high: number;
      low: number;
      close: number;
    }>,
    level: number,
    touches: number,
    type: 'SUPPORT' | 'RESISTANCE'
  ): number {
    let reliability = 50; // Base reliability
    
    // Higher reliability for more touches
    reliability += touches * 10;
    
    // Analyze penetration history
    const penetrations = this.analyzePenetrationHistory(priceData, level);
    const totalPenetrations = penetrations.length;
    const recoveredPenetrations = penetrations.filter(p => p.recovered).length;
    
    if (totalPenetrations > 0) {
      const recoveryRate = recoveredPenetrations / totalPenetrations;
      reliability += recoveryRate * 20; // Up to 20 points for good recovery rate
      
      // Penalty for frequent penetrations
      if (totalPenetrations > touches * 0.5) {
        reliability -= 15;
      }
    }
    
    // Time-based reliability (newer levels are less reliable)
    const age = this.calculateLevelAge(priceData, level);
    if (age > 30) { // More than 30 periods old
      reliability += 10;
    }
    
    return Math.max(0, Math.min(100, reliability));
  }

  // Utility methods
  private getSwingStrength(timeframe: TimeframeType): number {
    const strengthMap: Record<TimeframeType, number> = {
      '1M': 3,
      '5M': 3,
      '15M': 5,
      '30M': 5,
      '1H': 7,
      '4H': 10,
      '12H': 12,
      '1D': 15,
      '3D': 20,
      '1W': 25,
      '1M_MONTHLY': 30
    };
    
    return strengthMap[timeframe] || 5;
  }

  private getSignificantDecimalPlaces(price: number): number {
    if (price >= 1000) return 0;
    if (price >= 100) return 1;
    if (price >= 10) return 2;
    if (price >= 1) return 3;
    return 4;
  }

  private generateRoundNumbers(currentPrice: number, range: number, roundingFactor: number): number[] {
    const numbers: number[] = [];
    const start = currentPrice - range;
    const end = currentPrice + range;
    
    for (let price = start; price <= end; price += roundingFactor) {
      const rounded = Math.round(price / roundingFactor) * roundingFactor;
      if (rounded >= start && rounded <= end && Math.abs(rounded - currentPrice) > roundingFactor) {
        numbers.push(rounded);
      }
    }
    
    return numbers;
  }

  private calculatePsychologicalStrength(price: number, currentPrice: number): SupportResistanceLevel['strength'] {
    const distance = Math.abs(price - currentPrice) / currentPrice;
    
    if (distance < 0.01) return 'VERY_STRONG'; // Within 1%
    if (distance < 0.02) return 'STRONG';      // Within 2%
    if (distance < 0.05) return 'MODERATE';    // Within 5%
    return 'WEAK';
  }

  private calculatePsychologicalReliability(price: number, currentPrice: number): number {
    const distance = Math.abs(price - currentPrice) / currentPrice;
    
    // Closer levels are more reliable
    if (distance < 0.01) return 85;
    if (distance < 0.02) return 75;
    if (distance < 0.05) return 65;
    return 50;
  }

  private getPreviousPeriodData(
    priceData: Array<{ high: number; low: number; close: number }>,
    timeframe: TimeframeType
  ): { high: number; low: number; close: number } | null {
    if (priceData.length < 1) return null;
    
    // For simplicity, use the last complete candle
    const lastCandle = priceData[priceData.length - 1];
    return {
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close
    };
  }

  private calculatePivotStrength(pivotType: string): SupportResistanceLevel['strength'] {
    switch (pivotType) {
      case 'PIVOT': return 'VERY_STRONG';
      case 'RESISTANCE':
      case 'SUPPORT': return 'STRONG';
      default: return 'MODERATE';
    }
  }

  private calculatePivotReliability(pivotType: string): number {
    switch (pivotType) {
      case 'PIVOT': return 85;
      case 'RESISTANCE':
      case 'SUPPORT': return 75;
      default: return 65;
    }
  }

  private mergeSimilarLevels(levels: SupportResistanceLevel[]): SupportResistanceLevel[] {
    const merged: SupportResistanceLevel[] = [];
    const tolerance = 0.002; // 0.2% tolerance for merging
    
    levels.forEach(level => {
      const existingLevel = merged.find(existing => 
        Math.abs(existing.price - level.price) / level.price < tolerance &&
        existing.type === level.type
      );
      
      if (existingLevel) {
        // Merge levels - keep the stronger one
        if (level.strength === 'VERY_STRONG' || 
           (level.strength === 'STRONG' && existingLevel.strength !== 'VERY_STRONG')) {
          const index = merged.indexOf(existingLevel);
          merged[index] = level;
        }
      } else {
        merged.push(level);
      }
    });
    
    return merged;
  }

  // Confluence checking methods (simplified implementations)
  private checkFibonacciConfluence(price: number, priceData: any[]): boolean {
    // Implementation would check for Fibonacci retracement/extension levels
    return false;
  }

  private checkPivotConfluence(price: number, priceData: any[]): boolean {
    // Implementation would check for pivot point confluence
    return false;
  }

  private checkPsychologicalConfluence(price: number): boolean {
    // Check if price is a round number
    const decimalPlaces = this.getSignificantDecimalPlaces(price);
    const roundingFactor = Math.pow(10, -decimalPlaces);
    return Math.abs(price - Math.round(price / roundingFactor) * roundingFactor) < 0.0001;
  }

  private checkVolumeProfileConfluence(price: number, priceData: any[]): boolean {
    // Implementation would check for high volume node confluence
    return false;
  }

  private checkOrderBlockConfluence(price: number, priceData: any[]): boolean {
    // Implementation would check for order block confluence
    return false;
  }

  private checkFairValueGapConfluence(price: number, priceData: any[]): boolean {
    // Implementation would check for fair value gap confluence
    return false;
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return Math.floor((end - start) / (1000 * 60)); // Duration in minutes
  }

  private calculateLevelAge(priceData: any[], level: number): number {
    // Simplified age calculation - would be more sophisticated in real implementation
    return priceData.length;
  }
}