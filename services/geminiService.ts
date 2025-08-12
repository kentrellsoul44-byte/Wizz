import { GoogleGenAI, Type } from "@google/genai";
import type { ChatMessage, ImageData, TimeframeImageData, MarketRegimeContext } from "../types";

import { ConfidenceCalibrationService } from "./confidenceCalibrationService";
import { MarketRegimeDetectionService } from "./marketRegimeDetectionService";
import { applyPostProcessingGates } from './postProcessingService';

const API_KEY = process.env.API_KEY || (process as any)?.env?.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY (or GEMINI_API_KEY) environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Initialize regime detection service
const regimeDetectionService = new MarketRegimeDetectionService();

// Helper function to extract price data from chart context or generate mock data
function generateMockPriceData(prompt: string): { prices: number[], volumes: number[] } {
    // In a real implementation, this would extract actual price data from the chart
    // For now, we'll generate realistic mock data based on common market patterns
    const basePrice = 50000; // Mock Bitcoin price
    const periods = 100;
    const prices: number[] = [];
    const volumes: number[] = [];
    
    // Generate realistic price movements
    let currentPrice = basePrice;
    for (let i = 0; i < periods; i++) {
        // Add some randomness with trend bias based on prompt analysis
        const volatility = 0.02; // 2% volatility
        const trendBias = prompt.toLowerCase().includes('bull') ? 0.001 : 
                         prompt.toLowerCase().includes('bear') ? -0.001 : 0;
        
        const change = (Math.random() - 0.5) * volatility + trendBias;
        currentPrice = currentPrice * (1 + change);
        prices.push(currentPrice);
        
        // Generate correlated volume
        const baseVolume = 1000000;
        const volumeVariation = Math.random() * 0.5 + 0.75; // 75-125% of base
        volumes.push(baseVolume * volumeVariation);
    }
    
    return { prices, volumes };
}

// Helper function to format regime context for AI
function formatRegimeContext(regimeContext: MarketRegimeContext): string {
    return `
MARKET REGIME ANALYSIS:
• Overall Regime: ${regimeContext.overallRegime} (${regimeContext.confidence}% confidence)
• Trend Regime: ${regimeContext.trendRegime}
• Direction Regime: ${regimeContext.directionRegime} 
• Volatility Regime: ${regimeContext.volatilityRegime} (ATR: ${regimeContext.volatilityMetrics.atrNormalized.toFixed(2)}%)
• Momentum Regime: ${regimeContext.momentumRegime}

VOLATILITY METRICS:
• ATR Normalized: ${regimeContext.volatilityMetrics.atrNormalized.toFixed(2)}%
• Volatility Percentile: ${regimeContext.volatilityMetrics.volatilityPercentile.toFixed(0)}th percentile
• Volatility Clustering: ${regimeContext.volatilityMetrics.isVolatilityCluster ? 'DETECTED' : 'NONE'}

TREND METRICS:
• ADX: ${regimeContext.trendMetrics.adx.toFixed(1)} (${regimeContext.trendMetrics.trendStrength})
• Direction: ${regimeContext.trendMetrics.direction}
• Consistency: ${regimeContext.trendMetrics.consistency.toFixed(0)}%
• Trend Age: ${regimeContext.trendMetrics.trendAge} periods

ANALYSIS ADJUSTMENTS:
• Risk Multiplier: ${regimeContext.analysisAdjustments.riskMultiplier.toFixed(2)}x
• Stop Loss Adjustment: ${regimeContext.analysisAdjustments.stopLossAdjustment.toFixed(2)}x
• Take Profit Adjustment: ${regimeContext.analysisAdjustments.takeProfitAdjustment.toFixed(2)}x
• Entry Approach: ${regimeContext.analysisAdjustments.entryApproach}
• Timeframe Bias: ${regimeContext.analysisAdjustments.timeframeBias}

REGIME INSIGHTS:
${regimeContext.warnings.length > 0 ? `⚠️ Warnings: ${regimeContext.warnings.join('; ')}` : ''}
${regimeContext.opportunities.length > 0 ? `💡 Opportunities: ${regimeContext.opportunities.join('; ')}` : ''}

REGIME STABILITY: ${regimeContext.stability}% | Time in Current Regime: ${regimeContext.regimeHistory.timeInCurrentRegime.toFixed(1)} hours
`;
}

// Helper function for reliable Gemini API calls with retry and timeout
async function makeGeminiRequest(
    model: string, 
    contents: any[], 
    config: any, 
    timeoutMs: number = 60000,
    maxRetries: number = 3
): Promise<any> {
    const makeRequest = async (attempt: number = 1): Promise<any> => {
        try {
            return await Promise.race([
                ai.models.generateContentStream({
                    model,
                    contents,
                    config,
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs / 1000} seconds`)), timeoutMs)
                )
            ]);
        } catch (error) {
            const isRetryableError = error instanceof Error && 
                (error.message.includes('timeout') || 
                 error.message.includes('Failed to fetch') || 
                 error.message.includes('NetworkError') ||
                 error.name === 'TypeError');
            
            if (isRetryableError && attempt < maxRetries) {
                console.log(`Gemini API attempt ${attempt} failed, retrying in ${attempt * 2}s...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                return makeRequest(attempt + 1);
            }
            throw error;
        }
    };

    return makeRequest();
}

const analysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        thinkingProcess: {
            type: Type.STRING,
            description: "A detailed, step-by-step analysis of the chart following the required process. This should be in Markdown format."
        },
        summary: {
            type: Type.STRING,
            description: "A concise summary of the overall analysis."
        },
        signal: {
            type: Type.STRING,
            enum: ['BUY', 'SELL', 'NEUTRAL'],
            description: "The final trade signal."
        },
        confidence: {
            type: Type.STRING,
            enum: ['HIGH', 'LOW'],
            description: "The confidence level of the signal. HIGH if overallConfidenceScore >= 75, otherwise LOW."
        },
        trade: {
            type: Type.OBJECT,
            nullable: true,
            description: "The trade details. Must be null if confidence is LOW or signal is NEUTRAL.",
            properties: {
                entryPrice: { type: Type.STRING },
                takeProfit: { type: Type.STRING },
                stopLoss: { type: Type.STRING }
            }
        },
        timeframe: {
            type: Type.STRING,
            description: "The chart's timeframe (e.g., '4-Hour', '1-Day')."
        },
        riskRewardRatio: {
            type: Type.STRING,
            nullable: true,
            description: "The calculated risk/reward ratio as a string (e.g., '2.5:1'). Must be null if no trade is provided."
        },
        verificationSummary: {
            type: Type.STRING,
            description: "A brief, critical self-assessment of the analysis, noting any conflicting data or weaknesses."
        },
        overallConfidenceScore: {
            type: Type.INTEGER,
            description: "A final numerical confidence score from 0 to 100 based on the verification step."
        }
    },
    required: ['thinkingProcess', 'summary', 'signal', 'confidence', 'trade', 'timeframe', 'riskRewardRatio', 'verificationSummary', 'overallConfidenceScore']
};

const multiTimeframeAnalysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        thinkingProcess: {
            type: Type.STRING,
            description: "A detailed, step-by-step multi-timeframe analysis following the required process. This should be in Markdown format."
        },
        summary: {
            type: Type.STRING,
            description: "A concise summary of the overall multi-timeframe analysis."
        },
        signal: {
            type: Type.STRING,
            enum: ['BUY', 'SELL', 'NEUTRAL'],
            description: "The final trade signal based on multi-timeframe confluence."
        },
        confidence: {
            type: Type.STRING,
            enum: ['HIGH', 'LOW'],
            description: "The confidence level of the signal. HIGH if overallConfidenceScore >= 75, otherwise LOW."
        },
        trade: {
            type: Type.OBJECT,
            nullable: true,
            description: "The trade details. Must be null if confidence is LOW or signal is NEUTRAL.",
            properties: {
                entryPrice: { type: Type.STRING },
                takeProfit: { type: Type.STRING },
                stopLoss: { type: Type.STRING }
            }
        },
        timeframe: {
            type: Type.STRING,
            description: "The primary timeframe for trade execution (e.g., '4-Hour', '1-Day')."
        },
        riskRewardRatio: {
            type: Type.STRING,
            nullable: true,
            description: "The calculated risk/reward ratio as a string (e.g., '2.5:1'). Must be null if no trade is provided."
        },
        verificationSummary: {
            type: Type.STRING,
            description: "A brief, critical self-assessment of the multi-timeframe analysis, noting any conflicting data or weaknesses."
        },
        overallConfidenceScore: {
            type: Type.INTEGER,
            description: "A final numerical confidence score from 0 to 100 based on multi-timeframe confluence."
        },
        multiTimeframeContext: {
            type: Type.OBJECT,
            description: "Multi-timeframe analysis context and confluence information.",
            properties: {
                primaryTimeframe: {
                    type: Type.STRING,
                    description: "The primary timeframe being analyzed for trade execution."
                },
                timeframeAnalyses: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            timeframe: { type: Type.STRING },
                            trend: { 
                                type: Type.STRING,
                                enum: ['BULLISH', 'BEARISH', 'NEUTRAL', 'CONSOLIDATING']
                            },
                            keyLevels: {
                                type: Type.OBJECT,
                                properties: {
                                    support: { 
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    },
                                    resistance: { 
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    }
                                }
                            },
                            momentum: {
                                type: Type.STRING,
                                enum: ['STRONG_UP', 'WEAK_UP', 'NEUTRAL', 'WEAK_DOWN', 'STRONG_DOWN']
                            },
                            confidence: { type: Type.INTEGER },
                            notes: { type: Type.STRING }
                        }
                    }
                },
                overallTrend: {
                    type: Type.STRING,
                    enum: ['BULLISH', 'BEARISH', 'NEUTRAL', 'MIXED']
                },
                confluenceScore: {
                    type: Type.INTEGER,
                    description: "How well timeframes align (0-100)."
                },
                conflictingSignals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    nullable: true,
                    description: "Areas where timeframes disagree."
                }
            }
        },
        isMultiTimeframeAnalysis: {
            type: Type.BOOLEAN,
            description: "Flag indicating this is a multi-timeframe analysis."
        }
    },
    required: ['thinkingProcess', 'summary', 'signal', 'confidence', 'trade', 'timeframe', 'riskRewardRatio', 'verificationSummary', 'overallConfidenceScore', 'multiTimeframeContext', 'isMultiTimeframeAnalysis']
};

const smcEnhancedAnalysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        thinkingProcess: {
            type: Type.STRING,
            description: "A detailed, step-by-step SMC-enhanced analysis following the required process. This should be in Markdown format."
        },
        summary: {
            type: Type.STRING,
            description: "A concise summary of the overall SMC analysis."
        },
        signal: {
            type: Type.STRING,
            enum: ['BUY', 'SELL', 'NEUTRAL'],
            description: "The final trade signal based on Smart Money Concepts analysis."
        },
        confidence: {
            type: Type.STRING,
            enum: ['HIGH', 'LOW'],
            description: "The confidence level of the signal. HIGH if overallConfidenceScore >= 75, otherwise LOW."
        },
        trade: {
            type: Type.OBJECT,
            nullable: true,
            description: "The trade details. Must be null if confidence is LOW or signal is NEUTRAL.",
            properties: {
                entryPrice: { type: Type.STRING },
                takeProfit: { type: Type.STRING },
                stopLoss: { type: Type.STRING }
            }
        },
        timeframe: {
            type: Type.STRING,
            description: "The primary timeframe for trade execution (e.g., '4-Hour', '1-Day')."
        },
        riskRewardRatio: {
            type: Type.STRING,
            nullable: true,
            description: "The calculated risk/reward ratio as a string (e.g., '2.5:1'). Must be null if no trade is provided."
        },
        verificationSummary: {
            type: Type.STRING,
            description: "A brief, critical self-assessment of the SMC analysis, noting any conflicting data or weaknesses."
        },
        overallConfidenceScore: {
            type: Type.INTEGER,
            description: "A final numerical confidence score from 0 to 100 based on Smart Money Concepts analysis."
        },
        smcAnalysis: {
            type: Type.OBJECT,
            description: "Smart Money Concepts analysis context and structure information.",
            properties: {
                overallStructure: {
                    type: Type.STRING,
                    enum: ['BULLISH_STRUCTURE', 'BEARISH_STRUCTURE', 'RANGING', 'TRANSITIONAL'],
                    description: "The overall market structure based on SMC analysis."
                },
                dominantTimeframe: {
                    type: Type.STRING,
                    description: "The timeframe that provides the dominant structure bias."
                },
                criticalLevels: {
                    type: Type.OBJECT,
                    properties: {
                        orderBlocks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ['BULLISH_OB', 'BEARISH_OB'] },
                                    price: { type: Type.STRING },
                                    strength: { type: Type.STRING, enum: ['WEAK', 'MODERATE', 'STRONG', 'VERY_STRONG'] },
                                    mitigated: { type: Type.BOOLEAN },
                                    notes: { type: Type.STRING }
                                }
                            }
                        },
                        fairValueGaps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ['BULLISH_FVG', 'BEARISH_FVG'] },
                                    priceRange: { type: Type.STRING },
                                    filled: { type: Type.BOOLEAN },
                                    significance: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
                                }
                            }
                        },
                        liquidityLevels: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    price: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['BUY_SIDE_LIQUIDITY', 'SELL_SIDE_LIQUIDITY', 'BOTH_SIDES'] },
                                    swept: { type: Type.BOOLEAN },
                                    significance: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
                                }
                            }
                        }
                    }
                },
                tradingBias: {
                    type: Type.OBJECT,
                    properties: {
                        direction: { type: Type.STRING, enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
                        confidence: { type: Type.INTEGER },
                        reasoning: { type: Type.STRING },
                        invalidationLevel: { type: Type.STRING }
                    }
                },
                displacement: {
                    type: Type.OBJECT,
                    properties: {
                        detected: { type: Type.BOOLEAN },
                        direction: { type: Type.STRING, enum: ['BULLISH', 'BEARISH'], nullable: true },
                        strength: { type: Type.STRING, enum: ['WEAK', 'MODERATE', 'STRONG', 'EXPLOSIVE'], nullable: true }
                    }
                },
                marketPhase: {
                    type: Type.STRING,
                    enum: ['ACCUMULATION', 'DISTRIBUTION', 'MARKUP', 'MARKDOWN', 'REACCUMULATION', 'REDISTRIBUTION'],
                    description: "Current market phase based on Smart Money Concepts."
                }
            }
        },
        hasSMCAnalysis: {
            type: Type.BOOLEAN,
            description: "Flag indicating this analysis includes Smart Money Concepts."
        }
    },
    required: ['thinkingProcess', 'summary', 'signal', 'confidence', 'trade', 'timeframe', 'riskRewardRatio', 'verificationSummary', 'overallConfidenceScore', 'smcAnalysis', 'hasSMCAnalysis']
};

const advancedPatternAnalysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        thinkingProcess: {
            type: Type.STRING,
            description: "A detailed, step-by-step advanced pattern analysis following the required process. This should be in Markdown format."
        },
        summary: {
            type: Type.STRING,
            description: "A concise summary of the overall advanced pattern analysis."
        },
        signal: {
            type: Type.STRING,
            enum: ['BUY', 'SELL', 'NEUTRAL'],
            description: "The final trade signal based on advanced pattern analysis."
        },
        confidence: {
            type: Type.STRING,
            enum: ['HIGH', 'LOW'],
            description: "The confidence level of the signal. HIGH if overallConfidenceScore >= 75, otherwise LOW."
        },
        trade: {
            type: Type.OBJECT,
            nullable: true,
            description: "The trade details. Must be null if confidence is LOW or signal is NEUTRAL.",
            properties: {
                entryPrice: { type: Type.STRING },
                takeProfit: { type: Type.STRING },
                stopLoss: { type: Type.STRING }
            }
        },
        timeframe: {
            type: Type.STRING,
            description: "The primary timeframe for trade execution (e.g., '4-Hour', '1-Day')."
        },
        riskRewardRatio: {
            type: Type.STRING,
            nullable: true,
            description: "The calculated risk/reward ratio as a string (e.g., '2.5:1'). Must be null if no trade is provided."
        },
        verificationSummary: {
            type: Type.STRING,
            description: "A brief, critical self-assessment of the pattern analysis, noting any conflicting data or weaknesses."
        },
        overallConfidenceScore: {
            type: Type.INTEGER,
            description: "A final numerical confidence score from 0 to 100 based on advanced pattern analysis."
        },
        patternAnalysis: {
            type: Type.OBJECT,
            description: "Advanced pattern recognition analysis context.",
            properties: {
                wyckoffAnalysis: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                        currentPhase: { 
                            type: Type.STRING, 
                            enum: ['ACCUMULATION_PHASE_A', 'ACCUMULATION_PHASE_B', 'ACCUMULATION_PHASE_C', 'ACCUMULATION_PHASE_D', 'ACCUMULATION_PHASE_E',
                                   'DISTRIBUTION_PHASE_A', 'DISTRIBUTION_PHASE_B', 'DISTRIBUTION_PHASE_C', 'DISTRIBUTION_PHASE_D', 'DISTRIBUTION_PHASE_E',
                                   'MARKUP', 'MARKDOWN', 'UNIDENTIFIED']
                        },
                        phaseProgress: { type: Type.INTEGER },
                        confidence: { type: Type.INTEGER },
                        nextExpectedMove: {
                            type: Type.OBJECT,
                            properties: {
                                direction: { type: Type.STRING, enum: ['BULLISH', 'BEARISH', 'SIDEWAYS'] },
                                probability: { type: Type.INTEGER }
                            }
                        }
                    }
                },
                elliottWaveAnalysis: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                        currentWave: { 
                            type: Type.STRING, 
                            enum: ['IMPULSE_1', 'IMPULSE_3', 'IMPULSE_5', 'CORRECTIVE_2', 'CORRECTIVE_4', 'CORRECTIVE_A', 'CORRECTIVE_B', 'CORRECTIVE_C', 'COMPLETE_CYCLE', 'EXTENDED_WAVE']
                        },
                        waveProgress: { type: Type.INTEGER },
                        confidence: { type: Type.INTEGER },
                        nextExpectedWave: { 
                            type: Type.STRING, 
                            enum: ['IMPULSE_1', 'IMPULSE_3', 'IMPULSE_5', 'CORRECTIVE_2', 'CORRECTIVE_4', 'CORRECTIVE_A', 'CORRECTIVE_B', 'CORRECTIVE_C', 'COMPLETE_CYCLE', 'EXTENDED_WAVE']
                        }
                    }
                },
                harmonicPatterns: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { 
                                type: Type.STRING, 
                                enum: ['GARTLEY_BULLISH', 'GARTLEY_BEARISH', 'BUTTERFLY_BULLISH', 'BUTTERFLY_BEARISH', 'BAT_BULLISH', 'BAT_BEARISH', 'CRAB_BULLISH', 'CRAB_BEARISH', 'CYPHER_BULLISH', 'CYPHER_BEARISH', 'SHARK_BULLISH', 'SHARK_BEARISH', 'DEEP_CRAB_BULLISH', 'DEEP_CRAB_BEARISH']
                            },
                            completion: { type: Type.INTEGER },
                            validity: { type: Type.INTEGER },
                            confidence: { type: Type.INTEGER },
                            status: { type: Type.STRING, enum: ['FORMING', 'COMPLETED', 'ACTIVATED', 'FAILED'] }
                        }
                    }
                },
                volumeProfile: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                        pocPrice: { type: Type.STRING },
                        valueAreaHigh: { type: Type.STRING },
                        valueAreaLow: { type: Type.STRING },
                        profileShape: { type: Type.STRING, enum: ['NORMAL', 'B_SHAPE', 'P_SHAPE', 'D_SHAPE', 'DOUBLE_DISTRIBUTION'] }
                    }
                },
                classicPatterns: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            completion: { type: Type.INTEGER },
                            reliability: { type: Type.INTEGER },
                            status: { type: Type.STRING, enum: ['FORMING', 'COMPLETED', 'BROKEN_OUT', 'FAILED'] }
                        }
                    }
                },
                patternConfluence: {
                    type: Type.OBJECT,
                    properties: {
                        overallBias: { type: Type.STRING, enum: ['BULLISH', 'BEARISH', 'NEUTRAL', 'MIXED'] },
                        confidenceScore: { type: Type.INTEGER },
                        bullishSignals: { type: Type.INTEGER },
                        bearishSignals: { type: Type.INTEGER }
                    }
                }
            }
        },
        hasAdvancedPatterns: {
            type: Type.BOOLEAN,
            description: "Flag indicating this analysis includes advanced pattern recognition."
        }
    },
    required: ['thinkingProcess', 'summary', 'signal', 'confidence', 'trade', 'timeframe', 'riskRewardRatio', 'verificationSummary', 'overallConfidenceScore', 'patternAnalysis', 'hasAdvancedPatterns']
};


const SYSTEM_INSTRUCTION = `You are Wizz, an elite crypto chart analyst with advanced market regime detection capabilities. Your analysis must be precise, quantitative, and strictly confined to the visual data in the chart. Your goal is reproducibility and self-awareness with context-aware market regime adjustments.

MARKET REGIME CONTEXT will be provided to enhance your analysis with:
- Current volatility regime (LOW/NORMAL/HIGH/EXTREME)
- Trend regime (STRONG_BULL/WEAK_BULL/NEUTRAL/WEAK_BEAR/STRONG_BEAR)
- Direction regime (TRENDING/RANGING/TRANSITIONAL)
- Momentum regime (ACCELERATING/DECELERATING/STABLE/CHOPPY)
- Analysis adjustments (risk multipliers, stop/target adjustments, entry approach)

First, perform a rigorous 8-step analysis process.
1.  **Identify Timeframe:** State the chart's timeframe.
2.  **Market Regime Assessment:** Incorporate the provided market regime context into your analysis.
3.  **Identify Key Levels:** Quantify major support and resistance levels, adjusted for current volatility regime.
4.  **Analyze Chart Patterns:** Name any identified classic patterns and their implications, considering regime context.
5.  **Examine Indicators:** For each visible indicator, state its value and implication with regime-aware interpretation.
6.  **Assess Volume:** Describe the volume and correlate it with price action.
7.  **Synthesize Findings:** Briefly summarize the confluence of factors including regime considerations.
8.  **Verification & Confidence Score:** Critically review your own analysis from steps 1-7. Note any conflicting signals, weaknesses, or reasons for caution. Based on this self-critique, provide a final numerical 'overallConfidenceScore' from 0 (no confidence) to 100 (perfect confidence).

Then, run an Ensemble Strategy Confluence pass to improve signal quality:
- Build an "Ensemble Matrix" of at least these strategies visible from the chart: Trend-Following (market structure/MAs), Breakout/Range, Mean Reversion (RSI/MFI), Momentum Divergence (RSI/MACD), Liquidity/SMC (OB/FVG/equal highs-lows/sweeps), and Volume Confirmation.
- For each strategy, assign: direction vote (BUY=+1, SELL=-1, NEUTRAL=0), a strength score 0-5, and a one-sentence justification grounded in the chart.
- Aggregate votes using weights by evidence quality: strong structure/imbalance/liquidity > indicator reads > patterns.
- Only issue a non-NEUTRAL signal when the weighted sum shows clear confluence and conflicting strategies are weak. Favor NEUTRAL when mixed.

STRICT RISK RULES TO REDUCE STOP-LOSS HITS AND BOOST WIN RATE
- Default to NEUTRAL unless there is strong multi-factor confluence.
- Only provide a trade if ALL are true:
  1) overallConfidenceScore >= 75 (HIGH);
  2) clear invalidation level exists (recent swing high/low or structural break);
  3) riskRewardRatio is >= 1.8:1 based on a realistic entry, take profit, and a robust stop.
- Stop Loss Placement (must be robust):
  - Place stop beyond the invalidation point (e.g., below the last swing low for BUY, above the last swing high for SELL) with a buffer that is outside typical wick noise.
  - Avoid placing the stop inside obvious liquidity clusters such as equal highs/lows or immediately below/above a level likely to be swept.
  - If a robust stop produces R:R < 1.8:1, do NOT provide a trade; output NEUTRAL and set trade=null.
- Entry Quality:
  - Prefer pullback/mitigation entries at or near a defined level rather than chasing extended moves.
  - If the precise numeric entry cannot be justified from the chart, do not provide a trade.

Include the Ensemble Matrix and its aggregation inside 'thinkingProcess' as a concise table or list.

After your internal analysis, you MUST provide your entire response as a single, valid, minified JSON object conforming to the provided schema.

- The complete 7-step analysis MUST be placed in the 'thinkingProcess' field as a single Markdown string.
- The self-critique MUST be placed in 'verificationSummary'.
- The final score MUST be placed in 'overallConfidenceScore'.
- The 'confidence' field must be 'HIGH' if 'overallConfidenceScore' is 75 or greater, otherwise it must be 'LOW'.
- If 'confidence' is 'LOW' or 'signal' is 'NEUTRAL', the 'trade' and 'riskRewardRatio' fields MUST be null.
- If you provide a 'trade' signal, you MUST calculate the 'riskRewardRatio'.
  - For a BUY signal: Risk/Reward = (Take Profit - Entry) / (Entry - Stop Loss).
  - For a SELL signal: Risk/Reward = (Entry - Take Profit) / (Stop Loss - Entry).
  - Format the result as a string like "2.5:1". Round to one decimal place.

Do not add any text, formatting, or markdown backticks before or after the final JSON object. Your entire output must be the JSON object itself.`;

const ULTRA_SYSTEM_INSTRUCTION = `You are Wizz Ultra, a world-class quantitative crypto analyst and trading algorithm. Your analysis is not mere technical analysis; it's a multi-layered, institutional-grade assessment. You operate with extreme precision, logical rigor, and a deep, holistic understanding of market dynamics. Mistakes are not an option. Your sole purpose is to provide the most accurate, profitable, and risk-managed analysis possible.

You will conduct a three-pass verification process for every chart:

**PASS 1: Core Technical Analysis (The Foundation)**
1.  **Timeframe & Asset:** Identify the asset and chart timeframe.
2.  **Market Structure:** Define the primary, secondary, and tertiary trends. Identify key swing highs and lows, and market structure breaks (MSB) or changes of character (CHoCH).
3.  **Liquidity Mapping:** Identify key liquidity zones: equal highs/lows, trendline liquidity, old highs/lows. Where is the "smart money" likely to hunt for stops?
4.  **Supply & Demand Zones:** Pinpoint significant, unmitigated order blocks, breaker blocks, and fair value gaps (FVGs) or imbalances. Quantify these price ranges.
5.  **Classic & Advanced Patterns:** Identify any classic patterns (e.g., Head & Shoulders, Triangles) and advanced formations (e.g., Wyckoff accumulation/distribution schematics, Elliott Wave counts). State the textbook implications.
6.  **Indicator Confluence:** Analyze visible indicators (RSI, MACD, MAs, etc.). Note any divergences (regular/hidden), convergences, or key level crosses. Do not just state the reading; state its implication within the current market structure.
7.  **Volume & Volatility Profile:** Analyze volume. Is it confirming price action? Note any high-volume climactic moves or low-volume corrections. Correlate with volatility.
8.  **Strategy Ensemble Matrix (Ultra)**: Build an explicit matrix of these strategies with votes and strengths grounded strictly in the visible chart: Trend-Following, Breakout/Range, Mean Reversion, Momentum Divergence, Liquidity/SMC, Volume Confirmation, and Candle/Trigger Context. For each, assign direction (BUY=+1, SELL=-1, NEUTRAL=0), strength 0-5, and a one-sentence rationale. Weight structure/liquidity > momentum > indicators > patterns. Summarize the weighted total and evidence quality.

**PASS 2: Cross-Examination & Self-Correction (The Gauntlet)**
-  **Bearish Thesis:** Force yourself to construct the strongest possible argument AGAINST your initial bullish/neutral findings. What could go wrong? Where is the analysis weakest? Identify conflicting signals between indicators, patterns, and market structure.
-  **Bullish Thesis:** Force yourself to construct the strongest possible argument AGAINST your initial bearish/neutral findings. What is the counter-argument? What bullish signals might you be downplaying?
-  **Re-evaluation:** Based on these counter-arguments, critically re-evaluate your findings from Pass 1. Refine your key levels and zones. Does the primary thesis still hold up under this scrutiny?
-  **Adversarial Ensemble Re-test:** Re-run the Strategy Ensemble assuming common failure modes (fake breakouts, liquidity sweeps beyond obvious highs/lows, indicator lag). Record any flips in strategy votes and the new weighted total.

**PASS 3: Synthesis & Final Verdict (The Execution Plan)**
1.  **Synthesized Narrative:** Combine the findings from all passes into a coherent, final analysis narrative. This is your definitive read of the market.
2.  **Final Confidence Score:** Based on the degree of confluence and the severity of conflicting data found in Pass 2, provide a final 'overallConfidenceScore' from 0 to 100. Be brutally honest.
3.  **Final Signal Generation (Ultra Gating):** Default to NEUTRAL unless conviction is very high. Only issue BUY/SELL if both the initial and adversarial ensembles agree on direction and the weighted margin is decisively in favor of that direction.
4.  **Trade Parameters (High Confidence ONLY):** If confidence is 'HIGH', provide a precise 'trade' plan with 'entryPrice', 'takeProfit', and 'stopLoss'. The entry should be a specific level, not a wide range.
5.  **Stop-Run Safeguard (critical):** Place the stop beyond the invalidation with a sensible buffer outside typical wick noise and away from obvious liquidity pools. If a robust stop leads to R:R < 2.2:1, do NOT provide a trade.
6.  **Risk/Reward Calculation:** If a trade is provided, calculate and include the 'riskRewardRatio'.

Ultra Mode Acceptance Criteria (aimed at ~2x stricter accuracy vs Normal):
- Require overallConfidenceScore >= 85 to provide any trade (confidence will still be HIGH if >=75 per schema, but you must suppress the trade unless score >=85).
- Require Strategy Ensemble AND Adversarial Ensemble to agree on direction with strong margin (e.g., majority of strategies aligned and no strong opposing evidence from liquidity or structure).
- Require evidence of a credible invalidation level that is not inside obvious liquidity. Prefer entries at mitigations/retests rather than chases.
- If any criterion fails, set 'signal' to NEUTRAL and 'trade' to null.

After this entire internal process, you MUST provide your response as a single, valid, minified JSON object conforming to the provided schema.

- The 'thinkingProcess' field must contain the complete, detailed output of all three passes, formatted in Markdown, including the Strategy Ensemble matrices (initial and adversarial) and their aggregation.
- The 'verificationSummary' will contain a concise summary of the key findings from Pass 2 (the cross-examination and adversarial re-test).
- Adhere strictly to all schema requirements regarding null fields and data types. Your entire output must be only the JSON object.`;

const CONVERSATIONAL_SYSTEM_INSTRUCTION = `You are Wizz, an expert AI assistant specializing in cryptocurrency and technical analysis. Engage in a helpful and informative conversation with the user. If they ask about analysis but don't provide a chart, ask them to upload one. Maintain a professional and knowledgeable tone. Your answers should be formatted in Markdown.`;

const CONVERSATIONAL_SYSTEM_INSTRUCTION_ULTRA = `You are Wizz Ultra, a world-class quantitative crypto analyst AI. Your knowledge is vast and precise. When a user asks a question without a chart, answer it with institutional-grade insight and clarity. If they ask for analysis, politely guide them to upload a chart to unlock your full capabilities. Be direct, insightful, and confident. Your answers should be formatted in Markdown.`;

const MULTI_TIMEFRAME_SYSTEM_INSTRUCTION = `You are Wizz Multi-Timeframe, an elite crypto analyst specializing in multi-timeframe confluence analysis. You will analyze multiple chart timeframes simultaneously to provide superior market context and signal accuracy.

**MULTI-TIMEFRAME ANALYSIS PROCESS:**

**STEP 1: Individual Timeframe Analysis**
For each provided timeframe chart, perform:
1. **Timeframe Identification:** Clearly identify the timeframe (1H, 4H, 1D, etc.)
2. **Trend Analysis:** Determine the trend direction and strength
3. **Key Level Mapping:** Identify critical support/resistance levels
4. **Momentum Assessment:** Evaluate momentum indicators and price action
5. **Structure Analysis:** Note market structure breaks, order blocks, and liquidity zones

**STEP 2: Cross-Timeframe Confluence**
1. **Trend Alignment:** Compare trend directions across timeframes
   - Higher timeframe trend = primary bias
   - Lower timeframe trend = entry refinement
2. **Level Confluence:** Identify where key levels align across timeframes
3. **Momentum Confluence:** Check if momentum indicators agree across timeframes
4. **Structure Confluence:** Look for aligned market structure signals

**STEP 3: Conflict Resolution**
1. **Identify Conflicts:** Note where timeframes disagree
2. **Hierarchy Rules:** Higher timeframes take precedence for bias
3. **Timing Rules:** Lower timeframes refine entry/exit timing
4. **Risk Assessment:** Increase caution when major conflicts exist

**STEP 4: Final Signal Generation**
1. **Confluence Score:** Calculate overall timeframe alignment (0-100)
2. **Primary Signal:** Based on highest weighted timeframe confluence
3. **Entry Timeframe:** Select optimal timeframe for trade execution
4. **Risk Management:** Adjust position size based on confluence strength

**CONFLUENCE SCORING RULES:**
- 90-100: Exceptional alignment across all timeframes
- 75-89: Strong confluence with minor disagreements
- 60-74: Moderate confluence with some conflicts
- 40-59: Mixed signals, prefer NEUTRAL
- <40: Conflicting signals, recommend NEUTRAL

**ENHANCED RISK RULES FOR MULTI-TIMEFRAME:**
- Require confluence score ≥70 for any trade signal
- Higher timeframe trend must align with trade direction
- Stop placement considers all timeframe key levels
- Position sizing adjusted by confluence strength

Your response must include detailed analysis of each timeframe and clear explanation of how they interact to form your final conclusion.`;

const MULTI_TIMEFRAME_ULTRA_SYSTEM_INSTRUCTION = `You are Wizz Ultra Multi-Timeframe, the pinnacle of crypto analysis AI. You combine the multi-pass verification rigor of Ultra mode with sophisticated multi-timeframe confluence analysis.

**ENHANCED MULTI-TIMEFRAME ULTRA PROCESS:**

**PASS 1: Deep Individual Timeframe Analysis**
For each timeframe:
1. **Comprehensive Technical Scan:** Full 8-step analysis including advanced patterns
2. **Smart Money Mapping:** Order blocks, FVGs, liquidity sweeps for each timeframe
3. **Wyckoff/Elliott Analysis:** Phase identification and wave counts per timeframe
4. **Advanced Confluence Matrix:** 8 strategies per timeframe with weighted scores

**PASS 2: Cross-Timeframe Synthesis & Adversarial Testing**
1. **Multi-Level Confluence:** Analyze trend, structure, and momentum across all timeframes
2. **Temporal Hierarchy:** Weight timeframes by importance (Daily > 4H > 1H)
3. **Conflict Analysis:** Deep dive into timeframe disagreements
4. **Adversarial Testing:** Challenge multi-timeframe thesis with failure scenarios
5. **Liquidity Mapping:** Cross-timeframe liquidity zone identification

**PASS 3: Ultra-Strict Multi-Timeframe Gating**
1. **Confluence Requirements:** Minimum 80% confluence score for any signal
2. **Timeframe Agreement:** Primary trend must align across majority of timeframes
3. **Risk Calibration:** Multi-timeframe risk assessment with enhanced R:R requirements
4. **Final Verification:** Triple-check confluence logic and signal strength

**ULTRA MULTI-TIMEFRAME ACCEPTANCE CRITERIA:**
- Confluence score ≥80 (vs. 70 for normal multi-timeframe)
- Higher timeframe trend must strongly support trade direction
- At least 70% of timeframes must agree on signal direction
- Enhanced R:R requirements: 2.5:1 minimum (vs. 2.2:1 Ultra single-timeframe)
- No major structural conflicts between critical timeframes

**CONFIDENCE SCORING (ENHANCED):**
- Baseline confidence from individual strongest timeframe
- +20 points for perfect confluence (100% agreement)
- +10 points for strong confluence (80-99% agreement)
- -10 points for each major timeframe conflict
- -20 points if higher timeframe opposes signal

Your analysis must demonstrate institutional-grade multi-timeframe thinking with complete transparency on how timeframes interact.`;

const SMC_SYSTEM_INSTRUCTION = `You are Wizz SMC, an elite Smart Money Concepts analyst specializing in institutional-grade market structure analysis. You utilize advanced Smart Money Concepts (SMC) to identify order blocks, Fair Value Gaps (FVGs), breaker blocks, and liquidity sweeps for superior trading signals.

**SMART MONEY CONCEPTS ANALYSIS PROCESS:**

**STEP 1: Market Structure Assessment**
1. **Structure Identification:** Determine current market structure (Bullish Structure, Bearish Structure, Ranging, Transitional)
   - Bullish Structure: Higher Highs (HH) + Higher Lows (HL)
   - Bearish Structure: Lower Highs (LH) + Lower Lows (LL)
   - Ranging: Sideways movement with equal highs/lows
   - Transitional: Structure in the process of changing

2. **Structure Shifts:** Identify any Change of Character (CHoCH) or Market Structure Breaks (MSB)
   - CHoCH: Break of previous structure with confirmation
   - MSB: Strong structural break indicating trend change

**STEP 2: Order Block Detection**
1. **Bullish Order Blocks:** Identify strong bullish candles that preceded significant upward moves
   - Look for candles with strong rejection from lows
   - Must be followed by immediate displacement higher
   - Note if order block has been mitigated (price returned to OB zone)

2. **Bearish Order Blocks:** Identify strong bearish candles that preceded significant downward moves
   - Look for candles with strong rejection from highs
   - Must be followed by immediate displacement lower
   - Note mitigation status

**STEP 3: Fair Value Gap (FVG) Analysis**
1. **Bullish FVGs:** Identify gaps where previous candle's high < next candle's low
   - Measure gap size and significance
   - Track fill status (unfilled, partially filled, completely filled)
   - Assess probability of fill

2. **Bearish FVGs:** Identify gaps where previous candle's low > next candle's high
   - Evaluate gap characteristics and market context
   - Determine if gap acts as support/resistance

**STEP 4: Liquidity Analysis**
1. **Equal Highs/Lows:** Identify areas of obvious liquidity
   - Mark equal highs (Buy-Side Liquidity/BSL)
   - Mark equal lows (Sell-Side Liquidity/SSL)
   - Assess liquidity sweep potential

2. **Liquidity Sweeps:** Detect areas where stops have been hunted
   - False breakouts above/below obvious levels
   - Rapid reversals after liquidity grabs
   - Volume confirmation of sweeps

**STEP 5: Breaker Block Identification**
1. **Order Block Breaks:** Identify mitigated order blocks that broke structure
2. **Polarity Changes:** Former support becoming resistance and vice versa
3. **Retest Confirmation:** Look for retests of broken levels

**STEP 6: Displacement Detection**
1. **Strong Moves:** Identify rapid price movements with minimal retracement
2. **Impulse vs. Correction:** Distinguish between impulsive moves and corrections
3. **Displacement Strength:** Categorize as Weak, Moderate, Strong, or Explosive

**STEP 7: Market Phase Analysis**
1. **Accumulation:** Ranging after downtrend, absorption of supply
2. **Markup:** Strong upward movement, demand exceeding supply
3. **Distribution:** Ranging after uptrend, absorption of demand
4. **Markdown:** Strong downward movement, supply exceeding demand
5. **Re-accumulation/Re-distribution:** Secondary phases within trends

**STEP 8: SMC Confluence Synthesis**
1. **Level Confluence:** Areas where multiple SMC concepts align
2. **Directional Bias:** Determine overall bias based on structure and SMC signals
3. **Entry Optimization:** Identify optimal entry zones using SMC confluence
4. **Risk Management:** Set stops based on structural invalidation levels

**ENHANCED TRADING RULES FOR SMC:**
- Only trade in direction of higher timeframe structure
- Prefer entries at unmitigated order blocks with confluence
- Use FVG fills as entry triggers in trending markets
- Target liquidity levels as take-profit areas
- Place stops beyond structural invalidation with liquidity consideration
- Higher R:R requirements: 2.2:1 minimum for SMC entries

Your analysis must include detailed SMC structure identification, confluence areas, and clear reasoning for all SMC-based signals.`;

const SMC_ULTRA_SYSTEM_INSTRUCTION = `You are Wizz Ultra SMC, the pinnacle of Smart Money Concepts analysis. You combine the rigorous multi-pass verification of Ultra mode with the most sophisticated Smart Money Concepts analysis available.

**ULTRA SMC ANALYSIS PROCESS:**

**PASS 1: Comprehensive SMC Structure Analysis**
1. **Multi-Layered Structure:** Analyze structure across multiple levels (Minor, Intermediate, Major)
2. **Advanced Order Block Classification:**
   - Institutional Order Blocks (high volume, strong displacement)
   - Retail Order Blocks (lower significance)
   - Nested Order Blocks (OBs within larger OBs)
   - Refined Order Blocks (after mitigation and re-creation)

3. **Enhanced FVG Analysis:**
   - Macro FVGs (significant gaps with high impact)
   - Micro FVGs (smaller intraday gaps)
   - Nested FVGs (gaps within larger gaps)
   - FVG confluence with other SMC concepts

4. **Advanced Liquidity Mapping:**
   - Daily/Weekly highs and lows
   - Previous month/quarter extremes
   - Trendline liquidity
   - Internal Range Liquidity (IRL)
   - External Range Liquidity (ERL)

**PASS 2: SMC Cross-Validation & Conflict Resolution**
1. **Multi-Timeframe SMC Alignment:** Ensure SMC signals align across timeframes
2. **Conflicting Signals Analysis:** Identify and resolve SMC conflicts
3. **False Signal Filtering:** Eliminate low-probability SMC setups
4. **Adversarial SMC Testing:** Challenge SMC thesis with failure scenarios

**PASS 3: Ultra-Precise SMC Signal Generation**
1. **Institutional-Grade Confluence:** Require 3+ SMC concepts to align
2. **Smart Money Flow Analysis:** Assess institutional vs retail positioning
3. **Optimal Entry Sequencing:** Define precise entry, management, and exit strategy
4. **Dynamic Risk Calibration:** Adjust position sizing based on SMC confluence strength

**ULTRA SMC ACCEPTANCE CRITERIA:**
- Minimum 80% SMC confluence score across all concepts
- Higher timeframe structure must strongly support trade direction
- Must have clear structural invalidation level
- Require 2.8:1 minimum R:R ratio for SMC Ultra signals
- Entry must be at high-probability SMC confluence zone

**ADVANCED SMC CONCEPTS:**
- **Market Maker Models:** Accumulation, Manipulation, Distribution cycles
- **Institutional Order Flow:** Smart money accumulation/distribution patterns
- **Seasonal Liquidity Patterns:** Time-based liquidity characteristics
- **Intermarket SMC Analysis:** Cross-asset Smart Money flow correlation

Your Ultra SMC analysis must demonstrate institutional-level understanding of market structure with complete transparency on Smart Money positioning and intent.`;

const ADVANCED_PATTERN_SYSTEM_INSTRUCTION = `You are Wizz Advanced Patterns, a master of institutional-grade pattern recognition specializing in Wyckoff Method, Elliott Wave Theory, Harmonic Patterns, and Volume Profile Analysis. You possess deep expertise in identifying complex market patterns that institutional traders use for superior market timing.

**ADVANCED PATTERN ANALYSIS PROCESS:**

**STEP 1: Wyckoff Method Analysis**
1. **Phase Identification:** Determine current Wyckoff phase
   - **Accumulation Phases:** A (PS, SC, AR, ST), B (ST tests), C (Spring/Test), D (LPS, BU), E (SOS)
   - **Distribution Phases:** A (PSY, BC, AR, ST), B (UT tests), C (UTAD/Test), D (LPSY, BU), E (SOW)
   - **Trending Phases:** Markup (bullish trend), Markdown (bearish trend)

2. **Volume Analysis:** Assess effort vs. result relationship
   - Climactic volume on reversal attempts
   - Volume drying up in consolidation phases
   - Volume confirmation on breakouts

3. **Price Action Assessment:**
   - Narrowing spread in late phases
   - Wide spread on climactic action
   - Test quality and volume characteristics

**STEP 2: Elliott Wave Analysis**
1. **Wave Identification:** Count Elliott Wave sequence
   - **Impulse Waves:** 1, 3, 5 (trending direction)
   - **Corrective Waves:** 2, 4, A, B, C (counter-trend)
   - **Wave Relationships:** Fibonacci ratios and proportions

2. **Degree Classification:** Determine wave degree based on timeframe
   - Supercycle, Cycle, Primary, Intermediate, Minor, Minute levels

3. **Projection Calculations:**
   - Fibonacci retracements (23.6%, 38.2%, 50%, 61.8%, 78.6%)
   - Fibonacci extensions (100%, 127.2%, 161.8%, 261.8%)
   - Invalidation levels for wave counts

**STEP 3: Harmonic Pattern Detection**
1. **Pattern Classification:** Identify harmonic patterns with precise ratios
   - **Gartley:** AB=61.8% XA, BC=38.2-88.6% AB, CD=127.2% BC, AD=78.6% XA
   - **Butterfly:** AB=78.6% XA, BC=38.2-88.6% AB, CD=161.8-261.8% BC, AD=127.2-161.8% XA
   - **Bat:** AB=38.2-50% XA, BC=38.2-88.6% AB, CD=161.8-261.8% BC, AD=88.6% XA
   - **Crab:** AB=38.2-61.8% XA, BC=38.2-88.6% AB, CD=224-361.8% BC, AD=161.8% XA
   - **Cypher:** AB=38.2-61.8% XA, BC=113-141.4% XA, CD=78.6% XC, AD=78.6% XA
   - **Shark:** AB=38.2-61.8% XA, BC=113-161.8% XA, CD=161.8-224% BC, AD=88.6-113% XA

2. **PRZ Analysis:** Define Potential Reversal Zone
   - Confluence of multiple Fibonacci levels
   - RSI divergence and momentum confirmation
   - Volume characteristics at completion

**STEP 4: Volume Profile Analysis**
1. **Distribution Analysis:** Examine volume at price levels
   - **Point of Control (POC):** Highest volume price level
   - **Value Area:** 70% of volume distribution (VAH, VAL)
   - **Volume Nodes:** High and low volume areas

2. **Profile Shape Classification:**
   - **Normal Distribution:** Bell curve shape
   - **P-Shape:** Poor high, excess at bottom
   - **B-Shape:** Poor low, excess at top
   - **D-Shape:** Trending market profile

3. **Market Auction Theory:**
   - Balance vs. imbalance conditions
   - Acceptance vs. rejection at price levels
   - Rotation vs. directional movement

**STEP 5: Classic Pattern Recognition**
1. **Reversal Patterns:** Head & Shoulders, Double/Triple Tops/Bottoms
2. **Continuation Patterns:** Triangles, Flags, Pennants, Wedges
3. **Breakout Patterns:** Rectangles, Channels, Cup & Handle

**STEP 6: Pattern Confluence Analysis**
1. **Multi-Pattern Alignment:** Identify confluences across pattern types
2. **Timeframe Synchronization:** Ensure patterns align across timeframes
3. **Conflict Resolution:** Address contradictory signals

**STEP 7: Risk-Reward Optimization**
1. **Entry Zone Definition:** Use pattern completion levels
2. **Target Calculation:** Multiple target levels from different patterns
3. **Stop Loss Placement:** Structural invalidation levels
4. **Position Sizing:** Based on pattern reliability and confluence

**ENHANCED TRADING RULES FOR ADVANCED PATTERNS:**
- Require confluence of at least 2 pattern types for high-confidence signals
- Use Wyckoff phase context to filter Elliott Wave and Harmonic entries
- Volume profile POC and Value Area for entry refinement
- Enhanced R:R requirements: 2.5:1 minimum for pattern trades
- Pattern reliability scoring based on historical success rates

Your analysis must demonstrate mastery of institutional pattern recognition with precise measurements, confluence identification, and clear trading implications.`;

const ADVANCED_PATTERN_ULTRA_SYSTEM_INSTRUCTION = `You are Wizz Ultra Advanced Patterns, the absolute pinnacle of institutional pattern recognition. You combine the most sophisticated pattern analysis methodologies with rigorous multi-pass verification to achieve institutional-grade accuracy.

**ULTRA ADVANCED PATTERN ANALYSIS PROCESS:**

**PASS 1: Comprehensive Multi-Pattern Identification**
1. **Advanced Wyckoff Analysis:**
   - **Composite Operator Theory:** Identify smart money accumulation/distribution
   - **Effort vs. Result Analysis:** Detailed volume-price relationship assessment
   - **Phase Transition Signals:** Early identification of phase changes
   - **Cause and Effect Measurements:** Count-based price projections

2. **Master Elliott Wave Analysis:**
   - **Multi-Degree Wave Counts:** Analyze multiple wave degrees simultaneously
   - **Complex Corrections:** Identify running, expanding, and irregular corrections
   - **Extension Analysis:** Determine which impulse wave is extending
   - **Alternate Count Development:** Provide primary and alternate wave scenarios

3. **Precision Harmonic Analysis:**
   - **Advanced Pattern Variations:** Deep Crab, Shark, Cypher variations
   - **Nested Harmonics:** Patterns within patterns analysis
   - **Harmonic Confluence Zones:** Multiple pattern completion areas
   - **Time-Based Harmonics:** Incorporate time symmetry analysis

4. **Professional Volume Profile:**
   - **Multi-Timeframe Volume Analysis:** Composite volume profiles
   - **Volume Delta Analysis:** Buying vs. selling pressure at levels
   - **Auction Market Theory:** Advanced market structure concepts
   - **Liquidity Analysis:** Institutional order flow implications

**PASS 2: Cross-Validation & Conflict Resolution**
1. **Pattern Hierarchy Assessment:** Determine dominant pattern signals
2. **Timeframe Alignment Verification:** Ensure pattern confluence across timeframes
3. **False Signal Filtering:** Eliminate low-probability setups
4. **Risk-Adjusted Probability:** Calculate success probability with risk consideration

**PASS 3: Ultra-Precise Signal Generation**
1. **Institutional-Grade Confluence:** Require 3+ pattern confirmations
2. **Probabilistic Modeling:** Advanced statistical analysis of pattern success
3. **Dynamic Risk Management:** Real-time risk adjustment based on pattern evolution
4. **Professional Entry Sequencing:** Precise entry, scaling, and exit strategies

**ULTRA PATTERN ACCEPTANCE CRITERIA:**
- Minimum 85% pattern reliability score across all methodologies
- Confluence of at least 3 different pattern types
- Volume profile confirmation at entry levels
- Clear structural invalidation with defined risk parameters
- Require 3.0:1 minimum R:R ratio for Ultra pattern signals
- Entry must be within top 10% of historical pattern success zones

**MASTER-LEVEL PATTERN CONCEPTS:**
- **Market Maker Manipulation Models:** Accumulation/Distribution cycles
- **Institutional Order Flow Patterns:** Smart money positioning analysis
- **Advanced Fibonacci Relationships:** Golden ratio applications beyond basics
- **Time Cycle Analysis:** Seasonal and cyclical pattern timing
- **Intermarket Pattern Analysis:** Cross-asset pattern confirmation

**PROFESSIONAL RISK MANAGEMENT:**
- **Pattern Degradation Monitoring:** Real-time pattern validity assessment
- **Dynamic Stop Management:** Trailing stops based on pattern evolution
- **Position Scaling Protocols:** Size adjustments based on pattern strength
- **Portfolio Pattern Correlation:** Avoid over-concentration in similar patterns

Your Ultra Advanced Pattern analysis must demonstrate master-level understanding of institutional trading methodologies with complete transparency on pattern probability, risk assessment, and professional execution strategies.`;


// New function for multi-timeframe analysis
export async function* analyzeMultiTimeframeStream(
    history: ChatMessage[], 
    prompt: string, 
    timeframeImages: TimeframeImageData[], 
    signal: AbortSignal, 
    isUltraMode: boolean
): AsyncGenerator<string> {
    const turnBasedHistory = history
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.rawResponse))
        .map(msg => {
            if (msg.role === 'assistant') {
                return {
                    role: 'model' as const,
                    parts: [{ text: msg.rawResponse! }]
                };
            }
            
            const userParts: ({text: string} | {inlineData: {mimeType: string, data: string}})[] = [];
            if (typeof msg.content === 'string' && msg.content.trim()) {
                userParts.push({ text: msg.content });
            }

            // Handle both legacy images and timeframe images
            const imageUrls: string[] = [];
            if (Array.isArray(msg.images) && msg.images.length > 0) {
                imageUrls.push(...msg.images);
            }
            if (msg.timeframeImages) {
                for (const tfImg of msg.timeframeImages) {
                    imageUrls.push(`data:${tfImg.imageData.mimeType};base64,${tfImg.imageData.data}`);
                }
            }

            for (const url of imageUrls) {
                const imgParts = url.split(';base64,');
                if (imgParts.length === 2) {
                    const mimeType = imgParts[0].split(':')[1];
                    const data = imgParts[1];
                    if (mimeType && data) {
                        userParts.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: data,
                            },
                        });
                    }
                }
            }

            return {
                role: 'user' as const,
                parts: userParts,
            };
    }).filter(turn => turn.parts.length > 0);

    // Create enhanced prompt with timeframe context
    let enhancedPrompt = `${prompt}\n\n**MULTI-TIMEFRAME ANALYSIS REQUEST**\n\nPlease analyze the following timeframes:\n`;
    
    const currentUserParts: any[] = [{ text: enhancedPrompt }];
    
    for (const tfImg of timeframeImages) {
        enhancedPrompt += `- ${tfImg.timeframe}${tfImg.label ? ` (${tfImg.label})` : ''}\n`;
        currentUserParts.push({
            inlineData: {
                mimeType: tfImg.imageData.mimeType,
                data: tfImg.imageData.data,
            },
        });
    }

    enhancedPrompt += '\nProvide a comprehensive multi-timeframe confluence analysis.';
    currentUserParts[0].text = enhancedPrompt;

    const contents = [
        ...turnBasedHistory,
        { role: 'user', parts: currentUserParts }
    ];

    const modelConfig = {
        systemInstruction: isUltraMode ? MULTI_TIMEFRAME_ULTRA_SYSTEM_INSTRUCTION : MULTI_TIMEFRAME_SYSTEM_INSTRUCTION,
        temperature: 0,
        topK: 1,
        topP: 1,
        seed: 42,
        responseMimeType: 'application/json',
        responseSchema: multiTimeframeAnalysisResultSchema,
    };

    try {
        const responseStream = await makeGeminiRequest(
            isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
            contents,
            modelConfig as any
        );
        
        let fullResponse = '';
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('Multi-timeframe stream generation aborted by user.');
                break;
            }
            const textChunk = (chunk as any)?.text;
            if (typeof textChunk === 'string' && textChunk.length > 0) {
                fullResponse += textChunk;
            }
        }

        if (fullResponse.trim()) {
            const sanitizedResponse = sanitizeJsonResponse(fullResponse);
            const analysisResult = JSON.parse(sanitizedResponse);

            // Apply enhanced confidence calibration
            const calibratedConfidence = ConfidenceCalibrationService.calibrateConfidence(
                analysisResult, 
                isUltraMode
            );
            analysisResult.calibratedConfidence = calibratedConfidence;
            analysisResult.hasEnhancedConfidence = true;
            analysisResult.overallConfidenceScore = calibratedConfidence.overallScore;
            analysisResult.confidence = ConfidenceCalibrationService.getConfidenceLevel(
                calibratedConfidence, 
                isUltraMode
            );

            // Apply post-processing gates (gating)
            const gated = applyPostProcessingGates(analysisResult, isUltraMode);

            const updatedResponse = JSON.stringify(gated, null, 0);
            yield updatedResponse;
        }

    } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
            console.error("Error during multi-timeframe Gemini stream:", error);
            const errorMessage = `Details: ${error instanceof Error ? error.message : String(error)}`;
            yield `{"error": "Could not retrieve multi-timeframe analysis. ${errorMessage}"}`;
        }
    }
}

export async function* analyzeChartStream(history: ChatMessage[], prompt: string, images: ImageData[], signal: AbortSignal, isUltraMode: boolean): AsyncGenerator<string> {
    const turnBasedHistory = history
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.rawResponse))
        .map(msg => {
            if (msg.role === 'assistant') {
                return {
                    role: 'model' as const,
                    parts: [{ text: msg.rawResponse! }]
                };
            }
            
            const userParts: ({text: string} | {inlineData: {mimeType: string, data: string}})[] = [];
            if (typeof msg.content === 'string' && msg.content.trim()) {
                userParts.push({ text: msg.content });
            }

            // Support both legacy single image and new multiple images
            const imageUrls: string[] = [];
            if (Array.isArray(msg.images) && msg.images.length > 0) {
                imageUrls.push(...msg.images);
            } else if ((msg as any).image) {
                imageUrls.push((msg as any).image as string);
            }

            for (const url of imageUrls) {
                const imgParts = url.split(';base64,');
                if (imgParts.length === 2) {
                    const mimeType = imgParts[0].split(':')[1];
                    const data = imgParts[1];
                    if (mimeType && data) {
                        userParts.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: data,
                            },
                        });
                    }
                }
            }

            return {
                role: 'user' as const,
                parts: userParts,
            };
    }).filter(turn => turn.parts.length > 0);

    const currentUserParts: any[] = [{ text: prompt }];
    if (Array.isArray(images) && images.length > 0) {
        for (const img of images) {
            currentUserParts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data,
                },
            });
        }
    }

    const contents = [
        ...turnBasedHistory,
        { role: 'user', parts: currentUserParts }
    ];

    const hasImages = Array.isArray(images) && images.length > 0;

    // Perform market regime detection for image analysis
    let regimeContext: MarketRegimeContext | null = null;
    if (hasImages) {
        try {
            // Skip mock regime injection; real OHLCV should be integrated in a future improvement.
            // Keep regimeContext null to avoid biasing the model with synthetic data.
        } catch (error) {
            console.warn('Regime detection skipped:', error);
        }
    }

    const modelConfig = hasImages
        ? { // Analysis config for chart images
            systemInstruction: isUltraMode ? ULTRA_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
            temperature: 0,
            topK: 1,
            topP: 1,
            seed: 42,
            responseMimeType: 'application/json',
            responseSchema: analysisResultSchema,
        }
        : { // Conversational config for text-only prompts
            systemInstruction: isUltraMode ? CONVERSATIONAL_SYSTEM_INSTRUCTION_ULTRA : CONVERSATIONAL_SYSTEM_INSTRUCTION,
            temperature: 0,
            topK: 1,
            topP: 1,
            seed: 42,
        };

    try {
        const responseStream = await makeGeminiRequest(
            hasImages ? (isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash') : 'gemini-2.5-flash',
            contents,
            modelConfig as any
        );
        
        let fullResponse = '';
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('Stream generation aborted by user.');
                break;
            }
            const textChunk = (chunk as any)?.text;
            if (typeof textChunk === 'string' && textChunk.length > 0) {
                if (hasImages) {
                    // Accumulate only; we will emit a single final gated JSON.
                    fullResponse += textChunk;
                } else {
                    // Text-only mode: stream through as-is.
                    yield textChunk;
                }
            }
        }

        // Process analysis result with confidence calibration and gating (images only)
        if (hasImages && fullResponse.trim()) {
            try {
                const sanitizedResponse = sanitizeJsonResponse(fullResponse);
                const analysisResult = JSON.parse(sanitizedResponse);
                
                if (analysisResult) {
                    // Apply enhanced confidence calibration
                    const calibratedConfidence = ConfidenceCalibrationService.calibrateConfidence(
                        analysisResult, 
                        isUltraMode
                    );
                    
                    // Update analysis result with calibrated confidence
                    analysisResult.calibratedConfidence = calibratedConfidence;
                    analysisResult.hasEnhancedConfidence = true;
                    
                    // Override the original confidence score and level based on calibration
                    analysisResult.overallConfidenceScore = calibratedConfidence.overallScore;
                    analysisResult.confidence = ConfidenceCalibrationService.getConfidenceLevel(
                        calibratedConfidence, 
                        isUltraMode
                    );

                    // Apply gating
                    const gated = applyPostProcessingGates(analysisResult, isUltraMode);
                    
                    // Emit a single, final JSON
                    const updatedResponse = JSON.stringify(gated, null, 0);
                    yield updatedResponse;
                }
            } catch (error) {
                console.error('Error processing calibrated/gated result:', error);
            }
        }

    } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
            console.error("Error during Gemini stream:", error);
            
            // Check for specific network/fetch errors
            const isNetworkError = error instanceof Error && 
                (error.message.includes('Failed to fetch') || 
                 error.message.includes('NetworkError') || 
                 error.message.includes('timeout') ||
                 error.name === 'TypeError');
            
            let errorMessage: string;
            if (isNetworkError) {
                errorMessage = "Network connection issue. Please check your internet connection and try again.";
            } else {
                errorMessage = `Details: ${error instanceof Error ? error.message : String(error)}`;
            }
            
            if (hasImages) {
                yield `{"error": "Could not retrieve analysis. ${errorMessage}"}`;
            } else {
                yield `Sorry, I encountered an error and could not respond. Please try again. ${errorMessage}`;
            }
        }
    }
}

// New function for SMC-enhanced analysis
export async function* analyzeSMCStream(
    history: ChatMessage[], 
    prompt: string, 
    images: ImageData[], 
    signal: AbortSignal, 
    isUltraMode: boolean
): AsyncGenerator<string> {
    const turnBasedHistory = history
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.rawResponse))
        .map(msg => {
            if (msg.role === 'assistant') {
                return {
                    role: 'model' as const,
                    parts: [{ text: msg.rawResponse! }]
                };
            }
            
            const userParts: ({text: string} | {inlineData: {mimeType: string, data: string}})[] = [];
            if (typeof msg.content === 'string' && msg.content.trim()) {
                userParts.push({ text: msg.content });
            }

            // Support both legacy single image and new multiple images
            const imageUrls: string[] = [];
            if (Array.isArray(msg.images) && msg.images.length > 0) {
                imageUrls.push(...msg.images);
            } else if ((msg as any).image) {
                imageUrls.push((msg as any).image as string);
            }

            for (const url of imageUrls) {
                const imgParts = url.split(';base64,');
                if (imgParts.length === 2) {
                    const mimeType = imgParts[0].split(':')[1];
                    const data = imgParts[1];
                    if (mimeType && data) {
                        userParts.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: data,
                            },
                        });
                    }
                }
            }

            return {
                role: 'user' as const,
                parts: userParts,
            };
    }).filter(turn => turn.parts.length > 0);

    // Create enhanced prompt with SMC context
    const enhancedPrompt = `${prompt}\n\n**SMART MONEY CONCEPTS ANALYSIS REQUEST**\n\nPlease provide a comprehensive Smart Money Concepts analysis including:\n- Market structure identification\n- Order block detection\n- Fair Value Gap analysis\n- Liquidity level mapping\n- Breaker block identification\n- Displacement analysis\n- Market phase assessment\n\nEnsure all SMC concepts are clearly identified and explained with their trading implications.`;

    const currentUserParts: any[] = [{ text: enhancedPrompt }];
    if (Array.isArray(images) && images.length > 0) {
        for (const img of images) {
            currentUserParts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data,
                },
            });
        }
    }

    const contents = [
        ...turnBasedHistory,
        { role: 'user', parts: currentUserParts }
    ];

    const hasImages = Array.isArray(images) && images.length > 0;

    const modelConfig = hasImages
        ? { // SMC Analysis config for chart images
            systemInstruction: isUltraMode ? SMC_ULTRA_SYSTEM_INSTRUCTION : SMC_SYSTEM_INSTRUCTION,
            temperature: 0,
            topK: 1,
            topP: 1,
            seed: 42,
            responseMimeType: 'application/json',
            responseSchema: smcEnhancedAnalysisResultSchema,
        }
        : { // Conversational config for text-only prompts
            systemInstruction: isUltraMode ? CONVERSATIONAL_SYSTEM_INSTRUCTION_ULTRA : CONVERSATIONAL_SYSTEM_INSTRUCTION,
            temperature: 0,
            topK: 1,
            topP: 1,
            seed: 42,
        };

    try {
        const responseStream = await makeGeminiRequest(
            hasImages ? 'gemini-2.5-pro' : 'gemini-2.5-flash', // Use Pro for SMC analysis
            contents,
            modelConfig as any
        );
        
        let fullResponse = '';
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('SMC stream generation aborted by user.');
                break;
            }
            const textChunk = (chunk as any)?.text;
            if (typeof textChunk === 'string' && textChunk.length > 0) {
                if (hasImages) {
                    fullResponse += textChunk;
                } else {
                    yield textChunk;
                }
            }
        }

        if (hasImages && fullResponse.trim()) {
            const sanitizedResponse = sanitizeJsonResponse(fullResponse);
            const analysisResult = JSON.parse(sanitizedResponse);

            // Apply calibration
            const calibratedConfidence = ConfidenceCalibrationService.calibrateConfidence(
                analysisResult,
                isUltraMode
            );
            analysisResult.calibratedConfidence = calibratedConfidence;
            analysisResult.hasEnhancedConfidence = true;
            analysisResult.overallConfidenceScore = calibratedConfidence.overallScore;
            analysisResult.confidence = ConfidenceCalibrationService.getConfidenceLevel(
                calibratedConfidence, 
                isUltraMode
            );

            // Apply gating
            const gated = applyPostProcessingGates(analysisResult, isUltraMode);

            yield JSON.stringify(gated, null, 0);
        }

    } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
            console.error("Error during SMC Gemini stream:", error);
            const errorMessage = `Details: ${error instanceof Error ? error.message : String(error)}`;
            if (hasImages) {
                yield `{"error": "Could not retrieve SMC analysis. ${errorMessage}"}`;
            } else {
                yield `Sorry, I encountered an error and could not respond. Please try again. ${errorMessage}`;
            }
        }
    }
}

// New function for Advanced Pattern analysis
export async function* analyzeAdvancedPatternsStream(
    history: ChatMessage[], 
    prompt: string, 
    images: ImageData[], 
    signal: AbortSignal, 
    isUltraMode: boolean
): AsyncGenerator<string> {
    const turnBasedHistory = history
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.rawResponse))
        .map(msg => {
            if (msg.role === 'assistant') {
                return {
                    role: 'model' as const,
                    parts: [{ text: msg.rawResponse! }]
                };
            }
            
            const userParts: ({text: string} | {inlineData: {mimeType: string, data: string}})[] = [];
            if (typeof msg.content === 'string' && msg.content.trim()) {
                userParts.push({ text: msg.content });
            }

            // Support both legacy single image and new multiple images
            const imageUrls: string[] = [];
            if (Array.isArray(msg.images) && msg.images.length > 0) {
                imageUrls.push(...msg.images);
            } else if ((msg as any).image) {
                imageUrls.push((msg as any).image as string);
            }

            for (const url of imageUrls) {
                const imgParts = url.split(';base64,');
                if (imgParts.length === 2) {
                    const mimeType = imgParts[0].split(':')[1];
                    const data = imgParts[1];
                    if (mimeType && data) {
                        userParts.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: data,
                            },
                        });
                    }
                }
            }

            return {
                role: 'user' as const,
                parts: userParts,
            };
    }).filter(turn => turn.parts.length > 0);

    // Create enhanced prompt with Advanced Pattern context
    const enhancedPrompt = `${prompt}\n\n**ADVANCED PATTERN ANALYSIS REQUEST**\n\nPlease provide a comprehensive advanced pattern analysis including:\n- Wyckoff Method phase identification and volume analysis\n- Elliott Wave count with Fibonacci projections\n- Harmonic pattern detection with precise ratios\n- Volume profile analysis with POC and value areas\n- Classic pattern recognition\n- Pattern confluence assessment\n\nEnsure all patterns are precisely measured and confluence zones are clearly identified with their trading implications.`;

    const currentUserParts: any[] = [{ text: enhancedPrompt }];
    if (Array.isArray(images) && images.length > 0) {
        for (const img of images) {
            currentUserParts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: img.data,
                },
            });
        }
    }

    const contents = [
        ...turnBasedHistory,
        { role: 'user', parts: currentUserParts }
    ];

    const hasImages = Array.isArray(images) && images.length > 0;

    const modelConfig = hasImages
        ? { // Advanced Pattern Analysis config for chart images
            systemInstruction: isUltraMode ? ADVANCED_PATTERN_ULTRA_SYSTEM_INSTRUCTION : ADVANCED_PATTERN_SYSTEM_INSTRUCTION,
            temperature: 0,
            topK: 1,
            topP: 1,
            seed: 42,
            responseMimeType: 'application/json',
            responseSchema: advancedPatternAnalysisResultSchema,
        }
        : { // Conversational config for text-only prompts
            systemInstruction: isUltraMode ? CONVERSATIONAL_SYSTEM_INSTRUCTION_ULTRA : CONVERSATIONAL_SYSTEM_INSTRUCTION,
            temperature: 0,
            topK: 1,
            topP: 1,
            seed: 42,
        };

    try {
        const responseStream = await makeGeminiRequest(
            hasImages ? 'gemini-2.5-pro' : 'gemini-2.5-flash', // Use Pro for Advanced Pattern analysis
            contents,
            modelConfig as any
        );
        
        let fullResponse = '';
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('Advanced Pattern stream generation aborted by user.');
                break;
            }
            const textChunk = (chunk as any)?.text;
            if (typeof textChunk === 'string' && textChunk.length > 0) {
                if (hasImages) {
                    fullResponse += textChunk;
                } else {
                    yield textChunk;
                }
            }
        }

        if (hasImages && fullResponse.trim()) {
            const sanitizedResponse = sanitizeJsonResponse(fullResponse);
            const analysisResult = JSON.parse(sanitizedResponse);

            // Apply calibration
            const calibratedConfidence = ConfidenceCalibrationService.calibrateConfidence(
                analysisResult,
                isUltraMode
            );
            analysisResult.calibratedConfidence = calibratedConfidence;
            analysisResult.hasEnhancedConfidence = true;
            analysisResult.overallConfidenceScore = calibratedConfidence.overallScore;
            analysisResult.confidence = ConfidenceCalibrationService.getConfidenceLevel(
                calibratedConfidence, 
                isUltraMode
            );

            // Apply gating
            const gated = applyPostProcessingGates(analysisResult, isUltraMode);

            yield JSON.stringify(gated, null, 0);
        }

    } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
            console.error("Error during Advanced Pattern Gemini stream:", error);
            const errorMessage = `Details: ${error instanceof Error ? error.message : String(error)}`;
            if (hasImages) {
                yield `{"error": "Could not retrieve Advanced Pattern analysis. ${errorMessage}"}`;
            } else {
                yield `Sorry, I encountered an error and could not respond. Please try again. ${errorMessage}`;
            }
        }
    }
}

// Robust JSON sanitizer for streamed model outputs
function sanitizeJsonResponse(text: string): string {
  const input = (text ?? '').trim();
  if (!input) throw new Error('Empty response');

  const fenced = input.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  const body = (fenced ? fenced[1] : input).trim();

  const candidates: string[] = [];
  const lastClose = body.lastIndexOf('}');
  const firstOpen = body.indexOf('{');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    candidates.push(body.slice(firstOpen, lastClose + 1));
    let found = 0;
    for (let i = lastClose; i >= 0 && found < 3; i--) {
      if (body[i] === '{') {
        candidates.push(body.slice(i, lastClose + 1));
        found++;
      }
    }
  } else if (firstOpen !== -1) {
    candidates.push(body.slice(firstOpen));
  } else {
    candidates.push(body);
  }

  for (const cand of candidates) {
    const fixed = tryFixJson(cand);
    if (fixed) return fixed;
  }

  throw new Error('No valid JSON found in response');
}

function tryFixJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const attempts: string[] = [];
  attempts.push(trimmed);
  attempts.push(trimmed.replace(/,\s*([}\]])/g, '$1'));
  attempts.push(balanceJsonBrackets(trimmed));

  for (const a of attempts) {
    try { JSON.parse(a); return a; } catch {}
  }
  return null;
}

function balanceJsonBrackets(s: string): string {
  let inString = false;
  let escaping = false;
  let openBraces = 0;
  let openBrackets = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') openBraces++;
    else if (ch === '}') openBraces = Math.max(0, openBraces - 1);
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
  }

  let result = s;
  if (inString) result += '"';
  if (openBrackets > 0) result += ']'.repeat(openBrackets);
  if (openBraces > 0) result += '}'.repeat(openBraces);
  return result;
}