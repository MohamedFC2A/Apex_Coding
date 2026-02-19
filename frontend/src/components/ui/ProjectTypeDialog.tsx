'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Code2,
  CheckCircle2,
  X
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

export type ProjectType = 'FRONTEND_ONLY';

interface ProjectTypeDialogProps {
  isOpen: boolean;
  onSelect: (type: ProjectType) => void;
  onCancel: () => void;
}

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const DialogContainer = styled(motion.div)`
  background: rgba(7, 11, 18, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  max-width: 600px;
  width: 100%;
  padding: 40px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 1px rgba(255, 255, 255, 0.1);

  @media (max-width: 640px) {
    padding: 30px 20px;
    border-radius: 16px;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;

  @media (max-width: 640px) {
    margin-bottom: 30px;
  }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 12px 0;
  text-align: center;

  @media (max-width: 640px) {
    font-size: 22px;
  }
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.62);
  margin: 0;
  line-height: 1.5;
`;

const OptionsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const OptionCard = styled(motion.button)<{ $selected?: boolean }>`
  all: unset;
  cursor: pointer;
  border: 2px solid ${p => p.$selected
    ? 'rgba(34, 211, 238, 0.6)'
    : 'rgba(255, 255, 255, 0.12)'};
  background: ${p => p.$selected
    ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(56, 189, 248, 0.05) 100%)'
    : 'rgba(255, 255, 255, 0.03)'};
  border-radius: 16px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 220ms ease;
  position: relative;
  overflow: hidden;

  @media (max-width: 640px) {
    padding: 24px 18px;
    gap: 12px;
  }

  &:hover {
    border-color: ${p => p.$selected
      ? 'rgba(34, 211, 238, 0.8)'
      : 'rgba(255, 255, 255, 0.25)'};
    background: ${p => p.$selected
      ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(56, 189, 248, 0.08) 100%)'
      : 'rgba(255, 255, 255, 0.06)'};
  }

  ${p => p.$selected && `
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.3), inset 0 0 40px rgba(34, 211, 238, 0.05);
  `}
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);

  svg {
    width: 22px;
    height: 22px;
  }
`;

const OptionLabel = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
`;

const OptionDescription = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.58);
  text-align: left;
  line-height: 1.4;
`;

const Features = styled.ul`
  max-width: 280px;
  margin: 0;
  padding-left: 16px;
  list-style: none;

  li {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '✓';
      color: rgba(34, 211, 238, 0.7);
      font-weight: bold;
      width: 14px;
    }
  }
`;

const FooterActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;

  @media (max-width: 640px) {
    gap: 10px;
  }
`;

const Button = styled(motion.button)<{ $variant?: 'primary' | 'secondary' }>`
  all: unset;
  cursor: pointer;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 220ms ease;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  ${p => p.$variant === 'primary' ? `
    background: linear-gradient(135deg, rgba(34, 211, 238, 0.9) 0%, rgba(56, 189, 248, 0.9) 100%);
    color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(34, 211, 238, 0.5);
    box-shadow: 0 8px 24px rgba(34, 211, 238, 0.25);

    &:hover {
      box-shadow: 0 12px 32px rgba(34, 211, 238, 0.35);
      transform: translateY(-2px);
    }
  ` : `
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.12);

    &:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ProjectTypeDialog: React.FC<ProjectTypeDialogProps> = ({
  isOpen,
  onSelect,
  onCancel
}) => {
  const { t, isRTL } = useLanguage();
  const [selected, setSelected] = useState<ProjectType | null>('FRONTEND_ONLY');

  const handleSelect = (type: ProjectType) => {
    setSelected(type);
  };

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      setSelected(null);
    }
  };

  const handleCancel = () => {
    setSelected(null);
    onCancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleCancel}
        >
          <DialogContainer
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
          >
            <Header>
              <Title>{t('app.project.selectType')}</Title>
              <Subtitle>{t('app.project.selectTypeDesc')}</Subtitle>
            </Header>

            <OptionsGrid>
              <OptionCard
                $selected={selected === 'FRONTEND_ONLY'}
                onClick={() => handleSelect('FRONTEND_ONLY')}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconWrapper>
                    <Code2 size={20} />
                  </IconWrapper>
                  <div>
                    <OptionLabel>{t('app.project.frontendOnly')}</OptionLabel>
                    <OptionDescription>{t('app.project.frontendOnlyDesc')}</OptionDescription>
                  </div>
                </div>
                {selected === 'FRONTEND_ONLY' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Features>
                      <li>{t('app.project.feat.ui')}</li>
                      <li>{t('app.project.feat.components')}</li>
                      <li>{t('app.project.feat.interactions')}</li>
                      <li>{t('app.project.feat.responsive')}</li>
                    </Features>
                  </motion.div>
                )}
              </OptionCard>
            </OptionsGrid>

            <FooterActions>
              <Button
                $variant="secondary"
                onClick={handleCancel}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={16} />
                {t('common.cancel')}
              </Button>
              <Button
                $variant="primary"
                disabled={!selected}
                onClick={handleConfirm}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <CheckCircle2 size={16} />
                {t('common.confirm')}
              </Button>
            </FooterActions>
          </DialogContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};
