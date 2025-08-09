import type { AnalysisResult } from "../types";
import { DynamicRiskRewardService } from "./dynamicRiskRewardService";
import { TradeTrackingService } from "./tradeTrackingService";

function parseRiskReward(ratio?: string): number | null {
  if (!ratio) return null;
  // Expect formats like "2.5:1" or "3:1" (ignore spaces)
  const cleaned = ratio.trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)[\s]*:[\s]*1$/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return isNaN(value) ? null : value;
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

export function applyPostProcessingGates(result: AnalysisResult, isUltraMode: boolean): AnalysisResult {
  const gated: AnalysisResult = { ...result };

  // Ensure confidence aligns with score per schema guidance
  const score = Number.isFinite(result.overallConfidenceScore) ? result.overallConfidenceScore : 0;
  const computedConfidence = score >= 75 ? "HIGH" : "LOW";
  if (gated.confidence !== computedConfidence) {
    gated.confidence = computedConfidence;
  }

  const rr = parseRiskReward(result.riskRewardRatio);
  const hasValidTrade = isValidTradeStructure(result);

  // Get dynamic risk/reward requirements
  const dynamicRRService = DynamicRiskRewardService.getInstance();
  const tradeTrackingService = TradeTrackingService.getInstance();
  const assetType = extractAssetType(result); // Extract from analysis context
  const timeframe = (result.timeframe as any) || '1H'; // Default to 1H if not specified
  const timestamp = new Date().toISOString();
  
  // Calculate dynamic R:R requirements
  const dynamicRR = calculateDynamicRRRequirements(
    result,
    isUltraMode,
    assetType,
    timeframe,
    timestamp,
    dynamicRRService,
    tradeTrackingService
  );

  // SMC-specific gating
  if (result.hasSMCAnalysis && result.smcAnalysis) {
    const smcScore = result.smcAnalysis.tradingBias.confidence;
    
    if (isUltraMode) {
      // Ultra SMC: Maximum precision requirements
      const minScoreForTrade = 85;
      const minRR = dynamicRR.ultraMode.minRR; // Dynamic R:R for Ultra SMC
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
      const minRR = dynamicRR.normalMode.minRR; // Dynamic R:R for Normal SMC
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
      const minRR = dynamicRR.ultraMode.minRR; // Dynamic R:R for Ultra Pattern trades
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
      const minRR = dynamicRR.normalMode.minRR; // Dynamic R:R for Normal Pattern trades
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
      const minRR = dynamicRR.ultraMode.minRR; // Dynamic R:R for Ultra multi-timeframe
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
      const minRR = dynamicRR.normalMode.minRR; // Dynamic R:R for Normal multi-timeframe
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
    const minRR = dynamicRR.ultraMode.minRR; // Dynamic R:R for Ultra mode

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
    const minRR = dynamicRR.normalMode.minRR; // Dynamic R:R for Normal mode

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
  tradeTrackingService: TradeTrackingService
): { normalMode: { minRR: number; optimalRR: number; maxRR: number }; ultraMode: { minRR: number; optimalRR: number; maxRR: number } } {
  // Get base R:R requirements based on mode
  const baseRR = isUltraMode ? 2.2 : 1.8;
  
  // Get asset profile
  const assetProfile = dynamicRRService.getAssetProfile(assetType);
  
  // Calculate volatility metrics (simplified - in practice, this would use actual price data)
  const volatilityMetrics = dynamicRRService.calculateVolatilityMetrics([], timeframe as any);
  
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