import { StopLossIntelligenceService } from './services/stopLossIntelligenceService.js';

/**
 * Comprehensive test and demonstration of the Stop-Loss Intelligence system
 * This showcases AI-powered stop optimization, ATR-based dynamic stops, 
 * support/resistance analysis, liquidity pool avoidance, and time-based adjustments.
 */

// Mock market data for testing
const generateMockPriceData = (startPrice = 50000, periods = 200) => {
  const data = [];
  let price = startPrice;
  const baseTime = Date.now() - (periods * 60 * 60 * 1000); // Start N hours ago
  
  for (let i = 0; i < periods; i++) {
    const timestamp = new Date(baseTime + (i * 60 * 60 * 1000)).toISOString(); // Hourly data
    
    // Generate realistic OHLCV data with some volatility patterns
    const volatility = 0.02 + (Math.sin(i / 20) * 0.01); // Cyclical volatility
    const change = (Math.random() - 0.5) * volatility;
    
    price = price * (1 + change);
    const high = price * (1 + Math.random() * 0.01);
    const low = price * (1 - Math.random() * 0.01);
    const volume = Math.floor(Math.random() * 100000) + 50000;
    
    data.push({
      timestamp,
      open: price,
      high,
      low,
      close: price,
      volume
    });
  }
  
  return data;
};

// Test scenario configurations
const testScenarios = [
  {
    name: "Bitcoin Long Entry - High Volatility",
    request: {
      entryPrice: 52000,
      currentPrice: 52500,
      tradeDirection: 'BUY',
      timeframe: '1H',
      asset: 'BTC/USD',
      marketData: {
        priceHistory: generateMockPriceData(50000, 200),
        recentCandles: 100
      },
      preferences: {
        riskTolerance: 'MODERATE',
        preferredStopType: ['ATR_DYNAMIC', 'SUPPORT_RESISTANCE'],
        maxRiskPercent: 2.0,
        minRiskRewardRatio: 2.5,
        allowDynamicAdjustment: true
      },
      context: {
        smcAnalysis: {
          tradingBias: {
            direction: 'BULLISH',
            confidence: 85,
            reasoning: 'Strong bullish structure with demand zone support',
            invalidationLevel: 50500
          }
        }
      }
    }
  },
  
  {
    name: "EUR/USD Short Entry - London Session",
    request: {
      entryPrice: 1.0850,
      currentPrice: 1.0820,
      tradeDirection: 'SELL',
      timeframe: '15M',
      asset: 'EUR/USD',
      marketData: {
        priceHistory: generateMockPriceData(1.0900, 150),
        recentCandles: 50
      },
      preferences: {
        riskTolerance: 'CONSERVATIVE',
        preferredStopType: ['LIQUIDITY_AVOIDANCE', 'TIME_ADJUSTED'],
        maxRiskPercent: 1.5,
        minRiskRewardRatio: 3.0,
        allowDynamicAdjustment: true
      }
    }
  },
  
  {
    name: "SPY Long Entry - Low Volatility Environment",
    request: {
      entryPrice: 450.00,
      currentPrice: 452.50,
      tradeDirection: 'BUY',
      timeframe: '4H',
      asset: 'SPY',
      marketData: {
        priceHistory: generateMockPriceData(445, 100),
        recentCandles: 50
      },
      preferences: {
        riskTolerance: 'AGGRESSIVE',
        preferredStopType: ['AI_OPTIMIZED', 'ATR_DYNAMIC'],
        maxRiskPercent: 3.0,
        minRiskRewardRatio: 2.0,
        allowDynamicAdjustment: false
      }
    }
  }
];

/**
 * Run comprehensive tests on the Stop-Loss Intelligence system
 */
async function runStopLossIntelligenceTests() {
  console.log('🧠 Stop-Loss Intelligence System - Comprehensive Testing Suite');
  console.log('=' .repeat(70));
  
  const stopLossService = StopLossIntelligenceService.getInstance();
  
  for (const scenario of testScenarios) {
    console.log(`\n📊 Testing Scenario: ${scenario.name}`);
    console.log('-'.repeat(50));
    
    try {
      // Run stop-loss optimization
      const startTime = Date.now();
      const result = await stopLossService.optimizeStopLoss(scenario.request);
      const processingTime = Date.now() - startTime;
      
      // Display comprehensive results
      displayStopLossAnalysis(result, processingTime);
      
      // Demonstrate dynamic adjustment capabilities
      if (scenario.request.preferences.allowDynamicAdjustment) {
        await demonstrateDynamicAdjustments(result, scenario.request);
      }
      
    } catch (error) {
      console.error(`❌ Error in scenario "${scenario.name}":`, error.message);
    }
  }
  
  // Performance and stress testing
  await runPerformanceTests(stopLossService);
  
  console.log('\n✅ Stop-Loss Intelligence testing complete!');
}

/**
 * Display comprehensive stop-loss analysis results
 */
function displayStopLossAnalysis(result, processingTime) {
  console.log(`⚡ Processing Time: ${processingTime}ms`);
  console.log(`🎯 Trade: ${result.tradeDirection} @ ${result.entryPrice}`);
  console.log(`💰 Current Price: ${result.currentPrice}`);
  
  // Basic Stop Analysis
  console.log('\n📋 Basic Stop Analysis:');
  console.log(`  Price: ${result.basicStop.price.toFixed(2)}`);
  console.log(`  Distance: ${result.basicStop.distance.toFixed(2)} points`);
  console.log(`  R:R Ratio: ${result.basicStop.riskRewardRatio.toFixed(2)}:1`);
  
  // ATR Analysis
  console.log('\n📈 ATR-Based Dynamic Analysis:');
  console.log(`  Current ATR: ${result.atrAnalysis.metrics.current.toFixed(4)}`);
  console.log(`  ATR Trend: ${result.atrAnalysis.metrics.trend}`);
  console.log(`  ATR Percentile: ${result.atrAnalysis.metrics.percentile.toFixed(1)}%`);
  console.log(`  Recommended Stop: ${result.atrAnalysis.recommendedStop.toFixed(2)}`);
  console.log(`  Multiplier Used: ${result.atrAnalysis.multiplier.toFixed(2)}x`);
  console.log(`  Confidence: ${result.atrAnalysis.confidence}%`);
  
  // Support/Resistance Analysis
  console.log('\n🎯 Support/Resistance Analysis:');
  console.log(`  Nearby Levels: ${result.supportResistanceAnalysis.nearbyLevels.length}`);
  if (result.supportResistanceAnalysis.criticalLevel) {
    const level = result.supportResistanceAnalysis.criticalLevel;
    console.log(`  Critical Level: ${level.price.toFixed(2)} (${level.type}, ${level.strength})`);
    console.log(`  Touches: ${level.touches}, Reliability: ${level.reliability}%`);
  }
  console.log(`  Recommended Stop: ${result.supportResistanceAnalysis.recommendedStop.toFixed(2)}`);
  console.log(`  Confidence: ${result.supportResistanceAnalysis.confidence}%`);
  
  // Liquidity Pool Analysis
  console.log('\n🌊 Liquidity Pool Analysis:');
  console.log(`  Detected Pools: ${result.liquidityAnalysis.nearbyPools.length}`);
  console.log(`  Risk Pools: ${result.liquidityAnalysis.riskPools.length}`);
  
  if (result.liquidityAnalysis.riskPools.length > 0) {
    console.log('  ⚠️  High-Risk Pools:');
    result.liquidityAnalysis.riskPools.slice(0, 3).forEach(pool => {
      console.log(`    ${pool.type} @ ${pool.price.toFixed(2)} (${pool.intensity}, ${pool.sweepProbability}% sweep risk)`);
    });
  }
  
  console.log(`  Recommended Stop: ${result.liquidityAnalysis.recommendedStop.toFixed(2)}`);
  console.log(`  Confidence: ${result.liquidityAnalysis.confidence}%`);
  
  // Time-Based Adjustments
  console.log('\n⏰ Time-Based Analysis:');
  console.log(`  Current Session: ${result.timeAdjustments.currentSession.sessionType}`);
  console.log(`  Adjustment Factor: ${result.timeAdjustments.currentSession.adjustmentFactor.toFixed(2)}x`);
  console.log(`  Volatility Expected: ${result.timeAdjustments.currentSession.volatilityExpectation}`);
  console.log(`  Liquidity Expected: ${result.timeAdjustments.currentSession.liquidityExpectation}`);
  console.log(`  Dynamic Adjustment: ${result.timeAdjustments.dynamicAdjustment ? 'YES' : 'NO'}`);
  
  if (result.timeAdjustments.currentSession.newsEvents.length > 0) {
    console.log('  📰 Upcoming News:');
    result.timeAdjustments.currentSession.newsEvents.forEach(event => {
      console.log(`    ${event.type} in ${event.timeToEvent}min (${event.impact} impact)`);
    });
  }
  
  // AI Optimization
  console.log('\n🤖 AI Optimization:');
  console.log(`  Model Version: ${result.aiOptimization.modelVersion}`);
  console.log(`  Recommended Stop: ${result.aiOptimization.recommendedStop.toFixed(2)}`);
  console.log(`  Confidence: ${result.aiOptimization.confidence}%`);
  console.log(`  Reasoning: ${result.aiOptimization.reasoning}`);
  
  // Final Recommendation
  console.log('\n🎯 FINAL RECOMMENDATION:');
  console.log(`  Stop Type: ${result.finalRecommendation.type}`);
  console.log(`  Stop Price: ${result.finalRecommendation.price.toFixed(2)}`);
  console.log(`  Distance: ${result.finalRecommendation.distance.toFixed(2)} points`);
  console.log(`  Risk:Reward: ${result.finalRecommendation.riskRewardRatio.toFixed(2)}:1`);
  console.log(`  Overall Confidence: ${result.finalRecommendation.confidence}%`);
  console.log(`  Reasoning: ${result.finalRecommendation.reasoning}`);
  
  // Risk Assessment
  console.log('\n⚠️  Risk Assessment:');
  console.log(`  Stop Hunting Risk: ${result.riskAssessment.stopHuntingRisk}`);
  console.log(`  Gap Risk: ${result.riskAssessment.gapRisk}`);
  console.log(`  Liquidity Risk: ${result.riskAssessment.liquidityRisk}`);
  console.log(`  Volatility Risk: ${result.riskAssessment.volatilityRisk}`);
  console.log(`  Overall Risk: ${result.riskAssessment.overallRisk}`);
  
  if (result.riskAssessment.mitigationStrategies.length > 0) {
    console.log('  📋 Mitigation Strategies:');
    result.riskAssessment.mitigationStrategies.forEach((strategy, index) => {
      console.log(`    ${index + 1}. ${strategy}`);
    });
  }
  
  // Monitoring Rules
  console.log('\n👁️  Dynamic Monitoring Rules:');
  const rules = result.finalRecommendation.monitoringRules;
  console.log(`  ATR Change Threshold: ${rules.atrThreshold}%`);
  console.log(`  S/R Proximity Threshold: ${(rules.proximityThreshold * 100).toFixed(1)}%`);
  console.log(`  Time Threshold: ${rules.timeThreshold} minutes`);
  console.log(`  Volatility Spike Threshold: ${rules.volatilityThreshold}%`);
}

/**
 * Demonstrate dynamic stop adjustment capabilities
 */
async function demonstrateDynamicAdjustments(result, request) {
  console.log('\n🔄 Dynamic Adjustment Demonstration:');
  console.log('-'.repeat(30));
  
  // Simulate market conditions changing over time
  const scenarios = [
    { hours: 2, description: 'ATR expansion due to news event', atrMultiplier: 1.5 },
    { hours: 4, description: 'Session change to high volatility period', sessionMultiplier: 1.3 },
    { hours: 6, description: 'Approaching major support level', srProximity: 0.01 },
    { hours: 8, description: 'Liquidity pool sweep detected', liquidityThreat: true }
  ];
  
  scenarios.forEach(scenario => {
    console.log(`\n⏱️  After ${scenario.hours} hours: ${scenario.description}`);
    
    // Calculate adjustment recommendations
    let recommendation = 'MAINTAIN';
    let reasoning = 'No significant changes detected';
    
    if (scenario.atrMultiplier && scenario.atrMultiplier > 1.2) {
      recommendation = 'WIDEN';
      reasoning = `ATR expanded by ${((scenario.atrMultiplier - 1) * 100).toFixed(0)}%, widen stop to accommodate increased volatility`;
    } else if (scenario.sessionMultiplier && scenario.sessionMultiplier > 1.2) {
      recommendation = 'WIDEN';
      reasoning = `High volatility session detected, increase stop distance by ${((scenario.sessionMultiplier - 1) * 100).toFixed(0)}%`;
    } else if (scenario.srProximity && scenario.srProximity < 0.02) {
      recommendation = 'TIGHTEN';
      reasoning = `Approaching strong support/resistance, consider tightening stop`;
    } else if (scenario.liquidityThreat) {
      recommendation = 'ADJUST';
      reasoning = 'Move stop beyond detected liquidity pool to avoid stop hunting';
    }
    
    console.log(`  Recommendation: ${recommendation}`);
    console.log(`  Reasoning: ${reasoning}`);
    
    if (recommendation !== 'MAINTAIN') {
      const adjustedStop = calculateAdjustedStop(result.finalRecommendation.price, scenario, request);
      console.log(`  Suggested New Stop: ${adjustedStop.toFixed(2)}`);
      console.log(`  Risk Change: ${calculateRiskChange(result.finalRecommendation.price, adjustedStop).toFixed(1)}%`);
    }
  });
}

/**
 * Calculate adjusted stop price based on scenario
 */
function calculateAdjustedStop(currentStop, scenario, request) {
  let adjustmentFactor = 1.0;
  
  if (scenario.atrMultiplier) {
    adjustmentFactor *= scenario.atrMultiplier;
  }
  
  if (scenario.sessionMultiplier) {
    adjustmentFactor *= scenario.sessionMultiplier;
  }
  
  if (scenario.srProximity) {
    adjustmentFactor *= 0.9; // Tighten slightly
  }
  
  if (scenario.liquidityThreat) {
    adjustmentFactor *= 1.1; // Move away from liquidity
  }
  
  const stopDistance = Math.abs(request.entryPrice - currentStop);
  const adjustedDistance = stopDistance * adjustmentFactor;
  
  return request.tradeDirection === 'BUY' 
    ? request.entryPrice - adjustedDistance
    : request.entryPrice + adjustedDistance;
}

/**
 * Calculate risk change percentage
 */
function calculateRiskChange(oldStop, newStop) {
  return ((Math.abs(newStop) - Math.abs(oldStop)) / Math.abs(oldStop)) * 100;
}

/**
 * Run performance and stress tests
 */
async function runPerformanceTests(stopLossService) {
  console.log('\n🚀 Performance Testing:');
  console.log('-'.repeat(30));
  
  const iterations = 50;
  const times = [];
  
  console.log(`Running ${iterations} iterations...`);
  
  for (let i = 0; i < iterations; i++) {
    const testRequest = {
      entryPrice: 50000 + (Math.random() * 1000),
      currentPrice: 50000 + (Math.random() * 1000),
      tradeDirection: Math.random() > 0.5 ? 'BUY' : 'SELL',
      timeframe: '1H',
      asset: 'BTC/USD',
      marketData: {
        priceHistory: generateMockPriceData(50000, 100),
        recentCandles: 50
      },
      preferences: {
        riskTolerance: 'MODERATE',
        preferredStopType: ['ATR_DYNAMIC'],
        maxRiskPercent: 2.0,
        minRiskRewardRatio: 2.0,
        allowDynamicAdjustment: false
      }
    };
    
    const startTime = Date.now();
    await stopLossService.optimizeStopLoss(testRequest);
    const endTime = Date.now();
    
    times.push(endTime - startTime);
  }
  
  // Calculate statistics
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  
  console.log(`📊 Performance Results (${iterations} iterations):`);
  console.log(`  Average: ${avgTime.toFixed(1)}ms`);
  console.log(`  Minimum: ${minTime}ms`);
  console.log(`  Maximum: ${maxTime}ms`);
  console.log(`  95th Percentile: ${p95Time}ms`);
  
  // Memory usage estimation
  const memoryUsage = process.memoryUsage();
  console.log(`💾 Memory Usage:`);
  console.log(`  RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`);
}

/**
 * Demonstrate integration with existing trading system
 */
function demonstrateIntegration() {
  console.log('\n🔗 Integration Example:');
  console.log('-'.repeat(30));
  
  const integrationCode = `
// Example integration with existing trading system
import { StopLossIntelligenceService } from './services/stopLossIntelligenceService';

class TradingBot {
  constructor() {
    this.stopLossService = StopLossIntelligenceService.getInstance();
  }
  
  async executeTradeWithIntelligentStop(signal) {
    // 1. Get optimized stop-loss recommendation
    const stopAnalysis = await this.stopLossService.optimizeStopLoss({
      entryPrice: signal.entryPrice,
      currentPrice: this.getCurrentPrice(signal.asset),
      tradeDirection: signal.direction,
      timeframe: signal.timeframe,
      asset: signal.asset,
      marketData: this.getMarketData(signal.asset),
      preferences: this.getUserRiskPreferences(),
      context: {
        smcAnalysis: this.getSmcAnalysis(signal.asset),
        patternAnalysis: this.getPatternAnalysis(signal.asset)
      }
    });
    
    // 2. Execute trade with intelligent stop
    const trade = await this.executeTrade({
      asset: signal.asset,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      stopLoss: stopAnalysis.finalRecommendation.price,
      takeProfit: this.calculateTakeProfit(signal, stopAnalysis),
      riskAmount: this.calculatePositionSize(stopAnalysis)
    });
    
    // 3. Set up dynamic monitoring if recommended
    if (stopAnalysis.timeAdjustments.dynamicAdjustment) {
      this.setupDynamicStopMonitoring(trade, stopAnalysis);
    }
    
    return { trade, stopAnalysis };
  }
  
  setupDynamicStopMonitoring(trade, analysis) {
    const rules = analysis.finalRecommendation.monitoringRules;
    
    // Monitor ATR changes
    this.scheduleATRCheck(trade, rules.atrThreshold);
    
    // Monitor S/R proximity
    this.monitorSRProximity(trade, rules.proximityThreshold);
    
    // Set time-based review
    setTimeout(() => this.reviewStopPlacement(trade), 
               rules.timeThreshold * 60 * 1000);
    
    // Monitor volatility spikes
    this.setupVolatilityAlert(trade, rules.volatilityThreshold);
  }
}
`;
  
  console.log(integrationCode);
}

// Run the comprehensive test suite
if (typeof window === 'undefined') {
  // Node.js environment
  runStopLossIntelligenceTests()
    .then(() => {
      demonstrateIntegration();
      console.log('\n🎉 All tests completed successfully!');
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
    });
}

export { runStopLossIntelligenceTests, demonstrateIntegration };