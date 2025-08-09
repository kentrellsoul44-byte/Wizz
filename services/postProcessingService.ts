import type { AnalysisResult } from "../types";

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

  // Multi-timeframe specific gating
  if (result.isMultiTimeframeAnalysis && result.multiTimeframeContext) {
    const confluenceScore = result.multiTimeframeContext.confluenceScore;
    
    if (isUltraMode) {
      // Ultra multi-timeframe: Even stricter requirements
      const minScoreForTrade = 85;
      const minRR = 2.5; // Enhanced for multi-timeframe ultra
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
      const minRR = 2.0; // Slightly higher for multi-timeframe
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
    const minRR = 2.2;

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
    const minRR = 1.8;

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