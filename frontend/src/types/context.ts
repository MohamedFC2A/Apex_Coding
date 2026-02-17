export type ContextStatus = 'ok' | 'warning' | 'critical';

export interface ContextBudgetState {
  maxChars: number;
  maxEstimatedTokens: number;
  usedChars: number;
  usedEstimatedTokens: number;
  utilizationPct: number;
  status: ContextStatus;
}

export interface CompressionSummaryBlock {
  id: string;
  range: string;
  summary: string;
  keyFiles: string[];
  keyDecisions: string[];
}

export interface CompressionSnapshot {
  level: number;
  compressedMessagesCount: number;
  summaryBlocks: CompressionSummaryBlock[];
  lastCompressedAt: number;
}

export interface ActiveModelProfile {
  plannerModel: string;
  executorModel: string;
}
