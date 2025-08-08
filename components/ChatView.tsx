import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ImageData, AnalysisResult, MessageContent } from '../types';
import { ChatInput } from './ChatInput';
import { Message } from './Message';
import { analyzeChartStream } from '../services/geminiService';
import { useSession } from '../contexts/SessionContext';
import { EmptyChat } from './EmptyChat';
import { buildCacheKey } from '../services/determinismService';
import { getCache, setCache } from '../services/cacheService';
import { LiveChart } from './LiveChart';
import { LiveChartControls } from './LiveChartControls';
import type { Interval } from '../services/marketDataService';

interface ChatViewProps {
    defaultUltraMode: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ defaultUltraMode }) => {
  const { activeSession, updateSession, updateSessionTitle } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<{key: number, text: string}>({key: 0, text: ''});
  const [isUltraMode, setIsUltraMode] = useState(defaultUltraMode);
  const [isLiveChartActive, setIsLiveChartActive] = useState(false);
  const [liveSymbol, setLiveSymbol] = useState('BTCUSDT');
  const [liveInterval, setLiveInterval] = useState<Interval>('1m');
  const [isLivePaused, setIsLivePaused] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [activeSession?.messages]);

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
    const promptVersion = 'p1';
    const modelVersion = 'gemini-2.5-flash';
    const cacheKey = imageHashes.length > 0 ? buildCacheKey({ imageHashes, promptVersion, modelVersion, ultra: isUltraMode }) : '';

    // If analyzing images and cache exists, short-circuit
    if (imageHashes.length > 0) {
      const cached = getCache(cacheKey);
      if (cached) {
        const assistantMessageId = `msg_${Date.now() + 1}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: JSON.parse(cached.raw) as AnalysisResult,
          thinkingText: (JSON.parse(cached.raw) as AnalysisResult).thinkingProcess,
          rawResponse: cached.raw,
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
                const parsedJson = JSON.parse(fullResponseText);
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    finalContent = parsedJson as AnalysisResult;
                    thinkingText = (finalContent as AnalysisResult).thinkingProcess;
                    // cache exact duplicate image hashes
                    if (imageHashes.length > 0) {
                      setCache(cacheKey, {
                        signal: (finalContent as AnalysisResult).signal,
                        confidence: ((finalContent as AnalysisResult).overallConfidenceScore ?? 50) / 100,
                        raw: fullResponseText,
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
  }, [activeSession, updateSession, updateSessionTitle, isUltraMode]);

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
    const promptVersion = 'p1';
    const modelVersion = 'gemini-2.5-flash';
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
        const stream = analyzeChartStream(historyForStream, prompt, images, abortControllerRef.current.signal, isUltraMode);
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
                const parsedJson = JSON.parse(fullResponseText);
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    finalContent = parsedJson as AnalysisResult;
                    thinkingText = (finalContent as AnalysisResult).thinkingProcess;
                    if (imageHashes && imageHashes.length > 0) {
                      setCache(cacheKey, {
                        signal: (finalContent as AnalysisResult).signal,
                        confidence: ((finalContent as AnalysisResult).overallConfidenceScore ?? 50) / 100,
                        raw: fullResponseText,
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
  }, [activeSession, updateSession, isLoading, isUltraMode]);


  if (!activeSession) return null; // Should be handled by parent, but good practice

  return (
    <div className="flex flex-1 flex-col bg-chat-bg overflow-hidden">
      {isLiveChartActive ? (
        <>
          <div className="flex-1 overflow-hidden p-6">
            <div className="w-full h-full rounded-lg border border-border-color">
              <LiveChart symbol={liveSymbol} interval={liveInterval} isPaused={isLivePaused} />
            </div>
          </div>
          <div className="px-6 pb-4 bg-chat-bg">
            <LiveChartControls
              symbol={liveSymbol}
              onSymbolChange={setLiveSymbol}
              interval={liveInterval}
              onIntervalChange={setLiveInterval}
              isPaused={isLivePaused}
              onTogglePaused={() => setIsLivePaused((p) => !p)}
              onCloseLiveChart={() => setIsLiveChartActive(false)}
            />
          </div>
        </>
      ) : (
        <>
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
                isLoading={isLoading} 
                onStopGeneration={handleStopGeneration}
                initialPrompt={initialPrompt.text}
                isUltraMode={isUltraMode}
                onToggleUltraMode={() => setIsUltraMode(prev => !prev)}
                isLiveChart={isLiveChartActive}
                onToggleLiveChart={() => setIsLiveChartActive((p) => !p)}
            />
          </div>
        </>
      )}
    </div>
  );
}