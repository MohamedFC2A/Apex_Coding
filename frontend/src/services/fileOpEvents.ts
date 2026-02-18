export type ParsedFileOpEvent =
  | {
      type: 'start' | 'chunk' | 'end';
      path: string;
      mode?: 'create' | 'edit';
      chunk?: string;
      partial?: boolean;
      line?: number;
      append?: boolean;
    }
  | {
      type: 'delete';
      path: string;
      reason?: string;
      safetyCheckPassed?: boolean;
    }
  | {
      type: 'move';
      path: string;
      toPath: string;
      reason?: string;
      safetyCheckPassed?: boolean;
    };

type BackendFileOpPayload = {
  op: 'patch' | 'delete' | 'move';
  phase: 'start' | 'chunk' | 'end';
  path: string;
  toPath?: string;
  mode?: 'create' | 'edit';
  reason?: string;
  chunk?: string;
};

const toSafeString = (value: unknown) => String(value || '').trim();

export const parseFileOpEventPayload = (dataText: string): ParsedFileOpEvent | null => {
  let payload: BackendFileOpPayload;
  try {
    payload = JSON.parse(String(dataText || '')) as BackendFileOpPayload;
  } catch {
    return null;
  }

  const op = payload?.op;
  const phase = payload?.phase;
  const path = toSafeString(payload?.path);
  const reason = toSafeString(payload?.reason);
  const mode = payload?.mode === 'edit' ? 'edit' : 'create';

  if (!path) return null;

  if (op === 'delete') {
    return {
      type: 'delete',
      path,
      reason: reason || undefined,
      safetyCheckPassed: false
    };
  }

  if (op === 'move') {
    const toPath = toSafeString(payload?.toPath);
    if (!toPath) return null;
    return {
      type: 'move',
      path,
      toPath,
      reason: reason || undefined,
      safetyCheckPassed: false
    };
  }

  if (op !== 'patch') return null;

  if (phase === 'start') {
    return {
      type: 'start',
      path,
      mode
    };
  }
  if (phase === 'chunk') {
    const chunk = String(payload?.chunk ?? '');
    if (!chunk) return null;
    return {
      type: 'chunk',
      path,
      mode,
      chunk
    };
  }
  if (phase === 'end') {
    return {
      type: 'end',
      path,
      mode
    };
  }
  return null;
};
