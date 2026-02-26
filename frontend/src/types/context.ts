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

export interface MemoryFact {
  id: string;
  category: 'working' | 'decision' | 'task';
  summary: string;
  relatedFiles: string[];
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryLedger {
  working: MemoryFact[];
  decisions: MemoryFact[];
  tasks: MemoryFact[];
}

export interface MemorySnapshot {
  version: 1;
  generatedAt: number;
  ledger: MemoryLedger;
}

export interface ActiveModelProfile {
  plannerModel: string;
  executorModel: string;
  specialistModels?: Record<string, string>;
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
  strategy: 'balanced_graph' | 'light' | 'max' | 'strict_full';
}

export interface WorkspaceManifestEntry {
  path: string;
  hash: string;
  size: number;
  type: 'code' | 'config' | 'asset' | 'doc' | 'other';
  extension: string;
}

export interface WorkspaceCoverageMetrics {
  requiredSetCoverage: number;
  dependencyCoverage: number;
  previewSignalCoverage: number;
  activeRecencyCoverage: number;
  tokenHeadroomCoverage: number;
  overallConfidence: number;
}

export interface WorkspaceAllowedCreateRule {
  pattern: string;
  reason: string;
}

export interface WorkspaceAnalysisReport {
  manifest: WorkspaceManifestEntry[];
  requiredReadSet: string[];
  expandedReadSet: string[];
  allowedEditPaths: string[];
  allowedCreateRules: WorkspaceAllowedCreateRule[];
  confidence: number;
  coverageMetrics: WorkspaceCoverageMetrics;
  riskFlags: string[];
}
