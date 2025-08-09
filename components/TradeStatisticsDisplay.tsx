import React from 'react';
import type { TradeStatistics } from '../services/tradeTrackingService';

interface TradeStatisticsDisplayProps {
  statistics: TradeStatistics;
  isVisible: boolean;
  onClose: () => void;
}

export const TradeStatisticsDisplay: React.FC<TradeStatisticsDisplayProps> = ({
  statistics,
  isVisible,
  onClose
}) => {
  if (!isVisible) return null;

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.7) return 'text-green-600';
    if (rate >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRRColor = (rr: number): string => {
    if (rr >= 2.5) return 'text-green-600';
    if (rr >= 2.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVolatilityLabel = (vol: string): string => {
    switch (vol) {
      case 'lowVol': return 'Low Volatility';
      case 'mediumVol': return 'Medium Volatility';
      case 'highVol': return 'High Volatility';
      case 'extremeVol': return 'Extreme Volatility';
      default: return vol;
    }
  };

  const getAnalysisTypeLabel = (type: string): string => {
    switch (type) {
      case 'SMC': return 'Smart Money Concepts';
      case 'PATTERN': return 'Pattern Recognition';
      case 'MULTI_TIMEFRAME': return 'Multi-Timeframe';
      case 'STANDARD': return 'Standard Analysis';
      default: return type;
    }
  };

  const getDayLabel = (day: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || `Day ${day}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Trade Performance Statistics
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Overall Statistics */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Overall Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Trades</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {statistics.totalTrades}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
              <p className={`text-2xl font-bold ${getSuccessRateColor(statistics.successRate)}`}>
                {formatPercentage(statistics.successRate)}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Average R:R</p>
              <p className={`text-2xl font-bold ${getRRColor(statistics.averageRR)}`}>
                {statistics.averageRR.toFixed(2)}:1
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Hold Time</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {statistics.averageHoldingTime.toFixed(1)}h
              </p>
            </div>
          </div>
        </div>

        {/* Asset Performance */}
        {statistics.bestPerformingAsset && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Asset Performance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">Best Performing</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {statistics.bestPerformingAsset}
                </p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">Worst Performing</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {statistics.worstPerformingAsset}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Volatility Performance */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance by Volatility
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statistics.volatilityPerformance).map(([vol, stats]) => (
              <div key={vol} className="p-4 bg-gray-50 dark:bg-gray-700 rounded border">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {getVolatilityLabel(vol)}
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Trades: {stats.trades}
                  </p>
                  <p className={`text-sm font-semibold ${getSuccessRateColor(stats.successRate)}`}>
                    Success: {formatPercentage(stats.successRate)}
                  </p>
                  <p className={`text-sm font-semibold ${getRRColor(stats.avgRR)}`}>
                    Avg R:R: {stats.avgRR.toFixed(2)}:1
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Type Performance */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance by Analysis Type
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statistics.analysisTypePerformance).map(([type, stats]) => (
              <div key={type} className="p-4 bg-gray-50 dark:bg-gray-700 rounded border">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {getAnalysisTypeLabel(type)}
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Trades: {stats.trades}
                  </p>
                  <p className={`text-sm font-semibold ${getSuccessRateColor(stats.successRate)}`}>
                    Success: {formatPercentage(stats.successRate)}
                  </p>
                  <p className={`text-sm font-semibold ${getRRColor(stats.avgRR)}`}>
                    Avg R:R: {stats.avgRR.toFixed(2)}:1
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Performance - Daily */}
        {Object.keys(statistics.timePerformance.daily).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Performance by Day of Week
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, day) => {
                const dayStats = statistics.timePerformance.daily[day];
                if (!dayStats || dayStats.trades === 0) return null;
                
                return (
                  <div key={day} className="p-3 bg-gray-50 dark:bg-gray-700 rounded border text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {getDayLabel(day)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {dayStats.trades} trades
                    </p>
                    <p className={`text-sm font-semibold ${getSuccessRateColor(dayStats.successRate)}`}>
                      {formatPercentage(dayStats.successRate)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Time Performance - Hourly (Top 6 hours) */}
        {Object.keys(statistics.timePerformance.hourly).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Performing Hours
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {Object.entries(statistics.timePerformance.hourly)
                .filter(([_, stats]) => stats.trades >= 3) // Minimum 3 trades
                .sort(([_, a], [__, b]) => b.successRate - a.successRate)
                .slice(0, 6)
                .map(([hour, stats]) => (
                  <div key={hour} className="p-3 bg-gray-50 dark:bg-gray-700 rounded border text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {hour}:00 UTC
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {stats.trades} trades
                    </p>
                    <p className={`text-sm font-semibold ${getSuccessRateColor(stats.successRate)}`}>
                      {formatPercentage(stats.successRate)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};