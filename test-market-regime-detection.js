// Market Regime Detection Demo Script
// This script demonstrates the capabilities of the new Market Regime Detection system

import { MarketRegimeDetectionService } from './services/marketRegimeDetectionService.js';

// Create an instance of the regime detection service
const regimeDetector = new MarketRegimeDetectionService();

// Helper function to generate realistic price data for different market scenarios
function generateMarketScenario(scenario, periods = 100) {
    const prices = [];
    const volumes = [];
    let basePrice = 50000; // Starting price
    
    for (let i = 0; i < periods; i++) {
        let change = 0;
        let volumeMultiplier = 1;
        
        switch (scenario) {
            case 'bull_trending':
                // Strong upward trend with increasing volatility
                change = (Math.random() * 0.04 + 0.01); // 1-5% gains
                volumeMultiplier = 1 + (i / periods) * 2; // Increasing volume
                break;
                
            case 'bear_trending':
                // Strong downward trend
                change = -(Math.random() * 0.04 + 0.01); // 1-5% losses
                volumeMultiplier = 1 + (i / periods) * 1.5;
                break;
                
            case 'bull_ranging':
                // Sideways movement with slight upward bias
                change = (Math.random() - 0.48) * 0.02; // Slight bullish bias
                volumeMultiplier = 0.7 + Math.random() * 0.6; // Lower volume
                break;
                
            case 'bear_ranging':
                // Sideways movement with slight downward bias
                change = (Math.random() - 0.52) * 0.02; // Slight bearish bias
                volumeMultiplier = 0.7 + Math.random() * 0.6;
                break;
                
            case 'high_volatility':
                // High volatility choppy market
                change = (Math.random() - 0.5) * 0.08; // ±4% swings
                volumeMultiplier = 0.5 + Math.random() * 2; // Varying volume
                break;
                
            case 'low_volatility':
                // Low volatility consolidation
                change = (Math.random() - 0.5) * 0.005; // ±0.25% moves
                volumeMultiplier = 0.8 + Math.random() * 0.4; // Steady volume
                break;
                
            default:
                change = (Math.random() - 0.5) * 0.02;
                volumeMultiplier = 1;
        }
        
        basePrice *= (1 + change);
        prices.push(basePrice);
        
        const baseVolume = 1000000;
        volumes.push(baseVolume * volumeMultiplier);
    }
    
    return { prices, volumes };
}

// Test different market scenarios
async function runRegimeDetectionDemo() {
    console.log('🔍 Market Regime Detection System Demo\n');
    console.log('=========================================\n');
    
    const scenarios = [
        'bull_trending',
        'bear_trending', 
        'bull_ranging',
        'bear_ranging',
        'high_volatility',
        'low_volatility'
    ];
    
    for (const scenario of scenarios) {
        console.log(`📊 Testing scenario: ${scenario.toUpperCase().replace('_', ' ')}`);
        console.log('─'.repeat(50));
        
        try {
            // Generate market data for this scenario
            const { prices, volumes } = generateMarketScenario(scenario);
            
            // Detect market regime
            const regimeContext = await regimeDetector.detectMarketRegime(prices, volumes, '1H');
            
            // Display results
            console.log(`🎯 Overall Regime: ${regimeContext.overallRegime}`);
            console.log(`📈 Trend Regime: ${regimeContext.trendRegime}`);
            console.log(`🔄 Direction Regime: ${regimeContext.directionRegime}`);
            console.log(`📊 Volatility Regime: ${regimeContext.volatilityRegime}`);
            console.log(`⚡ Momentum Regime: ${regimeContext.momentumRegime}`);
            console.log(`🎯 Confidence: ${regimeContext.confidence}%`);
            console.log(`🔒 Stability: ${regimeContext.stability}%`);
            
            // Show key metrics
            console.log('\n📋 Key Metrics:');
            console.log(`   • ATR (normalized): ${regimeContext.volatilityMetrics.atrNormalized.toFixed(2)}%`);
            console.log(`   • ADX: ${regimeContext.trendMetrics.adx.toFixed(1)}`);
            console.log(`   • Trend Direction: ${regimeContext.trendMetrics.direction}`);
            console.log(`   • Price Efficiency: ${regimeContext.rangingMetrics.efficiency.toFixed(0)}%`);
            console.log(`   • RSI: ${regimeContext.momentumMetrics.rsi.toFixed(0)}`);
            
            // Show analysis adjustments
            console.log('\n⚙️  Analysis Adjustments:');
            console.log(`   • Risk Multiplier: ${regimeContext.analysisAdjustments.riskMultiplier.toFixed(2)}x`);
            console.log(`   • Stop Loss Adjustment: ${regimeContext.analysisAdjustments.stopLossAdjustment.toFixed(2)}x`);
            console.log(`   • Take Profit Adjustment: ${regimeContext.analysisAdjustments.takeProfitAdjustment.toFixed(2)}x`);
            console.log(`   • Entry Approach: ${regimeContext.analysisAdjustments.entryApproach}`);
            console.log(`   • Timeframe Bias: ${regimeContext.analysisAdjustments.timeframeBias}`);
            
            // Show warnings and opportunities
            if (regimeContext.warnings.length > 0) {
                console.log('\n⚠️  Warnings:');
                regimeContext.warnings.forEach(warning => console.log(`   • ${warning}`));
            }
            
            if (regimeContext.opportunities.length > 0) {
                console.log('\n💡 Opportunities:');
                regimeContext.opportunities.forEach(opportunity => console.log(`   • ${opportunity}`));
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${scenario}:`, error.message);
        }
        
        console.log('\n' + '='.repeat(70) + '\n');
    }
    
    // Test configuration changes
    console.log('🔧 Testing Configuration Changes\n');
    console.log('─'.repeat(50));
    
    // Test with different thresholds
    regimeDetector.updateConfig({
        thresholds: {
            volatility: {
                low: 0.3,
                normal: 1.0,
                high: 2.5,
            },
            trend: {
                weak: 20,
                moderate: 35,
                strong: 55,
            },
            ranging: {
                efficiency: 25,
                consolidation: 65,
            },
        }
    });
    
    console.log('✅ Updated configuration with more sensitive thresholds');
    
    // Test the high volatility scenario again with new config
    const { prices, volumes } = generateMarketScenario('high_volatility');
    const regimeContext = await regimeDetector.detectMarketRegime(prices, volumes, '1H');
    
    console.log('\n📊 High volatility scenario with sensitive thresholds:');
    console.log(`🎯 Overall Regime: ${regimeContext.overallRegime}`);
    console.log(`📊 Volatility Regime: ${regimeContext.volatilityRegime}`);
    console.log(`🎯 Confidence: ${regimeContext.confidence}%`);
    
    // Show regime history
    const history = regimeDetector.getRegimeHistoryData();
    console.log(`\n📚 Regime History: ${history.length} entries`);
    
    console.log('\n🎉 Market Regime Detection Demo Complete!');
}

// Run the demo if this script is executed directly
if (typeof window === 'undefined') {
    runRegimeDetectionDemo().catch(console.error);
}

export { runRegimeDetectionDemo, generateMarketScenario };