import React, { useState } from 'react';
import type { CalibratedConfidence } from '../services/confidenceCalibrationService';

interface ConfidenceDisplayProps {
  calibratedConfidence: CalibratedConfidence;
  className?: string;
}

export const ConfidenceDisplay: React.FC<ConfidenceDisplayProps> = ({ 
  calibratedConfidence, 
  className = '' 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { overallScore, factors, interval, breakdown, historicalContext, riskAdjustments } = calibratedConfidence;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getReliabilityColor = (reliability: string): string => {
    switch (reliability) {
      case 'VERY_HIGH': return 'text-green-600 dark:text-green-400';
      case 'HIGH': return 'text-blue-600 dark:text-blue-400';
      case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400';
      case 'LOW': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      {/* Main Confidence Score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Confidence:
            </span>
            <span className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}%
            </span>
          </div>
          
          {/* Confidence Interval */}
          <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
            <span>±{interval.uncertainty}%</span>
            <span className={`font-medium ${getReliabilityColor(interval.reliability)}`}>
              ({interval.reliability.toLowerCase()} reliability)
            </span>
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Confidence Range Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{interval.lowerBound}%</span>
          <span>Range: {interval.lowerBound}% - {interval.upperBound}%</span>
          <span>{interval.upperBound}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative">
          {/* Range indicator */}
          <div 
            className="absolute h-2 bg-blue-200 dark:bg-blue-800 rounded-full"
            style={{
              left: `${interval.lowerBound}%`,
              width: `${interval.upperBound - interval.lowerBound}%`
            }}
          />
          {/* Center point */}
          <div 
            className={`absolute h-2 w-1 ${getScoreColor(overallScore).replace('text-', 'bg-')} rounded-full`}
            style={{ left: `${overallScore}%` }}
          />
        </div>
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          
          {/* Factor Scores */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Confidence Factors
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Technical Confluence:</span>
                  <span className={getScoreColor(factors.technicalConfluence)}>
                    {formatPercentage(factors.technicalConfluence)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Historical Patterns:</span>
                  <span className={getScoreColor(factors.historicalPatternSuccess)}>
                    {formatPercentage(factors.historicalPatternSuccess)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Market Conditions:</span>
                  <span className={getScoreColor(factors.marketConditions)}>
                    {formatPercentage(factors.marketConditions)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Volatility Adjustment:</span>
                  <span className={getScoreColor(factors.volatilityAdjustment)}>
                    {formatPercentage(factors.volatilityAdjustment)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Volume Confirmation:</span>
                  <span className={getScoreColor(factors.volumeConfirmation)}>
                    {formatPercentage(factors.volumeConfirmation)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Structural Integrity:</span>
                  <span className={getScoreColor(factors.structuralIntegrity)}>
                    {formatPercentage(factors.structuralIntegrity)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quality Metrics */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Quality Metrics
            </h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Data Quality</div>
                <div className={getScoreColor(breakdown.qualityMetrics.dataQuality)}>
                  {formatPercentage(breakdown.qualityMetrics.dataQuality)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Signal Clarity</div>
                <div className={getScoreColor(breakdown.qualityMetrics.signalClarity)}>
                  {formatPercentage(breakdown.qualityMetrics.signalClarity)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Market Noise</div>
                <div className={getScoreColor(100 - breakdown.qualityMetrics.marketNoise)}>
                  {formatPercentage(breakdown.qualityMetrics.marketNoise)}
                </div>
              </div>
            </div>
          </div>

          {/* Historical Context */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Historical Context
            </h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Similar Patterns</div>
                  <div className="font-medium">{historicalContext.similarPatternCount}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                  <div className={`font-medium ${getScoreColor(historicalContext.successRate)}`}>
                    {formatPercentage(historicalContext.successRate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Avg Win</div>
                  <div className="font-medium text-green-600 dark:text-green-400">
                    +{historicalContext.avgReturnOnSuccess}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Avg Loss</div>
                  <div className="font-medium text-red-600 dark:text-red-400">
                    {historicalContext.avgLossOnFailure}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Adjustments */}
          {(riskAdjustments.volatilityPenalty > 0 || riskAdjustments.liquidityDiscount > 0 || riskAdjustments.newsRisk > 0) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Risk Adjustments
              </h4>
              <div className="space-y-1 text-sm">
                {riskAdjustments.volatilityPenalty > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Volatility Penalty:</span>
                    <span>-{riskAdjustments.volatilityPenalty}%</span>
                  </div>
                )}
                {riskAdjustments.liquidityDiscount > 0 && (
                  <div className="flex justify-between text-orange-600 dark:text-orange-400">
                    <span>Liquidity Discount:</span>
                    <span>-{riskAdjustments.liquidityDiscount}%</span>
                  </div>
                )}
                {riskAdjustments.newsRisk > 0 && (
                  <div className="flex justify-between text-yellow-600 dark:text-yellow-400">
                    <span>News Risk:</span>
                    <span>-{riskAdjustments.newsRisk}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Factor Contributions */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Factor Contributions to Final Score
            </h4>
            <div className="space-y-1 text-xs">
              {Object.entries(breakdown.factorContributions).map(([factor, contribution]) => (
                <div key={factor} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {factor.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                  </span>
                  <span className={getScoreColor(contribution)}>
                    +{contribution}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfidenceDisplay;