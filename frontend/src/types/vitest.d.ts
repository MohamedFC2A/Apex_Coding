// TypeScript declaration file to inform the compiler about the 'vitest' module.
// This resolves "Cannot find module 'vitest'" errors when using Vitest in a TS project.
declare module 'vitest' {
  export const describe: typeof import('vitest').describe;
  export const it: typeof import('vitest').it;
  export const test: typeof import('vitest').test;
  export const expect: typeof import('vitest').expect;
  export const vi: typeof import('vitest').vi;
  export const beforeEach: typeof import('vitest').beforeEach;
  export const afterEach: typeof import('vitest').afterEach;
}

