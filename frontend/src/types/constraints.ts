export type ProjectMode = 'FRONTEND_ONLY';
export type ConstraintEnforcement = 'hard';
export type QualityGateMode = 'strict' | 'medium' | 'light';
export type SiteArchitectureMode = 'adaptive_multi_page' | 'single_page' | 'force_multi_page';
export type FileControlMode = 'safe_full' | 'create_edit_only';
export type ContextIntelligenceMode = 'balanced_graph' | 'light' | 'max' | 'strict_full';
export type AnalysisMode = 'strict_full';
export type TouchBudgetMode = 'minimal' | 'adaptive';
export type PostProcessMode = 'safety_only';
export type GenerationProfile = 'auto' | 'static' | 'framework';
export type DestructiveSafetyMode = 'backup_then_apply' | 'manual_confirm' | 'no_delete_move';

export interface GenerationConstraints {
  projectMode: ProjectMode;
  selectedFeatures: string[];
  customFeatureTags: string[];
  enforcement: ConstraintEnforcement;
  qualityGateMode?: QualityGateMode;
  siteArchitectureMode?: SiteArchitectureMode;
  fileControlMode?: FileControlMode;
  contextIntelligenceMode?: ContextIntelligenceMode;
  analysisMode?: AnalysisMode;
  touchBudgetMode?: TouchBudgetMode;
  postProcessMode?: PostProcessMode;
  minContextConfidence?: number;
  generationProfile?: GenerationProfile;
  destructiveSafetyMode?: DestructiveSafetyMode;
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
