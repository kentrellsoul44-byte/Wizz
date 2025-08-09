import React from 'react';
import type { DynamicRRResult } from '../services/dynamicRiskRewardService';

interface DynamicRRDisplayProps {
  dynamicRR: DynamicRRResult;
  isVisible: boolean;
  onClose: () => void;
}

export const DynamicRRDisplay: React.FC<DynamicRRDisplayProps> = ({
  dynamicRR,
  isVisible,
  onClose
}) => {
  if (!isVisible) return null;

  const formatAdjustment = (adjustment: number): string => {
    const sign = adjustment >= 0 ? '+' : '';
    return `${sign}${adjustment.toFixed(2)}`;
  };

  const getAdjustmentColor = (adjustment: number): string => {
    if (adjustment > 0) return 'text-green-600';
    if (adjustment < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Dynamic Risk/Reward Analysis
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

        {/* Summary Section */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Base R:R Requirement</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {dynamicRR.baseRR.toFixed(1)}:1
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Adjusted R:R Requirement</p>
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {dynamicRR.adjustedRR.toFixed(1)}:1
              </p>
            </div>
          </div>
        </div>

        {/* Adjustment Factors */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Adjustment Factors
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">Volatility Adjustment</span>
              <span className={`font-mono ${getAdjustmentColor(dynamicRR.adjustmentFactors.volatilityAdjustment)}`}>
                {formatAdjustment(dynamicRR.adjustmentFactors.volatilityAdjustment)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">Asset Type Adjustment</span>
              <span className={`font-mono ${getAdjustmentColor(dynamicRR.adjustmentFactors.assetTypeAdjustment)}`}>
                {formatAdjustment(dynamicRR.adjustmentFactors.assetTypeAdjustment)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">Historical Success Adjustment</span>
              <span className={`font-mono ${getAdjustmentColor(dynamicRR.adjustmentFactors.historicalSuccessAdjustment)}`}>
                {formatAdjustment(dynamicRR.adjustmentFactors.historicalSuccessAdjustment)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">Time Pattern Adjustment</span>
              <span className={`font-mono ${getAdjustmentColor(dynamicRR.adjustmentFactors.timePatternAdjustment)}`}>
                {formatAdjustment(dynamicRR.adjustmentFactors.timePatternAdjustment)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-gray-700 dark:text-gray-300">Confidence Adjustment</span>
              <span className={`font-mono ${getAdjustmentColor(dynamicRR.adjustmentFactors.confidenceAdjustment)}`}>
                {formatAdjustment(dynamicRR.adjustmentFactors.confidenceAdjustment)}
              </span>
            </div>
          </div>
        </div>

        {/* Reasoning */}
        {dynamicRR.reasoning.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Reasoning
            </h3>
            <div className="space-y-2">
              {dynamicRR.reasoning.map((reason, index) => (
                <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final Recommendation */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Final Recommendation
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Minimum R:R</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {dynamicRR.finalRecommendation.minRR.toFixed(1)}:1
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Optimal R:R</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {dynamicRR.finalRecommendation.optimalRR.toFixed(1)}:1
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum R:R</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {dynamicRR.finalRecommendation.maxRR.toFixed(1)}:1
              </p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Confidence Level</p>
            <p className={`text-lg font-semibold ${getConfidenceColor(dynamicRR.finalRecommendation.confidence)}`}>
              {dynamicRR.finalRecommendation.confidence.toFixed(0)}%
            </p>
          </div>
        </div>

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