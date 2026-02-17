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

export interface FileNode {
  path: string;
  type: 'file';
  extension: string;
  size: number;
  tags: string[];
  lastTouchedAt: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'link' | 'asset' | 'route';
  weight: number;
}

export interface PageNode {
  route: string;
  filePath: string;
  title?: string;
  linksTo: string[];
}

export interface DecisionNode {
  id: string;
  summary: string;
  relatedFiles: string[];
  createdAt: number;
  confidence: number;
}

export interface ContextRetrievalItem {
  path: string;
  score: number;
  reasons: string[];
}

export interface ContextRetrievalTrace {
  selected: ContextRetrievalItem[];
  dropped: ContextRetrievalItem[];
  budgetUsed: number;
  budgetMax: number;
  generatedAt: number;
  strategy: 'balanced_graph' | 'light' | 'max';
}
