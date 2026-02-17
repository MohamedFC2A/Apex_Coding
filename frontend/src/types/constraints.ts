export type ProjectMode = 'FRONTEND_ONLY' | 'FULL_STACK';
export type ConstraintEnforcement = 'hard';
export type QualityGateMode = 'strict' | 'medium' | 'light';
export type SiteArchitectureMode = 'adaptive_multi_page' | 'single_page' | 'force_multi_page';
export type FileControlMode = 'safe_full' | 'create_edit_only';
export type ContextIntelligenceMode = 'balanced_graph' | 'light' | 'max';

export interface GenerationConstraints {
  projectMode: ProjectMode;
  selectedFeatures: string[];
  customFeatureTags: string[];
  enforcement: ConstraintEnforcement;
  qualityGateMode?: QualityGateMode;
  siteArchitectureMode?: SiteArchitectureMode;
  fileControlMode?: FileControlMode;
  contextIntelligenceMode?: ContextIntelligenceMode;
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
