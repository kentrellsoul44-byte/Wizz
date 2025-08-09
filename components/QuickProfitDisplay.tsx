import React from 'react';
import type { QuickProfitAnalysis } from '../types';

interface QuickProfitDisplayProps {
  analysis: QuickProfitAnalysis;
  isVisible: boolean;
}

export const QuickProfitDisplay: React.FC<QuickProfitDisplayProps> = ({ analysis, isVisible }) => {
  if (!isVisible) return null;

  const getPercentageColor = (percentage: number) => {
    if (percentage === 25) return 'text-green-500';
    if (percentage === 20) return 'text-blue-500';
    if (percentage === 15) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500';
    if (confidence >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getVolatilityColor = (volatility: string) => {
    switch (volatility) {
      case 'LOW': return 'text-green-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'HIGH': return 'text-orange-500';
      case 'EXTREME': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTrendStrengthColor = (strength: string) => {
    switch (strength) {
      case 'VERY_STRONG': return 'text-green-500';
      case 'STRONG': return 'text-blue-500';
      case 'MODERATE': return 'text-yellow-500';
      case 'WEAK': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <span className="mr-2">🚀</span>
          Quick Profit Mode Analysis
        </h3>
        <div className={`text-2xl font-bold ${getPercentageColor(analysis.recommendedPercentage)}`}>
          {analysis.recommendedPercentage}%
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Confidence Score */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Confidence Score</span>
            <span className={`text-lg font-bold ${getConfidenceColor(analysis.confidence)}`}>
              {analysis.confidence}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${analysis.confidence >= 80 ? 'bg-green-500' : analysis.confidence >= 60 ? 'bg-yellow-500' : 'bg-orange-500'}`}
              style={{ width: `${analysis.confidence}%` }}
            ></div>
          </div>
        </div>

        {/* Market Conditions */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Market Conditions</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Volatility:</span>
              <span className={getVolatilityColor(analysis.marketConditions.volatility)}>
                {analysis.marketConditions.volatility}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Trend Strength:</span>
              <span className={getTrendStrengthColor(analysis.marketConditions.trendStrength)}>
                {analysis.marketConditions.trendStrength}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Price Action:</span>
              <span className="text-gray-600">
                {analysis.marketConditions.recentPriceAction}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Analysis Reasoning</h4>
        <div className="text-sm text-gray-600 whitespace-pre-line">
          {analysis.reasoning}
        </div>
      </div>

      {/* Risk Factors and Opportunities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Factors */}
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center">
            <span className="mr-1">⚠️</span>
            Risk Factors
          </h4>
          <ul className="text-sm text-red-600 space-y-1">
            {analysis.riskFactors.map((risk, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-1">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Opportunities */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center">
            <span className="mr-1">💡</span>
            Opportunities
          </h4>
          <ul className="text-sm text-green-600 space-y-1">
            {analysis.opportunities.map((opportunity, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-1">•</span>
                <span>{opportunity}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Profit Mode Info */}
      <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
        <div className="flex items-center text-sm text-blue-700">
          <span className="mr-2">ℹ️</span>
          <span>
            <strong>Quick Profit Mode:</strong> This analysis automatically calculates take-profit levels based on 
            {analysis.recommendedPercentage}% of the entry price, optimized for your chart's market conditions.
          </span>
        </div>
      </div>
    </div>
  );
};