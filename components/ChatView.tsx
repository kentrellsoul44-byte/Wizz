import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ImageData, AnalysisResult, MessageContent, TimeframeImageData, ProgressiveStreamEvent, MarketRegimeContext } from '../types';
import { ChatInput } from './ChatInput';
import { Message } from './Message';
import { MarketRegimeDisplay } from './MarketRegimeDisplay';
import { analyzeChartStream, analyzeMultiTimeframeStream, analyzeSMCStream, analyzeAdvancedPatternsStream } from '../services/geminiService';
import { progressiveAnalysis } from '../services/progressiveAnalysisService';
import { useSession } from '../contexts/SessionContext';
import { EmptyChat } from './EmptyChat';
import { buildCacheKey } from '../services/determinismService';
import { getCache, setCache } from '../services/cacheService';
import { intelligentCache } from '../services/intelligentCacheService';
import { applyPostProcessingGates } from '../services/postProcessingService';
import { MarketRegimeDetectionService } from '../services/marketRegimeDetectionService';

function sanitizeJsonResponse(text: string): string {
  const input = (text ?? '').trim();
  const fenced = input.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  const body = fenced ? fenced[1].trim() : input;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return body.slice(first, last + 1);
  }
  return body;
}

interface ChatViewProps {
    defaultUltraMode: boolean;
    defaultQuickProfitMode: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ defaultUltraMode, defaultQuickProfitMode }) => {
  const { activeSession, updateSession, updateSessionTitle } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<{key: number, text: string}>({key: 0, text: ''});
  const [isUltraMode, setIsUltraMode] = useState(defaultUltraMode);
  const [isQuickProfitMode, setIsQuickProfitMode] = useState(defaultQuickProfitMode);
  const [currentMarketRegime, setCurrentMarketRegime] = useState<MarketRegimeContext | null>(null);
  const [showRegimeDisplay, setShowRegimeDisplay] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const regimeDetectionServiceRef = useRef<MarketRegimeDetectionService>(new MarketRegimeDetectionService());

  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [activeSession?.messages]);

  // Helper function to generate mock market data and update regime
  const updateMarketRegime = useCallback(async (prompt: string, hasImages: boolean) => {
    if (!hasImages) return; // Only update regime for chart analysis
    
    try {
      // Generate mock price data based on the prompt context
      const generateMockData = (prompt: string) => {
        const basePrice = 45000 + Math.random() * 20000; // Random base price between 45k-65k
        const periods = 100;
        const prices: number[] = [];
        const volumes: number[] = [];
        
        // Add bias based on prompt content
        const bullishBias = prompt.toLowerCase().includes('bull') || prompt.toLowerCase().includes('up') ? 0.002 : 0;
        const bearishBias = prompt.toLowerCase().includes('bear') || prompt.toLowerCase().includes('down') ? -0.002 : 0;
        const volatilityMultiplier = prompt.toLowerCase().includes('volatile') || prompt.toLowerCase().includes('extreme') ? 2 : 1;
        
        let currentPrice = basePrice;
        for (let i = 0; i < periods; i++) {
          const volatility = (0.015 * volatilityMultiplier) + (Math.random() * 0.01);
          const trendBias = bullishBias + bearishBias;
          const change = (Math.random() - 0.5) * volatility + trendBias;
          
          currentPrice = currentPrice * (1 + change);
          prices.push(currentPrice);
          
          // Generate volume with some correlation to price movement
          const baseVolume = 1000000;
          const volumeMultiplier = 0.5 + Math.random() * 1.5; // 50%-200% of base
          const moveCorrelation = Math.abs(change) * 5; // Higher volume on bigger moves
          volumes.push(baseVolume * volumeMultiplier * (1 + moveCorrelation));
        }
        
        return { prices, volumes };
      };

      const { prices, volumes } = generateMockData(prompt);
      const regimeContext = await regimeDetectionServiceRef.current.detectMarketRegime(prices, volumes, '1H');
      setCurrentMarketRegime(regimeContext);
    } catch (error) {
      console.warn('Failed to update market regime:', error);
    }
  }, []);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);
  
  const handleExamplePrompt = useCallback((prompt: string) => {
    setInitialPrompt({ key: Date.now(), text: prompt });
  }, []);

  const handleSendMessage = useCallback(async (prompt: string, images: ImageData[]) => {
    if (!activeSession || (!prompt && (!images || images.length === 0))) return;
    
    const imageHashes = (images || []).map(i => i.hash!).filter(Boolean);
    const promptVersion = 'p2';
    const modelVersion = isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache for analysis result
    if (imageHashes.length > 0) {
      const cachedResult = intelligentCache.getCachedAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode);
      if (cachedResult) {
        const assistantMessageId = `msg_${Date.now() + 1}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: cachedResult,
          thinkingText: cachedResult.thinkingProcess,
          rawResponse: JSON.stringify(cachedResult),
        };
        const messagesWithUser: ChatMessage[] = [...activeSession.messages, {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: prompt,
          ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
          ...(imageHashes.length > 0 && { imageHashes }),
        }];
        updateSession(activeSession.id, { messages: [...messagesWithUser, assistantMessage] });
        return;
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
      ...(imageHashes.length > 0 && { imageHashes }),
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    
    const messagesWithUser = [...activeSession.messages, userMessage];
    updateSession(activeSession.id, { messages: messagesWithUser });
    
    const messagesWithAssistant = [...messagesWithUser, assistantMessage];
    updateSession(activeSession.id, { messages: messagesWithAssistant });


    let fullResponseText = '';
    try {
        const stream = analyzeChartStream(activeSession.messages, prompt, images, abortControllerRef.current.signal, isUltraMode, isQuickProfitMode);
        for await (const chunk of stream) {
            if (abortControllerRef.current?.signal.aborted) break;
            fullResponseText += chunk;
        }

        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;

        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (finalAssistantMsgIndex === -1) return; // Should not happen

        const updatedMessages = [...finalSessionState.messages];

        if (abortControllerRef.current?.signal.aborted) {
            updatedMessages[finalAssistantMsgIndex].content = "Response stopped by user.";
            updateSession(activeSession.id, { messages: updatedMessages });
            return;
        }
        
        let finalContent: MessageContent;
        let thinkingText = '';

        if (images && images.length > 0) { // We were analyzing images, expect JSON
            try {
                const parsedJson = JSON.parse(sanitizeJsonResponse(fullResponseText));
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    const gated = applyPostProcessingGates(parsedJson as AnalysisResult, isUltraMode);
                    finalContent = gated as AnalysisResult;
                    thinkingText = gated.thinkingProcess;
                    
                    // Update market regime after successful analysis
                    updateMarketRegime(prompt, true);
                    
                    // Cache with intelligent cache system
                    if (imageHashes.length > 0) {
                      intelligentCache.cacheAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode, 'STANDARD', gated);
                      
                      // Also update legacy cache for backward compatibility
                      setCache(cacheKey, {
                        signal: gated.signal,
                        confidence: ((gated.overallConfidenceScore ?? 50) / 100),
                        raw: JSON.stringify(gated),
                        modelVersion,
                        promptVersion,
                        imageHashes,
                        ultra: isUltraMode,
                        timestamp: Date.now(),
                      });
                    }
                }
            } catch (e) {
                console.error("Failed to parse JSON response:", e, "Raw response:", fullResponseText);
                finalContent = `Error: The analysis result was not in the correct format. Please try again.`;
                if (fullResponseText) {
                     finalContent += `\n\nRaw output:\n${fullResponseText}`;
                }
            }
        } else { // This was a conversational message, expect markdown text
            finalContent = fullResponseText;
        }

        updatedMessages[finalAssistantMsgIndex].content = finalContent;
        updatedMessages[finalAssistantMsgIndex].thinkingText = thinkingText;
        updatedMessages[finalAssistantMsgIndex].rawResponse = fullResponseText;

        if (activeSession.title === 'New Analysis') {
            const newTitle = (typeof finalContent === 'object' && 'summary' in finalContent)
                ? (finalContent as AnalysisResult).summary.substring(0, 40) + '...'
                : prompt.substring(0, 40) + '...';
            updateSessionTitle(activeSession.id, newTitle);
        }
        
        updateSession(activeSession.id, { messages: updatedMessages });

    } catch (error) {
        console.error('Error during analysis stream:', error);
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if(!finalSessionState) return;
        const errorMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (errorMsgIndex !== -1) {
            const updatedMessages = [...finalSessionState.messages];
            updatedMessages[errorMsgIndex].content = 'An unexpected error occurred. Please try again.';
            updateSession(activeSession.id, { messages: updatedMessages });
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode, isQuickProfitMode]);

  const handleSendMultiTimeframeMessage = useCallback(async (prompt: string, timeframeImages: TimeframeImageData[]) => {
    if (!activeSession || (!prompt && (!timeframeImages || timeframeImages.length === 0))) return;
    
    // Generate cache key based on all timeframe images
    const imageHashes = timeframeImages.map(tf => tf.imageData.hash!).filter(Boolean);
    const promptVersion = 'mtf_p1'; // Multi-timeframe prompt version
    const modelVersion = isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache for multi-timeframe analysis
    if (imageHashes.length > 0) {
      const cachedResult = intelligentCache.getCachedAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode);
      if (cachedResult) {
        const assistantMessageId = `msg_${Date.now() + 1}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: cachedResult,
          thinkingText: cachedResult.thinkingProcess,
          rawResponse: JSON.stringify(cachedResult),
        };
        const messagesWithUser: ChatMessage[] = [...activeSession.messages, {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: prompt,
          timeframeImages,
          imageHashes,
        }];
        updateSession(activeSession.id, { messages: [...messagesWithUser, assistantMessage] });
        return;
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      timeframeImages,
      ...(imageHashes.length > 0 && { imageHashes }),
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    
    const messagesWithUser = [...activeSession.messages, userMessage];
    updateSession(activeSession.id, { messages: messagesWithUser });
    
    const messagesWithAssistant = [...messagesWithUser, assistantMessage];
    updateSession(activeSession.id, { messages: messagesWithAssistant });

    let fullResponseText = '';
    try {
        const stream = analyzeMultiTimeframeStream(activeSession.messages, prompt, timeframeImages, abortControllerRef.current.signal, isUltraMode, isQuickProfitMode);
        for await (const chunk of stream) {
            if (abortControllerRef.current?.signal.aborted) break;
            fullResponseText += chunk;
        }

        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;

        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (finalAssistantMsgIndex === -1) return;

        const updatedMessages = [...finalSessionState.messages];

        if (abortControllerRef.current?.signal.aborted) {
            updatedMessages[finalAssistantMsgIndex].content = "Multi-timeframe analysis stopped by user.";
            updateSession(activeSession.id, { messages: updatedMessages });
            return;
        }
        
        let finalContent: MessageContent;
        let thinkingText = '';

        if (timeframeImages && timeframeImages.length > 0) {
            try {
                const parsedJson = JSON.parse(sanitizeJsonResponse(fullResponseText));
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    const gated = applyPostProcessingGates(parsedJson as AnalysisResult, isUltraMode);
                    finalContent = gated as AnalysisResult;
                    thinkingText = gated.thinkingProcess;
                    
                    // Cache multi-timeframe analysis with intelligent cache
                    if (imageHashes.length > 0) {
                      intelligentCache.cacheAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode, 'MULTI_TIMEFRAME', gated);
                      
                      // Also update legacy cache for backward compatibility
                      setCache(cacheKey, {
                        signal: gated.signal,
                        confidence: ((gated.overallConfidenceScore ?? 50) / 100),
                        raw: JSON.stringify(gated),
                        modelVersion,
                        promptVersion,
                        ultra: isUltraMode,
                      });
                    }
                }
            } catch (error) {
                console.error('Failed to parse multi-timeframe JSON response:', error);
                finalContent = `Unable to parse the multi-timeframe analysis response. Raw response: ${fullResponseText.substring(0, 500)}...`;
            }
        } else {
            finalContent = fullResponseText; // Conversational response
        }

        updatedMessages[finalAssistantMsgIndex] = {
            ...updatedMessages[finalAssistantMsgIndex],
            content: finalContent,
            ...(thinkingText && { thinkingText }),
            rawResponse: fullResponseText,
        };

        updateSession(activeSession.id, { messages: updatedMessages });

        // Generate title for first message
        if (finalSessionState.messages.length === 2 && typeof finalContent === 'object' && 'summary' in finalContent) {
            const title = finalContent.summary?.substring(0, 50) + (finalContent.summary && finalContent.summary.length > 50 ? '...' : '') || 'Multi-Timeframe Analysis';
            updateSessionTitle(activeSession.id, title);
        } else if (finalSessionState.messages.length === 2) {
            updateSessionTitle(activeSession.id, 'Multi-Timeframe Chat');
        }
        
    } catch (error) {
        console.error('Error in multi-timeframe analysis:', error);
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (finalSessionState) {
            const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
            if (finalAssistantMsgIndex !== -1) {
                const updatedMessages = [...finalSessionState.messages];
                updatedMessages[finalAssistantMsgIndex].content = `Sorry, I encountered an error during multi-timeframe analysis. Please try again.`;
                updateSession(activeSession.id, { messages: updatedMessages });
            }
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode, isQuickProfitMode]);

  const handleSendSMCMessage = useCallback(async (prompt: string, images: ImageData[]) => {
    if (!activeSession || (!prompt && (!images || images.length === 0))) return;
    
    const imageHashes = (images || []).map(i => i.hash!).filter(Boolean);
    const promptVersion = 'smc_p1'; // SMC prompt version
    const modelVersion = 'gemini-2.5-pro'; // Always use Pro for SMC
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache for SMC analysis
    if (imageHashes.length > 0) {
      const cachedResult = intelligentCache.getCachedAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode);
      if (cachedResult) {
        const assistantMessageId = `msg_${Date.now() + 1}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: cachedResult,
          thinkingText: cachedResult.thinkingProcess,
          rawResponse: JSON.stringify(cachedResult),
        };
        const messagesWithUser: ChatMessage[] = [...activeSession.messages, {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: prompt,
          ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
          ...(imageHashes.length > 0 && { imageHashes }),
        }];
        updateSession(activeSession.id, { messages: [...messagesWithUser, assistantMessage] });
        return;
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
      ...(imageHashes.length > 0 && { imageHashes }),
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    
    const messagesWithUser = [...activeSession.messages, userMessage];
    updateSession(activeSession.id, { messages: messagesWithUser });
    
    const messagesWithAssistant = [...messagesWithUser, assistantMessage];
    updateSession(activeSession.id, { messages: messagesWithAssistant });

    let fullResponseText = '';
    try {
        const stream = analyzeSMCStream(activeSession.messages, prompt, images, abortControllerRef.current.signal, isUltraMode, isQuickProfitMode);
        for await (const chunk of stream) {
            if (abortControllerRef.current?.signal.aborted) break;
            fullResponseText += chunk;
        }

        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;

        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (finalAssistantMsgIndex === -1) return;

        const updatedMessages = [...finalSessionState.messages];

        if (abortControllerRef.current?.signal.aborted) {
            updatedMessages[finalAssistantMsgIndex].content = "SMC analysis stopped by user.";
            updateSession(activeSession.id, { messages: updatedMessages });
            return;
        }
        
        let finalContent: MessageContent;
        let thinkingText = '';

        if (images && images.length > 0) {
            try {
                const parsedJson = JSON.parse(sanitizeJsonResponse(fullResponseText));
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    const gated = applyPostProcessingGates(parsedJson as AnalysisResult, isUltraMode);
                    finalContent = gated as AnalysisResult;
                    thinkingText = gated.thinkingProcess;
                    
                    // Update market regime after successful SMC analysis
                    updateMarketRegime(prompt, true);
                    
                    // Cache SMC analysis with intelligent cache
                    if (imageHashes.length > 0) {
                      intelligentCache.cacheAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode, 'SMC', gated);
                      
                      // Also update legacy cache for backward compatibility
                      setCache(cacheKey, {
                        signal: gated.signal,
                        confidence: ((gated.overallConfidenceScore ?? 50) / 100),
                        raw: JSON.stringify(gated),
                        modelVersion,
                        promptVersion,
                        ultra: isUltraMode,
                      });
                    }
                }
            } catch (error) {
                console.error('Failed to parse SMC JSON response:', error);
                finalContent = `Unable to parse the SMC analysis response. Raw response: ${fullResponseText.substring(0, 500)}...`;
            }
        } else {
            finalContent = fullResponseText; // Conversational response
        }

        updatedMessages[finalAssistantMsgIndex] = {
            ...updatedMessages[finalAssistantMsgIndex],
            content: finalContent,
            ...(thinkingText && { thinkingText }),
            rawResponse: fullResponseText,
        };

        updateSession(activeSession.id, { messages: updatedMessages });

        // Generate title for first message
        if (finalSessionState.messages.length === 2 && typeof finalContent === 'object' && 'summary' in finalContent) {
            const title = finalContent.summary?.substring(0, 50) + (finalContent.summary && finalContent.summary.length > 50 ? '...' : '') || 'SMC Analysis';
            updateSessionTitle(activeSession.id, title);
        } else if (finalSessionState.messages.length === 2) {
            updateSessionTitle(activeSession.id, 'SMC Chat');
        }
        
    } catch (error) {
        console.error('Error in SMC analysis:', error);
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (finalSessionState) {
            const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
            if (finalAssistantMsgIndex !== -1) {
                const updatedMessages = [...finalSessionState.messages];
                updatedMessages[finalAssistantMsgIndex].content = `Sorry, I encountered an error during SMC analysis. Please try again.`;
                updateSession(activeSession.id, { messages: updatedMessages });
            }
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
     }, [activeSession, updateSession, updateSessionTitle, isUltraMode, isQuickProfitMode]);

  const handleSendAdvancedPatternMessage = useCallback(async (prompt: string, images: ImageData[]) => {
    if (!activeSession || (!prompt && (!images || images.length === 0))) return;
    
    const imageHashes = (images || []).map(i => i.hash!).filter(Boolean);
    const promptVersion = 'pattern_p1'; // Pattern prompt version
    const modelVersion = 'gemini-2.5-pro'; // Always use Pro for Advanced Patterns
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache for Pattern analysis
    if (imageHashes.length > 0) {
      const cachedResult = intelligentCache.getCachedAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode);
      if (cachedResult) {
        const assistantMessageId = `msg_${Date.now() + 1}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: cachedResult,
          thinkingText: cachedResult.thinkingProcess,
          rawResponse: JSON.stringify(cachedResult),
        };
        const messagesWithUser: ChatMessage[] = [...activeSession.messages, {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: prompt,
          ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
          ...(imageHashes.length > 0 && { imageHashes }),
        }];
        updateSession(activeSession.id, { messages: [...messagesWithUser, assistantMessage] });
        return;
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
      ...(imageHashes.length > 0 && { imageHashes }),
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    
    const messagesWithUser = [...activeSession.messages, userMessage];
    updateSession(activeSession.id, { messages: messagesWithUser });
    
    const messagesWithAssistant = [...messagesWithUser, assistantMessage];
    updateSession(activeSession.id, { messages: messagesWithAssistant });

    let fullResponseText = '';
    try {
        const stream = analyzeAdvancedPatternsStream(activeSession.messages, prompt, images, abortControllerRef.current.signal, isUltraMode, isQuickProfitMode);
        for await (const chunk of stream) {
            if (abortControllerRef.current?.signal.aborted) break;
            fullResponseText += chunk;
        }

        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;

        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (finalAssistantMsgIndex === -1) return;

        const updatedMessages = [...finalSessionState.messages];

        if (abortControllerRef.current?.signal.aborted) {
            updatedMessages[finalAssistantMsgIndex].content = "Advanced Pattern analysis stopped by user.";
            updateSession(activeSession.id, { messages: updatedMessages });
            return;
        }
        
        let finalContent: MessageContent;
        let thinkingText = '';

        if (images && images.length > 0) {
            try {
                const parsedJson = JSON.parse(sanitizeJsonResponse(fullResponseText));
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    const gated = applyPostProcessingGates(parsedJson as AnalysisResult, isUltraMode);
                    finalContent = gated as AnalysisResult;
                    thinkingText = gated.thinkingProcess;
                    
                    // Cache Pattern analysis with intelligent cache
                    if (imageHashes.length > 0) {
                      intelligentCache.cacheAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode, 'ADVANCED_PATTERN', gated);
                      
                      // Also update legacy cache for backward compatibility
                      setCache(cacheKey, {
                        signal: gated.signal,
                        confidence: ((gated.overallConfidenceScore ?? 50) / 100),
                        raw: JSON.stringify(gated),
                        modelVersion,
                        promptVersion,
                        ultra: isUltraMode,
                      });
                    }
                }
            } catch (error) {
                console.error('Failed to parse Advanced Pattern JSON response:', error);
                finalContent = `Unable to parse the Advanced Pattern analysis response. Raw response: ${fullResponseText.substring(0, 500)}...`;
            }
        } else {
            finalContent = fullResponseText; // Conversational response
        }

        updatedMessages[finalAssistantMsgIndex] = {
            ...updatedMessages[finalAssistantMsgIndex],
            content: finalContent,
            ...(thinkingText && { thinkingText }),
            rawResponse: fullResponseText,
        };

        updateSession(activeSession.id, { messages: updatedMessages });

        // Generate title for first message
        if (finalSessionState.messages.length === 2 && typeof finalContent === 'object' && 'summary' in finalContent) {
            const title = finalContent.summary?.substring(0, 50) + (finalContent.summary && finalContent.summary.length > 50 ? '...' : '') || 'Pattern Analysis';
            updateSessionTitle(activeSession.id, title);
        } else if (finalSessionState.messages.length === 2) {
            updateSessionTitle(activeSession.id, 'Pattern Chat');
        }
        
    } catch (error) {
        console.error('Error in Advanced Pattern analysis:', error);
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (finalSessionState) {
            const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
            if (finalAssistantMsgIndex !== -1) {
                const updatedMessages = [...finalSessionState.messages];
                updatedMessages[finalAssistantMsgIndex].content = `Sorry, I encountered an error during Advanced Pattern analysis. Please try again.`;
                updateSession(activeSession.id, { messages: updatedMessages });
            }
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode, isQuickProfitMode]);

  const handleSendProgressiveMessage = useCallback(async (
    prompt: string, 
    images: ImageData[], 
    analysisType: 'STANDARD' | 'MULTI_TIMEFRAME' | 'SMC' | 'ADVANCED_PATTERN'
  ) => {
    if (!activeSession || (!prompt && (!images || images.length === 0))) return;
    
    const imageHashes = (images || []).map(i => i.hash!).filter(Boolean);
    const promptVersion = 'progressive_p1';
    const modelVersion = isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache for progressive analysis result
    if (imageHashes.length > 0) {
      const cachedResult = intelligentCache.getCachedAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode);
      if (cachedResult) {
        const assistantMessageId = `msg_${Date.now() + 1}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: cachedResult,
          thinkingText: cachedResult.thinkingProcess,
          rawResponse: JSON.stringify(cachedResult),
        };
        const messagesWithUser: ChatMessage[] = [...activeSession.messages, {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: prompt,
          ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
          ...(imageHashes.length > 0 && { imageHashes }),
        }];
        updateSession(activeSession.id, { messages: [...messagesWithUser, assistantMessage] });
        return;
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      ...(images && images.length > 0 && { images: images.map(img => `data:${img.mimeType};base64,${img.data}`) }),
      ...(imageHashes.length > 0 && { imageHashes }),
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      thinkingText: '',
    };

    const updatedMessages = [...activeSession.messages, userMessage, assistantMessage];
    updateSession(activeSession.id, { messages: updatedMessages });

    try {
      // Start progressive analysis
      const progressiveStream = progressiveAnalysis.startProgressiveAnalysis(
        analysisType,
        prompt,
        images,
        null, // timeframeImages - handled by analysisType
        activeSession.messages,
        isUltraMode,
        abortControllerRef.current!.signal
      );

      let finalContent: AnalysisResult | string = '';
      let thinkingText = '';
      let currentPhase = 'INITIALIZING';

      // Process progressive analysis events
      for await (const event of progressiveStream) {
        if (abortControllerRef.current?.signal.aborted) break;

        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) break;

        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (finalAssistantMsgIndex === -1) break;

        const updatedMessages = [...finalSessionState.messages];

        switch (event.type) {
          case 'PHASE_START':
            currentPhase = event.phase;
            thinkingText = `Starting ${event.phase.toLowerCase()} analysis...`;
            break;

          case 'PHASE_COMPLETE':
            if (event.data) {
              finalContent = event.data as AnalysisResult;
              thinkingText = (event.data as AnalysisResult).thinkingProcess || `Completed ${event.phase.toLowerCase()} analysis (${event.confidence}% confidence)`;
            }
            break;

          case 'ANALYSIS_COMPLETE':
            if (event.data) {
              finalContent = event.data as AnalysisResult;
              thinkingText = (event.data as AnalysisResult).thinkingProcess || 'Progressive analysis completed';
            }
            break;

          case 'PHASE_ERROR':
            thinkingText = `Error in ${event.phase.toLowerCase()} phase: ${event.metadata?.errorDetails || 'Unknown error'}`;
            break;
        }

        // Update message with current progress
        updatedMessages[finalAssistantMsgIndex] = {
          ...updatedMessages[finalAssistantMsgIndex],
          content: finalContent,
          thinkingText,
        };

        updateSession(activeSession.id, { messages: updatedMessages });
      }

      // Cache the final progressive analysis result
      if (imageHashes.length > 0 && typeof finalContent === 'object' && 'summary' in finalContent) {
        intelligentCache.cacheAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode, analysisType, finalContent as AnalysisResult);
        
        // Also update legacy cache for backward compatibility
        setCache(cacheKey, {
          signal: (finalContent as AnalysisResult).signal,
          confidence: ((finalContent as AnalysisResult).overallConfidenceScore ?? 50) / 100,
          raw: JSON.stringify(finalContent),
          modelVersion,
          promptVersion,
          ultra: isUltraMode,
        });
      }

      // Get final session state for title generation
      const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
      
      // Generate title for first message
      if (finalSessionState && finalSessionState.messages.length === 2 && typeof finalContent === 'object' && 'summary' in finalContent) {
        const title = finalContent.summary?.substring(0, 50) + (finalContent.summary && finalContent.summary.length > 50 ? '...' : '') || 'Progressive Analysis';
        updateSessionTitle(activeSession.id, title);
      } else if (finalSessionState && finalSessionState.messages.length === 2) {
        updateSessionTitle(activeSession.id, 'Progressive Chat');
      }

    } catch (error) {
      console.error('Error in progressive analysis:', error);
      const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
      if (finalSessionState) {
        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
        if (finalAssistantMsgIndex !== -1) {
          const updatedMessages = [...finalSessionState.messages];
          updatedMessages[finalAssistantMsgIndex].content = `Sorry, I encountered an error during progressive analysis. Please try again.`;
          updateSession(activeSession.id, { messages: updatedMessages });
        }
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode, isQuickProfitMode]);

  const handleRegenerateResponse = useCallback(async () => {
    if (!activeSession || isLoading) return;

    const lastAssistantMessageIndex = activeSession.messages.map(m => m.role).lastIndexOf('assistant');
    if (lastAssistantMessageIndex === -1 || lastAssistantMessageIndex === 0) return;

    const lastUserMessage = activeSession.messages[lastAssistantMessageIndex - 1];
    const assistantMessageToUpdate = activeSession.messages[lastAssistantMessageIndex];

    if (lastUserMessage.role !== 'user') return;

    const historyForStream = activeSession.messages.slice(0, lastAssistantMessageIndex - 1);

    const prompt = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : '';
    let images: ImageData[] = [];

    // Reconstruct images from last user message, supporting legacy single image
    const imageUrls: string[] = [];
    if (Array.isArray((lastUserMessage as any).images) && (lastUserMessage as any).images.length > 0) {
        imageUrls.push(...((lastUserMessage as any).images as string[]));
    } else if ((lastUserMessage as any).image) {
        imageUrls.push((lastUserMessage as any).image as string);
    }

    for (const url of imageUrls) {
        const parts = url.split(';base64,');
        if (parts.length === 2) {
            const mimeType = parts[0].split(':')[1];
            const data = parts[1];
            images.push({ mimeType, data });
        }
    }

    // Cache check using stored hashes if present
    const imageHashes = (lastUserMessage as any).imageHashes as string[] | undefined;
    const promptVersion = 'p2';
    const modelVersion = isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const cacheKey = imageHashes && imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';
    if (cacheKey) {
      const cached = getCache(cacheKey);
      if (cached) {
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;
        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageToUpdate.id);
        if (finalAssistantMsgIndex === -1) return;
        const updatedMessages = [...finalSessionState.messages];
        const parsed = JSON.parse(cached.raw) as AnalysisResult;
        updatedMessages[finalAssistantMsgIndex].content = parsed;
        updatedMessages[finalAssistantMsgIndex].thinkingText = parsed.thinkingProcess;
        updatedMessages[finalAssistantMsgIndex].rawResponse = cached.raw;
        updateSession(activeSession.id, { messages: updatedMessages });
        return;
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const messagesWithClearedAssistant = activeSession.messages.map(m =>
        m.id === assistantMessageToUpdate.id
            ? { ...m, content: '', thinkingText: '', rawResponse: '' }
            : m
    );
    updateSession(activeSession.id, { messages: messagesWithClearedAssistant });

    let fullResponseText = '';
    try {
        const stream = analyzeChartStream(historyForStream, prompt, images, abortControllerRef.current.signal, isUltraMode, isQuickProfitMode);
        for await (const chunk of stream) {
            if (abortControllerRef.current?.signal.aborted) break;
            fullResponseText += chunk;
        }

        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;

        const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageToUpdate.id);
        if (finalAssistantMsgIndex === -1) return;

        const updatedMessages = [...finalSessionState.messages];

        if (abortControllerRef.current?.signal.aborted) {
            updatedMessages[finalAssistantMsgIndex].content = "Response stopped by user.";
            updateSession(activeSession.id, { messages: updatedMessages });
            return;
        }

        let finalContent: MessageContent;
        let thinkingText = '';

        if (images && images.length > 0) { // We were analyzing images, expect JSON
            try {
                const parsedJson = JSON.parse(sanitizeJsonResponse(fullResponseText));
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    const gated = applyPostProcessingGates(parsedJson as AnalysisResult, isUltraMode);
                    finalContent = gated as AnalysisResult;
                    thinkingText = gated.thinkingProcess;
                    if (imageHashes && imageHashes.length > 0) {
                      setCache(cacheKey, {
                        signal: gated.signal,
                        confidence: ((gated.overallConfidenceScore ?? 50) / 100),
                        raw: JSON.stringify(gated),
                        modelVersion,
                        promptVersion,
                        imageHashes,
                        ultra: isUltraMode,
                        timestamp: Date.now(),
                      });
                    }
                }
            } catch (e) {
                console.error("Failed to parse JSON response:", e, "Raw response:", fullResponseText);
                finalContent = `Error: The analysis result was not in the correct format. Please try again.`;
                if (fullResponseText) {
                    finalContent += `\n\nRaw output:\n${fullResponseText}`;
                }
            }
        } else { // This was a conversational message, expect markdown text
            finalContent = fullResponseText;
        }

        updatedMessages[finalAssistantMsgIndex].content = finalContent;
        updatedMessages[finalAssistantMsgIndex].thinkingText = thinkingText;
        updatedMessages[finalAssistantMsgIndex].rawResponse = fullResponseText;

        updateSession(activeSession.id, { messages: updatedMessages });

    } catch (error) {
        console.error('Error during analysis stream:', error);
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (!finalSessionState) return;
        const errorMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageToUpdate.id);
        if (errorMsgIndex !== -1) {
            const updatedMessages = [...finalSessionState.messages];
            updatedMessages[errorMsgIndex].content = 'An unexpected error occurred. Please try again.';
            updateSession(activeSession.id, { messages: updatedMessages });
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
  }, [activeSession, updateSession, isLoading, isUltraMode, isQuickProfitMode]);


  if (!activeSession) return null; // Should be handled by parent, but good practice

  return (
    <div className="flex flex-1 bg-chat-bg overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {activeSession.messages.length === 0 ? (
             <EmptyChat onExampleClick={handleExamplePrompt} />
          ) : (
            activeSession.messages.map((message, index) => (
              <Message 
                key={message.id} 
                message={message}
                isLastMessage={index === activeSession.messages.length - 1}
                isLoading={isLoading && index === activeSession.messages.length - 1 && message.role === 'assistant'}
                onRegenerate={handleRegenerateResponse}
              />
            ))
          )}
        </div>
        <div className="px-6 pb-4 bg-chat-bg">
          <ChatInput 
              key={initialPrompt.key}
              onSendMessage={handleSendMessage}
              onSendMultiTimeframeMessage={handleSendMultiTimeframeMessage}
              onSendSMCMessage={handleSendSMCMessage}
              onSendAdvancedPatternMessage={handleSendAdvancedPatternMessage}
              onSendProgressiveMessage={handleSendProgressiveMessage}
              isLoading={isLoading} 
              onStopGeneration={handleStopGeneration}
              initialPrompt={initialPrompt.text}
              isUltraMode={isUltraMode}
              onToggleUltraMode={() => setIsUltraMode(prev => !prev)}
              isQuickProfitMode={isQuickProfitMode}
              onToggleQuickProfitMode={() => setIsQuickProfitMode(prev => !prev)}
          />
        </div>
      </div>

      {/* Market Regime Sidebar */}
      {showRegimeDisplay && (
        <div className="w-80 border-l border-gray-700 bg-gray-800/30 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Market Analysis</h2>
              <button
                onClick={() => setShowRegimeDisplay(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Hide regime display"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <MarketRegimeDisplay regimeContext={currentMarketRegime} />
          </div>
        </div>
      )}

      {/* Show Regime Button (when hidden) */}
      {!showRegimeDisplay && (
        <button
          onClick={() => setShowRegimeDisplay(true)}
          className="fixed top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow-lg transition-colors z-10"
          aria-label="Show market regime"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
      )}
    </div>
  );
}