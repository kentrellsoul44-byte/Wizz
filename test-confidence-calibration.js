import { ConfidenceCalibrationService } from './services/confidenceCalibrationService.js';

/**
 * Test Enhanced Confidence Calibration System
 * Demonstrates multi-factor confidence scoring with intervals
 */

// Test scenario 1: Strong multi-timeframe confluence
const strongConfluenceScenario = {
  thinkingProcess: "Strong multi-timeframe analysis...",
  summary: "Bullish breakout with high confluence",
  signal: 'BUY',
  confidence: 'HIGH',
  trade: {
    entryPrice: "45250.00",
    takeProfit: "47500.00", 
    stopLoss: "44000.00"
  },
  overallConfidenceScore: 85,
  multiTimeframeContext: {
    primaryTimeframe: '4H',
    timeframeAnalyses: [
      { timeframe: '1D', trend: 'BULLISH', confidence: 88 },
      { timeframe: '4H', trend: 'BULLISH', confidence: 82 },
      { timeframe: '1H', trend: 'BULLISH', confidence: 79 }
    ],
    overallTrend: 'BULLISH',
    confluenceScore: 85,
    conflictingSignals: []
  },
  smcAnalysis: {
    overallStructure: 'BULLISH_STRUCTURE',
    tradingBias: {
      direction: 'BULLISH',
      confidence: 78,
      reasoning: 'Clear bullish structure with order block support'
    },
    confluences: {
      orderBlockConfluence: [{}, {}], // 2 confluent order blocks
      fvgConfluence: [{}], // 1 FVG
      liquidityConfluence: [{}, {}, {}] // 3 liquidity levels
    },
    criticalLevels: {
      highestProbabilityZones: [{}, {}, {}],
      liquidityTargets: [{}, {}],
      structuralSupports: [{}, {}],
      structuralResistances: [{}]
    },
    riskAssessment: {
      liquidityRisks: [],
      structuralRisks: ['Minor resistance overhead'],
      recommendations: []
    }
  },
  patternAnalysis: {
    patternConfluence: {
      confidenceScore: 82,
      overallBias: 'BULLISH'
    },
    marketCondition: {
      trend: 'STRONG_UPTREND',
      volatility: 'MEDIUM',
      phase: 'MARKUP'
    },
    harmonicPatterns: [
      { status: 'COMPLETED', validity: 85 }
    ],
    classicPatterns: [
      { reliability: 78, volume: { breakoutVolume: 'CONFIRMED', patternVolume: 'INCREASING' } }
    ],
    conflictingPatterns: [],
    volumeProfile: {
      marketStructure: { balanced: false, trending: true, rotational: false },
      tradingImplications: { acceptance: true, support: [{}, {}, {}], resistance: [{}] }
    },
    wyckoffAnalysis: {
      volumeCharacteristics: {
        climacticVolume: true,
        volumeConfirmation: true,
        volumeDrying: false
      }
    }
  },
  quickProfitAnalysis: {
    marketConditions: {
      volatility: 'MEDIUM',
      trendStrength: 'STRONG',
      supportResistanceDistance: 'FAR',
      recentPriceAction: 'BREAKOUT'
    }
  }
};

// Test scenario 2: Weak signal with high volatility
const weakVolatileScenario = {
  thinkingProcess: "Mixed signals in volatile market...",
  summary: "Uncertain conditions with conflicting signals",
  signal: 'NEUTRAL',
  confidence: 'LOW',
  trade: null,
  overallConfidenceScore: 45,
  multiTimeframeContext: {
    primaryTimeframe: '4H',
    timeframeAnalyses: [
      { timeframe: '1D', trend: 'NEUTRAL', confidence: 55 },
      { timeframe: '4H', trend: 'BEARISH', confidence: 48 },
      { timeframe: '1H', trend: 'BULLISH', confidence: 52 }
    ],
    overallTrend: 'MIXED',
    confluenceScore: 35,
    conflictingSignals: ['Timeframe divergence', 'Mixed momentum signals']
  },
  smcAnalysis: {
    overallStructure: 'TRANSITIONAL',
    tradingBias: {
      direction: 'NEUTRAL',
      confidence: 42,
      reasoning: 'Transitional structure with unclear bias'
    },
    confluences: {
      orderBlockConfluence: [],
      fvgConfluence: [],
      liquidityConfluence: [{}] // Only 1 liquidity level
    },
    criticalLevels: {
      highestProbabilityZones: [{}],
      liquidityTargets: [],
      structuralSupports: [{}],
      structuralResistances: [{}]
    },
    riskAssessment: {
      liquidityRisks: ['Multiple liquidity sweeps possible', 'Unclear direction'],
      structuralRisks: ['Structure break imminent', 'No clear invalidation'],
      recommendations: ['Wait for clearer structure']
    }
  },
  patternAnalysis: {
    patternConfluence: {
      confidenceScore: 38,
      overallBias: 'MIXED'
    },
    marketCondition: {
      trend: 'SIDEWAYS',
      volatility: 'HIGH',
      phase: 'DISTRIBUTION'
    },
    harmonicPatterns: [],
    classicPatterns: [
      { reliability: 45, volume: { breakoutVolume: 'WEAK', patternVolume: 'DECREASING' } }
    ],
    conflictingPatterns: ['Double top vs ascending triangle', 'Volume divergence'],
    volumeProfile: {
      marketStructure: { balanced: true, trending: false, rotational: true },
      tradingImplications: { acceptance: false, support: [{}], resistance: [{}] }
    },
    wyckoffAnalysis: {
      volumeCharacteristics: {
        climacticVolume: false,
        volumeConfirmation: false,
        volumeDrying: true
      }
    }
  },
  quickProfitAnalysis: {
    marketConditions: {
      volatility: 'HIGH',
      trendStrength: 'WEAK',
      supportResistanceDistance: 'CLOSE',
      recentPriceAction: 'CONSOLIDATING'
    }
  }
};

// Test scenario 3: Ultra mode with high standards
const ultraModeScenario = {
  thinkingProcess: "Ultra mode analysis with stringent criteria...",
  summary: "High-probability setup meeting ultra mode standards",
  signal: 'SELL',
  confidence: 'HIGH',
  trade: {
    entryPrice: "45250.00",
    takeProfit: "42800.00",
    stopLoss: "46200.00"
  },
  overallConfidenceScore: 92,
  multiTimeframeContext: {
    primaryTimeframe: '4H',
    timeframeAnalyses: [
      { timeframe: '1W', trend: 'BEARISH', confidence: 95 },
      { timeframe: '1D', trend: 'BEARISH', confidence: 89 },
      { timeframe: '4H', trend: 'BEARISH', confidence: 88 }
    ],
    overallTrend: 'BEARISH',
    confluenceScore: 92,
    conflictingSignals: []
  },
  smcAnalysis: {
    overallStructure: 'BEARISH_STRUCTURE',
    tradingBias: {
      direction: 'BEARISH',
      confidence: 91,
      reasoning: 'Perfect bearish structure with multiple confirmations'
    },
    confluences: {
      orderBlockConfluence: [{}, {}, {}], // 3 confluent order blocks
      fvgConfluence: [{}, {}], // 2 FVGs
      liquidityConfluence: [{}, {}, {}, {}] // 4 liquidity levels
    },
    criticalLevels: {
      highestProbabilityZones: [{}, {}, {}, {}],
      liquidityTargets: [{}, {}, {}],
      structuralSupports: [{}, {}],
      structuralResistances: [{}, {}, {}]
    },
    riskAssessment: {
      liquidityRisks: [],
      structuralRisks: [],
      recommendations: ['High probability short setup']
    }
  },
  patternAnalysis: {
    patternConfluence: {
      confidenceScore: 94,
      overallBias: 'BEARISH'
    },
    marketCondition: {
      trend: 'STRONG_DOWNTREND',
      volatility: 'LOW',
      phase: 'MARKDOWN'
    },
    harmonicPatterns: [
      { status: 'COMPLETED', validity: 92 },
      { status: 'COMPLETED', validity: 88 }
    ],
    classicPatterns: [
      { reliability: 89, volume: { breakoutVolume: 'CONFIRMED', patternVolume: 'INCREASING' } }
    ],
    conflictingPatterns: [],
    volumeProfile: {
      marketStructure: { balanced: false, trending: true, rotational: false },
      tradingImplications: { acceptance: true, support: [{}], resistance: [{}, {}, {}] }
    },
    wyckoffAnalysis: {
      volumeCharacteristics: {
        climacticVolume: true,
        volumeConfirmation: true,
        volumeDrying: false
      }
    }
  },
  quickProfitAnalysis: {
    marketConditions: {
      volatility: 'LOW',
      trendStrength: 'VERY_STRONG',
      supportResistanceDistance: 'FAR',
      recentPriceAction: 'BREAKOUT'
    }
  }
};

console.log('🧪 Enhanced Confidence Calibration System Test\n');
console.log('='.repeat(60));

// Test all scenarios
const scenarios = [
  { name: 'Strong Multi-Timeframe Confluence', data: strongConfluenceScenario, ultraMode: false },
  { name: 'Weak Volatile Market Conditions', data: weakVolatileScenario, ultraMode: false },
  { name: 'Ultra Mode High Standards', data: ultraModeScenario, ultraMode: true }
];

scenarios.forEach((scenario, index) => {
  console.log(`\n${index + 1}. ${scenario.name}`);
  console.log('-'.repeat(50));
  
  try {
    const calibratedConfidence = ConfidenceCalibrationService.calibrateConfidence(
      scenario.data,
      scenario.ultraMode
    );
    
    console.log(`Original Score: ${scenario.data.overallConfidenceScore}%`);
    console.log(`Calibrated Score: ${calibratedConfidence.overallScore}%`);
    console.log(`Confidence Interval: ${calibratedConfidence.interval.lowerBound}% - ${calibratedConfidence.interval.upperBound}%`);
    console.log(`Uncertainty: ±${calibratedConfidence.interval.uncertainty}%`);
    console.log(`Reliability: ${calibratedConfidence.interval.reliability}`);
    console.log(`Confidence Level: ${ConfidenceCalibrationService.getConfidenceLevel(calibratedConfidence, scenario.ultraMode)}`);
    
    console.log('\nFactor Breakdown:');
    console.log(`  Technical Confluence: ${calibratedConfidence.factors.technicalConfluence}%`);
    console.log(`  Historical Patterns: ${calibratedConfidence.factors.historicalPatternSuccess}%`);
    console.log(`  Market Conditions: ${calibratedConfidence.factors.marketConditions}%`);
    console.log(`  Volatility Adjustment: ${calibratedConfidence.factors.volatilityAdjustment}%`);
    console.log(`  Volume Confirmation: ${calibratedConfidence.factors.volumeConfirmation}%`);
    console.log(`  Structural Integrity: ${calibratedConfidence.factors.structuralIntegrity}%`);
    
    console.log('\nQuality Metrics:');
    console.log(`  Data Quality: ${calibratedConfidence.breakdown.qualityMetrics.dataQuality}%`);
    console.log(`  Signal Clarity: ${calibratedConfidence.breakdown.qualityMetrics.signalClarity}%`);
    console.log(`  Market Noise: ${calibratedConfidence.breakdown.qualityMetrics.marketNoise}%`);
    
    console.log('\nHistorical Context:');
    console.log(`  Similar Patterns: ${calibratedConfidence.historicalContext.similarPatternCount}`);
    console.log(`  Success Rate: ${calibratedConfidence.historicalContext.successRate}%`);
    console.log(`  Avg Win: +${calibratedConfidence.historicalContext.avgReturnOnSuccess}%`);
    console.log(`  Avg Loss: ${calibratedConfidence.historicalContext.avgLossOnFailure}%`);
    
    if (calibratedConfidence.riskAdjustments.volatilityPenalty > 0 || 
        calibratedConfidence.riskAdjustments.liquidityDiscount > 0 || 
        calibratedConfidence.riskAdjustments.newsRisk > 0) {
      console.log('\nRisk Adjustments:');
      if (calibratedConfidence.riskAdjustments.volatilityPenalty > 0) {
        console.log(`  Volatility Penalty: -${calibratedConfidence.riskAdjustments.volatilityPenalty}%`);
      }
      if (calibratedConfidence.riskAdjustments.liquidityDiscount > 0) {
        console.log(`  Liquidity Discount: -${calibratedConfidence.riskAdjustments.liquidityDiscount}%`);
      }
      if (calibratedConfidence.riskAdjustments.newsRisk > 0) {
        console.log(`  News Risk: -${calibratedConfidence.riskAdjustments.newsRisk}%`);
      }
    }
    
    console.log(`\nFormatted Display: ${ConfidenceCalibrationService.formatConfidenceDisplay(calibratedConfidence)}`);
    
  } catch (error) {
    console.error(`Error in scenario "${scenario.name}":`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Enhanced Confidence Calibration System Test Complete\n');

console.log('🆕 Key Improvements Implemented:');
console.log('• Multi-factor confidence scoring (6 factors)');
console.log('• Technical confluence weight calculation');
console.log('• Historical pattern success rate tracking');
console.log('• Market conditions factor analysis');
console.log('• Volatility adjustment calculations');
console.log('• Confidence intervals with uncertainty ranges (e.g., "75% ±10%")');
console.log('• Quality metrics assessment');
console.log('• Risk adjustments for various market conditions');
console.log('• Enhanced UI component with detailed breakdown');
console.log('• Integration with existing analysis pipeline');

console.log('\n🎯 Benefits:');
console.log('• More accurate confidence assessment');
console.log('• Statistical uncertainty quantification');
console.log('• Better risk management through adjusted scoring');
console.log('• Transparent factor breakdown for decision making');
console.log('• Historical context for pattern validation');
console.log('• Real-time market condition awareness');