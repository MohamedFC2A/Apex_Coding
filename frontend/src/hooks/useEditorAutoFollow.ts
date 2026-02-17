import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as monaco from 'monaco-editor';
import type { EditorFollowState } from '@/types/editor';

const RESUME_AFTER_MS = 2000;
const BOTTOM_THRESHOLD_PX = 48;

export const useEditorAutoFollow = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
  const [followState, setFollowState] = useState<EditorFollowState>({
    mode: 'following',
    resumeAfterMs: RESUME_AFTER_MS,
    lastUserScrollAt: 0
  });
  const resumeTimerRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);

  const clearResumeTimer = useCallback(() => {
    if (!resumeTimerRef.current) return;
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
  }, []);

  const scrollToBottom = useCallback(
    (smooth = true) => {
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;
      const lastLine = model.getLineCount();
      const column = model.getLineMaxColumn(lastLine);
      programmaticScrollRef.current = true;
      editor.revealPositionInCenterIfOutsideViewport(
        { lineNumber: lastLine, column },
        smooth ? 0 : 1
      );
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 60);
    },
    [editor]
  );

  const pauseFollowing = useCallback(() => {
    const now = Date.now();
    setFollowState((prev) => ({
      ...prev,
      mode: 'paused_by_user',
      lastUserScrollAt: now
    }));
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      setFollowState((prev) => {
        if (prev.mode !== 'paused_by_user') return prev;
        if (Date.now() - prev.lastUserScrollAt < RESUME_AFTER_MS - 40) return prev;
        scrollToBottom(true);
        return { ...prev, mode: 'following' };
      });
    }, RESUME_AFTER_MS);
  }, [clearResumeTimer, scrollToBottom]);

  const resumeFollowing = useCallback(
    (scroll = true) => {
      clearResumeTimer();
      setFollowState((prev) => ({ ...prev, mode: 'following' }));
      if (scroll) scrollToBottom(true);
    },
    [clearResumeTimer, scrollToBottom]
  );

  useEffect(() => {
    if (!editor) return;
    const disposable = editor.onDidScrollChange((event) => {
      if (programmaticScrollRef.current) return;
      if (!event.scrollTopChanged) return;
      const scrollTop = editor.getScrollTop();
      const viewport = editor.getLayoutInfo().height;
      const scrollHeight = editor.getScrollHeight();
      const nearBottom = scrollTop + viewport >= scrollHeight - BOTTOM_THRESHOLD_PX;
      if (nearBottom) {
        resumeFollowing(false);
        return;
      }
      pauseFollowing();
    });
    return () => disposable.dispose();
  }, [editor, pauseFollowing, resumeFollowing]);

  useEffect(
    () => () => {
      clearResumeTimer();
    },
    [clearResumeTimer]
  );

  const notifyContentAppended = useCallback(() => {
    if (!editor) return;
    setFollowState((prev) => {
      if (prev.mode === 'following') {
        scrollToBottom(false);
        return prev;
      }
      const idleMs = Date.now() - prev.lastUserScrollAt;
      if (idleMs >= RESUME_AFTER_MS) {
        scrollToBottom(true);
        return { ...prev, mode: 'following' };
      }
      return prev;
    });
  }, [editor, scrollToBottom]);

  const isFollowing = useMemo(() => followState.mode === 'following', [followState.mode]);

  return {
    followState,
    isFollowing,
    pauseFollowing,
    resumeFollowing,
    notifyContentAppended
  };
};
