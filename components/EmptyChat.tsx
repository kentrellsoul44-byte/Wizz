
import React from 'react';

interface EmptyChatProps {
    onExampleClick: (prompt: string) => void;
}

const examplePrompts = [
    "Analyze the trend and key levels for this BTC/USD 4H chart.",
    "Is there a bullish or bearish pattern forming here?",
    "Based on the indicators, what's a potential trade setup?"
];

const ExamplePromptButton: React.FC<{text: string, onClick: () => void}> = ({text, onClick}) => (
    <button 
        onClick={onClick}
        className="w-full text-left p-3 bg-input-bg rounded-lg hover:bg-border-color transition-colors text-sm text-text-secondary"
    >
        {text}
    </button>
);

export const EmptyChat: React.FC<EmptyChatProps> = ({ onExampleClick }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-accent-blue rounded-full mb-4 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                </svg>
            </div>
            <h2 className="text-2xl font-semibold text-text-primary">Wizz AI Analyzer</h2>
            <p className="text-text-secondary mt-2 mb-8">Upload a crypto chart image and ask a question to begin. Or, try one of these examples:</p>
            <div className="w-full space-y-3">
                {examplePrompts.map(prompt => (
                    <ExamplePromptButton 
                        key={prompt} 
                        text={prompt} 
                        onClick={() => onExampleClick(prompt)} 
                    />
                ))}
            </div>
        </div>
    );
}
