# Social Media Generator — Agent Instructions

## Project Overview
Dashboard SaaS for AI-powered social media & blog content generation.

## Tech Stack
- Next.js 15 LTS (App Router, `output: 'standalone'`)
- TypeScript 5 (strict)
- Tailwind CSS v3.4 + shadcn/ui
- Supabase (PostgreSQL + Auth)
- AI Providers: Gemini, OpenAI, Perplexity, DeepSeek, Fal.ai, Leonardo AI, Freepik

## Build & Run
```bash
npm install
npm run build        # production build (standalone mode)
npm run dev          # development server
```

## Architecture
- `src/lib/ai/provider-manager.ts` — Singleton AIProviderManager (server-side only)
- `src/lib/ai/server-keys.ts` — API key mapping (server-side only, never exposed to client)
- `src/lib/ai/prompts-default.ts` — Default prompts, centralized
- `src/context/AIConfigContext.tsx` — Client-side provider preferences (localStorage)
- `src/context/BrandIdentityContext.tsx` — Client-side brand identity / direction artistique (localStorage)
- `src/lib/brand-identity.ts` — Brand identity types, Zod schema, prompt injection helpers
- `src/lib/brand-identity-server.ts` — Server-side loader for `brand-identity.json`
- `src/lib/canvas-logo-overlay.ts` — Canvas post-processing for logo overlay on generated images
- `src/app/api/ai/*` — API routes for chat, image, providers status, scrape, pdf, brand

## Security Rules
- API keys NEVER leave the server
- Rate limiting: 20 req/min per IP on `/api/ai/*`
- Input validation with Zod on all API routes
- PDF upload: max 10MB, MIME type check
- URL scraping: SSRF protection (private IPs blocked)

## Deployment Modes
- **Windows standalone**: `.next/standalone/` + `start.bat`
- **Web**: Vercel recommended
- **Hostinger Managed Node.js Web App**: Standalone deployment to `nodejs/` via GitHub Actions with specific patches for Passenger Unix socket routing and `preload-timestamp.js` crash mitigation. See [DEPLOYMENT.md](file:///x:/BILANS/PROJECT/SOCIAL%20MEDIA%20GENERATORE%20V2/DEPLOYMENT.md) for full setup instructions and troubleshooting.
