import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { getServerKey, type AIProvider } from './server-keys'
import { getPrompt, getDefaultPrompt } from './prompts-store'
import { buildBrandTextBlock, buildBrandVisualBlock, buildReferenceImagePrompt } from '@/lib/brand-identity'
import { loadBrandIdentityServer } from '@/lib/brand-identity-server'

export interface ResearchResult {
  topics: string
  findings: string
  sources?: string[]
}

export type SocialPlatform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'telegram'

export type ArticleTone =
  | 'Expert & Rassurant'
  | 'Pédagogique'
  | 'Commercial'
  | 'Neutre'

export type ArticleLength = 'short' | 'medium' | 'long'

export interface ScrapedContent {
  title?: string
  content: string
}

export interface SocialPostResult {
  text: string
  platform: SocialPlatform
  trace?: PromptTrace
}

export interface PromptTraceStep {
  step: number
  name: string
  description: string
  systemPrompt?: string
  userPrompt?: string
  assembledPrompt?: string
  output?: string
  metadata?: Record<string, unknown>
}

export interface PromptTrace {
  steps: PromptTraceStep[]
}

export interface ImageResult {
  imageUrl: string
  modelUsed: string
  trace?: PromptTrace
}

export interface VideoResult {
  videoUrl: string
  modelUsed: string
  trace?: PromptTrace
}

export interface VideoPromptBlocks {
  scene: string
  style: string
  camera: string
  movement: string
  lighting: string
  duration: string
  aspectRatio: string
}

export interface ArticleResult {
  title: string
  content: string
  trace?: PromptTrace
}

export type CarouselPlatform =
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'twitter'
  | 'tiktok'

export interface CarouselSlide {
  title: string
  text: string
}

export interface CarouselScriptResult {
  title: string
  slides: CarouselSlide[]
  trace?: PromptTrace
}

function lengthDescription(length: ArticleLength): string {
  switch (length) {
    case 'short':
      return 'Court (400-600 mots)'
    case 'medium':
      return 'Moyen (800-1200 mots)'
    case 'long':
      return 'Long (1500-2500 mots)'
  }
}

class AIProviderManager {
  private static instance: AIProviderManager

  private geminiClient: GoogleGenerativeAI | null = null
  private openaiClient: OpenAI | null = null
  private perplexityClient: OpenAI | null = null

  private constructor() {
    const geminiKey = getServerKey('gemini')
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey)
    }

    const openaiKey = getServerKey('openai')
    if (openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey, timeout: 30000 })
    }

    const perplexityKey = getServerKey('perplexity')
    if (perplexityKey) {
      this.perplexityClient = new OpenAI({
        apiKey: perplexityKey,
        baseURL: 'https://api.perplexity.ai',
        timeout: 30000,
      })
    }
  }

  public static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager()
    }
    return AIProviderManager.instance
  }

  private async callLLM(
    prompt: string,
    provider?: AIProvider,
    temperature = 0.7,
    modelOverride?: string
  ): Promise<string> {
    const result = await this.callLLMWithTrace(prompt, provider, temperature, modelOverride)
    return result.text
  }

  private async callLLMWithTrace(
    prompt: string,
    provider?: AIProvider,
    temperature = 0.7,
    modelOverride?: string
  ): Promise<{ text: string; systemPrompt: string; fullPrompt: string }> {
    const preferred = provider || 'gemini'
    const errors: string[] = []

    // Helper to resolve model per provider
    const resolveModel = (p: AIProvider): string => {
      if (modelOverride && modelOverride.startsWith(p === 'gemini' ? 'gemini' : p === 'openai' ? 'gpt' : 'sonar')) {
        return modelOverride
      }
      switch (p) {
        case 'gemini': return 'gemini-2.5-flash'
        case 'openai': return 'gpt-4o-mini'
        case 'perplexity': return 'sonar-pro'
        default: return 'gemini-2.5-flash'
      }
    }

    // Build enriched system prompt with brand identity
    const brand = loadBrandIdentityServer()
    const brandBlock = buildBrandTextBlock(brand)
    const systemGlobal = getDefaultPrompt('PROMPT_SYSTEM_GLOBAL') || ''
    const system = [brandBlock, systemGlobal].filter(Boolean).join('\n\n')
    const fullPrompt = `${system}\n\n${prompt}`

    // Try preferred first
    const tryProviders: AIProvider[] = [preferred]
    // Then fallback chain
    const fallbackChain: AIProvider[] = ['openai', 'gemini', 'perplexity']
    for (const p of fallbackChain) {
      if (!tryProviders.includes(p)) tryProviders.push(p)
    }

    for (const p of tryProviders) {
      try {
        if (p === 'perplexity' && this.perplexityClient) {
          const result = await this.perplexityClient.chat.completions.create({
            model: resolveModel('perplexity'),
            messages: [{ role: 'user', content: fullPrompt }],
            temperature,
          })
          return { text: result.choices[0]?.message?.content || '', systemPrompt: system, fullPrompt }
        }

        if (p === 'gemini' && this.geminiClient) {
          const model = this.geminiClient.getGenerativeModel({
            model: resolveModel('gemini'),
          })
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature },
          })
          return { text: result.response.text(), systemPrompt: system, fullPrompt }
        }

        if (p === 'openai' && this.openaiClient) {
          const result = await this.openaiClient.chat.completions.create({
            model: resolveModel('openai'),
            messages: [{ role: 'user', content: fullPrompt }],
            temperature,
          })
          return { text: result.choices[0]?.message?.content || '', systemPrompt: system, fullPrompt }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${p}: ${msg}`)
        // Continue to next provider
      }
    }

    throw new Error(`Aucun provider AI disponible. Erreurs : ${errors.join(' | ')}`)
  }

  // ───────────────────────────────────────────────
  // MOCK FALLBACKS
  // ───────────────────────────────────────────────

  private mockDraftArticle(topics: string, tone: string, length: string): ArticleResult {
    return {
      title: `Article sur ${topics} — ${tone}`,
      content: `# ${topics}\n\n**Introduction**\n\nVoici un article de démonstration généré sans clé API configurée. Le sujet est : *${topics}*. Le ton choisi est **${tone}** avec une longueur **${length}**.\n\n## Section principale\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n## Conclusion\n\nMerci d'avoir lu cet article. N'oubliez pas de configurer vos clés API pour des générations réelles.`,
    }
  }

  private mockEnrichArticle(content: string): string {
    return content.replace(/\*\*/g, '**').replace(
      /# /g,
      '# '
    ) + '\n\n> **Note :** Cet article a été enrichi en mode démo (aucune clé API configurée).'
  }

  private mockSocialContent(platform: SocialPlatform): SocialPostResult {
    const mocks: Record<SocialPlatform, string> = {
      twitter: '🚀 Découvrez comment transformer votre contenu en posts engageants ! #MarketingDigital #ContentStrategy',
      linkedin: "Dans un monde où le contenu est roi, savoir adapter son message à chaque plateforme fait toute la différence. Quelle est votre stratégie de contenu pour 2026 ?\n\n#ContentMarketing #LinkedInTips #DigitalStrategy",
      instagram: "✨ Nouveau contenu à découvrir !\n\nOn parle stratégie, création et optimisation. Prêt à passer au niveau supérieur ? 💡\n\n#ContentCreator #InstaDaily #MarketingTips #SocialMedia #DigitalLife #BrandStrategy",
      facebook: "On adore partager des astuces pour améliorer votre présence en ligne. Quel est votre plus grand défi sur les réseaux sociaux ? Dites-nous tout en commentaires ! 👇",
      telegram: "📢 Nouveau : découvrez notre guide pour optimiser vos posts sur tous les réseaux sociaux. Lien dans la bio.",
    }
    return { text: mocks[platform], platform }
  }

  private mockImageDescription(title: string): string {
    return `A professional editorial illustration representing "${title}", clean modern aesthetic, soft lighting, high quality.`
  }

  private mockGenerateImage(): ImageResult {
    // 1x1 transparent pixel as base64 fallback
    return {
      imageUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      modelUsed: 'mock',
    }
  }

  private mockCarouselScript(platform: CarouselPlatform): CarouselScriptResult {
    const mocks: Record<CarouselPlatform, CarouselScriptResult> = {
      instagram: {
        title: '5 astuces pour booster votre contenu',
        slides: [
          { title: 'Le hook', text: 'La première seconde compte plus que tout. Accrochez immédiatement.' },
          { title: 'Storytelling', text: 'Racontez une histoire, pas des faits. Vos abonnés veulent vibrer.' },
          { title: 'Cohérence visuelle', text: 'Une palette de couleurs = une marque reconnaissable.' },
          { title: 'CTA clair', text: 'Demandez explicitement ce que vous voulez : like, partage, commente.' },
          { title: 'Analyse', text: 'Mesurez, ajustez, recommencez. Les données ne mentent pas.' },
        ],
      },
      linkedin: {
        title: 'Comment construire une stratégie LinkedIn efficace',
        slides: [
          { title: 'Le problème', text: '90% des professionnels sous-utilisent LinkedIn. Voici pourquoi.' },
          { title: 'Positionnement', text: 'Définissez votre niche. Spécifique = mémorable.' },
          { title: 'Contenu structuré', text: 'Un post = une idée. Pas plus. La clarté gagne.' },
          { title: 'Engagement', text: 'Répondez à chaque commentaire. L\'algorithme récompense la conversation.' },
          { title: 'CTA', text: 'Suivez-moi pour plus de stratégies. Partagez si cela vous a aidé.' },
        ],
      },
      facebook: {
        title: 'Guide Facebook 2026',
        slides: [
          { title: 'Introduction', text: 'Facebook reste la plateforme avec le plus grand reach. Voici comment en profiter.' },
          { title: 'Communauté', text: 'Créez un groupe. La fidélité y est 10x plus forte.' },
          { title: 'Format', text: 'Les carrousels fonctionnent mieux que les posts simples. Testez.' },
        ],
      },
      twitter: {
        title: 'X en 2026 : ce qui change',
        slides: [
          { title: 'Nouveautés', text: 'Les carrousels ads sont là. 2-6 cartes pour raconter votre histoire.' },
          { title: 'Action', text: 'Chaque carte a son CTA. Utilisez-les intelligemment.' },
        ],
      },
      tiktok: {
        title: 'Viraliser sur TikTok',
        slides: [
          { title: 'Accroche', text: '3 secondes pour convaincre. Pas une de plus.' },
          { title: 'Étape 1', text: 'Trouvez votre format. Répétez jusqu\'à ce que ça marche.' },
          { title: 'Étape 2', text: 'Postez 1x par jour minimum. La constance bat la perfection.' },
          { title: 'CTA', text: 'Abonne-toi pour plus de tips. 🚀' },
        ],
      },
    }
    return mocks[platform]
  }

  private mockResearch(topics: string): ResearchResult {
    return {
      topics,
      findings: `Résultats de recherche (mode démo — aucune clé API configurée) :

1. **Tendance principale** — Les orthophonistes font face à une digitalisation croissante de leur pratique.
2. **Nouvelle réglementation** — Mise à jour des référentiels de formation continue en 2026.
3. **Innovation technologique** — Essor des outils d'aide au diagnostic basés sur l'IA.
4. **Démographie** — Pénurie de professionnels dans certaines régions rurales.
5. **Télésanté** — Consolidation des téléconsultations post-COVID.

Sources : données simulées pour démonstration.`,
      sources: ['https://example.com/demo-source-1', 'https://example.com/demo-source-2'],
    }
  }

  // ───────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────

  public async draftArticle(
    topics: string,
    tone: ArticleTone,
    length: ArticleLength,
    provider?: AIProvider,
    model?: string
  ): Promise<ArticleResult> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      return this.mockDraftArticle(topics, tone, lengthDescription(length))
    }

    const prompt = getPrompt('article_drafting', {
      topics,
      tone,
      length_desc: lengthDescription(length),
    })

    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(prompt, provider, 0.7, model)

    const lines = text.split('\n')
    const title = lines[0].replace(/^#\s*/, '').trim()
    const content = text

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Prompt système global + identité marque',
          description: 'Le system prompt injecté automatiquement avant chaque appel LLM. Contient les instructions globales et le bloc identité marque.',
          systemPrompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.7 },
        },
      ],
    }

    return { title, content, trace }
  }

  public async enrichArticleContent(
    content: string,
    provider?: AIProvider,
    model?: string
  ): Promise<{ content: string; trace: PromptTrace }> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      return { content: this.mockEnrichArticle(content), trace: { steps: [] } }
    }

    const prompt = getPrompt('article_enrichment', { content })
    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(prompt, provider, 0.7, model)

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Enrichissement article',
          description: 'Appel LLM avec le prompt d\'enrichissement et le system prompt global.',
          systemPrompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.7 },
        },
      ],
    }

    return { content: text, trace }
  }

  public async generateSocialContent(
    sourceContent: string,
    platform: SocialPlatform,
    provider?: AIProvider,
    model?: string
  ): Promise<SocialPostResult> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      return this.mockSocialContent(platform)
    }

    const prompt = getPrompt(`social_${platform}`, { source_content: sourceContent })
    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(prompt, provider, 0.7, model)

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Génération de post social',
          description: `Appel LLM pour générer un post ${platform}. Le system prompt global + identité marque est injecté automatiquement.`,
          systemPrompt,
          userPrompt: prompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { platform, provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.7 },
        },
      ],
    }

    return { text, platform, trace }
  }

  public async generateImageDescription(
    title: string,
    content: string,
    provider?: AIProvider,
    model?: string
  ): Promise<{ description: string; trace: PromptTrace }> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      return { description: this.mockImageDescription(title), trace: { steps: [] } }
    }

    const prompt = getPrompt('image_description_generator', { title, content })
    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(prompt, provider, 0.7, model)

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Génération de la description visuelle',
          description: 'Le LLM analyse le contenu source et génère une description visuelle concise (≤ 50 mots) en anglais.',
          systemPrompt,
          userPrompt: prompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.7 },
        },
      ],
    }

    return { description: text, trace }
  }

  public async generateImage(
    prompt: string,
    provider: AIProvider = 'openai',
    model?: string,
    referenceImages?: string[]
  ): Promise<ImageResult> {
    const hasKey = getServerKey(provider)
    if (!hasKey) {
      return this.mockGenerateImage()
    }

    const traceSteps: PromptTrace['steps'] = []

    const tryOpenAIGenerate = async (model: string): Promise<ImageResult | null> => {
      if (!this.openaiClient) return null
      // Map internal names to actual OpenAI API models
      const openAIModel = model === 'gpt-image-2' ? 'dall-e-3' : (model === 'gpt-image-1' ? 'dall-e-2' : model)
      try {
        const result = await this.openaiClient.images.generate({
          model: openAIModel,
          prompt,
          n: 1,
          size: '1024x1024',
        })
        const first = result.data?.[0]
        console.log(`[image-gen] model=${openAIModel} b64_len=${first?.b64_json?.length || 0} url=${first?.url || 'none'}`)
        if (first?.url) {
          traceSteps.push({
            step: traceSteps.length + 1,
            name: 'API OpenAI — images.generate',
            description: `Appel direct à OpenAI images.generate avec le modèle ${openAIModel}.`,
            userPrompt: prompt,
            metadata: { model: openAIModel, api: 'images.generate', size: '1024x1024', hasB64: !!first.b64_json, hasUrl: !!first.url },
          })
          return { imageUrl: first.url, modelUsed: openAIModel, trace: { steps: traceSteps } }
        }
        if (first?.b64_json) {
          traceSteps.push({
            step: traceSteps.length + 1,
            name: 'API OpenAI — images.generate',
            description: `Appel direct à OpenAI images.generate avec le modèle ${openAIModel}.`,
            userPrompt: prompt,
            metadata: { model: openAIModel, api: 'images.generate', size: '1024x1024', b64Length: first.b64_json.length },
          })
          return { imageUrl: `data:image/png;base64,${first.b64_json}`, modelUsed: openAIModel, trace: { steps: traceSteps } }
        }
      } catch (err: any) {
        console.error(`OpenAI image generate error (${openAIModel}):`, err?.message || err)
      }
      return null
    }

    const tryOpenAIEdit = async (): Promise<ImageResult | null> => {
      // DALL-E does not support image-to-image style reference images, and passing a raw buffer
      // in the images.edit API is invalid and causes the connection to hang on shared hosting.
      // We bypass this entirely and fallback to standard generate to prevent 504 timeouts.
      return null
    }

    // OpenAI: try edit with refs first, then generate fallback
    if (provider === 'openai' && this.openaiClient) {
      if (referenceImages && referenceImages.length > 0) {
        const editResult = await tryOpenAIEdit()
        if (editResult) return editResult
        console.log('[image] edit failed, falling back to generate without refs')
      }
      const img2 = await tryOpenAIGenerate('gpt-image-2')
      if (img2) return img2
      const img1 = await tryOpenAIGenerate('gpt-image-1')
      if (img1) return img1
      return this.mockGenerateImage()
    }

    // Gemini fallback to OpenAI images
    if (provider === 'gemini' && this.geminiClient) {
      if (referenceImages && referenceImages.length > 0) {
        const editResult = await tryOpenAIEdit()
        if (editResult) return { ...editResult, modelUsed: `${editResult.modelUsed} (fallback from gemini)` }
      }
      const img2 = await tryOpenAIGenerate('gpt-image-2')
      if (img2) return { ...img2, modelUsed: `${img2.modelUsed} (fallback from gemini)` }
      const img1 = await tryOpenAIGenerate('gpt-image-1')
      if (img1) return { ...img1, modelUsed: `${img1.modelUsed} (fallback from gemini)` }
      return this.mockGenerateImage()
    }

    // Fal.ai / Leonardo / Freepik would be implemented here with their respective SDKs
    // Magnific image generation
    if (provider === 'magnific') {
      const result = await this.generateMagnificImage(prompt, model, referenceImages)
      if (result) return result
      return this.mockGenerateImage()
    }

    return this.mockGenerateImage()
  }

  // ───────────────────────────────────────────────
  // MAGNIFIC HELPERS
  // ───────────────────────────────────────────────

  private magnificApiKey(): string | undefined {
    return getServerKey('magnific')
  }

  private async magnificPost(endpoint: string, body: unknown, apiKey: string): Promise<any> {
    const res = await fetch(`https://api.magnific.com/v1/ai/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-magnific-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Magnific API error ${res.status}: ${text}`)
    }
    return res.json()
  }

  private async magnificGet(endpoint: string, apiKey: string): Promise<any> {
    const res = await fetch(`https://api.magnific.com/v1/ai/${endpoint}`, {
      headers: { 'x-magnific-api-key': apiKey },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Magnific API error ${res.status}: ${text}`)
    }
    return res.json()
  }

  private async pollMagnificTask(
    taskEndpoint: string,
    apiKey: string,
    maxWaitMs = 120000,
    intervalMs = 3000
  ): Promise<string[]> {
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
      const data = await this.magnificGet(taskEndpoint, apiKey)
      const status = data.data?.status
      if (status === 'COMPLETED') {
        return data.data?.generated || []
      }
      if (status === 'FAILED') {
        throw new Error(`Magnific task failed: ${JSON.stringify(data.data)}`)
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error('Magnific task polling timeout')
  }

  private getMagnificImageModel(model?: string): { endpoint: string; body: Record<string, unknown> } {
    const m = model || 'mystic'
    switch (m) {
      case 'reimagine-flux':
        return {
          endpoint: 'reimagine-flux',
          body: {},
        }
      case 'ideogram':
        return {
          endpoint: 'ideogram',
          body: {},
        }
      case 'mystic':
      default:
        return {
          endpoint: 'mystic',
          body: {},
        }
    }
  }

  private async generateMagnificImage(
    prompt: string,
    model?: string,
    referenceImages?: string[]
  ): Promise<ImageResult | null> {
    const apiKey = this.magnificApiKey()
    if (!apiKey) return null

    const traceSteps: PromptTrace['steps'] = []
    const modelConfig = this.getMagnificImageModel(model)
    const endpoint = modelConfig.endpoint
    const modelUsed = endpoint

    try {
      const body: Record<string, unknown> = {
        prompt,
        ...modelConfig.body,
      }

      if (referenceImages && referenceImages.length > 0) {
        // Magnific supports reference images via URLs for some endpoints
        // For mystic and reimagine-flux, we can pass image_url
        if (endpoint === 'mystic' || endpoint === 'reimagine-flux') {
          body.image_url = referenceImages[0]
        }
      }

      const createRes = await this.magnificPost(endpoint, body, apiKey)
      const taskId = createRes.data?.task_id
      if (!taskId) {
        throw new Error('No task_id returned from Magnific')
      }

      traceSteps.push({
        step: 1,
        name: `API Magnific — ${endpoint}`,
        description: `Appel à Magnific ${endpoint} pour générer une image. Polling en cours...`,
        userPrompt: prompt,
        metadata: { endpoint, model: modelUsed, taskId, hasReferenceImages: !!referenceImages?.length },
      })

      const generated = await this.pollMagnificTask(`${endpoint}/${taskId}`, apiKey, 120000, 3000)
      if (!generated.length) {
        throw new Error('Magnific returned no generated images')
      }

      traceSteps.push({
        step: 2,
        name: 'API Magnific — Résultat',
        description: `Image générée avec succès après polling.`,
        metadata: { endpoint, model: modelUsed, resultUrl: generated[0] },
      })

      return {
        imageUrl: generated[0],
        modelUsed,
        trace: { steps: traceSteps },
      }
    } catch (err: any) {
      console.error(`Magnific image generation error (${endpoint}):`, err?.message || err)
      traceSteps.push({
        step: traceSteps.length + 1,
        name: `API Magnific — Erreur`,
        description: `L'appel à Magnific a échoué.`,
        metadata: { error: err?.message || String(err), endpoint },
      })
      return null
    }
  }

  public async enhanceVideoPrompt(
    blocks: VideoPromptBlocks,
    provider?: AIProvider,
    model?: string
  ): Promise<{ enhancedPrompt: string; trace: PromptTrace }> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      const basePrompt = this.buildVideoPromptFromBlocks(blocks)
      return { enhancedPrompt: basePrompt, trace: { steps: [] } }
    }

    const basePrompt = this.buildVideoPromptFromBlocks(blocks)
    const system = `Tu es un expert en prompt engineering pour la génération de vidéos par IA (text-to-video et image-to-video).
Tu reçois un prompt technique assemblé à partir de blocs (scène, style, caméra, mouvement, éclairage).
Ta mission : réécrire ce prompt en un texte fluide, descriptif et cinématographique en anglais, optimisé pour les modèles de génération vidéo (WAN, Kling, Runway, MiniMax).
Règles :
- Décris la scène avec des détails visuels riches (mouvement, lumière, texture, atmosphère).
- Mentionne explicitement le type de plan et le mouvement de caméra.
- Garde le prompt sous 2000 caractères.
- Ne mentionne pas que c'est un "prompt" — écris comme une description de scène de film.
- Réponds UNIQUEMENT avec le prompt amélioré, sans texte additionnel.`

    const userPrompt = `Prompt technique de base :\n${basePrompt}\n\nRéécris ce prompt en une description cinématographique fluide et détaillée en anglais :`

    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(userPrompt, provider, 0.8, model)

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Assemblage des blocs',
          description: 'Les blocs saisis par l\'utilisateur sont combinés en un prompt technique.',
          userPrompt: basePrompt,
          output: basePrompt,
        },
        {
          step: 2,
          name: 'Amélioration IA du prompt vidéo',
          description: 'Un LLM réécrit le prompt technique en une description cinématographique fluide en anglais.',
          systemPrompt,
          userPrompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.8 },
        },
      ],
    }

    return { enhancedPrompt: text.trim(), trace }
  }

  private buildVideoPromptFromBlocks(blocks: VideoPromptBlocks): string {
    const parts = [
      blocks.scene,
      blocks.style && `Style: ${blocks.style}`,
      blocks.camera && `Camera: ${blocks.camera}`,
      blocks.movement && `Movement: ${blocks.movement}`,
      blocks.lighting && `Lighting: ${blocks.lighting}`,
      blocks.duration && `Duration: ${blocks.duration}`,
      blocks.aspectRatio && `Aspect ratio: ${blocks.aspectRatio}`,
    ].filter(Boolean)
    return parts.join('. ')
  }

  public async generateVideo(
    prompt: string,
    provider: AIProvider = 'magnific',
    model?: string,
    imageUrl?: string
  ): Promise<VideoResult> {
    const hasKey = getServerKey(provider)
    if (!hasKey) {
      return this.mockGenerateVideo()
    }

    if (provider === 'magnific') {
      const result = await this.generateMagnificVideo(prompt, model, imageUrl)
      if (result) return result
      return this.mockGenerateVideo()
    }

    return this.mockGenerateVideo()
  }

  private mockGenerateVideo(): VideoResult {
    return {
      videoUrl: '',
      modelUsed: 'mock',
      trace: { steps: [] },
    }
  }

  private getMagnificVideoModel(model?: string): { endpoint: string; body: Record<string, unknown>; isImageToVideo: boolean } {
    const m = model || 'wan-2-7-text-to-video'
    switch (m) {
      case 'wan-v2-2-720p-image-to-video':
        return { endpoint: 'image-to-video/wan-v2-2-720p', body: { duration: '5', aspect_ratio: 'auto' }, isImageToVideo: true }
      case 'kling-o1':
        return { endpoint: 'image-to-video/kling-o1', body: { duration: '5', aspect_ratio: '16:9', quality: 'pro' }, isImageToVideo: true }
      case 'runway-gen-4-5':
        return { endpoint: 'video/runway-gen-4-5', body: { duration: 5, aspect_ratio: '1280:720' }, isImageToVideo: false }
      case 'minimax-live':
        return { endpoint: 'image-to-video/minimax-live', body: { duration: '5' }, isImageToVideo: true }
      case 'wan-2-7-text-to-video':
      default:
        return { endpoint: 'text-to-video/wan-2-7', body: { duration: 5, aspect_ratio: '16:9', resolution: '1080P' }, isImageToVideo: false }
    }
  }

  private async generateMagnificVideo(
    prompt: string,
    model?: string,
    imageUrl?: string
  ): Promise<VideoResult | null> {
    const apiKey = this.magnificApiKey()
    if (!apiKey) return null

    const traceSteps: PromptTrace['steps'] = []
    const modelConfig = this.getMagnificVideoModel(model)
    const endpoint = modelConfig.endpoint
    const modelUsed = model || 'wan-2-7-text-to-video'

    try {
      const body: Record<string, unknown> = {
        prompt,
        ...modelConfig.body,
      }

      if (modelConfig.isImageToVideo && imageUrl) {
        const isDataUri = imageUrl.startsWith('data:')
        if (endpoint.includes('wan-v2-2-720p') || endpoint.includes('minimax-live')) {
          // Magnific accepts both URL and base64 for these endpoints
          body.image = imageUrl
        } else if (endpoint.includes('kling-o1')) {
          // Kling O1 officially supports URL only, but we'll try passing base64 directly
          // If it fails, user should use a different I2V model or generate via /api/ai/image first
          body.first_frame_url = isDataUri ? imageUrl : imageUrl
        } else if (endpoint.includes('runway-gen-4-5') && isDataUri) {
          // Runway Gen 4.5 I2V mode uses image_url
          body.image_url = imageUrl
        }
      }

      const createRes = await this.magnificPost(endpoint, body, apiKey)
      const taskId = createRes.data?.task_id
      if (!taskId) {
        throw new Error('No task_id returned from Magnific video API')
      }

      traceSteps.push({
        step: 1,
        name: `API Magnific — ${endpoint}`,
        description: `Appel à Magnific ${endpoint} pour générer une vidéo. Polling en cours (peut prendre plusieurs minutes)...`,
        userPrompt: prompt,
        metadata: { endpoint, model: modelUsed, taskId, isImageToVideo: modelConfig.isImageToVideo, imageUrl },
      })

      const generated = await this.pollMagnificTask(`${endpoint}/${taskId}`, apiKey, 600000, 5000)
      if (!generated.length) {
        throw new Error('Magnific returned no generated videos')
      }

      traceSteps.push({
        step: 2,
        name: 'API Magnific — Résultat vidéo',
        description: `Vidéo générée avec succès après polling.`,
        metadata: { endpoint, model: modelUsed, resultUrl: generated[0] },
      })

      return {
        videoUrl: generated[0],
        modelUsed,
        trace: { steps: traceSteps },
      }
    } catch (err: any) {
      console.error(`Magnific video generation error (${endpoint}):`, err?.message || err)
      traceSteps.push({
        step: traceSteps.length + 1,
        name: `API Magnific — Erreur vidéo`,
        description: `L'appel à Magnific vidéo a échoué.`,
        metadata: { error: err?.message || String(err), endpoint },
      })
      return null
    }
  }

  public async generateCarouselScript(
    sourceContent: string,
    platform: CarouselPlatform,
    provider?: AIProvider,
    model?: string
  ): Promise<CarouselScriptResult> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      return this.mockCarouselScript(platform)
    }

    const prompt = getPrompt(`carousel_${platform}`, { source_content: sourceContent })
    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(prompt, provider, 0.7, model)

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Génération du script de carrousel',
          description: `Appel LLM pour générer un script JSON de carrousel ${platform}.`,
          systemPrompt,
          userPrompt: prompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { platform, provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.7 },
        },
      ],
    }

    // Try to extract JSON from the response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.title && Array.isArray(parsed.slides)) {
          return {
            title: String(parsed.title),
            slides: parsed.slides.map((s: any) => ({
              title: String(s.title || ''),
              text: String(s.text || ''),
            })),
            trace,
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    // Fallback: return raw text as a single slide
    return {
      title: `Carrousel ${platform}`,
      slides: [{ title: 'Slide 1', text: text.slice(0, 500) }],
      trace,
    }
  }

  public async generateCarouselSlideDescription(
    slideText: string,
    globalContext: string,
    provider?: AIProvider,
    model?: string
  ): Promise<{ description: string; trace: PromptTrace }> {
    const hasKey = getServerKey(provider || 'gemini') || getServerKey('openai')
    if (!hasKey) {
      return { description: this.mockImageDescription(slideText), trace: { steps: [] } }
    }

    const brand = loadBrandIdentityServer()
    const visualBlock = buildBrandVisualBlock(brand)
    let prompt = `À partir du texte de slide suivant et du contexte global, génère une description visuelle concise (≤ 50 mots) pour une illustration IA en anglais, photoréaliste.

Contexte global : ${globalContext.slice(0, 200)}
Texte du slide : ${slideText}`
    if (visualBlock) {
      prompt += `\n\nContraintes visuelles : ${visualBlock}`
    }
    prompt += `\n\nDescription visuelle :`
    const { text, systemPrompt, fullPrompt } = await this.callLLMWithTrace(prompt, provider, 0.7, model)

    const trace: PromptTrace = {
      steps: [
        {
          step: 1,
          name: 'Description visuelle de slide',
          description: 'Génération d\'une description visuelle pour un slide de carrousel.',
          systemPrompt,
          userPrompt: prompt,
          assembledPrompt: fullPrompt,
          output: text,
          metadata: { provider: provider || 'gemini', model: model || 'gemini-2.5-flash', temperature: 0.7 },
        },
      ],
    }

    return { description: text, trace }
  }

  public async scrapeUrl(url: string): Promise<ScrapedContent> {
    try {
      const { Readability } = await import('@mozilla/readability')
      const { JSDOM } = await import('jsdom')

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()

      if (!article) {
        return { title: url, content: html.replace(/<[^>]*>/g, ' ').slice(0, 8000) }
      }

      return {
        title: article.title || url,
        content: article.textContent || '',
      }
    } catch (error) {
      throw new Error(`Scraping failed: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }

  public async research(
    topics: string,
    provider?: AIProvider,
    model?: string
  ): Promise<ResearchResult> {
    const hasKey = getServerKey(provider || 'perplexity') || getServerKey('openai') || getServerKey('gemini')
    if (!hasKey) {
      return this.mockResearch(topics)
    }

    const prompt = getPrompt('research_veille', { topics })
    const system = getDefaultPrompt('PROMPT_SYSTEM_GLOBAL') || ''
    const response = await this.callLLM(`${system}\n\n${prompt}`, provider, 0.5, model)

    // Essayer d'extraire les sources si présentes
    const sourceRegex = /Sources?[\s:]*\n?((?:-?\s*https?:\/\/[^\s]+\n?)+)/gi
    const sourceMatch = sourceRegex.exec(response)
    const sources = sourceMatch
      ? sourceMatch[1].split('\n').map(s => s.replace(/^-\s*/, '').trim()).filter(s => s.startsWith('http'))
      : undefined

    const findings = sources ? response.replace(sourceRegex, '').trim() : response

    return { topics, findings, sources }
  }

  public async extractPdfText(buffer: Buffer): Promise<{ content: string; pageCount: number }> {
    try {
      const pdfParseModule = await import('pdf-parse')
      const pdfParse = (pdfParseModule as any).default || pdfParseModule
      const data = await pdfParse(buffer)
      return {
        content: data.text || '',
        pageCount: data.numpages || 0,
      }
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }
}

export const aiManager = AIProviderManager.getInstance()
