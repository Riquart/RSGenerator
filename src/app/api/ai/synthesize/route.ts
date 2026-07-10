import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { aiManager } from '@/lib/ai/provider-manager'
import { type AIProvider } from '@/lib/ai/server-keys'
import { getClientIP } from '@/lib/get-ip'
import { checkRateLimit } from '@/lib/rate-limit'

const synthesizeSchema = z.object({
  sourcesText: z.string(),
  guidancePrompt: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  webEnrichment: z.boolean().optional().default(false),
  allowedDomains: z.array(z.string()).optional().default([]),
})

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const rateLimit = checkRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Max 20 req/min.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = synthesizeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { sourcesText, guidancePrompt, provider, model, webEnrichment, allowedDomains } = parsed.data
    const aiProvider = (provider as AIProvider) || undefined

    const result = await aiManager.synthesizeSources(
      sourcesText,
      guidancePrompt,
      aiProvider,
      model,
      { webEnrichment, allowedDomains }
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('Synthesize API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
