import type { AnalysisResult } from "../types";
import { DynamicRiskRewardService } from "./dynamicRiskRewardService";
import { TradeTrackingService } from "./tradeTrackingService";
import { SupportResistanceAnalysisService } from './supportResistanceAnalysisService';
import { LiquidityPoolDetectionService } from './liquidityPoolDetectionService';
import { MarketRegimeDetectionService } from './marketRegimeDetectionService';

function parseRiskReward(ratio?: string): number | null {
  if (!ratio) return null;
  const cleaned = ratio.trim().toLowerCase().replace(/\s+/g, '');

  // Accept forms like "2.5:1", "1:2.5" (invert), "2.5x", "rr=2.5", "r=2.5", "2.5"
  // Prefer explicit X:1; if 1:X, invert to X.
  let rr: number | null = null;

  // X:1 or 1:X
  const colon = cleaned.match(/^(\d+(?:\.\d+)?):(?:(\d+(?:\.\d+)?))$/);
  if (colon) {
    const a = parseFloat(colon[1]);
    const b = parseFloat(colon[2]);
    if (isFinite(a) && isFinite(b) && b > 0) {
      rr = a / b;
    }
  }

  // Xx or r= X
  if (rr === null) {
    const mult = cleaned.match(/^(?:rr=|r=)?(\d+(?:\.\d+)?)x?$/);
    if (mult) {
      const v = parseFloat(mult[1]);
      if (isFinite(v)) rr = v;
    }
  }

  return rr !== null && isFinite(rr) && rr > 0 ? rr : null;
}

function isValidTradeStructure(result: AnalysisResult): boolean {
  if (!result.trade) return false;
  const { entryPrice, takeProfit, stopLoss } = result.trade;
  if (!entryPrice || !takeProfit || !stopLoss) return false;
  const e = parseFloat(String(entryPrice).replace(/[^0-9.+-]/g, ""));
  const tp = parseFloat(String(takeProfit).replace(/[^0-9.+-]/g, ""));
  const sl = parseFloat(String(stopLoss).replace(/[^0-9.+-]/g, ""));
  if ([e, tp, sl].some((n) => !isFinite(n))) return false;
  // Basic sanity: tp and sl should not equal entry; and should be on opposite sides
  if (e === tp || e === sl) return false;
  if (result.signal === "BUY" && !(tp > e && sl < e)) return false;
  if (result.signal === "SELL" && !(tp < e && sl > e)) return false;
  return true;
}

export interface ApplyGatesOptions {
  ohlcvBars?: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }>;
  assetOverride?: string; // e.g., BTC
  timeframeOverride?: string; // e.g., 1H
}

export async function applyPostProcessingGates(result: AnalysisResult, isUltraMode: boolean, options?: ApplyGatesOptions): Promise<AnalysisResult> {
  const gated: AnalysisResult = { ...result };

  // Ensure confidence aligns with score per schema guidance
  const score = Number.isFinite(result.overallConfidenceScore) ? result.overallConfidenceScore : 0;
  const computedConfidence = score >= 75 ? "HIGH" : "LOW";
  if (gated.confidence !== computedConfidence) {
    gated.confidence = computedConfidence;
  }

  const rr = parseRiskReward(result.riskRewardRatio);
  const hasValidTrade = isValidTradeStructure(result);

  // Get dynamic risk/reward requirements (with real OHLCV if provided)
  const dynamicRRService = DynamicRiskRewardService.getInstance();
  const tradeTrackingService = TradeTrackingService.getInstance();
  const assetType = options?.assetOverride || extractAssetType(result); // Extract from analysis context
  const timeframe = (options?.timeframeOverride as any) || (result.timeframe as any) || '1H'; // Default to 1H if not specified
  const timestamp = new Date().toISOString();
  
  // Calculate dynamic R:R requirements
  const dynamicRR = calculateDynamicRRRequirements(
    result,
    isUltraMode,
    assetType,
    timeframe,
    timestamp,
    dynamicRRService,
    tradeTrackingService,
    options?.ohlcvBars
  );

  // Optional: structure and liquidity sanity checks using OHLCV
  let requiredMinRRNormal = dynamicRR.normalMode.minRR;
  let requiredMinRRUltra = dynamicRR.ultraMode.minRR;
  if (options?.ohlcvBars && options.ohlcvBars.length > 0 && hasValidTrade) {
    try {
      const bars = options.ohlcvBars;
      const currentPrice = bars[bars.length - 1].close;
      const srService = SupportResistanceAnalysisService.getInstance();
      const liqService = LiquidityPoolDetectionService.getInstance();
      const regimeService = new MarketRegimeDetectionService();

      const entry = parseFloat(String(result.trade!.entryPrice).replace(/[^0-9.+-]/g, ""));
      const stop = parseFloat(String(result.trade!.stopLoss).replace(/[^0-9.+-]/g, ""));

      // Build priceData for S/R and Liquidity
      const priceData = bars.map(b => ({ timestamp: b.timestamp, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
      const srLevels = srService.identifySupportResistanceLevels(priceData, currentPrice, timeframe as any);
      const pools = liqService.detectLiquidityPools(priceData, currentPrice, timeframe as any);

      // Simple structural rule: SL must be beyond nearest structural level
      const buffer = currentPrice * 0.0005; // 5 bps
      let structureOK = true;
      if (gated.signal === 'BUY') {
        const supports = srLevels.filter(l => l.type === 'SUPPORT' && l.price < entry).sort((a, b) => Math.abs(b.price - entry) - Math.abs(a.price - entry));
        const nearestSupport = supports[0];
        if (nearestSupport) {
          if (!(stop <= (nearestSupport.price - buffer))) structureOK = false;
        } else {
          // No identified support; at least require stop < entry by buffer
          if (!(stop < entry - buffer)) structureOK = false;
        }
      } else if (gated.signal === 'SELL') {
        const resistances = srLevels.filter(l => l.type === 'RESISTANCE' && l.price > entry).sort((a, b) => Math.abs(b.price - entry) - Math.abs(a.price - entry));
        const nearestResistance = resistances[0];
        if (nearestResistance) {
          if (!(stop >= (nearestResistance.price + buffer))) structureOK = false;
        } else {
          if (!(stop > entry + buffer)) structureOK = false;
        }
      }

      // Liquidity avoidance: SL should not lie inside an avoidance zone
      let liquidityOK = true;
      for (const p of pools) {
        if (stop >= p.avoidanceZone.lower && stop <= p.avoidanceZone.upper) {
          liquidityOK = false;
          break;
        }
      }

      // Regime tightening: if extreme volatility, raise min RR slightly
      const prices = bars.map(b => b.close);
      const volumes = bars.map(b => b.volume);
      const regime = await regimeService.detectMarketRegime(prices, volumes, timeframe as any);
      if (regime.volatilityRegime === 'EXTREME') {
        requiredMinRRNormal += 0.2;
        requiredMinRRUltra += 0.2;
      }

      if (!structureOK || !liquidityOK) {
        // Fail closed if structure/liquidity invalid
        gated.signal = 'NEUTRAL';
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }
    } catch (e) {
      console.warn('S/R or liquidity or regime checks failed:', e);
    }
  }

  // SMC-specific gating
  if (result.hasSMCAnalysis && result.smcAnalysis) {
    const smcScore = result.smcAnalysis.tradingBias.confidence;
    
    if (isUltraMode) {
      // Ultra SMC: Maximum precision requirements
      const minScoreForTrade = 85;
      const minRR = requiredMinRRUltra; // adjusted
      const minSMCConfidence = 80;

      if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR || smcScore < minSMCConfidence) {
        gated.signal = "NEUTRAL";
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      return gated;
    } else {
      // Normal SMC mode
      const minScoreForTrade = 75;
      const minRR = requiredMinRRNormal; // adjusted
      const minSMCConfidence = 70;

      if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR || smcScore < minSMCConfidence) {
        gated.signal = "NEUTRAL";
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      return gated;
    }
  }

  // Advanced Pattern-specific gating
  if (result.hasAdvancedPatterns && result.patternAnalysis) {
    const patternScore = result.patternAnalysis.patternConfluence?.confidenceScore || 50;
    
    if (isUltraMode) {
      // Ultra Pattern: Maximum precision requirements
      const minScoreForTrade = 85;
      const minRR = requiredMinRRUltra; // adjusted
      const minPatternConfidence = 85;

      if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR || patternScore < minPatternConfidence) {
        gated.signal = "NEUTRAL";
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      return gated;
    } else {
      // Normal Pattern mode
      const minScoreForTrade = 75;
      const minRR = requiredMinRRNormal; // adjusted
      const minPatternConfidence = 75;

      if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR || patternScore < minPatternConfidence) {
        gated.signal = "NEUTRAL";
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      return gated;
    }
  }

  // Multi-timeframe specific gating
  if (result.isMultiTimeframeAnalysis && result.multiTimeframeContext) {
    const confluenceScore = result.multiTimeframeContext.confluenceScore;
    
    if (isUltraMode) {
      // Ultra multi-timeframe: Even stricter requirements
      const minScoreForTrade = 85;
      const minRR = requiredMinRRUltra; // adjusted
      const minConfluence = 80;

      if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR || confluenceScore < minConfluence) {
        gated.signal = "NEUTRAL";
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      return gated;
    } else {
      // Normal multi-timeframe mode
      const minScoreForTrade = 75;
      const minRR = requiredMinRRNormal; // adjusted
      const minConfluence = 70;

      if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR || confluenceScore < minConfluence) {
        gated.signal = "NEUTRAL";
        gated.trade = null;
        gated.riskRewardRatio = null as any;
        return gated;
      }

      return gated;
    }
  }

  // Standard single-timeframe gating (existing logic)
  if (isUltraMode) {
    // Ultra: 2x stricter
    const minScoreForTrade = 85;
    const minRR = requiredMinRRUltra; // adjusted

    if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
      gated.trade = null;
      gated.riskRewardRatio = null as any; // nullable per schema
      return gated;
    }

    if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR) {
      gated.signal = "NEUTRAL";
      gated.trade = null;
      gated.riskRewardRatio = null as any;
      return gated;
    }

    // Passed Ultra gates
    return gated;
  } else {
    // Normal mode gates
    const minScoreForTrade = 75;
    const minRR = requiredMinRRNormal; // adjusted

    if (gated.signal === "NEUTRAL" || gated.confidence === "LOW") {
      gated.trade = null;
      gated.riskRewardRatio = null as any;
      return gated;
    }

    if (score < minScoreForTrade || !hasValidTrade || rr === null || rr < minRR) {
      gated.signal = "NEUTRAL";
      gated.trade = null;
      gated.riskRewardRatio = null as any;
      return gated;
    }

    return gated;
  }
}

// Helper functions for dynamic R:R calculation

function extractAssetType(result: AnalysisResult): string {
  // Extract asset type from analysis context
  // This is a simplified implementation - in practice, this would be extracted from the chart data or user input
  if (result.summary.toLowerCase().includes('bitcoin') || result.summary.toLowerCase().includes('btc')) {
    return 'BTC';
  }
  if (result.summary.toLowerCase().includes('ethereum') || result.summary.toLowerCase().includes('eth')) {
    return 'ETH';
  }
  if (result.summary.toLowerCase().includes('eurusd') || result.summary.toLowerCase().includes('forex')) {
    return 'EURUSD';
  }
  if (result.summary.toLowerCase().includes('gold') || result.summary.toLowerCase().includes('commodity')) {
    return 'GOLD';
  }
  if (result.summary.toLowerCase().includes('stock') || result.summary.toLowerCase().includes('aapl')) {
    return 'AAPL';
  }
  
  // Default to crypto for unknown assets
  return 'BTC';
}

function calculateDynamicRRRequirements(
  result: AnalysisResult,
  isUltraMode: boolean,
  assetType: string,
  timeframe: string,
  timestamp: string,
  dynamicRRService: DynamicRiskRewardService,
  tradeTrackingService: TradeTrackingService,
  ohlcvBars?: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }>
): { normalMode: { minRR: number; optimalRR: number; maxRR: number }; ultraMode: { minRR: number; optimalRR: number; maxRR: number } } {
  // Get base R:R requirements based on mode
  const baseRR = isUltraMode ? 2.2 : 1.8;
  
  // Get asset profile
  const assetProfile = dynamicRRService.getAssetProfile(assetType);
  
  // Calculate volatility metrics using real OHLCV if provided
  const volatilityMetrics = (ohlcvBars && ohlcvBars.length > 0)
    ? dynamicRRService.calculateVolatilityMetrics(
        ohlcvBars.map(b => ({ high: b.high, low: b.low, close: b.close, timestamp: b.timestamp })),
        timeframe as any)
    : dynamicRRService.calculateVolatilityMetrics([], timeframe as any);
  
  // Analyze time patterns
  const timePatterns = dynamicRRService.analyzeTimePatterns(timestamp, assetType);
  
  // Get historical performance from trade tracking service
  const historicalPerformance = tradeTrackingService.getHistoricalPerformance(assetType, timeframe as any);
  
  // Calculate dynamic R:R for both modes
  const normalModeRR = dynamicRRService.calculateDynamicRR(
    baseRR,
    volatilityMetrics,
    assetProfile,
    historicalPerformance,
    timePatterns,
    result.overallConfidenceScore,
    false
  );
  
  const ultraModeRR = dynamicRRService.calculateDynamicRR(
    baseRR + 0.4, // Higher base for ultra mode
    volatilityMetrics,
    assetProfile,
    historicalPerformance,
    timePatterns,
    result.overallConfidenceScore,
    true
  );
  
  return {
    normalMode: {
      minRR: normalModeRR.finalRecommendation.minRR,
      optimalRR: normalModeRR.finalRecommendation.optimalRR,
      maxRR: normalModeRR.finalRecommendation.maxRR
    },
    ultraMode: {
      minRR: ultraModeRR.finalRecommendation.minRR,
      optimalRR: ultraModeRR.finalRecommendation.optimalRR,
      maxRR: ultraModeRR.finalRecommendation.maxRR
    }
  };
}