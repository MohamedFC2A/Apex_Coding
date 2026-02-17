import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Check, Plus, X } from 'lucide-react';
import { TOOL_FEATURES } from '@/config/toolFeatures';
import { useLanguage } from '@/context/LanguageContext';
import type { ToolFeatureCategory } from '@/types/constraints';

interface ToolsPanelProps {
  selectedFeatures: string[];
  customFeatureTags: string[];
  onToggleFeature: (featureId: string) => void;
  onAddCustomTag: (tag: string) => void;
  onRemoveCustomTag: (tag: string) => void;
  inline?: boolean;
}

const Panel = styled.div<{ $inline: boolean }>`
  width: 100%;
  padding: ${(p) => (p.$inline ? '10px 10px 12px' : '18px')};
  display: grid;
  gap: ${(p) => (p.$inline ? '12px' : '16px')};
`;

const TitleBlock = styled.div`
  display: grid;
  gap: 4px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.62);
`;

const Category = styled.section`
  display: grid;
  gap: 10px;
`;

const CategoryTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
`;

const Grid = styled.div<{ $inline: boolean }>`
  display: grid;
  grid-template-columns: ${(p) => (p.$inline ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))')};
  gap: ${(p) => (p.$inline ? '8px' : '10px')};

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureButton = styled.button<{ $active: boolean; $inline: boolean }>`
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 10px;
  text-align: left;
  width: 100%;
  border-radius: ${(p) => (p.$inline ? '10px' : '12px')};
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.42)' : 'rgba(255, 255, 255, 0.12)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.12)' : 'rgba(255, 255, 255, 0.04)')};
  padding: ${(p) => (p.$inline ? '9px 10px' : '11px 12px')};
  cursor: pointer;
  transition: 140ms ease;
  color: rgba(255, 255, 255, 0.92);

  &:hover {
    border-color: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.55)' : 'rgba(255, 255, 255, 0.25)')};
    background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.18)' : 'rgba(255, 255, 255, 0.08)')};
  }
`;

const CheckSlot = styled.span<{ $active: boolean }>`
  margin-top: 1px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.75)' : 'rgba(255,255,255,0.28)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.22)' : 'transparent')};
`;

const FeatureLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
`;

const FeatureDesc = styled.div`
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.62);
`;

const EmptyLine = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
  padding: 4px 2px;
`;

const TagRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(34, 211, 238, 0.28);
  background: rgba(34, 211, 238, 0.1);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  font-weight: 700;
  padding: 6px 10px;
`;

const RemoveTagButton = styled.button`
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`;

const TagInputRow = styled.form`
  display: flex;
  gap: 8px;
`;

const TagInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.26);
  color: rgba(255, 255, 255, 0.96);
  padding: 0 10px;
  font-size: 12px;
  outline: none;

  &:focus {
    border-color: rgba(34, 211, 238, 0.46);
  }
`;

const AddButton = styled.button`
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  font-weight: 800;
  padding: 0 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
`;

const CATEGORIES: ToolFeatureCategory[] = ['ui', 'ux', 'quality', 'integration'];

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  selectedFeatures,
  customFeatureTags,
  onToggleFeature,
  onAddCustomTag,
  onRemoveCustomTag,
  inline = false
}) => {
  const { t } = useLanguage();
  const [customTagInput, setCustomTagInput] = useState('');

  const featuresByCategory = useMemo(() => {
    return CATEGORIES.reduce<Record<ToolFeatureCategory, typeof TOOL_FEATURES>>((acc, category) => {
      acc[category] = TOOL_FEATURES.filter((feature) => feature.category === category);
      return acc;
    }, { ui: [], ux: [], quality: [], integration: [] });
  }, []);

  const submitCustomTag = (event: React.FormEvent) => {
    event.preventDefault();
    const tag = customTagInput.trim();
    if (!tag) return;
    onAddCustomTag(tag);
    setCustomTagInput('');
  };

  return (
    <Panel $inline={inline}>
      <TitleBlock>
        <Title>{t('app.tools.title')}</Title>
        <Subtitle>{t('app.tools.subtitle')}</Subtitle>
      </TitleBlock>

      {CATEGORIES.map((category) => (
        <Category key={category}>
          <CategoryTitle>{t(`app.tools.category.${category}`)}</CategoryTitle>
          <Grid $inline={inline}>
            {featuresByCategory[category].map((feature) => {
              const isActive = selectedFeatures.includes(feature.id);
              return (
                <FeatureButton
                  key={feature.id}
                  type="button"
                  $active={isActive}
                  $inline={inline}
                  aria-pressed={isActive}
                  onClick={() => onToggleFeature(feature.id)}
                >
                  <CheckSlot $active={isActive}>{isActive ? <Check size={12} /> : null}</CheckSlot>
                  <div>
                    <FeatureLabel>{t(feature.labelKey)}</FeatureLabel>
                    <FeatureDesc>{t(feature.descriptionKey)}</FeatureDesc>
                  </div>
                </FeatureButton>
              );
            })}
          </Grid>
        </Category>
      ))}

      <Category>
        <CategoryTitle>{t('app.tools.section.selected')}</CategoryTitle>
        {selectedFeatures.length === 0 ? (
          <EmptyLine>{t('app.tools.selected.none')}</EmptyLine>
        ) : (
          <TagRow>
            {selectedFeatures.map((id) => (
              <Tag key={id}>{t(`app.tools.feature.${id}.label`)}</Tag>
            ))}
          </TagRow>
        )}
      </Category>

      <Category>
        <CategoryTitle>{t('app.tools.section.custom')}</CategoryTitle>
        <TagInputRow onSubmit={submitCustomTag}>
          <TagInput
            value={customTagInput}
            onChange={(event) => setCustomTagInput(event.target.value)}
            placeholder={t('app.tools.custom.placeholder')}
          />
          <AddButton type="submit">
            <Plus size={12} />
            {t('app.tools.custom.add')}
          </AddButton>
        </TagInputRow>
        {customFeatureTags.length === 0 ? (
          <EmptyLine>{t('app.tools.custom.none')}</EmptyLine>
        ) : (
          <TagRow>
            {customFeatureTags.map((tag) => (
              <Tag key={tag}>
                <span>{tag}</span>
                <RemoveTagButton type="button" onClick={() => onRemoveCustomTag(tag)} aria-label="Remove custom tag">
                  <X size={12} />
                </RemoveTagButton>
              </Tag>
            ))}
          </TagRow>
        )}
      </Category>
    </Panel>
  );
};
