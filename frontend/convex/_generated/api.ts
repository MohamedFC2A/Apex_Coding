// Minimal non-codegen API proxy.
// If you run `npx convex dev`, Convex will generate a fully-typed `convex/_generated/api.ts`.
// This proxy keeps the app compiling and provides function references at runtime.

import { anyApi } from 'convex/server';

export const api: any = anyApi;

