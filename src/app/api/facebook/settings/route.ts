import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  FacebookSettingsSchema,
  loadFacebookSettings,
  saveFacebookSettings,
} from '@/lib/facebook-settings'
import { updateEnvValues } from '@/lib/env-file'
import { getClientIP } from '@/lib/get-ip'
import { checkRateLimit } from '@/lib/rate-limit'

const settingsRequestSchema = FacebookSettingsSchema.extend({
  pageAccessToken: z.string().optional(),
  n8nWebhookUrl: z.string().url().optional().or(z.literal('')),
})

export async function GET() {
  const settings = loadFacebookSettings()
  return NextResponse.json({
    settings,
    secrets: {
      hasPageAccessToken: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      hasN8nWebhookUrl: !!process.env.FACEBOOK_N8N_WEBHOOK_URL,
    },
  })
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const rateLimit = checkRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = settingsRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid Facebook settings', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { pageAccessToken, n8nWebhookUrl, ...settings } = parsed.data
    saveFacebookSettings(settings)
    await updateEnvValues({
      FACEBOOK_PAGE_ACCESS_TOKEN: pageAccessToken?.trim() || undefined,
      FACEBOOK_N8N_WEBHOOK_URL: n8nWebhookUrl?.trim() || undefined,
    })

    if (pageAccessToken?.trim()) {
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN = pageAccessToken.trim()
    }
    if (n8nWebhookUrl?.trim()) {
      process.env.FACEBOOK_N8N_WEBHOOK_URL = n8nWebhookUrl.trim()
    }

    return NextResponse.json({
      success: true,
      settings,
      message:
        'Parametres Facebook sauvegardes. Tu peux publier immediatement.',
    })
  } catch (error) {
    console.error('Facebook settings save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
