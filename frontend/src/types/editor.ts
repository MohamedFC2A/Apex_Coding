export interface EditorFollowState {
  mode: 'following' | 'paused_by_user';
  resumeAfterMs: number;
  lastUserScrollAt: number;
}
