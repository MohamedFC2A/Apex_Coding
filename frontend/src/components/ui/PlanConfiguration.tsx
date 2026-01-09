import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Settings, Shield, Zap, Layout, Database, Globe } from 'lucide-react';

const Container = styled(motion.div)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  backdrop-filter: blur(10px);
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
`;

const OptionButton = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)')};
  border: 1px solid ${(p) => (p.$active ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)')};
  color: ${(p) => (p.$active ? 'rgba(59, 130, 246, 1)' : 'rgba(255, 255, 255, 0.7)')};
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)')};
  }
`;

export interface PlanConfig {
  type: 'web' | 'api' | 'mobile' | 'cli';
  priority: 'speed' | 'performance' | 'security';
  stack: string[];
}

interface PlanConfigurationProps {
  config: PlanConfig;
  onChange: (config: PlanConfig) => void;
}

export const PlanConfiguration: React.FC<PlanConfigurationProps> = ({ config, onChange }) => {
  const update = (key: keyof PlanConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const toggleStack = (tech: string) => {
    const current = config.stack || [];
    if (current.includes(tech)) {
      update('stack', current.filter(t => t !== tech));
    } else {
      update('stack', [...current, tech]);
    }
  };

  return (
    <Container initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Title>
        <Settings size={18} />
        Plan Configuration
      </Title>

      <Section>
        <Label>Project Type</Label>
        <Grid>
          <OptionButton $active={config.type === 'web'} onClick={() => update('type', 'web')}>
            <Globe size={14} /> Web App
          </OptionButton>
          <OptionButton $active={config.type === 'api'} onClick={() => update('type', 'api')}>
            <Database size={14} /> API
          </OptionButton>
          <OptionButton $active={config.type === 'mobile'} onClick={() => update('type', 'mobile')}>
            <Layout size={14} /> Mobile
          </OptionButton>
          <OptionButton $active={config.type === 'cli'} onClick={() => update('type', 'cli')}>
             <Zap size={14} /> CLI Tool
          </OptionButton>
        </Grid>
      </Section>

      <Section>
        <Label>Primary Goal</Label>
        <Grid>
          <OptionButton $active={config.priority === 'speed'} onClick={() => update('priority', 'speed')}>
            <Zap size={14} /> Dev Speed
          </OptionButton>
          <OptionButton $active={config.priority === 'performance'} onClick={() => update('priority', 'performance')}>
            <Zap size={14} /> Performance
          </OptionButton>
          <OptionButton $active={config.priority === 'security'} onClick={() => update('priority', 'security')}>
            <Shield size={14} /> Security
          </OptionButton>
        </Grid>
      </Section>

      <Section>
        <Label>Preferred Stack (Optional)</Label>
        <Grid>
          {['Next.js', 'React', 'Node.js', 'Python', 'Go', 'Rust', 'Tailwind', 'PostgreSQL'].map((tech) => (
            <OptionButton 
              key={tech} 
              $active={(config.stack || []).includes(tech)} 
              onClick={() => toggleStack(tech)}
            >
              {tech}
            </OptionButton>
          ))}
        </Grid>
      </Section>
    </Container>
  );
};
