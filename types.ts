

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