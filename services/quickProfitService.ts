import type { QuickProfitAnalysis, QuickProfitPercentage, AnalysisResult, TradeSignal } from '../types';

export class QuickProfitService {
  /**
   * Analyzes chart conditions to determine the optimal profit percentage for Quick Profit mode
   */
  static analyzeQuickProfitPercentage(analysisResult: AnalysisResult): QuickProfitAnalysis {
    const confidence = analysisResult.overallConfidenceScore;
    const signal = analysisResult.signal;
    const trade = analysisResult.trade;
    
    // If no trade signal or low confidence, recommend conservative approach
    if (!trade || signal === 'NEUTRAL' || confidence < 50) {
      return {
        recommendedPercentage: 10,
        confidence: Math.max(confidence, 30),
        reasoning: "Conservative 10% target due to low confidence or neutral signal",
        marketConditions: {
          volatility: 'MEDIUM',
          trendStrength: 'WEAK',
          supportResistanceDistance: 'MEDIUM',
          recentPriceAction: 'CONSOLIDATING'
        },
        riskFactors: ["Low confidence signal", "Neutral market conditions"],
        opportunities: ["Conservative approach reduces risk"]
      };
    }

    // Analyze market conditions based on available data
    const marketConditions = this.analyzeMarketConditions(analysisResult);
    
    // Determine recommended percentage based on conditions
    const recommendedPercentage = this.calculateRecommendedPercentage(
      confidence,
      marketConditions,
      analysisResult
    );

    // Generate reasoning based on analysis
    const reasoning = this.generateReasoning(recommendedPercentage, marketConditions, confidence);
    
    // Identify risk factors and opportunities
    const { riskFactors, opportunities } = this.identifyRiskAndOpportunities(marketConditions, analysisResult);

    return {
      recommendedPercentage,
      confidence,
      reasoning,
      marketConditions,
      riskFactors,
      opportunities
    };
  }

  /**
   * Applies Quick Profit mode to a trade signal by calculating take profit based on percentage
   */
  static applyQuickProfitToTrade(trade: TradeSignal, percentage: QuickProfitPercentage): TradeSignal {
    const entryPrice = parseFloat(trade.entryPrice.replace(/[^0-9.-]/g, ''));
    const stopLoss = parseFloat(trade.stopLoss.replace(/[^0-9.-]/g, ''));
    
    if (isNaN(entryPrice) || isNaN(stopLoss)) {
      return trade; // Return original if parsing fails
    }

    // Calculate the price difference for the percentage
    const priceDifference = entryPrice * (percentage / 100);
    
    // Determine if it's a buy or sell signal based on entry vs stop loss
    const isBuySignal = entryPrice > stopLoss;
    
    let newTakeProfit: string;
    if (isBuySignal) {
      // For buy signals, take profit is above entry
      const takeProfitPrice = entryPrice + priceDifference;
      newTakeProfit = takeProfitPrice.toFixed(8); // Handle crypto precision
    } else {
      // For sell signals, take profit is below entry
      const takeProfitPrice = entryPrice - priceDifference;
      newTakeProfit = takeProfitPrice.toFixed(8);
    }

    return {
      ...trade,
      takeProfit: newTakeProfit,
      profitPercentage: percentage,
      quickProfitMode: true
    };
  }

  /**
   * Analyzes market conditions from the analysis result
   */
  private static analyzeMarketConditions(analysisResult: AnalysisResult) {
    const confidence = analysisResult.overallConfidenceScore;
    
    // Default conditions
    let volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'MEDIUM';
    let trendStrength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG' = 'MODERATE';
    let supportResistanceDistance: 'CLOSE' | 'MEDIUM' | 'FAR' = 'MEDIUM';
    let recentPriceAction: 'CONSOLIDATING' | 'BREAKOUT' | 'REVERSAL' | 'CONTINUATION' = 'CONSOLIDATING';

    // Analyze volatility based on confidence and signal strength
    if (confidence >= 85) {
      volatility = 'LOW';
    } else if (confidence >= 70) {
      volatility = 'MEDIUM';
    } else if (confidence >= 50) {
      volatility = 'HIGH';
    } else {
      volatility = 'EXTREME';
    }

    // Analyze trend strength
    if (confidence >= 80) {
      trendStrength = 'VERY_STRONG';
    } else if (confidence >= 65) {
      trendStrength = 'STRONG';
    } else if (confidence >= 45) {
      trendStrength = 'MODERATE';
    } else {
      trendStrength = 'WEAK';
    }

    // Analyze support/resistance distance (simplified)
    if (confidence >= 75) {
      supportResistanceDistance = 'FAR';
    } else if (confidence >= 55) {
      supportResistanceDistance = 'MEDIUM';
    } else {
      supportResistanceDistance = 'CLOSE';
    }

    // Analyze recent price action based on signal
    if (analysisResult.signal === 'NEUTRAL') {
      recentPriceAction = 'CONSOLIDATING';
    } else if (confidence >= 70) {
      recentPriceAction = 'BREAKOUT';
    } else if (confidence >= 50) {
      recentPriceAction = 'CONTINUATION';
    } else {
      recentPriceAction = 'REVERSAL';
    }

    // Use advanced pattern analysis if available
    if (analysisResult.patternAnalysis) {
      const pattern = analysisResult.patternAnalysis;
      
      // Adjust based on pattern confidence
      if (pattern.patternConfluence.confidenceScore >= 80) {
        trendStrength = 'VERY_STRONG';
        recentPriceAction = 'BREAKOUT';
      } else if (pattern.patternConfluence.confidenceScore >= 60) {
        trendStrength = 'STRONG';
        recentPriceAction = 'CONTINUATION';
      }

      // Adjust volatility based on market condition
      if (pattern.marketCondition.volatility === 'HIGH') {
        volatility = 'HIGH';
      } else if (pattern.marketCondition.volatility === 'EXTREME') {
        volatility = 'EXTREME';
      } else if (pattern.marketCondition.volatility === 'LOW') {
        volatility = 'LOW';
      }
    }

    // Use SMC analysis if available
    if (analysisResult.smcAnalysis) {
      const smc = analysisResult.smcAnalysis;
      
      if (smc.tradingBias.confidence >= 80) {
        trendStrength = 'VERY_STRONG';
      } else if (smc.tradingBias.confidence >= 60) {
        trendStrength = 'STRONG';
      }
    }

    return {
      volatility,
      trendStrength,
      supportResistanceDistance,
      recentPriceAction
    };
  }

  /**
   * Calculates the recommended profit percentage based on market conditions
   */
  private static calculateRecommendedPercentage(
    confidence: number,
    marketConditions: ReturnType<typeof this.analyzeMarketConditions>,
    analysisResult: AnalysisResult
  ): QuickProfitPercentage {
    let basePercentage = 15; // Default to 15%

    // Adjust based on confidence
    if (confidence >= 85) {
      basePercentage = 25;
    } else if (confidence >= 75) {
      basePercentage = 20;
    } else if (confidence >= 60) {
      basePercentage = 15;
    } else {
      basePercentage = 10;
    }

    // Adjust based on volatility
    if (marketConditions.volatility === 'EXTREME') {
      basePercentage = Math.max(10, basePercentage - 5);
    } else if (marketConditions.volatility === 'HIGH') {
      basePercentage = Math.max(10, basePercentage - 5);
    } else if (marketConditions.volatility === 'LOW') {
      basePercentage = Math.min(25, basePercentage + 5);
    }

    // Adjust based on trend strength
    if (marketConditions.trendStrength === 'VERY_STRONG') {
      basePercentage = Math.min(25, basePercentage + 5);
    } else if (marketConditions.trendStrength === 'STRONG') {
      basePercentage = Math.min(25, basePercentage + 5);
    } else if (marketConditions.trendStrength === 'WEAK') {
      basePercentage = Math.max(10, basePercentage - 5);
    }

    // Adjust based on recent price action
    if (marketConditions.recentPriceAction === 'BREAKOUT') {
      basePercentage = Math.min(25, basePercentage + 5);
    } else if (marketConditions.recentPriceAction === 'REVERSAL') {
      basePercentage = Math.max(10, basePercentage - 5);
    }

    // Adjust based on support/resistance distance
    if (marketConditions.supportResistanceDistance === 'FAR') {
      basePercentage = Math.min(25, basePercentage + 5);
    } else if (marketConditions.supportResistanceDistance === 'CLOSE') {
      basePercentage = Math.max(10, basePercentage - 5);
    }

    // Ensure the percentage is one of the valid options
    if (basePercentage <= 12.5) return 10;
    if (basePercentage <= 17.5) return 15;
    if (basePercentage <= 22.5) return 20;
    return 25;
  }

  /**
   * Generates reasoning for the recommended percentage
   */
  private static generateReasoning(
    percentage: QuickProfitPercentage,
    marketConditions: ReturnType<typeof this.analyzeMarketConditions>,
    confidence: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`${percentage}% profit target recommended based on:`);

    if (confidence >= 80) {
      reasons.push("• High confidence signal");
    } else if (confidence >= 60) {
      reasons.push("• Moderate confidence signal");
    } else {
      reasons.push("• Conservative approach due to lower confidence");
    }

    if (marketConditions.trendStrength === 'VERY_STRONG' || marketConditions.trendStrength === 'STRONG') {
      reasons.push("• Strong trend momentum");
    }

    if (marketConditions.recentPriceAction === 'BREAKOUT') {
      reasons.push("• Recent breakout pattern");
    }

    if (marketConditions.volatility === 'LOW') {
      reasons.push("• Low volatility environment");
    } else if (marketConditions.volatility === 'HIGH' || marketConditions.volatility === 'EXTREME') {
      reasons.push("• High volatility - conservative target");
    }

    if (marketConditions.supportResistanceDistance === 'FAR') {
      reasons.push("• Clear path to target with minimal resistance");
    }

    return reasons.join("\n");
  }

  /**
   * Identifies risk factors and opportunities
   */
  private static identifyRiskAndOpportunities(
    marketConditions: ReturnType<typeof this.analyzeMarketConditions>,
    analysisResult: AnalysisResult
  ): { riskFactors: string[]; opportunities: string[] } {
    const riskFactors: string[] = [];
    const opportunities: string[] = [];

    // Risk factors
    if (marketConditions.volatility === 'HIGH' || marketConditions.volatility === 'EXTREME') {
      riskFactors.push("High market volatility may cause rapid price swings");
    }

    if (marketConditions.trendStrength === 'WEAK') {
      riskFactors.push("Weak trend may result in false breakouts");
    }

    if (marketConditions.supportResistanceDistance === 'CLOSE') {
      riskFactors.push("Nearby support/resistance levels may limit movement");
    }

    if (analysisResult.overallConfidenceScore < 70) {
      riskFactors.push("Lower confidence signal increases risk");
    }

    // Opportunities
    if (marketConditions.trendStrength === 'VERY_STRONG' || marketConditions.trendStrength === 'STRONG') {
      opportunities.push("Strong trend momentum supports target achievement");
    }

    if (marketConditions.recentPriceAction === 'BREAKOUT') {
      opportunities.push("Breakout pattern suggests continued momentum");
    }

    if (marketConditions.volatility === 'LOW') {
      opportunities.push("Low volatility provides stable price action");
    }

    if (marketConditions.supportResistanceDistance === 'FAR') {
      opportunities.push("Clear path to target with minimal resistance");
    }

    if (analysisResult.overallConfidenceScore >= 80) {
      opportunities.push("High confidence signal reduces risk");
    }

    return { riskFactors, opportunities };
  }
}