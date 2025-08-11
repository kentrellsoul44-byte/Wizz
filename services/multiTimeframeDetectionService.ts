import type { ImageData, TimeframeImageData, TimeframeType } from '../types';

export interface MultiTimeframeDetectionResult {
  isMultiTimeframe: boolean;
  isCorrelationAnalysis: boolean;
  isDifferentAssets: boolean;
  detectedTimeframes: TimeframeType[];
  confidence: number;
  reasoning: string;
}

export class MultiTimeframeDetectionService {
  private static readonly TIMEFRAME_KEYWORDS = {
    '1M': ['1m', '1 minute', '1min', 'minute'],
    '5M': ['5m', '5 minute', '5min', '5 minutes'],
    '15M': ['15m', '15 minute', '15min', '15 minutes'],
    '30M': ['30m', '30 minute', '30min', '30 minutes'],
    '1H': ['1h', '1 hour', '1hr', 'hour', '1 hour'],
    '4H': ['4h', '4 hour', '4hr', '4 hours'],
    '12H': ['12h', '12 hour', '12hr', '12 hours'],
    '1D': ['1d', '1 day', 'daily', 'day'],
    '3D': ['3d', '3 day', '3 days'],
    '1W': ['1w', '1 week', 'weekly', 'week'],
    '1M_MONTHLY': ['1m', '1 month', 'monthly', 'month']
  };

  private static readonly CORRELATION_KEYWORDS = [
    'correlation', 'correlate', 'relationship', 'compare', 'versus', 'vs', 'against',
    'correlation analysis', 'correlation study', 'correlation between', 'correlation of',
    'how do', 'how does', 'relationship between', 'compare', 'comparison'
  ];

  private static readonly ASSET_KEYWORDS = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'binance', 'bnb', 'cardano', 'ada',
    'solana', 'sol', 'polkadot', 'dot', 'chainlink', 'link', 'litecoin', 'ltc',
    'ripple', 'xrp', 'dogecoin', 'doge', 'shiba', 'shib', 'avalanche', 'avax',
    'polygon', 'matic', 'cosmos', 'atom', 'uniswap', 'uni', 'aave', 'aave',
    'compound', 'comp', 'sushi', 'sushi', 'yearn', 'yfi', 'curve', 'crv'
  ];

  /**
   * Automatically detect if the uploaded images are for multi-timeframe analysis
   */
  static detectMultiTimeframeAnalysis(
    images: ImageData[], 
    prompt: string = ''
  ): MultiTimeframeDetectionResult {
    const result: MultiTimeframeDetectionResult = {
      isMultiTimeframe: false,
      isCorrelationAnalysis: false,
      isDifferentAssets: false,
      detectedTimeframes: [],
      confidence: 0,
      reasoning: ''
    };

    // If only one image, it's not multi-timeframe
    if (images.length <= 1) {
      result.reasoning = 'Single image detected - not multi-timeframe analysis';
      return result;
    }

    const promptLower = prompt.toLowerCase();
    let confidence = 0;
    const reasons: string[] = [];

    // Check for correlation analysis keywords
    const hasCorrelationKeywords = this.CORRELATION_KEYWORDS.some(keyword => 
      promptLower.includes(keyword)
    );

    if (hasCorrelationKeywords) {
      result.isCorrelationAnalysis = true;
      confidence += 30;
      reasons.push('Correlation analysis keywords detected in prompt');
    }

    // Check for different asset keywords
    const assetMatches = this.ASSET_KEYWORDS.filter(keyword => 
      promptLower.includes(keyword)
    );
    
    if (assetMatches.length > 1) {
      result.isDifferentAssets = true;
      confidence += 25;
      reasons.push(`Multiple assets detected: ${assetMatches.join(', ')}`);
    }

    // Check for timeframe keywords in prompt
    const detectedTimeframes: TimeframeType[] = [];
    for (const [timeframe, keywords] of Object.entries(this.TIMEFRAME_KEYWORDS)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        detectedTimeframes.push(timeframe as TimeframeType);
      }
    }

    if (detectedTimeframes.length > 1) {
      confidence += 35;
      reasons.push(`Multiple timeframes mentioned: ${detectedTimeframes.join(', ')}`);
    }

    // Check image count and patterns
    if (images.length >= 2) {
      confidence += 20;
      reasons.push(`${images.length} images uploaded - likely different timeframes`);
    }

    if (images.length >= 3) {
      confidence += 10;
      reasons.push('Three or more images suggest comprehensive multi-timeframe analysis');
    }

    // Determine if it's multi-timeframe based on confidence
    result.isMultiTimeframe = confidence >= 50;
    result.confidence = Math.min(confidence, 100);
    result.detectedTimeframes = detectedTimeframes;
    result.reasoning = reasons.join('; ');

    return result;
  }

  /**
   * Generate default timeframe assignments for uploaded images
   */
  static generateDefaultTimeframes(images: ImageData[]): TimeframeImageData[] {
    const defaultTimeframes: TimeframeType[] = ['1H', '4H', '1D'];
    
    return images.map((image, index) => ({
      imageData: image,
      timeframe: defaultTimeframes[index] || '1D',
      label: `Chart ${index + 1}`
    }));
  }

  /**
   * Check if the analysis should be treated as multi-timeframe
   */
  static shouldUseMultiTimeframeAnalysis(
    images: ImageData[], 
    prompt: string = ''
  ): boolean {
    const detection = this.detectMultiTimeframeAnalysis(images, prompt);
    
    // Use multi-timeframe if:
    // 1. Multiple images are uploaded
    // 2. Not explicitly a correlation analysis
    // 3. Not explicitly different assets
    // 4. High confidence in multi-timeframe detection
    return images.length > 1 && 
           !detection.isCorrelationAnalysis && 
           !detection.isDifferentAssets && 
           detection.confidence >= 50;
  }
}