'use strict';

const PATCH_TOKEN = '[[PATCH_FILE:';
const START_TOKEN = '[[START_FILE:';
const EDIT_TOKEN = '[[EDIT_FILE:';
const EDIT_NODE_TOKEN = '[[EDIT_NODE:';
const DELETE_TOKEN = '[[DELETE_FILE:';
const MOVE_TOKEN = '[[MOVE_FILE:';
const END_TOKEN = '[[END_FILE]]';

const parsePathModeReason = (payload, fallbackMode = 'create') => {
  const text = String(payload || '').trim();
  if (!text) return { path: '', mode: fallbackMode };

  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  const path = parts[0] || '';
  let mode = fallbackMode;
  let reason;

  for (const part of parts.slice(1)) {
    const modeMatch = part.match(/^mode\s*[:=]\s*(create|edit)\s*$/i);
    if (modeMatch) {
      mode = modeMatch[1].toLowerCase();
      continue;
    }
    if (/^reason\s*[:=]/i.test(part)) {
      reason = part.replace(/^reason\s*[:=]\s*/i, '').trim();
    }
  }

  return { path, mode, reason };
};

const parseDeletePayload = (payload) => {
  const text = String(payload || '').trim();
  if (!text) return { path: '' };
  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  const path = parts[0] || '';
  const reasonPart = parts.slice(1).join(' | ');
  const reason = reasonPart ? reasonPart.replace(/^reason\s*[:=]\s*/i, '').trim() : undefined;
  return { path, reason };
};

const parseMovePayload = (payload) => {
  const text = String(payload || '').trim();
  if (!text) return { from: '', to: '' };
  const [routePart, ...rest] = text.split('|');
  const route = String(routePart || '').trim();
  const arrowIndex = route.indexOf('->');
  if (arrowIndex === -1) return { from: '', to: '' };
  const from = route.slice(0, arrowIndex).trim();
  const to = route.slice(arrowIndex + 2).trim();
  const reasonPart = rest.join(' | ').trim();
  const reason = reasonPart ? reasonPart.replace(/^reason\s*[:=]\s*/i, '').trim() : undefined;
  return { from, to, reason };
};

const createFileOpParser = (onEvent) => {
  if (typeof onEvent !== 'function') {
    throw new Error('createFileOpParser requires an onEvent callback');
  }

  let scan = '';
  let inPatch = false;
  let currentPath = '';
  let currentMode = 'create';
  let currentReason;

  const emit = (event) => {
    try {
      onEvent(event);
    } catch {
      // ignore downstream callback failures
    }
  };

  const flushPatchChunk = (chunk) => {
    if (!chunk) return;
    emit({
      op: 'patch',
      phase: 'chunk',
      path: currentPath,
      mode: currentMode,
      reason: currentReason,
      chunk
    });
  };

  const closePatch = () => {
    emit({
      op: 'patch',
      phase: 'end',
      path: currentPath,
      mode: currentMode,
      reason: currentReason
    });
    inPatch = false;
    currentPath = '';
    currentMode = 'create';
    currentReason = undefined;
  };

  const readMarkerPayload = (startIdx, token) => {
    const closeIdx = scan.indexOf(']]', startIdx);
    if (closeIdx === -1) return null;
    const payload = scan.slice(startIdx + token.length, closeIdx).trim();
    scan = scan.slice(closeIdx + 2);
    return payload;
  };

  const openPatch = (payload, fallbackMode) => {
    const parsed = parsePathModeReason(payload, fallbackMode);
    if (!parsed.path) return;
    inPatch = true;
    currentPath = parsed.path;
    currentMode = parsed.mode === 'edit' ? 'edit' : 'create';
    currentReason = parsed.reason;
    emit({
      op: 'patch',
      phase: 'start',
      path: currentPath,
      mode: currentMode,
      reason: currentReason
    });
  };

  const drain = () => {
    while (scan.length > 0) {
      if (!inPatch) {
        const patchIdx = scan.indexOf(PATCH_TOKEN);
        const startIdx = scan.indexOf(START_TOKEN);
        const editIdx = scan.indexOf(EDIT_TOKEN);
        const editNodeIdx = scan.indexOf(EDIT_NODE_TOKEN);
        const deleteIdx = scan.indexOf(DELETE_TOKEN);
        const moveIdx = scan.indexOf(MOVE_TOKEN);

        const nextIdx =
          [patchIdx, startIdx, editIdx, editNodeIdx, deleteIdx, moveIdx]
            .filter((idx) => idx !== -1)
            .sort((a, b) => a - b)[0] ?? -1;

        if (nextIdx === -1) {
          const keep = Math.max(
            PATCH_TOKEN.length - 1,
            START_TOKEN.length - 1,
            EDIT_TOKEN.length - 1,
            EDIT_NODE_TOKEN.length - 1,
            DELETE_TOKEN.length - 1,
            MOVE_TOKEN.length - 1
          );
          scan = scan.slice(Math.max(0, scan.length - keep));
          return;
        }

        if (nextIdx > 0) {
          scan = scan.slice(nextIdx);
        }

        if (scan.startsWith(DELETE_TOKEN)) {
          const payload = readMarkerPayload(0, DELETE_TOKEN);
          if (payload == null) return;
          const parsed = parseDeletePayload(payload);
          if (parsed.path) {
            emit({
              op: 'delete',
              phase: 'end',
              path: parsed.path,
              reason: parsed.reason
            });
          }
          continue;
        }

        if (scan.startsWith(MOVE_TOKEN)) {
          const payload = readMarkerPayload(0, MOVE_TOKEN);
          if (payload == null) return;
          const parsed = parseMovePayload(payload);
          if (parsed.from && parsed.to) {
            emit({
              op: 'move',
              phase: 'end',
              path: parsed.from,
              toPath: parsed.to,
              reason: parsed.reason
            });
          }
          continue;
        }

        if (scan.startsWith(PATCH_TOKEN)) {
          const payload = readMarkerPayload(0, PATCH_TOKEN);
          if (payload == null) return;
          openPatch(payload, 'create');
          continue;
        }

        if (scan.startsWith(EDIT_NODE_TOKEN)) {
          const payload = readMarkerPayload(0, EDIT_NODE_TOKEN);
          if (payload == null) return;
          openPatch(payload, 'edit');
          continue;
        }

        if (scan.startsWith(EDIT_TOKEN)) {
          const payload = readMarkerPayload(0, EDIT_TOKEN);
          if (payload == null) return;
          openPatch(payload, 'edit');
          continue;
        }

        if (scan.startsWith(START_TOKEN)) {
          const payload = readMarkerPayload(0, START_TOKEN);
          if (payload == null) return;
          openPatch(payload, 'create');
          continue;
        }
      }

      const endIdx = scan.indexOf(END_TOKEN);
      const nextMarkerIdx =
        [PATCH_TOKEN, START_TOKEN, EDIT_TOKEN, EDIT_NODE_TOKEN, DELETE_TOKEN, MOVE_TOKEN]
          .map((token) => scan.indexOf(token))
          .filter((idx) => idx !== -1)
          .sort((a, b) => a - b)[0] ?? -1;

      if (nextMarkerIdx !== -1 && (endIdx === -1 || nextMarkerIdx < endIdx)) {
        flushPatchChunk(scan.slice(0, nextMarkerIdx));
        closePatch();
        scan = scan.slice(nextMarkerIdx);
        continue;
      }

      if (endIdx !== -1) {
        flushPatchChunk(scan.slice(0, endIdx));
        closePatch();
        scan = scan.slice(endIdx + END_TOKEN.length);
        continue;
      }

      const keep = Math.max(
        PATCH_TOKEN.length + 8,
        START_TOKEN.length + 8,
        EDIT_TOKEN.length + 8,
        EDIT_NODE_TOKEN.length + 8,
        DELETE_TOKEN.length + 8,
        MOVE_TOKEN.length + 8,
        END_TOKEN.length + 8
      );
      if (scan.length <= keep) return;
      flushPatchChunk(scan.slice(0, scan.length - keep));
      scan = scan.slice(scan.length - keep);
    }
  };

  return {
    push(chunk) {
      if (!chunk) return;
      scan += String(chunk);
      drain();
    },
    finalize() {
      if (!scan) {
        if (inPatch) closePatch();
        return;
      }
      if (inPatch) {
        flushPatchChunk(scan);
        scan = '';
        closePatch();
      } else {
        scan = '';
      }
    }
  };
};

module.exports = {
  createFileOpParser
};
