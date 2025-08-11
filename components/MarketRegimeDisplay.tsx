import React from 'react';
import type { MarketRegimeContext } from '../types';

interface MarketRegimeDisplayProps {
  regimeContext: MarketRegimeContext | null;
  className?: string;
}

export const MarketRegimeDisplay: React.FC<MarketRegimeDisplayProps> = ({ 
  regimeContext, 
  className = "" 
}) => {
  if (!regimeContext) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-500 rounded-full animate-pulse"></div>
          <span className="text-gray-400 text-sm">Market regime analysis unavailable</span>
        </div>
      </div>
    );
  }

  const getRegimeColor = (regime: string): string => {
    if (regime.includes('BULL')) return 'text-green-400';
    if (regime.includes('BEAR')) return 'text-red-400';
    if (regime.includes('NEUTRAL')) return 'text-yellow-400';
    if (regime.includes('TRANSITIONAL')) return 'text-purple-400';
    return 'text-gray-400';
  };

  const getRegimeIcon = (regime: string): string => {
    if (regime.includes('BULL_TRENDING')) return '📈';
    if (regime.includes('BEAR_TRENDING')) return '📉';
    if (regime.includes('BULL_RANGING')) return '🔼';
    if (regime.includes('BEAR_RANGING')) return '🔽';
    if (regime.includes('NEUTRAL_TRENDING')) return '➡️';
    if (regime.includes('NEUTRAL_RANGING')) return '⭕';
    if (regime.includes('TRANSITIONAL')) return '🔄';
    return '❓';
  };

  const getVolatilityColor = (regime: string): string => {
    switch (regime) {
      case 'LOW': return 'text-blue-400';
      case 'NORMAL': return 'text-green-400';
      case 'HIGH': return 'text-orange-400';
      case 'EXTREME': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    if (confidence >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStabilityColor = (stability: number): string => {
    if (stability >= 80) return 'text-green-400';
    if (stability >= 60) return 'text-yellow-400';
    if (stability >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getRegimeIcon(regimeContext.overallRegime)}</span>
          <h3 className="text-lg font-semibold text-white">Market Regime</h3>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className={`text-sm font-medium ${getConfidenceColor(regimeContext.confidence)}`}>
              {regimeContext.confidence}% Confidence
            </div>
            <div className={`text-xs ${getStabilityColor(regimeContext.stability)}`}>
              {regimeContext.stability}% Stable
            </div>
          </div>
        </div>
      </div>

      {/* Overall Regime */}
      <div className="bg-gray-900/50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Overall Regime</span>
          <span className={`font-semibold ${getRegimeColor(regimeContext.overallRegime)}`}>
            {regimeContext.overallRegime.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Regime Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Trend</div>
          <div className={`text-sm font-medium ${getRegimeColor(regimeContext.trendRegime)}`}>
            {regimeContext.trendRegime.replace(/_/g, ' ')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ADX: {regimeContext.trendMetrics.adx.toFixed(1)}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Direction</div>
          <div className={`text-sm font-medium ${regimeContext.directionRegime === 'TRENDING' ? 'text-blue-400' : regimeContext.directionRegime === 'RANGING' ? 'text-orange-400' : 'text-purple-400'}`}>
            {regimeContext.directionRegime}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Efficiency: {regimeContext.rangingMetrics.efficiency.toFixed(0)}%
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Volatility</div>
          <div className={`text-sm font-medium ${getVolatilityColor(regimeContext.volatilityRegime)}`}>
            {regimeContext.volatilityRegime}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ATR: {regimeContext.volatilityMetrics.atrNormalized.toFixed(2)}%
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Momentum</div>
          <div className={`text-sm font-medium ${regimeContext.momentumRegime === 'ACCELERATING' ? 'text-green-400' : regimeContext.momentumRegime === 'DECELERATING' ? 'text-red-400' : regimeContext.momentumRegime === 'STABLE' ? 'text-blue-400' : 'text-yellow-400'}`}>
            {regimeContext.momentumRegime}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            RSI: {regimeContext.momentumMetrics.rsi.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Analysis Adjustments */}
      <div className="bg-gray-900/50 rounded-lg p-3">
        <div className="text-sm font-medium text-white mb-2">Analysis Adjustments</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Risk Multiplier:</span>
            <span className={`font-medium ${regimeContext.analysisAdjustments.riskMultiplier > 1 ? 'text-green-400' : regimeContext.analysisAdjustments.riskMultiplier < 1 ? 'text-red-400' : 'text-gray-300'}`}>
              {regimeContext.analysisAdjustments.riskMultiplier.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Stop Adjustment:</span>
            <span className={`font-medium ${regimeContext.analysisAdjustments.stopLossAdjustment > 1 ? 'text-red-400' : 'text-green-400'}`}>
              {regimeContext.analysisAdjustments.stopLossAdjustment.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target Adjustment:</span>
            <span className={`font-medium ${regimeContext.analysisAdjustments.takeProfitAdjustment > 1 ? 'text-green-400' : 'text-red-400'}`}>
              {regimeContext.analysisAdjustments.takeProfitAdjustment.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Entry Approach:</span>
            <span className={`font-medium ${
              regimeContext.analysisAdjustments.entryApproach === 'AGGRESSIVE' ? 'text-red-400' :
              regimeContext.analysisAdjustments.entryApproach === 'CONSERVATIVE' ? 'text-blue-400' :
              regimeContext.analysisAdjustments.entryApproach === 'PATIENT' ? 'text-green-400' :
              'text-purple-400'
            }`}>
              {regimeContext.analysisAdjustments.entryApproach}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings & Opportunities */}
      {(regimeContext.warnings.length > 0 || regimeContext.opportunities.length > 0) && (
        <div className="space-y-2">
          {regimeContext.warnings.length > 0 && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
              <div className="text-sm font-medium text-red-400 mb-1">⚠️ Warnings</div>
              <ul className="text-xs text-red-300 space-y-1">
                {regimeContext.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {regimeContext.opportunities.length > 0 && (
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
              <div className="text-sm font-medium text-green-400 mb-1">💡 Opportunities</div>
              <ul className="text-xs text-green-300 space-y-1">
                {regimeContext.opportunities.map((opportunity, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>{opportunity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Historical Context */}
      <div className="bg-gray-900/50 rounded-lg p-3">
        <div className="text-sm font-medium text-white mb-2">Historical Context</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Time in Regime:</span>
            <span className="text-gray-300">
              {regimeContext.regimeHistory.timeInCurrentRegime.toFixed(1)}h
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Recent Changes:</span>
            <span className={`font-medium ${regimeContext.regimeHistory.recentRegimeChanges > 3 ? 'text-red-400' : regimeContext.regimeHistory.recentRegimeChanges > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
              {regimeContext.regimeHistory.recentRegimeChanges}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Last Updated: {new Date(regimeContext.timestamp).toLocaleTimeString()}</span>
        <span>Next Review: {new Date(regimeContext.nextReviewTime).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default MarketRegimeDisplay;