import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  :root {
    --mobile-nav-height: 60px;
    --brain-console-collapsed-height: 48px;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.22) rgba(0, 0, 0, 0.18);
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .scrollbar-glass::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.18);
    border-radius: 999px;
  }

  .scrollbar-glass::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.10));
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 999px;
  }

  .scrollbar-glass::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(34, 211, 238, 0.22), rgba(168, 85, 247, 0.18));
    border-color: rgba(255, 255, 255, 0.14);
  }
`;
