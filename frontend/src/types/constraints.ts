export type ProjectMode = 'FRONTEND_ONLY' | 'FULL_STACK';
export type ConstraintEnforcement = 'hard';

export interface GenerationConstraints {
  projectMode: ProjectMode;
  selectedFeatures: string[];
  customFeatureTags: string[];
  enforcement: ConstraintEnforcement;
}

export type ToolFeatureCategory = 'ui' | 'ux' | 'quality' | 'integration';

export interface ToolFeature {
  id: string;
  labelKey: string;
  descriptionKey: string;
  category: ToolFeatureCategory;
  promptRule: string;
  validators: RegExp[];
}

