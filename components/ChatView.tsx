import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ImageData, AnalysisResult, MessageContent } from '../types';
import { ChatInput } from './ChatInput';
import { Message } from './Message';
import { analyzeChartStream } from '../services/geminiService';
import { useSession } from '../contexts/SessionContext';
import { EmptyChat } from './EmptyChat';

interface ChatViewProps {
    defaultUltraMode: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ defaultUltraMode }) => {
  const { activeSession, updateSession, updateSessionTitle } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<{key: number, text: string}>({key: 0, text: ''});
  const [isUltraMode, setIsUltraMode] = useState(defaultUltraMode);
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

  const handleSendMessage = useCallback(async (prompt: string, image: ImageData | null) => {
    if (!activeSession || (!prompt && !image)) return;
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      ...(image && { image: `data:${image.mimeType};base64,${image.data}` }),
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '', // Will be populated with AnalysisResult object or string
    };
    
    const messagesWithUser = [...activeSession.messages, userMessage];
    updateSession(activeSession.id, { messages: messagesWithUser });
    
    const messagesWithAssistant = [...messagesWithUser, assistantMessage];
    updateSession(activeSession.id, { messages: messagesWithAssistant });


    let fullResponseText = '';
    try {
        const stream = analyzeChartStream(activeSession.messages, prompt, image, abortControllerRef.current.signal, isUltraMode);
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

        if (image) { // We were analyzing an image, expect JSON
            try {
                const parsedJson = JSON.parse(fullResponseText);
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    finalContent = parsedJson as AnalysisResult;
                    thinkingText = finalContent.thinkingProcess;
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
                ? finalContent.summary.substring(0, 40) + '...'
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
    let image: ImageData | null = null;
    if (lastUserMessage.image) {
        const parts = lastUserMessage.image.split(';base64,');
        if (parts.length === 2) {
            const mimeType = parts[0].split(':')[1];
            const data = parts[1];
            image = { mimeType, data };
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
        const stream = analyzeChartStream(historyForStream, prompt, image, abortControllerRef.current.signal, isUltraMode);
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

        if (image) { // We were analyzing an image, expect JSON
            try {
                const parsedJson = JSON.parse(fullResponseText);
                if (parsedJson.error) {
                    finalContent = `Error: ${parsedJson.error}`;
                } else {
                    finalContent = parsedJson as AnalysisResult;
                    thinkingText = finalContent.thinkingProcess;
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
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
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
        />
      </div>
    </div>
  );
}