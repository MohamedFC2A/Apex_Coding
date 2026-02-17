import React, { createContext, useContext } from 'react';

interface IconContextType {
  defaultSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  defaultColor?: string;
  defaultStrokeWidth?: number;
}

const IconContext = createContext<IconContextType | undefined>(undefined);

export function IconProvider({ children, value }: { children: React.ReactNode; value?: IconContextType }) {
  return (
    <IconContext.Provider value={value || {}}>
      {children}
    </IconContext.Provider>
  );
}

export function useIconContext(): IconContextType {
  const context = useContext(IconContext);
  return context || {};
}
