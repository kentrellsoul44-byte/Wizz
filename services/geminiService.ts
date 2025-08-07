import { GoogleGenAI, Type } from "@google/genai";
import type { ChatMessage, ImageData } from "../types";

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
            description: "The confidence level of the signal. HIGH if overallConfidenceScore >= 70, otherwise LOW."
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


const SYSTEM_INSTRUCTION = `You are Wizz, an elite crypto chart analyst. Your analysis must be precise, quantitative, and strictly confined to the visual data in the chart. Your goal is reproducibility and self-awareness.

First, perform a rigorous 7-step analysis process.
1.  **Identify Timeframe:** State the chart's timeframe.
2.  **Identify Key Levels:** Quantify major support and resistance levels.
3.  **Analyze Chart Patterns:** Name any identified classic patterns and their implications.
4.  **Examine Indicators:** For each visible indicator, state its value and implication.
5.  **Assess Volume:** Describe the volume and correlate it with price action.
6.  **Synthesize Findings:** Briefly summarize the confluence of factors.
7.  **Verification & Confidence Score:** Critically review your own analysis from steps 1-6. Note any conflicting signals, weaknesses, or reasons for caution. Based on this self-critique, provide a final numerical 'overallConfidenceScore' from 0 (no confidence) to 100 (perfect confidence).

After your internal analysis, you MUST provide your entire response as a single, valid, minified JSON object conforming to the provided schema.

- The complete 7-step analysis MUST be placed in the 'thinkingProcess' field as a single Markdown string.
- The self-critique MUST be placed in 'verificationSummary'.
- The final score MUST be placed in 'overallConfidenceScore'.
- The 'confidence' field must be 'HIGH' if 'overallConfidenceScore' is 70 or greater, otherwise it must be 'LOW'.
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

**PASS 2: Cross-Examination & Self-Correction (The Gauntlet)**
-  **Bearish Thesis:** Force yourself to construct the strongest possible argument AGAINST your initial bullish/neutral findings. What could go wrong? Where is the analysis weakest? Identify conflicting signals between indicators, patterns, and market structure.
-  **Bullish Thesis:** Force yourself to construct the strongest possible argument AGAINST your initial bearish/neutral findings. What is the counter-argument? What bullish signals might you be downplaying?
-  **Re-evaluation:** Based on these counter-arguments, critically re-evaluate your findings from Pass 1. Refine your key levels and zones. Does the primary thesis still hold up under this scrutiny?

**PASS 3: Synthesis & Final Verdict (The Execution Plan)**
1.  **Synthesized Narrative:** Combine the findings from all passes into a coherent, final analysis narrative. This is your definitive read of the market.
2.  **Final Confidence Score:** Based on the degree of confluence and the severity of conflicting data found in Pass 2, provide a final 'overallConfidenceScore' from 0 to 100. Be brutally honest.
3.  **Final Signal Generation:** Based on the score, generate the final 'signal' ('BUY', 'SELL', 'NEUTRAL') and 'confidence' ('HIGH' for score >= 70, 'LOW' otherwise).
4.  **Trade Parameters (High Confidence ONLY):** If confidence is 'HIGH', provide a precise 'trade' plan with 'entryPrice', 'takeProfit', and 'stopLoss'. The entry should be a specific level, not a wide range. The stop loss must be placed logically based on market structure (e.g., below a swing low or invalidation point).
5.  **Risk/Reward Calculation:** If a trade is provided, calculate and include the 'riskRewardRatio'.

After this entire internal process, you MUST provide your response as a single, valid, minified JSON object conforming to the provided schema.

- The 'thinkingProcess' field must contain the complete, detailed output of all three passes, formatted in Markdown.
- The 'verificationSummary' will contain a concise summary of the key findings from Pass 2 (the cross-examination).
- Adhere strictly to all schema requirements regarding null fields and data types. Your entire output must be only the JSON object.`;

const CONVERSATIONAL_SYSTEM_INSTRUCTION = `You are Wizz, an expert AI assistant specializing in cryptocurrency and technical analysis. Engage in a helpful and informative conversation with the user. If they ask about analysis but don't provide a chart, ask them to upload one. Maintain a professional and knowledgeable tone. Your answers should be formatted in Markdown.`;

const CONVERSATIONAL_SYSTEM_INSTRUCTION_ULTRA = `You are Wizz Ultra, a world-class quantitative crypto analyst AI. Your knowledge is vast and precise. When a user asks a question without a chart, answer it with institutional-grade insight and clarity. If they ask for analysis, politely guide them to upload a chart to unlock your full capabilities. Be direct, insightful, and confident. Your answers should be formatted in Markdown.`;


export async function* analyzeChartStream(history: ChatMessage[], prompt: string, image: ImageData | null, signal: AbortSignal, isUltraMode: boolean): AsyncGenerator<string> {
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
            if (msg.image) {
                const imgParts = msg.image.split(';base64,');
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
    if (image) {
        currentUserParts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data,
            },
        });
    }

    const contents = [
        ...turnBasedHistory,
        { role: 'user', parts: currentUserParts }
    ];

    const modelConfig = image
        ? { // Analysis config for chart images
            systemInstruction: isUltraMode ? ULTRA_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
            temperature: 0,
            seed: 42,
            responseMimeType: 'application/json',
            responseSchema: analysisResultSchema,
        }
        : { // Conversational config for text-only prompts
            systemInstruction: isUltraMode ? CONVERSATIONAL_SYSTEM_INSTRUCTION_ULTRA : CONVERSATIONAL_SYSTEM_INSTRUCTION,
            temperature: 0.7,
        };

    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: modelConfig as any, // Cast as any to handle the two different config shapes
        });
        
        for await (const chunk of responseStream) {
            if (signal.aborted) {
                console.log('Stream generation aborted by user.');
                break;
            }
            yield chunk.text;
        }

    } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.error("Error during Gemini stream:", error);
          const errorMessage = `Details: ${error instanceof Error ? error.message : String(error)}`;
          if (image) {
            yield `{"error": "Could not retrieve analysis. ${errorMessage}"}`;
          } else {
            yield `Sorry, I encountered an error and could not respond. Please try again. ${errorMessage}`;
          }
        }
    }
}