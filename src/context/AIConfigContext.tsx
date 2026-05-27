'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { AIProvider } from '@/lib/ai/server-keys'

export interface AIConfig {
  textProvider: AIProvider
  textModel: string
  imageProvider: AIProvider
  imageModel: string
  videoProvider: AIProvider
  videoModel: string
  researchProvider: AIProvider
  researchModel: string
  socialProvider: AIProvider
  socialModel: string
}

export const MODEL_OPTIONS: Record<AIProvider, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-exp'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  // image models are handled separately; gpt-image-2 is the current OpenAI image model
  perplexity: ['sonar', 'sonar-pro', 'sonar-reasoning'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  fal: ['flux/dev', 'flux/schnell'],
  leonardo: ['Leonardo Phoenix', 'Leonardo Kino XL'],
  freepik: ['mystic-realism-v2'],
  magnific: [
    'mystic',
    'reimagine-flux',
    'ideogram',
    'wan-2-7-text-to-video',
    'wan-v2-2-720p-image-to-video',
    'kling-o1',
    'runway-gen-4-5',
    'minimax-live',
  ],
}

const defaultConfig: AIConfig = {
  textProvider: 'gemini',
  textModel: 'gemini-2.5-flash',
  imageProvider: 'openai',
  imageModel: 'gpt-image-2',
  videoProvider: 'magnific',
  videoModel: 'wan-2-7-text-to-video',
  researchProvider: 'perplexity',
  researchModel: 'sonar-pro',
  socialProvider: 'gemini',
  socialModel: 'gemini-2.5-flash',
}

interface AIConfigContextType {
  config: AIConfig
  setProvider: (category: keyof AIConfig, value: string) => void
  updateConfig: (updates: Partial<AIConfig>) => void
  resetConfig: () => void
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined)

function sanitizeConfig(partial: Partial<AIConfig>): AIConfig {
  const merged = { ...defaultConfig, ...partial }
  // Preserve custom model names typed by admins. Only repair empty values.
  const categories: (keyof AIConfig)[] = ['textProvider', 'imageProvider', 'videoProvider', 'researchProvider', 'socialProvider']
  for (const provKey of categories) {
    const provider = merged[provKey] as AIProvider
    const modelKey = provKey.replace('Provider', 'Model') as keyof AIConfig
    const available = MODEL_OPTIONS[provider]
    if (available && !String(merged[modelKey] || '').trim()) {
      ;(merged as any)[modelKey] = available[0]
    }
  }
  return merged
}

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AIConfig>(defaultConfig)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_config')
      if (saved) {
        try {
          setConfig(sanitizeConfig(JSON.parse(saved)))
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const persist = useCallback((newConfig: AIConfig) => {
    setConfig(newConfig)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_config', JSON.stringify(newConfig))
    }
  }, [])

  const setProvider = useCallback(
    (category: keyof AIConfig, value: string) => {
      setConfig((current) => {
        const newConfig = { ...current, [category]: value }
        // Auto-update model when provider changes and the model is empty.
        if (category.endsWith('Provider')) {
          const provider = value as AIProvider
          const modelKey = category.replace('Provider', 'Model') as keyof AIConfig
          const availableModels = MODEL_OPTIONS[provider]
          if (availableModels && !String(newConfig[modelKey] || '').trim()) {
            (newConfig as any)[modelKey] = availableModels[0]
          }
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai_config', JSON.stringify(newConfig))
        }
        return newConfig
      })
    },
    []
  )

  const updateConfig = useCallback((updates: Partial<AIConfig>) => {
    setConfig((current) => {
      const newConfig = sanitizeConfig({ ...current, ...updates })
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_config', JSON.stringify(newConfig))
      }
      return newConfig
    })
  }, [])

  const resetConfig = useCallback(() => {
    persist(defaultConfig)
  }, [persist])

  return (
    <AIConfigContext.Provider value={{ config, setProvider, updateConfig, resetConfig }}>
      {children}
    </AIConfigContext.Provider>
  )
}

export function useAIConfig() {
  const context = useContext(AIConfigContext)
  if (!context) {
    throw new Error('useAIConfig must be used within an AIConfigProvider')
  }
  return context
}
