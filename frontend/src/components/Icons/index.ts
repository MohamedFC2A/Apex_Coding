/**
 * Unified Icon System for Apex_Coding IDE
 * Exports both custom SVG icons and Lucide React icons through a single interface
 * 
 * Usage:
 * import { ApexIcon } from '@/components/Icons';
 * 
 * // Custom SVG icon
 * <ApexIcon type="custom" name="logo" size="lg" />
 * 
 * // Lucide icon
 * <ApexIcon type="lucide" name="Code" size="md" />
 */

export { ApexIcon, type ApexIconProps } from './ApexIcon';
export { IconProvider, useIconContext } from './IconContext';

// Custom SVG Icons
export {
  LogoIcon,
  AIBrainIcon,
  FastZapIcon,
  SuperRocketIcon,
  PreviewWindowIcon,
  ConnectedDotsIcon,
} from './custom/LogoIcon';

// Re-export Lucide icons for convenience
export * from 'lucide-react';
