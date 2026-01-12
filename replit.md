# Apex Coding - AI-Powered IDE

## Overview

Apex Coding is an AI-driven Integrated Development Environment (IDE) that integrates advanced AI capabilities directly into the coding workflow. The platform functions as an intelligent coding partner that understands project context, generates complete code, and provides real-time preview capabilities.

The application consists of a Next.js frontend with a React-based IDE interface and an Express.js backend API that handles AI interactions, code generation, and file management. The system uses streaming responses for real-time code generation and supports multiple AI modes including fast generation and "thinking" mode for complex reasoning.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 16 with React 18, using both App Router (`/app`) and legacy Vite setup
- **State Management**: Zustand stores for AI state (`aiStore`), project state (`projectStore`), preview state (`previewStore`), and subscription management (`subscriptionStore`)
- **Styling**: Tailwind CSS combined with styled-components for component-level styling
- **Code Editor**: Monaco Editor (same engine as VS Code) with custom "Apex Midnight" theme
- **Preview System**: StackBlitz SDK integration for live code preview in WebContainers
- **Animations**: Framer Motion for UI transitions and effects

### Backend Architecture
- **Framework**: Express.js running as both local server and Vercel serverless function
- **API Structure**: Single entry point (`api/index.js`) with middleware for rate limiting, request ID tracking, and CORS handling
- **AI Integration**: Configurable LLM provider (DeepSeek/OpenAI) accessed via backend proxy to protect API keys
- **Streaming**: Server-Sent Events (SSE) for real-time code generation streaming

### Key Design Patterns
- **Monorepo with Workspaces**: Root package.json manages frontend workspace
- **Shared Types**: Common TypeScript interfaces in `/shared/types.ts` used by both frontend and backend
- **Proxy Pattern**: Frontend calls `/api/*` routes that proxy to backend, avoiding CORS issues and hiding API keys
- **Persistent State**: Zustand persist middleware with localStorage for autosave functionality
- **File-Marker Protocol**: AI responses use `[[START_FILE: path]]` and `[[END_FILE]]` markers for parsing streamed file content

### File Structure Decisions
- `/api` - Express backend (Vercel serverless compatible)
- `/frontend/src/app` - Next.js App Router pages
- `/frontend/src/components` - React components (UI, marketing, editor)
- `/frontend/src/stores` - Zustand state management
- `/frontend/src/services` - API service layer (aiService, downloadService)
- `/shared` - Cross-project TypeScript types

## External Dependencies

### AI/LLM Integration
- **DeepSeek API**: Primary LLM provider configured via `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL`
- **OpenAI-compatible**: Backend uses OpenAI SDK pattern, allowing provider switching
- **Model Modes**: `deepseek-chat` for fast mode, `deepseek-reasoner` for thinking mode

### Development & Preview
- **StackBlitz SDK**: WebContainer-based live preview for generated projects
- **Monaco Editor**: In-browser code editing with syntax highlighting and TypeScript support

### Infrastructure
- **Vercel**: Deployment target with serverless functions and rewrites configured in `vercel.json`
- **Convex**: Referenced in dependencies for potential real-time database features (deployment noted in `.trae/documents`)

### Build Tools
- **Vite**: Development server with React plugin and proxy configuration for API calls
- **Next.js**: Production build and SSR/SSG capabilities
- **TypeScript**: Full type safety across frontend and shared code

### Rate Limiting & Security
- Custom rate limiting middleware (`api/middleware/rateLimit.js`)
- Request ID tracking for debugging (`api/middleware/requestId.js`)
- Origin validation with configurable allowed origins
- Client-side subscription tier system limiting daily AI requests