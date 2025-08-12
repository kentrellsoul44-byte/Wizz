import type {
  TimeBasedStopAdjustment,
  TimeframeType
} from '../types';

export class TimeBasedStopAdjustmentService {
  private static instance: TimeBasedStopAdjustmentService;
  private newsEvents: Map<string, any[]> = new Map(); // Would integrate with news feed
  
  public static getInstance(): TimeBasedStopAdjustmentService {
    if (!TimeBasedStopAdjustmentService.instance) {
      TimeBasedStopAdjustmentService.instance = new TimeBasedStopAdjustmentService();
    }
    return TimeBasedStopAdjustmentService.instance;
  }

  /**
   * Get current session-based stop adjustment
   */
  public getCurrentSessionAdjustment(
    timestamp: string = new Date().toISOString(),
    asset: string = 'FOREX'
  ): TimeBasedStopAdjustment {
    const date = new Date(timestamp);
    const currentHour = date.getUTCHours();
    const currentDay = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Determine current session
    const sessionType = this.determineCurrentSession(currentHour, currentDay, asset);
    
    // Calculate session-specific adjustment factor
    const adjustmentFactor = this.calculateSessionAdjustmentFactor(sessionType, currentHour, asset);
    
    // Generate reasoning for the adjustment
    const reasoning = this.generateSessionReasoning(sessionType, currentHour, asset);
    
    // Assess volatility and liquidity expectations
    const volatilityExpectation = this.assessSessionVolatility(sessionType, currentHour, asset);
    const liquidityExpectation = this.assessSessionLiquidity(sessionType, currentHour, asset);
    
    // Check for upcoming news events
    const newsEvents = this.getUpcomingNewsEvents(asset, timestamp);
    
    return {
      sessionType,
      adjustmentFactor,
      reasoning,
      volatilityExpectation,
      liquidityExpectation,
      newsEvents
    };
  }

  /**
   * Get upcoming session changes and adjustments
   */
  public getUpcomingSessionChanges(
    timestamp: string = new Date().toISOString(),
    asset: string = 'FOREX',
    lookAheadHours: number = 8
  ): TimeBasedStopAdjustment[] {
    const changes: TimeBasedStopAdjustment[] = [];
    const startTime = new Date(timestamp);
    
    for (let hour = 1; hour <= lookAheadHours; hour++) {
      const futureTime = new Date(startTime.getTime() + (hour * 60 * 60 * 1000));
      const futureHour = futureTime.getUTCHours();
      const futureDay = futureTime.getUTCDay();
      
      const sessionType = this.determineCurrentSession(futureHour, futureDay, asset);
      const currentSessionType = this.determineCurrentSession(startTime.getUTCHours(), startTime.getUTCDay(), asset);
      
      // Check if session is changing
      if (sessionType !== currentSessionType) {
        const adjustmentFactor = this.calculateSessionAdjustmentFactor(sessionType, futureHour, asset);
        const reasoning = this.generateSessionChangeReasoning(sessionType, futureTime, asset);
        const volatilityExpectation = this.assessSessionVolatility(sessionType, futureHour, asset);
        const liquidityExpectation = this.assessSessionLiquidity(sessionType, futureHour, asset);
        const newsEvents = this.getUpcomingNewsEvents(asset, futureTime.toISOString());
        
        changes.push({
          sessionType,
          adjustmentFactor,
          reasoning,
          volatilityExpectation,
          liquidityExpectation,
          newsEvents
        });
      }
    }
    
    return changes;
  }

  /**
   * Calculate time-adjusted stop loss level
   */
  public calculateTimeAdjustedStop(
    entryPrice: number,
    baseStop: number,
    tradeDirection: 'BUY' | 'SELL',
    timestamp: string = new Date().toISOString(),
    asset: string = 'FOREX'
  ): number {
    const currentAdjustment = this.getCurrentSessionAdjustment(timestamp, asset);
    const adjustmentFactor = currentAdjustment.adjustmentFactor;
    
    // Calculate the original stop distance
    const originalDistance = Math.abs(entryPrice - baseStop);
    
    // Apply time-based adjustment
    const adjustedDistance = originalDistance * adjustmentFactor;
    
    // Calculate adjusted stop level
    const adjustedStop = tradeDirection === 'BUY' 
      ? entryPrice - adjustedDistance
      : entryPrice + adjustedDistance;
    
    return adjustedStop;
  }

  /**
   * Check if dynamic adjustment is recommended
   */
  public shouldUseDynamicAdjustment(
    timestamp: string = new Date().toISOString(),
    asset: string = 'FOREX',
    lookAheadHours: number = 8
  ): boolean {
    const upcomingChanges = this.getUpcomingSessionChanges(timestamp, asset, lookAheadHours);
    const currentAdjustment = this.getCurrentSessionAdjustment(timestamp, asset);
    
    // Dynamic adjustment recommended if:
    // 1. Major session change coming up
    // 2. High-impact news events upcoming
    // 3. Significant volatility expected
    
    const majorSessionChange = upcomingChanges.some(change => 
      this.isMajorSessionChange(currentAdjustment.sessionType, change.sessionType)
    );
    
    const highImpactNews = currentAdjustment.newsEvents.some(event => 
      event.impact === 'HIGH' && event.timeToEvent < 4 * 60 // Within 4 hours
    );
    
    const volatilityChange = upcomingChanges.some(change =>
      change.volatilityExpectation === 'HIGH' && currentAdjustment.volatilityExpectation !== 'HIGH'
    );
    
    return majorSessionChange || highImpactNews || volatilityChange;
  }

  /**
   * Get recommended adjustment schedule
   */
  public getAdjustmentSchedule(
    timestamp: string = new Date().toISOString(),
    asset: string = 'FOREX',
    tradeDuration: number = 24 // hours
  ): Array<{
    timestamp: string;
    adjustment: TimeBasedStopAdjustment;
    recommendedAction: 'TIGHTEN' | 'WIDEN' | 'MAINTAIN';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const schedule: Array<{
      timestamp: string;
      adjustment: TimeBasedStopAdjustment;
      recommendedAction: 'TIGHTEN' | 'WIDEN' | 'MAINTAIN';
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }> = [];
    
    const startTime = new Date(timestamp);
    const endTime = new Date(startTime.getTime() + (tradeDuration * 60 * 60 * 1000));
    
    let currentTime = new Date(startTime);
    let previousAdjustment = this.getCurrentSessionAdjustment(currentTime.toISOString(), asset);
    
    while (currentTime < endTime) {
      currentTime = new Date(currentTime.getTime() + (60 * 60 * 1000)); // Advance by 1 hour
      
      const currentAdjustment = this.getCurrentSessionAdjustment(currentTime.toISOString(), asset);
      
      // Check if significant change occurred
      if (this.isSignificantAdjustmentChange(previousAdjustment, currentAdjustment)) {
        const recommendedAction = this.getRecommendedAction(previousAdjustment, currentAdjustment);
        const severity = this.calculateChangeSeverity(previousAdjustment, currentAdjustment);
        
        schedule.push({
          timestamp: currentTime.toISOString(),
          adjustment: currentAdjustment,
          recommendedAction,
          severity
        });
      }
      
      previousAdjustment = currentAdjustment;
    }
    
    return schedule;
  }

  // Private helper methods

  /**
   * Determine current trading session
   */
  private determineCurrentSession(
    hour: number,
    day: number,
    asset: string
  ): TimeBasedStopAdjustment['sessionType'] {
    // Handle weekend periods
    if (day === 0 || day === 6) { // Sunday or Saturday
      if (asset === 'CRYPTO') {
        return this.getCryptoSession(hour);
      }
      return 'WEEKEND';
    }
    
    // Handle different asset classes
    switch (asset.toUpperCase()) {
      case 'FOREX':
        return this.getForexSession(hour);
      case 'CRYPTO':
        return this.getCryptoSession(hour);
      case 'STOCKS':
        return this.getStockSession(hour, day);
      default:
        return this.getForexSession(hour); // Default to forex sessions
    }
  }

  /**
   * Get forex trading session
   */
  private getForexSession(hour: number): TimeBasedStopAdjustment['sessionType'] {
    // UTC times for major forex sessions
    if (hour >= 0 && hour < 8) return 'ASIAN';        // Asian session: 00:00-08:00 UTC
    if (hour >= 8 && hour < 16) return 'LONDON';      // London session: 08:00-16:00 UTC
    if (hour >= 16 && hour < 24) return 'NEW_YORK';   // New York session: 16:00-24:00 UTC
    
    // Overlap periods
    if (hour >= 8 && hour < 12) return 'OVERLAP';     // London-Asian overlap
    if (hour >= 12 && hour < 16) return 'OVERLAP';    // London-NY overlap
    
    return 'ASIAN';
  }

  /**
   * Get crypto trading session (24/7 market)
   */
  private getCryptoSession(hour: number): TimeBasedStopAdjustment['sessionType'] {
    // Crypto follows similar patterns but is 24/7
    if (hour >= 0 && hour < 8) return 'ASIAN';
    if (hour >= 8 && hour < 16) return 'LONDON';
    if (hour >= 16 && hour < 24) return 'NEW_YORK';
    
    return 'ASIAN';
  }

  /**
   * Get stock trading session
   */
  private getStockSession(hour: number, day: number): TimeBasedStopAdjustment['sessionType'] {
    // Weekend handling
    if (day === 0 || day === 6) return 'WEEKEND';
    
    // US stock market hours (approximately 14:30-21:00 UTC)
    if (hour >= 14 && hour < 21) return 'NEW_YORK';
    
    // European market hours (approximately 08:00-16:30 UTC)
    if (hour >= 8 && hour < 17) return 'LONDON';
    
    // Asian market hours (approximately 00:00-06:00 UTC)
    if (hour >= 0 && hour < 6) return 'ASIAN';
    
    return 'WEEKEND'; // Outside trading hours
  }

  /**
   * Calculate session-specific adjustment factor
   */
  private calculateSessionAdjustmentFactor(
    sessionType: TimeBasedStopAdjustment['sessionType'],
    hour: number,
    asset: string
  ): number {
    let baseFactor = 1.0;
    
    // Session-specific factors
    switch (sessionType) {
      case 'ASIAN':
        baseFactor = 0.8; // Generally lower volatility
        break;
      case 'LONDON':
        baseFactor = 1.2; // Higher volatility, major moves
        break;
      case 'NEW_YORK':
        baseFactor = 1.1; // High volume, moderate volatility
        break;
      case 'OVERLAP':
        baseFactor = 1.4; // Highest volatility during overlaps
        break;
      case 'WEEKEND':
        baseFactor = 0.6; // Very low activity
        break;
    }
    
    // Asset-specific adjustments
    if (asset.toUpperCase() === 'CRYPTO') {
      baseFactor *= 1.3; // Crypto generally more volatile
    } else if (asset.toUpperCase() === 'STOCKS') {
      baseFactor *= 0.9; // Stocks generally less volatile than forex
    }
    
    // Time-of-session adjustments
    const sessionProgress = this.calculateSessionProgress(sessionType, hour);
    if (sessionProgress < 0.25) {
      baseFactor *= 1.1; // Early session, higher volatility
    } else if (sessionProgress > 0.75) {
      baseFactor *= 0.9; // Late session, lower volatility
    }
    
    return Math.max(0.5, Math.min(2.0, baseFactor)); // Clamp between 0.5 and 2.0
  }

  /**
   * Calculate how far through a session we are (0-1)
   */
  private calculateSessionProgress(sessionType: TimeBasedStopAdjustment['sessionType'], hour: number): number {
    switch (sessionType) {
      case 'ASIAN':
        return (hour % 8) / 8;
      case 'LONDON':
        return ((hour - 8) % 8) / 8;
      case 'NEW_YORK':
        return ((hour - 16) % 8) / 8;
      case 'OVERLAP':
        return 0.5; // Middle of overlap
      default:
        return 0.5;
    }
  }

  /**
   * Assess expected volatility for session
   */
  private assessSessionVolatility(
    sessionType: TimeBasedStopAdjustment['sessionType'],
    hour: number,
    asset: string
  ): TimeBasedStopAdjustment['volatilityExpectation'] {
    // Base volatility by session
    let volatilityScore = 0;
    
    switch (sessionType) {
      case 'ASIAN':
        volatilityScore = 1; // Low
        break;
      case 'LONDON':
        volatilityScore = 3; // High
        break;
      case 'NEW_YORK':
        volatilityScore = 2; // Medium-High
        break;
      case 'OVERLAP':
        volatilityScore = 3; // High
        break;
      case 'WEEKEND':
        volatilityScore = 0; // Very Low
        break;
    }
    
    // Asset adjustments
    if (asset.toUpperCase() === 'CRYPTO') {
      volatilityScore = Math.min(3, volatilityScore + 1);
    }
    
    // Time-specific adjustments
    const sessionProgress = this.calculateSessionProgress(sessionType, hour);
    if (sessionProgress < 0.25 || sessionProgress > 0.75) {
      volatilityScore = Math.max(0, volatilityScore - 1); // Lower at session edges
    }
    
    if (volatilityScore >= 3) return 'HIGH';
    if (volatilityScore >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Assess expected liquidity for session
   */
  private assessSessionLiquidity(
    sessionType: TimeBasedStopAdjustment['sessionType'],
    hour: number,
    asset: string
  ): TimeBasedStopAdjustment['liquidityExpectation'] {
    let liquidityScore = 0;
    
    switch (sessionType) {
      case 'ASIAN':
        liquidityScore = 1; // Lower liquidity
        break;
      case 'LONDON':
        liquidityScore = 3; // High liquidity
        break;
      case 'NEW_YORK':
        liquidityScore = 3; // High liquidity
        break;
      case 'OVERLAP':
        liquidityScore = 3; // Highest liquidity
        break;
      case 'WEEKEND':
        liquidityScore = 0; // Very low liquidity
        break;
    }
    
    // Asset adjustments
    if (asset.toUpperCase() === 'STOCKS') {
      if (sessionType === 'WEEKEND') liquidityScore = 0;
    } else if (asset.toUpperCase() === 'CRYPTO') {
      liquidityScore = Math.max(1, liquidityScore); // Crypto always has some liquidity
    }
    
    if (liquidityScore >= 3) return 'HIGH';
    if (liquidityScore >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate reasoning for session-based adjustments
   */
  private generateSessionReasoning(
    sessionType: TimeBasedStopAdjustment['sessionType'],
    hour: number,
    asset: string
  ): string {
    const sessionNames = {
      'ASIAN': 'Asian',
      'LONDON': 'London',
      'NEW_YORK': 'New York',
      'OVERLAP': 'Session Overlap',
      'WEEKEND': 'Weekend'
    };
    
    const sessionName = sessionNames[sessionType] || 'Unknown';
    const volatility = this.assessSessionVolatility(sessionType, hour, asset);
    const liquidity = this.assessSessionLiquidity(sessionType, hour, asset);
    
    let reasoning = `Currently in ${sessionName} session with ${volatility.toLowerCase()} volatility and ${liquidity.toLowerCase()} liquidity.`;
    
    // Add session-specific insights
    switch (sessionType) {
      case 'ASIAN':
        reasoning += ' Asian session typically shows ranging behavior with occasional breakouts.';
        break;
      case 'LONDON':
        reasoning += ' London session often brings major directional moves and high activity.';
        break;
      case 'NEW_YORK':
        reasoning += ' New York session provides strong momentum and trend continuation.';
        break;
      case 'OVERLAP':
        reasoning += ' Session overlap periods show highest volatility and liquidity.';
        break;
      case 'WEEKEND':
        reasoning += ' Weekend periods have minimal activity and potential gap risks.';
        break;
    }
    
    return reasoning;
  }

  /**
   * Generate reasoning for session changes
   */
  private generateSessionChangeReasoning(
    sessionType: TimeBasedStopAdjustment['sessionType'],
    futureTime: Date,
    asset: string
  ): string {
    const timeStr = futureTime.toISOString().split('T')[1].substring(0, 5);
    return `Session changing to ${sessionType} at ${timeStr} UTC. Expect different volatility and liquidity patterns.`;
  }

  /**
   * Get upcoming news events
   */
  private getUpcomingNewsEvents(
    asset: string,
    timestamp: string
  ): TimeBasedStopAdjustment['newsEvents'] {
    // This would integrate with a real news feed API
    // For now, return mock events based on common patterns
    
    const currentTime = new Date(timestamp);
    const events: TimeBasedStopAdjustment['newsEvents'] = [];
    
    // Mock some common high-impact events
    const mockEvents = [
      { time: '08:30', impact: 'HIGH', type: 'NFP Release' },
      { time: '14:00', impact: 'MEDIUM', type: 'FOMC Minutes' },
      { time: '12:30', impact: 'HIGH', type: 'CPI Data' },
      { time: '15:00', impact: 'MEDIUM', type: 'ECB Decision' }
    ];
    
    // Random news disabled by default to maintain determinism.
    // Integrate a real calendar API to enable this feature.
    if (false) {
      const event = mockEvents[0];
      const eventTime = new Date(currentTime);
      eventTime.setHours(parseInt(event.time.split(':')[0]));
      eventTime.setMinutes(parseInt(event.time.split(':')[1]));
      const timeToEvent = Math.floor((eventTime.getTime() - currentTime.getTime()) / (1000 * 60));
      if (timeToEvent > 0 && timeToEvent < 8 * 60) {
        events.push({ upcoming: true, timeToEvent, impact: event.impact as 'LOW' | 'MEDIUM' | 'HIGH', type: event.type });
      }
    }
    
    return events;
  }

  /**
   * Check if session change is major
   */
  private isMajorSessionChange(
    current: TimeBasedStopAdjustment['sessionType'],
    upcoming: TimeBasedStopAdjustment['sessionType']
  ): boolean {
    const majorTransitions = [
      ['WEEKEND', 'ASIAN'],
      ['ASIAN', 'LONDON'],
      ['LONDON', 'NEW_YORK'],
      ['NEW_YORK', 'WEEKEND']
    ];
    
    return majorTransitions.some(([from, to]) => 
      current === from && upcoming === to
    );
  }

  /**
   * Check if adjustment change is significant
   */
  private isSignificantAdjustmentChange(
    previous: TimeBasedStopAdjustment,
    current: TimeBasedStopAdjustment
  ): boolean {
    const factorChange = Math.abs(current.adjustmentFactor - previous.adjustmentFactor);
    const volatilityChange = previous.volatilityExpectation !== current.volatilityExpectation;
    const liquidityChange = previous.liquidityExpectation !== current.liquidityExpectation;
    const newsEvent = current.newsEvents.some(event => event.impact === 'HIGH');
    
    return factorChange > 0.2 || volatilityChange || liquidityChange || newsEvent;
  }

  /**
   * Get recommended action for adjustment change
   */
  private getRecommendedAction(
    previous: TimeBasedStopAdjustment,
    current: TimeBasedStopAdjustment
  ): 'TIGHTEN' | 'WIDEN' | 'MAINTAIN' {
    const factorChange = current.adjustmentFactor - previous.adjustmentFactor;
    
    if (factorChange > 0.15) return 'WIDEN';
    if (factorChange < -0.15) return 'TIGHTEN';
    
    // Check for high-impact news
    if (current.newsEvents.some(event => event.impact === 'HIGH')) {
      return 'WIDEN'; // Widen stops before high-impact news
    }
    
    // Check for volatility changes
    if (current.volatilityExpectation === 'HIGH' && previous.volatilityExpectation !== 'HIGH') {
      return 'WIDEN';
    }
    
    if (current.volatilityExpectation === 'LOW' && previous.volatilityExpectation !== 'LOW') {
      return 'TIGHTEN';
    }
    
    return 'MAINTAIN';
  }

  /**
   * Calculate severity of change
   */
  private calculateChangeSeverity(
    previous: TimeBasedStopAdjustment,
    current: TimeBasedStopAdjustment
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const factorChange = Math.abs(current.adjustmentFactor - previous.adjustmentFactor);
    const hasHighImpactNews = current.newsEvents.some(event => event.impact === 'HIGH');
    const majorVolatilityChange = (
      (previous.volatilityExpectation === 'LOW' && current.volatilityExpectation === 'HIGH') ||
      (previous.volatilityExpectation === 'HIGH' && current.volatilityExpectation === 'LOW')
    );
    
    if (hasHighImpactNews || factorChange > 0.4 || majorVolatilityChange) {
      return 'HIGH';
    }
    
    if (factorChange > 0.2 || previous.sessionType !== current.sessionType) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }
}