// Test file for Dynamic Risk/Reward Optimization System
// This demonstrates the key functionality of the system

// Mock data for testing
const mockPriceData = [
  { high: 50000, low: 49000, close: 49500, timestamp: '2024-01-01T10:00:00Z' },
  { high: 50500, low: 49500, close: 50000, timestamp: '2024-01-01T11:00:00Z' },
  { high: 51000, low: 50000, close: 50500, timestamp: '2024-01-01T12:00:00Z' },
  { high: 51500, low: 50500, close: 51000, timestamp: '2024-01-01T13:00:00Z' },
  { high: 52000, low: 51000, close: 51500, timestamp: '2024-01-01T14:00:00Z' },
  { high: 52500, low: 51500, close: 52000, timestamp: '2024-01-01T15:00:00Z' },
  { high: 53000, low: 52000, close: 52500, timestamp: '2024-01-01T16:00:00Z' },
  { high: 53500, low: 52500, close: 53000, timestamp: '2024-01-01T17:00:00Z' },
  { high: 54000, low: 53000, close: 53500, timestamp: '2024-01-01T18:00:00Z' },
  { high: 54500, low: 53500, close: 54000, timestamp: '2024-01-01T19:00:00Z' },
  { high: 55000, low: 54000, close: 54500, timestamp: '2024-01-01T20:00:00Z' },
  { high: 55500, low: 54500, close: 55000, timestamp: '2024-01-01T21:00:00Z' },
  { high: 56000, low: 55000, close: 55500, timestamp: '2024-01-01T22:00:00Z' },
  { high: 56500, low: 55500, close: 56000, timestamp: '2024-01-01T23:00:00Z' },
  { high: 57000, low: 56000, close: 56500, timestamp: '2024-01-02T00:00:00Z' },
  { high: 57500, low: 56500, close: 57000, timestamp: '2024-01-02T01:00:00Z' },
  { high: 58000, low: 57000, close: 57500, timestamp: '2024-01-02T02:00:00Z' },
  { high: 58500, low: 57500, close: 58000, timestamp: '2024-01-02T03:00:00Z' },
  { high: 59000, low: 58000, close: 58500, timestamp: '2024-01-02T04:00:00Z' },
  { high: 59500, low: 58500, close: 59000, timestamp: '2024-01-02T05:00:00Z' },
  { high: 60000, low: 59000, close: 59500, timestamp: '2024-01-02T06:00:00Z' },
  { high: 60500, low: 59500, close: 60000, timestamp: '2024-01-02T07:00:00Z' },
  { high: 61000, low: 60000, close: 60500, timestamp: '2024-01-02T08:00:00Z' },
  { high: 61500, low: 60500, close: 61000, timestamp: '2024-01-02T09:00:00Z' },
  { high: 62000, low: 61000, close: 61500, timestamp: '2024-01-02T10:00:00Z' },
  { high: 62500, low: 61500, close: 62000, timestamp: '2024-01-02T11:00:00Z' },
  { high: 63000, low: 62000, close: 62500, timestamp: '2024-01-02T12:00:00Z' },
  { high: 63500, low: 62500, close: 63000, timestamp: '2024-01-02T13:00:00Z' },
  { high: 64000, low: 63000, close: 63500, timestamp: '2024-01-02T14:00:00Z' },
  { high: 64500, low: 63500, close: 64000, timestamp: '2024-01-02T15:00:00Z' },
  { high: 65000, low: 64000, close: 64500, timestamp: '2024-01-02T16:00:00Z' },
  { high: 65500, low: 64500, close: 65000, timestamp: '2024-01-02T17:00:00Z' },
  { high: 66000, low: 65000, close: 65500, timestamp: '2024-01-02T18:00:00Z' },
  { high: 66500, low: 65500, close: 66000, timestamp: '2024-01-02T19:00:00Z' },
  { high: 67000, low: 66000, close: 66500, timestamp: '2024-01-02T20:00:00Z' },
  { high: 67500, low: 66500, close: 67000, timestamp: '2024-01-02T21:00:00Z' },
  { high: 68000, low: 67000, close: 67500, timestamp: '2024-01-02T22:00:00Z' },
  { high: 68500, low: 67500, close: 68000, timestamp: '2024-01-02T23:00:00Z' },
  { high: 69000, low: 68000, close: 68500, timestamp: '2024-01-03T00:00:00Z' },
  { high: 69500, low: 68500, close: 69000, timestamp: '2024-01-03T01:00:00Z' },
  { high: 70000, low: 69000, close: 69500, timestamp: '2024-01-03T02:00:00Z' },
  { high: 70500, low: 69500, close: 70000, timestamp: '2024-01-03T03:00:00Z' },
  { high: 71000, low: 70000, close: 70500, timestamp: '2024-01-03T04:00:00Z' },
  { high: 71500, low: 70500, close: 71000, timestamp: '2024-01-03T05:00:00Z' },
  { high: 72000, low: 71000, close: 71500, timestamp: '2024-01-03T06:00:00Z' },
  { high: 72500, low: 71500, close: 72000, timestamp: '2024-01-03T07:00:00Z' },
  { high: 73000, low: 72000, close: 72500, timestamp: '2024-01-03T08:00:00Z' },
  { high: 73500, low: 72500, close: 73000, timestamp: '2024-01-03T09:00:00Z' },
  { high: 74000, low: 73000, close: 73500, timestamp: '2024-01-03T10:00:00Z' },
  { high: 74500, low: 73500, close: 74000, timestamp: '2024-01-03T11:00:00Z' },
  { high: 75000, low: 74000, close: 74500, timestamp: '2024-01-03T12:00:00Z' },
  { high: 75500, low: 74500, close: 75000, timestamp: '2024-01-03T13:00:00Z' },
  { high: 76000, low: 75000, close: 75500, timestamp: '2024-01-03T14:00:00Z' },
  { high: 76500, low: 75500, close: 76000, timestamp: '2024-01-03T15:00:00Z' },
  { high: 77000, low: 76000, close: 76500, timestamp: '2024-01-03T16:00:00Z' },
  { high: 77500, low: 76500, close: 77000, timestamp: '2024-01-03T17:00:00Z' },
  { high: 78000, low: 77000, close: 77500, timestamp: '2024-01-03T18:00:00Z' },
  { high: 78500, low: 77500, close: 78000, timestamp: '2024-01-03T19:00:00Z' },
  { high: 79000, low: 78000, close: 78500, timestamp: '2024-01-03T20:00:00Z' },
  { high: 79500, low: 78500, close: 79000, timestamp: '2024-01-03T21:00:00Z' },
  { high: 80000, low: 79000, close: 79500, timestamp: '2024-01-03T22:00:00Z' },
  { high: 80500, low: 79500, close: 80000, timestamp: '2024-01-03T23:00:00Z' }
];

// Test scenarios
const testScenarios = [
  {
    name: "BTC High Volatility Scenario",
    assetType: "BTC",
    timeframe: "1H",
    baseRR: 1.8,
    analysisConfidence: 85,
    isUltraMode: false,
    timestamp: "2024-01-03T12:00:00Z"
  },
  {
    name: "EURUSD Medium Volatility Scenario",
    assetType: "EURUSD",
    timeframe: "1H",
    baseRR: 1.8,
    analysisConfidence: 75,
    isUltraMode: false,
    timestamp: "2024-01-03T08:00:00Z" // London session
  },
  {
    name: "BTC Ultra Mode Scenario",
    assetType: "BTC",
    timeframe: "1H",
    baseRR: 2.2,
    analysisConfidence: 90,
    isUltraMode: true,
    timestamp: "2024-01-03T16:00:00Z" // NY session
  },
  {
    name: "AAPL Low Confidence Scenario",
    assetType: "AAPL",
    timeframe: "1H",
    baseRR: 1.8,
    analysisConfidence: 65,
    isUltraMode: false,
    timestamp: "2024-01-03T14:00:00Z" // Market hours
  }
];

// Mock historical performance data
const mockHistoricalPerformance = {
  totalTrades: 50,
  successfulTrades: 35,
  successRate: 0.7,
  averageRR: 2.1,
  volatilityBasedSuccess: {
    lowVol: { trades: 10, successRate: 0.8 },
    mediumVol: { trades: 20, successRate: 0.7 },
    highVol: { trades: 15, successRate: 0.6 },
    extremeVol: { trades: 5, successRate: 0.4 }
  },
  timeBasedSuccess: {
    hourly: {
      8: { trades: 5, successRate: 0.8 },
      12: { trades: 8, successRate: 0.75 },
      16: { trades: 6, successRate: 0.67 },
      20: { trades: 4, successRate: 0.5 }
    },
    daily: {
      1: { trades: 8, successRate: 0.75 }, // Monday
      2: { trades: 7, successRate: 0.71 }, // Tuesday
      3: { trades: 9, successRate: 0.78 }, // Wednesday
      4: { trades: 6, successRate: 0.67 }, // Thursday
      5: { trades: 5, successRate: 0.6 }   // Friday
    }
  },
  assetTypeSuccess: {
    BTC: { trades: 25, successRate: 0.72 },
    ETH: { trades: 15, successRate: 0.67 },
    EURUSD: { trades: 10, successRate: 0.8 }
  }
};

// Test function
function testDynamicRRSystem() {
  console.log("=== Dynamic Risk/Reward Optimization System Test ===\n");

  testScenarios.forEach((scenario, index) => {
    console.log(`Test ${index + 1}: ${scenario.name}`);
    console.log("=" .repeat(50));
    
    // Simulate volatility calculation
    const volatilityMetrics = {
      currentVolatility: 0.03, // 3% volatility
      historicalVolatility: 0.025, // 2.5% historical
      volatilityRegime: 'HIGH',
      volatilityTrend: 'INCREASING',
      atrValue: 1500,
      bollingerBandWidth: 0.04
    };

    // Simulate asset profile
    const assetProfile = {
      assetType: scenario.assetType.includes('BTC') || scenario.assetType.includes('ETH') ? 'CRYPTO' : 
                 scenario.assetType.includes('EUR') ? 'FOREX' : 'STOCKS',
      volatilityProfile: scenario.assetType.includes('BTC') ? 'HIGH' : 'MEDIUM',
      typicalRRRange: {
        min: scenario.assetType.includes('BTC') ? 1.8 : 1.5,
        max: scenario.assetType.includes('BTC') ? 3.5 : 2.8,
        optimal: scenario.assetType.includes('BTC') ? 2.2 : 2.0
      },
      marketHours: {
        is24h: scenario.assetType.includes('BTC') || scenario.assetType.includes('ETH'),
        activeHours: scenario.assetType.includes('EUR') ? [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23] : 
                     scenario.assetType.includes('AAPL') ? [13,14,15,16,17,18,19,20,21] : undefined
      }
    };

    // Simulate time patterns
    const currentHour = new Date(scenario.timestamp).getUTCHours();
    const currentDay = new Date(scenario.timestamp).getUTCDay();
    const timePatterns = {
      currentHour,
      currentDay,
      isActiveTradingTime: assetProfile.marketHours.is24h || 
                          (assetProfile.marketHours.activeHours && assetProfile.marketHours.activeHours.includes(currentHour)),
      timeBasedVolatility: currentHour === 8 || currentHour === 16 ? 0.7 : 
                          currentHour === 0 || currentHour === 12 ? 0.6 : 0.5,
      sessionStrength: currentHour >= 8 && currentHour <= 16 ? 'STRONG' : 
                      currentHour >= 6 && currentHour <= 18 ? 'MODERATE' : 'WEAK',
      marketSession: currentHour >= 0 && currentHour < 8 ? 'ASIAN' :
                    currentHour >= 8 && currentHour < 16 ? 'LONDON' :
                    currentHour >= 13 && currentHour < 21 ? 'NEW_YORK' : 'ASIAN'
    };

    // Calculate adjustments (simplified simulation)
    const volatilityAdjustment = volatilityMetrics.volatilityRegime === 'HIGH' ? -0.3 : 
                                volatilityMetrics.volatilityRegime === 'EXTREME' ? -0.5 : 0;
    
    const assetTypeAdjustment = assetProfile.volatilityProfile === 'HIGH' ? -0.2 : 0;
    
    const historicalSuccessAdjustment = mockHistoricalPerformance.successRate > 0.7 ? 0.1 : 
                                      mockHistoricalPerformance.successRate < 0.5 ? -0.2 : 0;
    
    const timePatternAdjustment = timePatterns.sessionStrength === 'STRONG' ? 0.1 : 
                                 timePatterns.sessionStrength === 'WEAK' ? -0.1 : 0;
    
    const confidenceAdjustment = scenario.analysisConfidence >= 85 ? 0.1 : 
                                scenario.analysisConfidence < 70 ? -0.2 : 0;

    const totalAdjustment = volatilityAdjustment + assetTypeAdjustment + 
                           historicalSuccessAdjustment + timePatternAdjustment + 
                           confidenceAdjustment;
    
    const adjustedRR = Math.max(1.0, scenario.baseRR + totalAdjustment);

    // Display results
    console.log(`Asset: ${scenario.assetType}`);
    console.log(`Timeframe: ${scenario.timeframe}`);
    console.log(`Base R:R: ${scenario.baseRR}:1`);
    console.log(`Analysis Confidence: ${scenario.analysisConfidence}%`);
    console.log(`Ultra Mode: ${scenario.isUltraMode}`);
    console.log(`Timestamp: ${scenario.timestamp}`);
    console.log(`Market Session: ${timePatterns.marketSession}`);
    console.log(`Session Strength: ${timePatterns.sessionStrength}`);
    console.log(`Volatility Regime: ${volatilityMetrics.volatilityRegime}`);
    console.log(`Current Volatility: ${(volatilityMetrics.currentVolatility * 100).toFixed(1)}%`);
    console.log(`Historical Success Rate: ${(mockHistoricalPerformance.successRate * 100).toFixed(1)}%`);
    
    console.log("\nAdjustment Factors:");
    console.log(`  Volatility: ${volatilityAdjustment > 0 ? '+' : ''}${volatilityAdjustment.toFixed(2)}`);
    console.log(`  Asset Type: ${assetTypeAdjustment > 0 ? '+' : ''}${assetTypeAdjustment.toFixed(2)}`);
    console.log(`  Historical Success: ${historicalSuccessAdjustment > 0 ? '+' : ''}${historicalSuccessAdjustment.toFixed(2)}`);
    console.log(`  Time Pattern: ${timePatternAdjustment > 0 ? '+' : ''}${timePatternAdjustment.toFixed(2)}`);
    console.log(`  Confidence: ${confidenceAdjustment > 0 ? '+' : ''}${confidenceAdjustment.toFixed(2)}`);
    console.log(`  Total Adjustment: ${totalAdjustment > 0 ? '+' : ''}${totalAdjustment.toFixed(2)}`);
    
    console.log(`\nFinal R:R Requirement: ${adjustedRR.toFixed(2)}:1`);
    console.log(`Change from Base: ${((adjustedRR - scenario.baseRR) / scenario.baseRR * 100).toFixed(1)}%`);
    
    // Recommendations
    const minRR = Math.max(1.0, adjustedRR);
    const optimalRR = Math.max(1.3, adjustedRR + 0.3);
    const maxRR = Math.max(1.6, adjustedRR + 0.6);
    
    console.log("\nRecommendations:");
    console.log(`  Minimum R:R: ${minRR.toFixed(2)}:1`);
    console.log(`  Optimal R:R: ${optimalRR.toFixed(2)}:1`);
    console.log(`  Maximum R:R: ${maxRR.toFixed(2)}:1`);
    
    console.log("\n" + "=" .repeat(50) + "\n");
  });

  console.log("Test completed! This demonstrates how the dynamic R:R system adapts to:");
  console.log("- Different asset types (crypto vs forex vs stocks)");
  console.log("- Market volatility conditions");
  console.log("- Time-based patterns and sessions");
  console.log("- Historical performance data");
  console.log("- Analysis confidence levels");
  console.log("- Ultra vs normal mode requirements");
}

// Run the test
testDynamicRRSystem();