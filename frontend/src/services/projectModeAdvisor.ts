import type { ProjectMode } from '@/types/constraints';

const FRONTEND_HINTS = /\b(html|css|landing page|portfolio|ui only|frontend only|static site)\b/i;

export interface ProjectModeRecommendation {
  recommendedMode: ProjectMode;
  reason: string;
}

export const recommendProjectMode = (
  prompt: string,
  currentMode: ProjectMode
): ProjectModeRecommendation | null => {
  const text = String(prompt || '').trim();
  if (!text) return null;

  if (FRONTEND_HINTS.test(text) && currentMode !== 'FRONTEND_ONLY') {
    return {
      recommendedMode: 'FRONTEND_ONLY',
      reason: 'Prompt looks frontend-only.'
    };
  }

  return null;
};
