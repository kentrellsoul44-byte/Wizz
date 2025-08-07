import React, { useState } from 'react';
import { marked } from 'marked';
import type { ChatMessage, AnalysisResult } from '../types';
import { RegenerateIcon } from './icons/RegenerateIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';

const UserIcon: React.FC = () => (
  <div className="w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center font-bold text-white flex-shrink-0">
    U
  </div>
);

const WizzIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-sidebar-bg border border-border-color flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-accent-blue">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
        </svg>
    </div>
);

// A simple component to render markdown, with Tailwind's prose classes for styling.
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    // Sanitize the HTML to prevent XSS attacks if needed, though marked has some built-in protection.
    const parsedHtml = marked.parse(content, { gfm: true, breaks: true });
    return (
        <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: parsedHtml as string }} 
        />
    );
};


const AnalysisCard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const [isCopied, setIsCopied] = useState(false);

    const signalColor =
        result.signal === 'BUY' ? 'text-accent-green' :
        result.signal === 'SELL' ? 'text-accent-red' :
        'text-accent-yellow';

    const signalBgColor =
        result.signal === 'BUY' ? 'bg-accent-green-10' :
        result.signal === 'SELL' ? 'bg-accent-red-10' :
        'bg-accent-yellow-10';
        
    const handleCopy = () => {
        let textToCopy = `Wizz AI Analysis\n---\n`;
        textToCopy += `Summary: ${result.summary}\n`;
        textToCopy += `Signal: ${result.signal} (${result.confidence} Confidence)\n`;
        if (result.trade && result.confidence === 'HIGH') {
            textToCopy += `Entry Price: ${result.trade.entryPrice}\n`;
            textToCopy += `Take Profit: ${result.trade.takeProfit}\n`;
            textToCopy += `Stop Loss: ${result.trade.stopLoss}\n`;
        }
        if (result.riskRewardRatio) {
            textToCopy += `Risk/Reward Ratio: ${result.riskRewardRatio}\n`;
        }
        textToCopy += `AI Confidence Score: ${result.overallConfidenceScore}/100`;

        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="border border-border-color rounded-lg space-y-4 bg-sidebar-bg relative">
            <div className="absolute top-2 right-2">
                <button 
                    onClick={handleCopy} 
                    className="p-1.5 rounded-md text-text-secondary hover:bg-input-bg hover:text-text-primary transition-colors"
                    aria-label="Copy analysis to clipboard"
                >
                    {isCopied ? <CheckIcon className="h-4 w-4 text-accent-green" /> : <CopyIcon className="h-4 w-4" />}
                </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                  <h3 className="font-semibold text-text-primary mb-1">Summary</h3>
                  <p className="text-sm text-text-secondary">{result.summary}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg ${signalBgColor}`}>
                      <h4 className="text-xs font-semibold text-text-secondary mb-1">Signal</h4>
                      <p className={`text-lg font-bold ${signalColor}`}>{result.signal}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-input-bg-50">
                      <h4 className="text-xs font-semibold text-text-secondary mb-1">Confidence</h4>
                      <p className={`text-lg font-bold ${result.confidence === 'HIGH' ? 'text-text-primary' : 'text-text-secondary'}`}>{result.confidence}</p>
                  </div>
              </div>

              {result.timeframe && (
                  <div>
                      <h3 className="font-semibold text-text-primary mb-2">Analysis Context</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div className="bg-input-bg-50 p-2 rounded-md">
                              <span className="text-text-secondary block text-xs">Chart Timeframe</span>
                              <span className="font-mono text-text-primary">{result.timeframe}</span>
                          </div>
                          {result.riskRewardRatio && (
                              <div className="bg-input-bg-50 p-2 rounded-md">
                                  <span className="text-text-secondary block text-xs">Risk/Reward Ratio</span>
                                  <span className="font-mono text-text-primary">{result.riskRewardRatio}</span>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {result.trade && result.confidence === 'HIGH' && (
                  <div>
                      <h3 className="font-semibold text-text-primary mb-2">Trade Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          <div className="bg-input-bg-50 p-2 rounded-md">
                              <span className="text-text-secondary block text-xs">Entry Price</span>
                              <span className="font-mono text-text-primary">{result.trade.entryPrice}</span>
                          </div>
                          <div className="bg-input-bg-50 p-2 rounded-md">
                              <span className="text-text-secondary block text-xs">Take Profit</span>
                              <span className="font-mono text-accent-green">{result.trade.takeProfit}</span>
                          </div>
                          <div className="bg-input-bg-50 p-2 rounded-md">
                              <span className="text-text-secondary block text-xs">Stop Loss</span>
                              <span className="font-mono text-accent-red">{result.trade.stopLoss}</span>
                          </div>
                      </div>
                  </div>
              )}
              {result.confidence === 'LOW' && (
                  <p className="text-xs text-center text-text-secondary italic">No trade signal provided due to low confidence.</p>
              )}

              {/* Verification Section */}
              <div>
                  <h3 className="font-semibold text-text-primary mb-2">Verification</h3>
                  <div className="bg-input-bg-50 p-3 rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-text-secondary">AI Confidence Score</span>
                          <span className="text-lg font-bold text-text-primary">{result.overallConfidenceScore}/100</span>
                      </div>
                      <div className="w-full bg-border-color rounded-full h-2.5">
                          <div className="bg-accent-blue h-2.5 rounded-full" style={{ width: `${result.overallConfidenceScore}%` }}></div>
                      </div>
                      <p className="text-xs text-text-secondary pt-1">{result.verificationSummary}</p>
                  </div>
              </div>
            </div>
        </div>
    );
};

interface MessageProps {
  message: ChatMessage;
  isLastMessage: boolean;
  isLoading: boolean;
  onRegenerate: () => void;
}

export const Message: React.FC<MessageProps> = React.memo(({ message, isLastMessage, isLoading, onRegenerate }) => {
    const isUser = message.role === 'user';
    const { content, thinkingText } = message;

    if (isUser) {
        const imageUrls: string[] = [];
        if (Array.isArray((message as any).images) && (message as any).images.length > 0) {
            imageUrls.push(...((message as any).images as string[]));
        } else if ((message as any).image) {
            imageUrls.push((message as any).image as string);
        }
        return (
            <div className="flex items-start gap-4 justify-end">
                <div className="flex-1 max-w-2xl bg-accent-blue rounded-lg p-3 text-white">
                    {typeof content === 'string' && content && <p className="whitespace-pre-wrap">{content}</p>}
                    {imageUrls.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {imageUrls.map((url, idx) => (
                                <img key={idx} src={url} alt={`User upload ${idx+1}`} className="max-w-xs max-h-64 rounded-md border border-blue-400" />
                            ))}
                        </div>
                    )}
                </div>
                <UserIcon />
            </div>
        );
    }
    
    // Assistant message
    const isErrorMessage = typeof content === 'string' && (
        content.startsWith('Error:') ||
        content.startsWith('Sorry, I encountered an error') ||
        content === 'Response stopped by user.' ||
        content === 'An unexpected error occurred. Please try again.'
    );

    return (
        <div className="flex items-start gap-4">
            <WizzIcon />
            <div className="flex-1 max-w-2xl space-y-4">
                {/* Render a loading spinner if this is the message currently being generated */}
                {isLoading && (
                     <div className="flex items-center gap-2 text-text-secondary">
                        <div className="h-5 w-5 border-2 border-t-transparent border-accent-blue rounded-full animate-spin"></div>
                        <span>Wizz is analyzing...</span>
                     </div>
                )}
                
                {/* Render the thinking process (markdown) if it exists */}
                {thinkingText && <MarkdownRenderer content={thinkingText} />}

                {/* Render the final analysis card if it's an object */}
                {typeof content === 'object' && <AnalysisCard result={content as AnalysisResult} />}

                {/* Render text content if it's a string (e.g., error messages, conversational response) */}
                {typeof content === 'string' && content && (
                    isErrorMessage ? (
                        <p className="text-text-secondary italic">{content}</p>
                    ) : (
                        <MarkdownRenderer content={content} />
                    )
                )}
                                
                {/* Regenerate Button */}
                {isLastMessage && message.role === 'assistant' && !isLoading && message.content && (
                    <div className="!mt-2 flex justify-start">
                        <button
                            onClick={onRegenerate}
                            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-input-bg transition-colors"
                            aria-label="Regenerate response"
                        >
                            <RegenerateIcon className="h-4 w-4" />
                            <span>Regenerate</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});