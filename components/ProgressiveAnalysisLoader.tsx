import React, { useState, useEffect } from 'react';
import type { 
  ProgressiveStreamEvent, 
  ProgressiveAnalysisState, 
  AnalysisPhase,
  ProgressiveAnalysisResult 
} from '../types';

// ========================================
// PROGRESSIVE ANALYSIS LOADER COMPONENT
// ========================================

interface ProgressiveAnalysisLoaderProps {
  analysisState: ProgressiveAnalysisState | null;
  currentResult?: Partial<ProgressiveAnalysisResult>;
  onPhaseSkip?: (targetPhase: AnalysisPhase) => void;
  onCancel?: () => void;
  showDetailedProgress?: boolean;
  enablePhaseSkipping?: boolean;
}

export const ProgressiveAnalysisLoader: React.FC<ProgressiveAnalysisLoaderProps> = ({
  analysisState,
  currentResult,
  onPhaseSkip,
  onCancel,
  showDetailedProgress = true,
  enablePhaseSkipping = true
}) => {
  const [animationPhase, setAnimationPhase] = useState<AnalysisPhase>('OVERVIEW');
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!analysisState?.isActive) return;

    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [analysisState?.isActive]);

  useEffect(() => {
    if (analysisState?.currentPhase) {
      setAnimationPhase(analysisState.currentPhase);
    }
  }, [analysisState?.currentPhase]);

  if (!analysisState || !analysisState.isActive) {
    return null;
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  const getPhaseDescription = (phase: AnalysisPhase): string => {
    switch (phase) {
      case 'OVERVIEW':
        return 'Quick overview analysis - identifying immediate patterns and signals';
      case 'DETAILED':
        return 'Detailed analysis - comprehensive technical indicators and patterns';
      case 'VERIFICATION':
        return 'Final verification - cross-validation and risk optimization';
      default:
        return 'Processing analysis...';
    }
  };

  const getPhaseIcon = (phase: AnalysisPhase, isActive: boolean = false): string => {
    const icons = {
      OVERVIEW: isActive ? '🔍' : '👁️',
      DETAILED: isActive ? '🔬' : '📊',
      VERIFICATION: isActive ? '✅' : '🎯'
    };
    return icons[phase];
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 90) return 'text-green-400';
    if (confidence >= 70) return 'text-yellow-400';
    if (confidence >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-card-bg border border-border-color rounded-lg p-6 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-accent-blue rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full animate-ping" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Progressive Analysis</h3>
              <p className="text-sm text-text-secondary">Streaming analysis in real-time</p>
            </div>
          </div>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-text-secondary hover:text-text-primary transition-colors p-2"
              title="Cancel Analysis"
            >
              ✕
            </button>
          )}
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">Overall Progress</span>
            <span className="text-sm text-text-secondary">{analysisState.overallProgress}%</span>
          </div>
          <div className="w-full bg-border-color rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-accent-blue to-green-400 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${analysisState.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Phase Progress */}
        <div className="space-y-4 mb-6">
          {(['OVERVIEW', 'DETAILED', 'VERIFICATION'] as AnalysisPhase[]).map((phase, index) => {
            const phaseData = analysisState.phases[phase.toLowerCase() as keyof typeof analysisState.phases];
            const isActive = analysisState.currentPhase === phase;
            const isCompleted = phaseData.status === 'COMPLETED';
            const isError = phaseData.status === 'ERROR';
            const isPending = phaseData.status === 'PENDING';
            
            return (
              <div key={phase} className={`
                border rounded-lg p-4 transition-all duration-300
                ${isActive ? 'border-accent-blue bg-accent-blue/10' : 
                  isCompleted ? 'border-green-400 bg-green-400/10' :
                  isError ? 'border-red-400 bg-red-400/10' :
                  'border-border-color bg-sidebar-bg'}
              `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      text-2xl transition-all duration-300
                      ${isActive ? 'animate-bounce' : ''}
                    `}>
                      {isCompleted ? '✅' : 
                       isError ? '❌' : 
                       isActive ? getPhaseIcon(phase, true) : 
                       getPhaseIcon(phase, false)}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${
                          isActive ? 'text-accent-blue' :
                          isCompleted ? 'text-green-400' :
                          isError ? 'text-red-400' :
                          'text-text-secondary'
                        }`}>
                          Phase {index + 1}: {phase.charAt(0) + phase.slice(1).toLowerCase()}
                        </h4>
                        
                        {phaseData.confidence > 0 && (
                          <span className={`text-sm font-medium ${getConfidenceColor(phaseData.confidence)}`}>
                            {phaseData.confidence}% confidence
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-text-secondary mt-1">
                        {getPhaseDescription(phase)}
                      </p>
                      
                      {/* Phase timing */}
                      {showDetailedProgress && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                          {phaseData.startTime && (
                            <span>
                              Started: {formatTime(Date.now() - phaseData.startTime)} ago
                            </span>
                          )}
                          {phaseData.endTime && phaseData.startTime && (
                            <span>
                              Duration: {formatTime(phaseData.endTime - phaseData.startTime)}
                            </span>
                          )}
                          {isActive && (
                            <span className="text-accent-blue animate-pulse">
                              Processing...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Phase Skip Button */}
                  {enablePhaseSkipping && onPhaseSkip && isPending && index > 0 && (
                    <button
                      onClick={() => onPhaseSkip(phase)}
                      className="text-xs px-3 py-1 bg-accent-blue/20 text-accent-blue rounded hover:bg-accent-blue/30 transition-colors"
                      title={`Skip to ${phase} phase`}
                    >
                      Skip to Phase
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Information */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-sidebar-bg border border-border-color rounded p-3">
            <h5 className="text-sm font-medium text-text-secondary mb-1">Time Elapsed</h5>
            <p className="text-lg font-semibold text-text-primary">{formatTime(timeElapsed)}</p>
          </div>
          
          <div className="bg-sidebar-bg border border-border-color rounded p-3">
            <h5 className="text-sm font-medium text-text-secondary mb-1">Estimated Total</h5>
            <p className="text-lg font-semibold text-text-primary">
              {formatTime(analysisState.estimatedTotalTime)}
            </p>
          </div>
        </div>

        {/* Current Result Preview */}
        {currentResult && (currentResult.overviewData || currentResult.detailedData) && (
          <div className="border-t border-border-color pt-4">
            <h5 className="text-sm font-medium text-text-primary mb-3">Current Analysis Preview</h5>
            <div className="bg-sidebar-bg border border-border-color rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-secondary">Signal</span>
                <span className={`text-sm font-semibold ${
                  (currentResult.overviewData?.signal || currentResult.detailedData?.signal) === 'BUY' ? 'text-green-400' :
                  (currentResult.overviewData?.signal || currentResult.detailedData?.signal) === 'SELL' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {currentResult.overviewData?.signal || currentResult.detailedData?.signal || 'NEUTRAL'}
                </span>
              </div>
              
              {(currentResult.overviewData?.summary || currentResult.detailedData?.summary) && (
                <p className="text-sm text-text-secondary line-clamp-3">
                  {currentResult.detailedData?.summary || currentResult.overviewData?.summary}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Analysis ID for debugging */}
        {showDetailedProgress && (
          <div className="mt-4 text-xs text-text-secondary text-center">
            Analysis ID: {analysisState.analysisId}
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================
// PHASE INDICATOR COMPONENT
// ========================================

interface PhaseIndicatorProps {
  currentPhase: AnalysisPhase;
  phaseProgress: number; // 0-100
  confidence: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({
  currentPhase,
  phaseProgress,
  confidence,
  size = 'md',
  showLabel = true
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base'
  };

  const getPhaseColor = (phase: AnalysisPhase): string => {
    switch (phase) {
      case 'OVERVIEW': return 'text-blue-400 border-blue-400';
      case 'DETAILED': return 'text-yellow-400 border-yellow-400';
      case 'VERIFICATION': return 'text-green-400 border-green-400';
      default: return 'text-text-secondary border-border-color';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`
        relative rounded-full border-2 flex items-center justify-center
        ${sizeClasses[size]} ${getPhaseColor(currentPhase)}
        transition-all duration-300
      `}>
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="40%"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${phaseProgress * 2.51327} 251.327`}
            className="opacity-30"
          />
        </svg>
        
        {/* Phase icon */}
        <span className="relative z-10 font-bold">
          {currentPhase === 'OVERVIEW' ? '1' :
           currentPhase === 'DETAILED' ? '2' : '3'}
        </span>
      </div>
      
      {showLabel && (
        <div>
          <div className="text-sm font-medium text-text-primary">
            {currentPhase.charAt(0) + currentPhase.slice(1).toLowerCase()}
          </div>
          <div className="text-xs text-text-secondary">
            {confidence}% confidence
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================
// MINI PROGRESS INDICATOR
// ========================================

interface MiniProgressIndicatorProps {
  phase: AnalysisPhase;
  progress: number;
  confidence: number;
  className?: string;
}

export const MiniProgressIndicator: React.FC<MiniProgressIndicatorProps> = ({
  phase,
  progress,
  confidence,
  className = ''
}) => {
  const getPhaseEmoji = (phase: AnalysisPhase): string => {
    switch (phase) {
      case 'OVERVIEW': return '👁️';
      case 'DETAILED': return '🔬';
      case 'VERIFICATION': return '✅';
      default: return '⏳';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm">{getPhaseEmoji(phase)}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">
            {phase.charAt(0) + phase.slice(1).toLowerCase()}
          </span>
          <span className="text-text-primary font-medium">
            {progress}%
          </span>
        </div>
        <div className="w-full bg-border-color rounded-full h-1.5 mt-1">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              phase === 'OVERVIEW' ? 'bg-blue-400' :
              phase === 'DETAILED' ? 'bg-yellow-400' :
              'bg-green-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ========================================
// PROGRESS STREAM VISUALIZER
// ========================================

interface ProgressStreamVisualizerProps {
  events: ProgressiveStreamEvent[];
  maxEvents?: number;
  showMetadata?: boolean;
}

export const ProgressStreamVisualizer: React.FC<ProgressStreamVisualizerProps> = ({
  events,
  maxEvents = 10,
  showMetadata = false
}) => {
  const recentEvents = events.slice(-maxEvents).reverse();

  const getEventIcon = (type: ProgressiveStreamEvent['type']): string => {
    switch (type) {
      case 'PHASE_START': return '🚀';
      case 'PHASE_PROGRESS': return '⏳';
      case 'PHASE_COMPLETE': return '✅';
      case 'PHASE_ERROR': return '❌';
      case 'ANALYSIS_COMPLETE': return '🎉';
      default: return '📊';
    }
  };

  const getEventColor = (type: ProgressiveStreamEvent['type']): string => {
    switch (type) {
      case 'PHASE_START': return 'text-blue-400';
      case 'PHASE_PROGRESS': return 'text-yellow-400';
      case 'PHASE_COMPLETE': return 'text-green-400';
      case 'PHASE_ERROR': return 'text-red-400';
      case 'ANALYSIS_COMPLETE': return 'text-green-300';
      default: return 'text-text-secondary';
    }
  };

  return (
    <div className="bg-sidebar-bg border border-border-color rounded-lg p-4">
      <h4 className="text-sm font-medium text-text-primary mb-3">Analysis Stream</h4>
      
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {recentEvents.map((event, index) => (
          <div key={`${event.timestamp}-${index}`} className="flex items-start gap-3 text-xs">
            <span className={`${getEventColor(event.type)} mt-0.5`}>
              {getEventIcon(event.type)}
            </span>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-medium">
                  {event.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="text-text-secondary">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="text-text-secondary mt-1">
                Phase: {event.phase} • Progress: {event.progress}% • Confidence: {event.confidence}%
              </div>
              
              {showMetadata && event.metadata && (
                <div className="text-text-secondary mt-1 text-xs">
                  {event.metadata.processingTime}ms 
                  {event.metadata.cacheHit && ' (cached)'}
                  {event.metadata.errorDetails && ` - Error: ${event.metadata.errorDetails}`}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {recentEvents.length === 0 && (
          <div className="text-center text-text-secondary py-4">
            No events yet
          </div>
        )}
      </div>
    </div>
  );
};