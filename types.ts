

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