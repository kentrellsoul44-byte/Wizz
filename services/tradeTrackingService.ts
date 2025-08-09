import type { TimeframeType } from "../types";
import { DynamicRiskRewardService, type HistoricalPerformance } from "./dynamicRiskRewardService";

export interface TradeOutcome {
  id: string;
  assetType: string;
  timeframe: TimeframeType;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  actualExitPrice?: number;
  exitTime?: string;
  success?: boolean;
  rr: number;
  volatility: number;
  entryTime: string;
  exitReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'TIME_EXPIRY';
  analysisConfidence: number;
  isUltraMode: boolean;
  analysisType: 'SMC' | 'PATTERN' | 'MULTI_TIMEFRAME' | 'STANDARD';
}

export interface TradeStatistics {
  totalTrades: number;
  successfulTrades: number;
  successRate: number;
  averageRR: number;
  averageHoldingTime: number; // in hours
  bestPerformingAsset: string;
  worstPerformingAsset: string;
  volatilityPerformance: {
    lowVol: { trades: number; successRate: number; avgRR: number };
    mediumVol: { trades: number; successRate: number; avgRR: number };
    highVol: { trades: number; successRate: number; avgRR: number };
    extremeVol: { trades: number; successRate: number; avgRR: number };
  };
  timePerformance: {
    hourly: { [hour: number]: { trades: number; successRate: number; avgRR: number } };
    daily: { [day: number]: { trades: number; successRate: number; avgRR: number } };
  };
  analysisTypePerformance: {
    SMC: { trades: number; successRate: number; avgRR: number };
    PATTERN: { trades: number; successRate: number; avgRR: number };
    MULTI_TIMEFRAME: { trades: number; successRate: number; avgRR: number };
    STANDARD: { trades: number; successRate: number; avgRR: number };
  };
}

export class TradeTrackingService {
  private static instance: TradeTrackingService;
  private trades: Map<string, TradeOutcome> = new Map();
  private dynamicRRService: DynamicRiskRewardService;

  private constructor() {
    this.dynamicRRService = DynamicRiskRewardService.getInstance();
  }

  public static getInstance(): TradeTrackingService {
    if (!TradeTrackingService.instance) {
      TradeTrackingService.instance = new TradeTrackingService();
    }
    return TradeTrackingService.instance;
  }

  /**
   * Record a new trade
   */
  public recordTrade(trade: Omit<TradeOutcome, 'id'>): string {
    const id = this.generateTradeId();
    const tradeWithId: TradeOutcome = {
      ...trade,
      id
    };
    
    this.trades.set(id, tradeWithId);
    this.saveTradesToStorage();
    
    return id;
  }

  /**
   * Update trade outcome when it's closed
   */
  public updateTradeOutcome(
    tradeId: string,
    outcome: {
      actualExitPrice: number;
      exitTime: string;
      success: boolean;
      exitReason: TradeOutcome['exitReason'];
    }
  ): boolean {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      console.warn(`Trade ${tradeId} not found for outcome update`);
      return false;
    }

    // Update trade with outcome
    const updatedTrade: TradeOutcome = {
      ...trade,
      ...outcome
    };
    
    this.trades.set(tradeId, updatedTrade);
    
    // Update historical performance data
    this.updateHistoricalPerformance(updatedTrade);
    
    // Save to storage
    this.saveTradesToStorage();
    
    return true;
  }

  /**
   * Get trade statistics
   */
  public getTradeStatistics(): TradeStatistics {
    const completedTrades = Array.from(this.trades.values()).filter(t => t.success !== undefined);
    
    if (completedTrades.length === 0) {
      return this.getEmptyStatistics();
    }

    const totalTrades = completedTrades.length;
    const successfulTrades = completedTrades.filter(t => t.success).length;
    const successRate = successfulTrades / totalTrades;
    const averageRR = completedTrades.reduce((sum, t) => sum + t.rr, 0) / totalTrades;
    
    // Calculate average holding time
    const holdingTimes = completedTrades
      .filter(t => t.exitTime)
      .map(t => {
        const entry = new Date(t.entryTime).getTime();
        const exit = new Date(t.exitTime!).getTime();
        return (exit - entry) / (1000 * 60 * 60); // Convert to hours
      });
    const averageHoldingTime = holdingTimes.length > 0 
      ? holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length 
      : 0;

    // Asset performance
    const assetPerformance = this.calculateAssetPerformance(completedTrades);
    const bestPerformingAsset = assetPerformance.best;
    const worstPerformingAsset = assetPerformance.worst;

    // Volatility performance
    const volatilityPerformance = this.calculateVolatilityPerformance(completedTrades);

    // Time performance
    const timePerformance = this.calculateTimePerformance(completedTrades);

    // Analysis type performance
    const analysisTypePerformance = this.calculateAnalysisTypePerformance(completedTrades);

    return {
      totalTrades,
      successfulTrades,
      successRate,
      averageRR,
      averageHoldingTime,
      bestPerformingAsset,
      worstPerformingAsset,
      volatilityPerformance,
      timePerformance,
      analysisTypePerformance
    };
  }

  /**
   * Get historical performance for dynamic R:R calculation
   */
  public getHistoricalPerformance(assetType: string, timeframe: TimeframeType): HistoricalPerformance {
    const key = `${assetType}_${timeframe}`;
    const completedTrades = Array.from(this.trades.values())
      .filter(t => t.success !== undefined && t.assetType === assetType && t.timeframe === timeframe);

    if (completedTrades.length === 0) {
      return this.getDefaultHistoricalPerformance();
    }

    const totalTrades = completedTrades.length;
    const successfulTrades = completedTrades.filter(t => t.success).length;
    const successRate = successfulTrades / totalTrades;
    const averageRR = completedTrades.reduce((sum, t) => sum + t.rr, 0) / totalTrades;

    // Volatility-based success
    const volatilityBasedSuccess = this.calculateVolatilityBasedSuccess(completedTrades);

    // Time-based success
    const timeBasedSuccess = this.calculateTimeBasedSuccess(completedTrades);

    // Asset type success
    const assetTypeSuccess = this.calculateAssetTypeSuccess(completedTrades);

    return {
      totalTrades,
      successfulTrades,
      successRate,
      averageRR,
      volatilityBasedSuccess,
      timeBasedSuccess,
      assetTypeSuccess
    };
  }

  /**
   * Get all trades for a specific asset and timeframe
   */
  public getTradesForAsset(assetType: string, timeframe: TimeframeType): TradeOutcome[] {
    return Array.from(this.trades.values())
      .filter(t => t.assetType === assetType && t.timeframe === timeframe)
      .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
  }

  /**
   * Get recent trades (last N trades)
   */
  public getRecentTrades(limit: number = 50): TradeOutcome[] {
    return Array.from(this.trades.values())
      .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
      .slice(0, limit);
  }

  /**
   * Clear all trade data (for testing/reset purposes)
   */
  public clearAllTrades(): void {
    this.trades.clear();
    this.saveTradesToStorage();
  }

  // Private helper methods

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateHistoricalPerformance(trade: TradeOutcome): void {
    if (trade.success === undefined) return;

    const hour = new Date(trade.entryTime).getUTCHours();
    const day = new Date(trade.entryTime).getUTCDay();

    this.dynamicRRService.updateHistoricalPerformance(
      trade.assetType,
      trade.timeframe,
      {
        success: trade.success,
        rr: trade.rr,
        volatility: trade.volatility,
        hour,
        day
      }
    );
  }

  private calculateAssetPerformance(trades: TradeOutcome[]): { best: string; worst: string } {
    const assetStats = new Map<string, { trades: number; successRate: number }>();

    trades.forEach(trade => {
      if (!assetStats.has(trade.assetType)) {
        assetStats.set(trade.assetType, { trades: 0, successRate: 0 });
      }
      
      const stats = assetStats.get(trade.assetType)!;
      stats.trades++;
      if (trade.success) {
        stats.successRate = (stats.successRate * (stats.trades - 1) + 1) / stats.trades;
      }
    });

    let bestAsset = '';
    let worstAsset = '';
    let bestRate = -1;
    let worstRate = 2;

    assetStats.forEach((stats, asset) => {
      if (stats.trades >= 5) { // Minimum sample size
        if (stats.successRate > bestRate) {
          bestRate = stats.successRate;
          bestAsset = asset;
        }
        if (stats.successRate < worstRate) {
          worstRate = stats.successRate;
          worstAsset = asset;
        }
      }
    });

    return { best: bestAsset, worst: worstAsset };
  }

  private calculateVolatilityPerformance(trades: TradeOutcome[]): TradeStatistics['volatilityPerformance'] {
    const volStats = {
      lowVol: { trades: 0, successRate: 0, avgRR: 0 },
      mediumVol: { trades: 0, successRate: 0, avgRR: 0 },
      highVol: { trades: 0, successRate: 0, avgRR: 0 },
      extremeVol: { trades: 0, successRate: 0, avgRR: 0 }
    };

    const volCategories = {
      lowVol: [] as TradeOutcome[],
      mediumVol: [] as TradeOutcome[],
      highVol: [] as TradeOutcome[],
      extremeVol: [] as TradeOutcome[]
    };

    trades.forEach(trade => {
      let category: keyof typeof volCategories;
      if (trade.volatility < 0.01) category = 'lowVol';
      else if (trade.volatility < 0.025) category = 'mediumVol';
      else if (trade.volatility < 0.05) category = 'highVol';
      else category = 'extremeVol';

      volCategories[category].push(trade);
    });

    Object.keys(volStats).forEach(category => {
      const categoryTrades = volCategories[category as keyof typeof volCategories];
      if (categoryTrades.length > 0) {
        const successCount = categoryTrades.filter(t => t.success).length;
        const avgRR = categoryTrades.reduce((sum, t) => sum + t.rr, 0) / categoryTrades.length;
        
        volStats[category as keyof typeof volStats] = {
          trades: categoryTrades.length,
          successRate: successCount / categoryTrades.length,
          avgRR
        };
      }
    });

    return volStats;
  }

  private calculateTimePerformance(trades: TradeOutcome[]): TradeStatistics['timePerformance'] {
    const hourly: { [hour: number]: { trades: number; successRate: number; avgRR: number } } = {};
    const daily: { [day: number]: { trades: number; successRate: number; avgRR: number } } = {};

    trades.forEach(trade => {
      const hour = new Date(trade.entryTime).getUTCHours();
      const day = new Date(trade.entryTime).getUTCDay();

      // Update hourly stats
      if (!hourly[hour]) {
        hourly[hour] = { trades: 0, successRate: 0, avgRR: 0 };
      }
      hourly[hour].trades++;
      if (trade.success) {
        hourly[hour].successRate = (hourly[hour].successRate * (hourly[hour].trades - 1) + 1) / hourly[hour].trades;
      }
      hourly[hour].avgRR = (hourly[hour].avgRR * (hourly[hour].trades - 1) + trade.rr) / hourly[hour].trades;

      // Update daily stats
      if (!daily[day]) {
        daily[day] = { trades: 0, successRate: 0, avgRR: 0 };
      }
      daily[day].trades++;
      if (trade.success) {
        daily[day].successRate = (daily[day].successRate * (daily[day].trades - 1) + 1) / daily[day].trades;
      }
      daily[day].avgRR = (daily[day].avgRR * (daily[day].trades - 1) + trade.rr) / daily[day].trades;
    });

    return { hourly, daily };
  }

  private calculateAnalysisTypePerformance(trades: TradeOutcome[]): TradeStatistics['analysisTypePerformance'] {
    const analysisStats = {
      SMC: { trades: 0, successRate: 0, avgRR: 0 },
      PATTERN: { trades: 0, successRate: 0, avgRR: 0 },
      MULTI_TIMEFRAME: { trades: 0, successRate: 0, avgRR: 0 },
      STANDARD: { trades: 0, successRate: 0, avgRR: 0 }
    };

    const analysisCategories = {
      SMC: [] as TradeOutcome[],
      PATTERN: [] as TradeOutcome[],
      MULTI_TIMEFRAME: [] as TradeOutcome[],
      STANDARD: [] as TradeOutcome[]
    };

    trades.forEach(trade => {
      analysisCategories[trade.analysisType].push(trade);
    });

    Object.keys(analysisStats).forEach(type => {
      const typeTrades = analysisCategories[type as keyof typeof analysisCategories];
      if (typeTrades.length > 0) {
        const successCount = typeTrades.filter(t => t.success).length;
        const avgRR = typeTrades.reduce((sum, t) => sum + t.rr, 0) / typeTrades.length;
        
        analysisStats[type as keyof typeof analysisStats] = {
          trades: typeTrades.length,
          successRate: successCount / typeTrades.length,
          avgRR
        };
      }
    });

    return analysisStats;
  }

  private calculateVolatilityBasedSuccess(trades: TradeOutcome[]): HistoricalPerformance['volatilityBasedSuccess'] {
    const volSuccess = {
      lowVol: { trades: 0, successRate: 0 },
      mediumVol: { trades: 0, successRate: 0 },
      highVol: { trades: 0, successRate: 0 },
      extremeVol: { trades: 0, successRate: 0 }
    };

    trades.forEach(trade => {
      let category: keyof typeof volSuccess;
      if (trade.volatility < 0.01) category = 'lowVol';
      else if (trade.volatility < 0.025) category = 'mediumVol';
      else if (trade.volatility < 0.05) category = 'highVol';
      else category = 'extremeVol';

      volSuccess[category].trades++;
      if (trade.success) {
        volSuccess[category].successRate = 
          (volSuccess[category].successRate * (volSuccess[category].trades - 1) + 1) / 
          volSuccess[category].trades;
      }
    });

    return volSuccess;
  }

  private calculateTimeBasedSuccess(trades: TradeOutcome[]): HistoricalPerformance['timeBasedSuccess'] {
    const hourly: { [hour: number]: { trades: number; successRate: number } } = {};
    const daily: { [day: number]: { trades: number; successRate: number } } = {};

    trades.forEach(trade => {
      const hour = new Date(trade.entryTime).getUTCHours();
      const day = new Date(trade.entryTime).getUTCDay();

      // Update hourly stats
      if (!hourly[hour]) {
        hourly[hour] = { trades: 0, successRate: 0 };
      }
      hourly[hour].trades++;
      if (trade.success) {
        hourly[hour].successRate = (hourly[hour].successRate * (hourly[hour].trades - 1) + 1) / hourly[hour].trades;
      }

      // Update daily stats
      if (!daily[day]) {
        daily[day] = { trades: 0, successRate: 0 };
      }
      daily[day].trades++;
      if (trade.success) {
        daily[day].successRate = (daily[day].successRate * (daily[day].trades - 1) + 1) / daily[day].trades;
      }
    });

    return { hourly, daily };
  }

  private calculateAssetTypeSuccess(trades: TradeOutcome[]): HistoricalPerformance['assetTypeSuccess'] {
    const assetTypeSuccess: { [assetType: string]: { trades: number; successRate: number } } = {};

    trades.forEach(trade => {
      if (!assetTypeSuccess[trade.assetType]) {
        assetTypeSuccess[trade.assetType] = { trades: 0, successRate: 0 };
      }

      assetTypeSuccess[trade.assetType].trades++;
      if (trade.success) {
        assetTypeSuccess[trade.assetType].successRate = 
          (assetTypeSuccess[trade.assetType].successRate * (assetTypeSuccess[trade.assetType].trades - 1) + 1) / 
          assetTypeSuccess[trade.assetType].trades;
      }
    });

    return assetTypeSuccess;
  }

  private getEmptyStatistics(): TradeStatistics {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      successRate: 0,
      averageRR: 0,
      averageHoldingTime: 0,
      bestPerformingAsset: '',
      worstPerformingAsset: '',
      volatilityPerformance: {
        lowVol: { trades: 0, successRate: 0, avgRR: 0 },
        mediumVol: { trades: 0, successRate: 0, avgRR: 0 },
        highVol: { trades: 0, successRate: 0, avgRR: 0 },
        extremeVol: { trades: 0, successRate: 0, avgRR: 0 }
      },
      timePerformance: {
        hourly: {},
        daily: {}
      },
      analysisTypePerformance: {
        SMC: { trades: 0, successRate: 0, avgRR: 0 },
        PATTERN: { trades: 0, successRate: 0, avgRR: 0 },
        MULTI_TIMEFRAME: { trades: 0, successRate: 0, avgRR: 0 },
        STANDARD: { trades: 0, successRate: 0, avgRR: 0 }
      }
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

  // Storage methods (using localStorage for persistence)

  private saveTradesToStorage(): void {
    try {
      const tradesArray = Array.from(this.trades.values());
      localStorage.setItem('tradeTrackingData', JSON.stringify(tradesArray));
    } catch (error) {
      console.warn('Failed to save trades to storage:', error);
    }
  }

  private loadTradesFromStorage(): void {
    try {
      const stored = localStorage.getItem('tradeTrackingData');
      if (stored) {
        const tradesArray = JSON.parse(stored) as TradeOutcome[];
        this.trades.clear();
        tradesArray.forEach(trade => {
          this.trades.set(trade.id, trade);
        });
      }
    } catch (error) {
      console.warn('Failed to load trades from storage:', error);
    }
  }
}