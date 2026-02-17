import { TOOL_FEATURES_BY_ID } from '@/config/toolFeatures';
import type { GenerationConstraints } from '@/types/constraints';
import type { ProjectFile } from '@/types';

const flattenProjectFiles = (files: ProjectFile[]) =>
  files
    .map((file) => `${file.path || file.name}\n${file.content || ''}`)
    .join('\n');

export const validateConstraints = (
  files: ProjectFile[],
  constraints: GenerationConstraints
): { missingFeatures: string[] } => {
  const corpus = flattenProjectFiles(files);

  const missingFeatures = constraints.selectedFeatures.filter((featureId) => {
    const feature = TOOL_FEATURES_BY_ID[featureId];
    if (!feature || feature.validators.length === 0) return false;
    return !feature.validators.some((rule) => rule.test(corpus));
  });

  return { missingFeatures };
};

