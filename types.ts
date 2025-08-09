

import type { User as SupabaseUser } from '@supabase/gotrue-js';

// Re-exporting or creating a compatible User type.
// This matches the structure of a Supabase user object.
export type User = SupabaseUser;

export interface TradeSignal {
  entryPrice: string;
  takeProfit: string;
  stopLoss: string;
}

// New types for multi-timeframe support
export type TimeframeType = '1M' | '5M' | '15M' | '30M' | '1H' | '4H' | '12H' | '1D' | '3D' | '1W' | '1M_MONTHLY';

export interface TimeframeImageData {
  imageData: ImageData;
  timeframe: TimeframeType;
  label?: string; // Optional user-friendly label like "Bitcoin 4H Chart"
}

export interface TimeframeAnalysis {
  timeframe: TimeframeType;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CONSOLIDATING';
  keyLevels: {
    support: string[];
    resistance: string[];
  };
  momentum: 'STRONG_UP' | 'WEAK_UP' | 'NEUTRAL' | 'WEAK_DOWN' | 'STRONG_DOWN';
  confidence: number; // 0-100
  notes: string;
}

export interface MultiTimeframeContext {
  primaryTimeframe: TimeframeType;
  timeframeAnalyses: TimeframeAnalysis[];
  overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  confluenceScore: number; // 0-100, how well timeframes align
  conflictingSignals?: string[]; // Areas where timeframes disagree
}

// Smart Money Concepts (SMC) Types
export type MarketStructureType = 'BULLISH_STRUCTURE' | 'BEARISH_STRUCTURE' | 'RANGING' | 'TRANSITIONAL';
export type OrderBlockType = 'BULLISH_OB' | 'BEARISH_OB';
export type FVGType = 'BULLISH_FVG' | 'BEARISH_FVG';
export type BreakerBlockType = 'BULLISH_BREAKER' | 'BEARISH_BREAKER';
export type LiquiditySweepType = 'BUY_SIDE_LIQUIDITY' | 'SELL_SIDE_LIQUIDITY' | 'BOTH_SIDES';

export interface PriceLevel {
  price: number;
  timeframe: TimeframeType;
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  touched: number; // Number of times tested
  lastTouch?: string; // ISO date string
}

export interface OrderBlock {
  id: string;
  type: OrderBlockType;
  highPrice: number;
  lowPrice: number;
  originCandle: {
    timestamp: string;
    timeframe: TimeframeType;
  };
  mitigated: boolean;
  mitigationPrice?: number;
  mitigationTime?: string;
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  volume?: number;
  notes?: string;
}

export interface FairValueGap {
  id: string;
  type: FVGType;
  topPrice: number;
  bottomPrice: number;
  gapSize: number; // Size in price units
  gapSizePercent: number; // Size as percentage
  timeframe: TimeframeType;
  creationTime: string;
  filled: boolean;
  fillPrice?: number;
  fillTime?: string;
  fillPercentage: number; // 0-100, how much of the gap has been filled
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface BreakerBlock {
  id: string;
  type: BreakerBlockType;
  originalOrderBlock: OrderBlock;
  breakPrice: number;
  breakTime: string;
  retestPrice?: number;
  retestTime?: string;
  confirmed: boolean;
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
}

export interface LiquidityLevel {
  id: string;
  price: number;
  type: LiquiditySweepType;
  timeframe: TimeframeType;
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  equalHighsLows: number; // Number of equal highs/lows at this level
  swept: boolean;
  sweepTime?: string;
  sweepVolume?: number;
  projection: {
    targetPrice?: number;
    probability: number; // 0-100
  };
}

export interface MarketStructureShift {
  id: string;
  from: MarketStructureType;
  to: MarketStructureType;
  confirmationPrice: number;
  confirmationTime: string;
  timeframe: TimeframeType;
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  keyLevel: PriceLevel;
}

export interface SmartMoneyStructure {
  timeframe: TimeframeType;
  currentStructure: MarketStructureType;
  structureShifts: MarketStructureShift[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  breakerBlocks: BreakerBlock[];
  liquidityLevels: LiquidityLevel[];
  keyLevels: {
    support: PriceLevel[];
    resistance: PriceLevel[];
  };
  inducementLevels: PriceLevel[];
  displacement: {
    detected: boolean;
    direction?: 'BULLISH' | 'BEARISH';
    startPrice?: number;
    endPrice?: number;
    timeframe: TimeframeType;
    strength?: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXPLOSIVE';
  };
  marketPhase: 'ACCUMULATION' | 'DISTRIBUTION' | 'MARKUP' | 'MARKDOWN' | 'REACCUMULATION' | 'REDISTRIBUTION';
}

export interface SMCAnalysisContext {
  overallStructure: MarketStructureType;
  dominantTimeframe: TimeframeType;
  structuresByTimeframe: SmartMoneyStructure[];
  confluences: {
    orderBlockConfluence: OrderBlock[];
    fvgConfluence: FairValueGap[];
    liquidityConfluence: LiquidityLevel[];
  };
  criticalLevels: {
    highestProbabilityZones: PriceLevel[];
    liquidityTargets: LiquidityLevel[];
    structuralSupports: PriceLevel[];
    structuralResistances: PriceLevel[];
  };
  tradingBias: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number; // 0-100
    reasoning: string;
    invalidationLevel: number;
  };
  riskAssessment: {
    liquidityRisks: string[];
    structuralRisks: string[];
    recommendations: string[];
  };
}

// Advanced Pattern Recognition Types
export type WyckoffPhase = 
  | 'ACCUMULATION_PHASE_A' | 'ACCUMULATION_PHASE_B' | 'ACCUMULATION_PHASE_C' | 'ACCUMULATION_PHASE_D' | 'ACCUMULATION_PHASE_E'
  | 'DISTRIBUTION_PHASE_A' | 'DISTRIBUTION_PHASE_B' | 'DISTRIBUTION_PHASE_C' | 'DISTRIBUTION_PHASE_D' | 'DISTRIBUTION_PHASE_E'
  | 'MARKUP' | 'MARKDOWN' | 'UNIDENTIFIED';

export type ElliottWaveType = 
  | 'IMPULSE_1' | 'IMPULSE_3' | 'IMPULSE_5' | 'CORRECTIVE_2' | 'CORRECTIVE_4'
  | 'CORRECTIVE_A' | 'CORRECTIVE_B' | 'CORRECTIVE_C' | 'COMPLETE_CYCLE' | 'EXTENDED_WAVE';

export type ElliottWaveDegree = 'SUPERCYCLE' | 'CYCLE' | 'PRIMARY' | 'INTERMEDIATE' | 'MINOR' | 'MINUTE' | 'MINUETTE' | 'SUBMINUETTE';

export type HarmonicPatternType = 
  | 'GARTLEY_BULLISH' | 'GARTLEY_BEARISH'
  | 'BUTTERFLY_BULLISH' | 'BUTTERFLY_BEARISH'
  | 'BAT_BULLISH' | 'BAT_BEARISH'
  | 'CRAB_BULLISH' | 'CRAB_BEARISH'
  | 'CYPHER_BULLISH' | 'CYPHER_BEARISH'
  | 'SHARK_BULLISH' | 'SHARK_BEARISH'
  | 'DEEP_CRAB_BULLISH' | 'DEEP_CRAB_BEARISH';

export type VolumeProfileType = 'VALUE_AREA_HIGH' | 'VALUE_AREA_LOW' | 'POINT_OF_CONTROL' | 'VOLUME_CLUSTER' | 'LOW_VOLUME_NODE';

export interface WyckoffKeyLevel {
  id: string;
  price: number;
  type: 'SPRING' | 'UPTHRUST' | 'LAST_POINT_OF_SUPPLY' | 'LAST_POINT_OF_SUPPORT' | 'BACKUP' | 'SIGN_OF_STRENGTH' | 'SIGN_OF_WEAKNESS';
  timestamp: string;
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confirmed: boolean;
  description: string;
}

export interface WyckoffAnalysis {
  id: string;
  currentPhase: WyckoffPhase;
  phaseProgress: number; // 0-100 percentage through current phase
  timeframe: TimeframeType;
  keyLevels: WyckoffKeyLevel[];
  volumeCharacteristics: {
    climacticVolume: boolean;
    volumeDrying: boolean;
    volumeConfirmation: boolean;
    averageVolume: number;
  };
  priceAction: {
    narrowingSpread: boolean;
    wideSpread: boolean;
    effortVsResult: 'HARMONY' | 'DIVERGENCE' | 'NEUTRAL';
  };
  nextExpectedMove: {
    direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    probability: number; // 0-100
    targetPrice?: number;
    timeEstimate?: string;
  };
  confidence: number; // 0-100
  reasoning: string;
}

export interface ElliottWavePoint {
  id: string;
  wave: ElliottWaveType;
  degree: ElliottWaveDegree;
  price: number;
  timestamp: string;
  index: number;
  confirmed: boolean;
}

export interface ElliottWaveAnalysis {
  id: string;
  timeframe: TimeframeType;
  wavePoints: ElliottWavePoint[];
  currentWave: ElliottWaveType;
  currentDegree: ElliottWaveDegree;
  waveProgress: number; // 0-100 percentage through current wave
  impulseCorrective: 'IMPULSE' | 'CORRECTIVE';
  nextExpectedWave: ElliottWaveType;
  projections: {
    nextWaveTarget?: number;
    fibonacciLevels: {
      level: number; // e.g., 0.618, 1.618
      price: number;
      type: 'RETRACEMENT' | 'EXTENSION';
    }[];
  };
  invalidationLevel: number;
  confidence: number; // 0-100
  alternateCount?: {
    description: string;
    probability: number;
    keyDifference: string;
  };
}

export interface HarmonicRatio {
  name: string; // e.g., 'XA', 'AB', 'BC', 'CD'
  actual: number;
  ideal: number;
  tolerance: number;
  withinTolerance: boolean;
}

export interface HarmonicPattern {
  id: string;
  type: HarmonicPatternType;
  timeframe: TimeframeType;
  points: {
    X: { price: number; timestamp: string };
    A: { price: number; timestamp: string };
    B: { price: number; timestamp: string };
    C: { price: number; timestamp: string };
    D: { price: number; timestamp: string };
  };
  ratios: HarmonicRatio[];
  completion: number; // 0-100 percentage complete
  prz: { // Potential Reversal Zone
    high: number;
    low: number;
    centerPrice: number;
  };
  targets: {
    target1: number;
    target2: number;
    stopLoss: number;
  };
  validity: number; // 0-100 how close ratios are to ideal
  confidence: number; // 0-100
  status: 'FORMING' | 'COMPLETED' | 'ACTIVATED' | 'FAILED';
}

export interface VolumeNode {
  price: number;
  volume: number;
  percentage: number; // percentage of total volume
  type: VolumeProfileType;
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface VolumeProfile {
  id: string;
  timeframe: TimeframeType;
  period: {
    start: string;
    end: string;
    bars: number;
  };
  poc: VolumeNode; // Point of Control
  valueArea: {
    high: VolumeNode;
    low: VolumeNode;
    volumePercentage: number; // typically 70%
  };
  volumeNodes: VolumeNode[];
  profileShape: 'NORMAL' | 'B_SHAPE' | 'P_SHAPE' | 'D_SHAPE' | 'DOUBLE_DISTRIBUTION';
  marketStructure: {
    balanced: boolean;
    trending: boolean;
    rotational: boolean;
  };
  tradingImplications: {
    support: number[];
    resistance: number[];
    fairValue: number;
    acceptance: boolean; // price accepted at current levels
  };
}

export interface ClassicPattern {
  id: string;
  type: 'HEAD_AND_SHOULDERS' | 'INVERSE_HEAD_AND_SHOULDERS' | 'DOUBLE_TOP' | 'DOUBLE_BOTTOM' | 
        'TRIPLE_TOP' | 'TRIPLE_BOTTOM' | 'ASCENDING_TRIANGLE' | 'DESCENDING_TRIANGLE' | 
        'SYMMETRICAL_TRIANGLE' | 'WEDGE_RISING' | 'WEDGE_FALLING' | 'FLAG_BULLISH' | 'FLAG_BEARISH' |
        'PENNANT_BULLISH' | 'PENNANT_BEARISH' | 'CUP_AND_HANDLE' | 'INVERSE_CUP_AND_HANDLE';
  timeframe: TimeframeType;
  points: Array<{ price: number; timestamp: string; role: string }>;
  completion: number; // 0-100
  breakoutPrice: number;
  targets: {
    target1: number;
    target2: number;
    stopLoss: number;
  };
  volume: {
    patternVolume: 'INCREASING' | 'DECREASING' | 'NEUTRAL';
    breakoutVolume: 'CONFIRMED' | 'WEAK' | 'PENDING';
  };
  reliability: number; // 0-100
  status: 'FORMING' | 'COMPLETED' | 'BROKEN_OUT' | 'FAILED';
}

export interface AdvancedPatternContext {
  timeframe: TimeframeType;
  analysisTimestamp: string;
  wyckoffAnalysis?: WyckoffAnalysis;
  elliottWaveAnalysis?: ElliottWaveAnalysis;
  harmonicPatterns: HarmonicPattern[];
  volumeProfile?: VolumeProfile;
  classicPatterns: ClassicPattern[];
  patternConfluence: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    overallBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
    confidenceScore: number; // 0-100
  };
  tradingImplications: {
    primaryPattern: string;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    entryZone: { high: number; low: number };
    targets: number[];
    stopLoss: number;
    riskReward: number;
    timeHorizon: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  };
  conflictingPatterns: string[];
  marketCondition: {
    trend: 'STRONG_UPTREND' | 'WEAK_UPTREND' | 'SIDEWAYS' | 'WEAK_DOWNTREND' | 'STRONG_DOWNTREND';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    phase: 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN' | 'REACCUMULATION' | 'REDISTRIBUTION';
  };
}

export interface AnalysisResult {
  thinkingProcess: string; // The step-by-step analysis in Markdown.
  summary: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: 'HIGH' | 'LOW';
  trade: TradeSignal | null;
  timeframe?: string; // Primary timeframe being analyzed
  riskRewardRatio?: string;
  verificationSummary: string; // The AI's self-critique of its own analysis.
  overallConfidenceScore: number; // A numerical score from 0-100.
  // New multi-timeframe fields
  multiTimeframeContext?: MultiTimeframeContext;
  isMultiTimeframeAnalysis?: boolean;
  // Smart Money Concepts fields
  smcAnalysis?: SMCAnalysisContext;
  hasSMCAnalysis?: boolean;
  // Advanced Pattern Recognition fields
  patternAnalysis?: AdvancedPatternContext;
  hasAdvancedPatterns?: boolean;
}

export type MessageContent = string | AnalysisResult;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
  image?: string; // base64 data URL (deprecated; use images[] instead)
  images?: string[]; // array of base64 data URLs
  imageHashes?: string[]; // hashes for corresponding images (optional)
  timeframeImages?: TimeframeImageData[]; // multi-timeframe images with metadata
  thinkingText?: string; // The markdown thinking process text
  rawResponse?: string; // Full raw text from model for history
}

export interface Session {
  id: string; // Changed to string to accommodate UUID from Supabase
  title: string;
  messages: ChatMessage[];
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ImageData {
    mimeType: string;
    data: string; // base64 encoded string without prefix
    hash?: string; // optional SHA-256 hash of the canonicalized image bytes
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
      }
      user_preferences: {
        Row: {
          theme: "light" | "dark"
          updated_at: string
          user_id: string
          default_ultra_mode: boolean | null
        }
        Insert: {
          theme: "light" | "dark"
          updated_at?: string
          user_id: string
          default_ultra_mode?: boolean | null
        }
        Update: {
          theme?: "light" | "dark"
          updated_at?: string
          user_id?: string
          default_ultra_mode?: boolean | null
        }
      }
    }
    Views: {
      [_: string]: never
    }
    Functions: {
      [_: string]: never
    }
    Enums: {
      [_: string]: never
    }
    CompositeTypes: {
      [_: string]: never
    }
  }
}