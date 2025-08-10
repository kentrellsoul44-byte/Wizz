// Simple test for Quick Profit Service
import { QuickProfitService } from './services/quickProfitService.js';

// Mock analysis result for testing
const mockAnalysisResult = {
  signal: 'BUY',
  confidence: 'HIGH',
  overallConfidenceScore: 85,
  trade: {
    entryPrice: '50000',
    takeProfit: '55000',
    stopLoss: '48000'
  },
  patternAnalysis: {
    patternConfluence: {
      confidenceScore: 80
    },
    marketCondition: {
      volatility: 'MEDIUM'
    }
  }
};

console.log('Testing Quick Profit Service...\n');

// Test Quick Profit analysis
const quickProfitAnalysis = QuickProfitService.analyzeQuickProfitPercentage(mockAnalysisResult);
console.log('Quick Profit Analysis:', JSON.stringify(quickProfitAnalysis, null, 2));

// Test applying Quick Profit to trade
const updatedTrade = QuickProfitService.applyQuickProfitToTrade(mockAnalysisResult.trade, quickProfitAnalysis.recommendedPercentage);
console.log('\nUpdated Trade:', JSON.stringify(updatedTrade, null, 2));

console.log('\nTest completed successfully!');