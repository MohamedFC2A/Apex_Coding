import type { MemoryFact, MemorySnapshot } from '@/types/context';

type MemoryChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type MemoryPlanStep = {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  files?: string[];
};

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

const extractFileRefs = (text: string): string[] => {
  const out = new Set<string>();
  const source = String(text || '');
  const re =
    /(?:^|[\s("'`])((?:frontend|src|pages|components|styles|scripts|assets|data|backend)\/[^\s"'`]+|[a-zA-Z0-9_-]+\.(?:tsx?|jsx?|css|scss|sass|html?|md|svg|json|js))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const normalized = normalizePath(match[1] || '');
    if (!normalized) continue;
    out.add(normalized);
    if (out.size >= 12) break;
  }
  return Array.from(out);
};

const scoreConfidence = (text: string, hasFiles: boolean) => {
  const base = Math.min(0.98, 0.55 + Math.min(0.3, text.length / 1200));
  return Number((hasFiles ? base + 0.08 : base).toFixed(2));
};

const toFact = (
  idSeed: string,
  category: MemoryFact['category'],
  summary: string,
  relatedFiles: string[],
  now: number
): MemoryFact | null => {
  const cleanSummary = String(summary || '').trim();
  if (!cleanSummary) return null;
  const files = Array.from(new Set((relatedFiles || []).map((item) => normalizePath(item)).filter(Boolean))).slice(0, 12);
  return {
    id: `${category}-${idSeed}`,
    category,
    summary: cleanSummary.slice(0, 320),
    relatedFiles: files,
    confidence: scoreConfidence(cleanSummary, files.length > 0),
    createdAt: now,
    updatedAt: now
  };
};

const extractWorkingFacts = (history: MemoryChatMessage[], now: number): MemoryFact[] => {
  const recent = history.slice(-8);
  const out: MemoryFact[] = [];
  for (let i = 0; i < recent.length; i++) {
    const msg = recent[i];
    if (!msg?.content) continue;
    const summary = msg.content.replace(/\s+/g, ' ').trim().slice(0, 220);
    const fact = toFact(`${now}-${i}`, 'working', `[${msg.role}] ${summary}`, extractFileRefs(msg.content), now);
    if (fact) out.push(fact);
  }
  return out;
};

const DECISION_RE = /\b(decision|rule|constraint|must|should|important|avoid|policy|required|never)\b/i;

const extractDecisionFacts = (history: MemoryChatMessage[], now: number): MemoryFact[] => {
  const out: MemoryFact[] = [];
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const content = String(history[i]?.content || '');
    if (!content) continue;
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;
      if (!DECISION_RE.test(clean)) continue;
      const fact = toFact(`${now}-${i}-${count}`, 'decision', clean, extractFileRefs(clean), now);
      if (fact) out.push(fact);
      count += 1;
      if (out.length >= 16) return out;
    }
  }
  return out;
};

const extractTaskFacts = (steps: MemoryPlanStep[], now: number): MemoryFact[] => {
  const out: MemoryFact[] = [];
  const limited = steps.slice(0, 40);
  for (let i = 0; i < limited.length; i++) {
    const step = limited[i];
    const status = step.status || (step.completed ? 'completed' : 'pending');
    const summary = `[${status}] ${step.title}${step.description ? ` - ${step.description}` : ''}`;
    const fact = toFact(`${now}-${step.id || i}`, 'task', summary, Array.isArray(step.files) ? step.files : [], now);
    if (fact) out.push(fact);
  }
  return out;
};

export const buildMemorySnapshot = (args: {
  chatHistory: MemoryChatMessage[];
  planSteps: MemoryPlanStep[];
}): MemorySnapshot => {
  const now = Date.now();
  const history = Array.isArray(args.chatHistory) ? args.chatHistory : [];
  const steps = Array.isArray(args.planSteps) ? args.planSteps : [];

  return {
    version: 1,
    generatedAt: now,
    ledger: {
      working: extractWorkingFacts(history, now),
      decisions: extractDecisionFacts(history, now),
      tasks: extractTaskFacts(steps, now)
    }
  };
};

export const summarizeMemorySnapshot = (snapshot?: MemorySnapshot | null): string => {
  if (!snapshot?.ledger) return '';
  const sections: string[] = [];
  const working = snapshot.ledger.working.slice(0, 6).map((item) => `- ${item.summary}`);
  const decisions = snapshot.ledger.decisions.slice(0, 8).map((item) => `- ${item.summary}`);
  const tasks = snapshot.ledger.tasks.slice(0, 8).map((item) => `- ${item.summary}`);

  if (working.length > 0) sections.push('[WORKING MEMORY]', ...working);
  if (decisions.length > 0) sections.push('[DECISION MEMORY]', ...decisions);
  if (tasks.length > 0) sections.push('[TASK MEMORY]', ...tasks);
  return sections.join('\n');
};
