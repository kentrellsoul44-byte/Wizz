import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ImageData, AnalysisResult, MessageContent, TimeframeImageData, MarketRegimeContext } from '../types';
import { ChatInput } from './ChatInput';
import { Message } from './Message';
import { MarketRegimeDisplay } from './MarketRegimeDisplay';
import { analyzeChartStream, analyzeMultiTimeframeStream } from '../services/geminiService';
import { useSession } from '../contexts/SessionContext';
import { EmptyChat } from './EmptyChat';
import { buildCacheKey } from '../services/determinismService';
import { getCache, setCache } from '../services/cacheService';
import { intelligentCache } from '../services/intelligentCacheService';
import { applyPostProcessingGates } from '../services/postProcessingService';
import { MarketRegimeDetectionService } from '../services/marketRegimeDetectionService';

function sanitizeJsonResponse(text: string): string {
  const input = (text ?? '').trim();
  if (!input) throw new Error('Empty response');

  // Strip code fences if present
  const fenced = input.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  const body = (fenced ? fenced[1] : input).trim();

  // Prefer the last complete top-level JSON object in the stream
  const candidates: string[] = [];
  const lastBlock = extractLastTopLevelJson(body);
  if (lastBlock) {
    candidates.push(lastBlock);
  } else {
    // Fallback to naive slicing if we cannot structurally find a top-level block
    const lastClose = body.lastIndexOf('}');
    const firstOpen = body.indexOf('{');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      candidates.push(body.slice(firstOpen, lastClose + 1));
    } else if (firstOpen !== -1) {
      candidates.push(body.slice(firstOpen));
    } else {
      candidates.push(body);
    }
  }

  // Try to fix and validate each candidate
  for (const cand of candidates) {
    const fixed = tryFixJson(cand);
    if (fixed) return fixed;
  }

  throw new Error('No valid JSON found in response');
}

function extractLastTopLevelJson(s: string): string | null {
  let inString = false;
  let escaping = false;
  let depth = 0;
  let lastStart = -1;
  let lastEnd = -1;

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

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) lastStart = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && lastStart !== -1) {
        lastEnd = i;
      }
    }
  }

  if (lastStart !== -1 && lastEnd !== -1 && lastEnd > lastStart) {
    return s.slice(lastStart, lastEnd + 1);
  }
  return null;
}

function tryFixJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const attempts: string[] = [];
  // 1) Direct
  attempts.push(trimmed);
  // 2) Remove trailing commas before } or ]
  attempts.push(trimmed.replace(/,\s*([}\]])/g, '$1'));
  // 3) Balance braces/brackets ignoring content inside strings
  attempts.push(balanceJsonBrackets(trimmed));

  for (const attempt of attempts) {
    try {
      JSON.parse(attempt);
      return attempt;
    } catch (e) {
      // Continue to next attempt
    }
  }

  return null;
}

function balanceJsonBrackets(s: string): string {
  let inString = false;
  let escaping = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let result = '';
  
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
      result += ch;
      continue;
    }
    
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
    } else if (ch === '[') {
      bracketDepth++;
    } else if (ch === ']') {
      bracketDepth--;
    }
    
    result += ch;
  }
  
  // Add missing closing braces and brackets
  while (braceDepth > 0) {
    result += '}';
    braceDepth--;
  }
  while (bracketDepth > 0) {
    result += ']';
    bracketDepth--;
  }
  
  return result;
}

export const ChatView: React.FC = () => {
  const { activeSession, updateSession, updateSessionTitle } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isUltraMode, setIsUltraMode] = useState(false);
  const [marketRegimeContext, setMarketRegimeContext] = useState<MarketRegimeContext | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<{ key: number, text: string }>({ key: 0, text: '' });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Market regime detection service
  const marketRegimeService = useRef(new MarketRegimeDetectionService());

  const updateMarketRegime = useCallback((prompt: string, includesImage: boolean) => {
    if (includesImage) {
      const newContext = marketRegimeService.current.updateContext ? marketRegimeService.current.updateContext({
        lastAnalysisTime: new Date(),
        recentPrompts: marketRegimeContext?.recentPrompts 
          ? [...marketRegimeContext.recentPrompts.slice(-9), prompt]
          : [prompt],
        sessionAnalysisCount: (marketRegimeContext?.sessionAnalysisCount ?? 0) + 1,
      }) : (marketRegimeContext as any);
      if (newContext) setMarketRegimeContext(newContext);
    }
  }, [marketRegimeContext]);

  const handleRegenerateResponse = useCallback((messageIndex: number) => {
    if (!activeSession || messageIndex <= 0) return;
    
    const messages = activeSession.messages;
    const userMessage = messages[messageIndex - 1];
    
    if (userMessage.role !== 'user') return;
    
    // Extract images and prompts from the user message
    const prompt = userMessage.content;
    const images = userMessage.images || [];
    
    // Convert base64 images back to ImageData format if they exist
    const imageData: ImageData[] = images.map((base64Image, index) => ({
      mimeType: base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
      data: base64Image.split(',')[1] || base64Image,
      hash: userMessage.imageHashes?.[index] || `regen_${Date.now()}_${index}`
    }));
    
    // Remove the assistant message that we're regenerating
    const messagesWithoutResponse = messages.slice(0, messageIndex);
    updateSession(activeSession.id, { messages: messagesWithoutResponse });
    
    // Use Ultra mode when enabled for image analysis, otherwise standard
    if (isUltraMode && imageData.length > 0) {
      handleSendMessage(prompt, imageData);
    } else {
      handleSendMessage(prompt, imageData);
    }
  }, [activeSession, updateSession, isUltraMode]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const setPromptInChatInput = useCallback((prompt: string) => {
    setInitialPrompt({ key: Date.now(), text: prompt });
  }, []);

  const handleSendMessage = useCallback(async (prompt: string, images: ImageData[]) => {
    if (!activeSession || (!prompt && (!images || images.length === 0))) return;
    
    const imageHashes = (images || []).map(i => i.hash!).filter(Boolean);
    const promptVersion = isUltraMode ? 'ultra_p1' : 'standard_p1';
    const modelVersion = isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache first
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
        const stream = analyzeChartStream(activeSession.messages, prompt, images, abortControllerRef.current.signal, isUltraMode);
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
            updatedMessages[finalAssistantMsgIndex].content = "Analysis stopped by user.";
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
                    
                    // Update market regime after successful analysis
                    updateMarketRegime(prompt, true);
                    
                    // Cache analysis with intelligent cache
                    if (imageHashes.length > 0) {
                      intelligentCache.cacheAnalysis(imageHashes, promptVersion, modelVersion, isUltraMode, isUltraMode ? 'ULTRA' : 'STANDARD', gated);
                      
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
                console.error('Failed to parse JSON response:', error);
                finalContent = `Unable to parse the analysis response. Raw response: ${fullResponseText.substring(0, 500)}...`;
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
            const title = finalContent.summary?.substring(0, 50) + (finalContent.summary && finalContent.summary.length > 50 ? '...' : '') || 'Analysis';
            updateSessionTitle(activeSession.id, title);
        } else if (finalSessionState.messages.length === 2) {
            updateSessionTitle(activeSession.id, 'Chat');
        }
        
    } catch (error) {
        console.error('Error in analysis:', error);
        const finalSessionState = useSession.getState().sessions.find(s => s.id === activeSession.id);
        if (finalSessionState) {
            const finalAssistantMsgIndex = finalSessionState.messages.findIndex(m => m.id === assistantMessageId);
            if (finalAssistantMsgIndex !== -1) {
                const updatedMessages = [...finalSessionState.messages];
                updatedMessages[finalAssistantMsgIndex].content = `Sorry, I encountered an error during analysis. Please try again.`;
                updateSession(activeSession.id, { messages: updatedMessages });
            }
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode]);

  const handleSendMultiTimeframeMessage = useCallback(async (prompt: string, timeframeImages: TimeframeImageData[]) => {
    if (!activeSession || (!prompt && (!timeframeImages || timeframeImages.length === 0))) return;
    
    // Generate cache key based on all timeframe images
    const allImageHashes = timeframeImages.flatMap(tf => tf.imageData.hash).filter(Boolean);
    const promptVersion = 'multi_tf_p1';
    const modelVersion = isUltraMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const cacheKey = allImageHashes.length > 0 ? buildCacheKey({ imageHashes: allImageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // Check intelligent cache for multi-timeframe analysis
    if (allImageHashes.length > 0) {
      const cachedResult = intelligentCache.getCachedAnalysis(allImageHashes, promptVersion, modelVersion, isUltraMode);
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
          timeframeImages: timeframeImages.map(tf => `${tf.timeframe}: data:${tf.imageData.mimeType};base64,${tf.imageData.data}`),
          imageHashes: allImageHashes,
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
      timeframeImages: timeframeImages.map(tf => `${tf.timeframe}: data:${tf.imageData.mimeType};base64,${tf.imageData.data}`),
      imageHashes: allImageHashes,
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
        const stream = analyzeMultiTimeframeStream(activeSession.messages, prompt, timeframeImages, abortControllerRef.current.signal, isUltraMode);
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

        try {
            const parsedJson = JSON.parse(sanitizeJsonResponse(fullResponseText));
            if (parsedJson.error) {
                finalContent = `Error: ${parsedJson.error}`;
            } else {
                const gated = applyPostProcessingGates(parsedJson as AnalysisResult, isUltraMode);
                finalContent = gated as AnalysisResult;
                thinkingText = gated.thinkingProcess;
                
                // Update market regime after successful multi-timeframe analysis
                updateMarketRegime(prompt, true);
                
                // Cache multi-timeframe analysis with intelligent cache
                if (allImageHashes.length > 0) {
                  intelligentCache.cacheAnalysis(allImageHashes, promptVersion, modelVersion, isUltraMode, 'MULTI_TIMEFRAME', gated);
                  
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
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode]);

  // Handle escape key to clear loading state
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isLoading) {
        handleStopGeneration();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isLoading, handleStopGeneration]);

  if (!activeSession) {
    return <EmptyChat onPromptSelect={setPromptInChatInput} />;
  }

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-chat-bg">
          {activeSession.messages.length === 0 ? (
            <EmptyChat onPromptSelect={setPromptInChatInput} />
          ) : (
            activeSession.messages.map((message, index) => (
              <Message 
                key={message.id || index} 
                message={message} 
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
              isLoading={isLoading} 
              onStopGeneration={handleStopGeneration}
              initialPrompt={initialPrompt.text}
              isUltraMode={isUltraMode}
              onToggleUltraMode={() => setIsUltraMode(prev => !prev)}
          />
        </div>
      </div>

      {/* Market Regime Sidebar */}
      {marketRegimeContext && (
        <MarketRegimeDisplay regimeContext={marketRegimeContext} />
      )}
    </div>
  );
};