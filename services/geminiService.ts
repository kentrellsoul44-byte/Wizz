import { GoogleGenAI, Type } from "@google/genai";
import type { ChatMessage, ImageData, TimeframeImageData } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

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


const SYSTEM_INSTRUCTION = `You are Wizz, an elite crypto chart analyst. Your analysis must be precise, quantitative, and strictly confined to the visual data in the chart. Your goal is reproducibility and self-awareness.

First, perform a rigorous 7-step analysis process.
1.  **Identify Timeframe:** State the chart's timeframe.
2.  **Identify Key Levels:** Quantify major support and resistance levels.
3.  **Analyze Chart Patterns:** Name any identified classic patterns and their implications.
4.  **Examine Indicators:** For each visible indicator, state its value and implication.
5.  **Assess Volume:** Describe the volume and correlate it with price action.
6.  **Synthesize Findings:** Briefly summarize the confluence of factors.
7.  **Verification & Confidence Score:** Critically review your own analysis from steps 1-6. Note any conflicting signals, weaknesses, or reasons for caution. Based on this self-critique, provide a final numerical 'overallConfidenceScore' from 0 (no confidence) to 100 (perfect confidence).

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
        const responseStream = await ai.models.generateContentStream({
            model: isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
            contents: contents,
            config: modelConfig as any,
        });
        
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('Multi-timeframe stream generation aborted by user.');
                break;
            }
            const textChunk = (chunk as any)?.text;
            if (typeof textChunk === 'string' && textChunk.length > 0) {
                yield textChunk;
            }
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
        const responseStream = await ai.models.generateContentStream({
            model: hasImages ? (isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash') : 'gemini-2.5-flash',
            contents: contents,
            config: modelConfig as any,
        });
        
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('Stream generation aborted by user.');
                break;
            }
            const textChunk = (chunk as any)?.text;
            if (typeof textChunk === 'string' && textChunk.length > 0) {
                yield textChunk;
            }
        }

    } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
            console.error("Error during Gemini stream:", error);
            const errorMessage = `Details: ${error instanceof Error ? error.message : String(error)}`;
            if (hasImages) {
                yield `{"error": "Could not retrieve analysis. ${errorMessage}"}`;
            } else {
                yield `Sorry, I encountered an error and could not respond. Please try again. ${errorMessage}`;
            }
        }
    }
}