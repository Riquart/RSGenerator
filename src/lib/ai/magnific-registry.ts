// Registre curé des modèles image, multi-provider (Magnific/Freepik + Leonardo).
// Source de vérité partagée UI (formulaires) + backend (routage + body).
// Spec: docs/generation-jobs.md — endpoints Magnific sondés en direct avec la clé de prod.
//
// Magnific (base https://api.magnific.com) :
//  - 'sync'  : POST renvoie { data: [{ base64 }] }
//  - 'async' : POST renvoie { data: { task_id, status } } ; poll GET <endpoint>/<task_id>
// Leonardo (base https://cloud.leonardo.ai/api/rest/v1) :
//  - async : POST /generations renvoie { sdGenerationJob: { generationId } } ;
//            poll GET /generations/{id} → generations_by_pk.generated_images[].url
//
// Vocabulaires de ratio :
//  - 'named' : square_1_1, traditional_3_4, ...   (Magnific: Mystic, Flux, Seedream, Imagen)
//  - 'ratio' : 1:1, 4:5, 9:16, ...                (Magnific: Nano Banana / Gemini)
//  - 'wh'    : "832x1216" (largeurxhauteur)         (Leonardo)

export type Provider = "magnific" | "openai";
export type GenMode = "sync" | "async";
export type AspectVocab = "named" | "ratio" | "size";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamField {
  key: string;
  label: string;
  type: "select" | "number";
  options?: ParamOption[];
  default?: string | number;
  min?: number;
  max?: number;
}

export interface ModelDef {
  id: string;
  label: string;
  family: string;
  provider: Provider;
  mode: GenMode;
  endpoint: string; // Magnific: chemin API ; Leonardo: non utilisé
  aspectKey: "aspect_ratio" | "image.size";
  aspectVocab: AspectVocab;
  params: ParamField[];
  oaiModel?: string; // id du modèle OpenAI (provider 'openai'), ex 'gpt-image-2'
  supportsRefs?: boolean; // accepte les images de référence de marque (style)
}

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "magnific", label: "Magnific" },
  { id: "openai", label: "OpenAI" },
];

export const ASPECT_NAMED: ParamOption[] = [
  { value: "square_1_1", label: "Carré 1:1" },
  { value: "traditional_3_4", label: "Portrait 3:4" },
  { value: "social_story_9_16", label: "Story 9:16" },
  { value: "widescreen_16_9", label: "Paysage 16:9" },
  { value: "classic_4_3", label: "Paysage 4:3" },
];

export const ASPECT_RATIO: ParamOption[] = [
  { value: "1:1", label: "Carré 1:1" },
  { value: "4:5", label: "Portrait 4:5" },
  { value: "9:16", label: "Story 9:16" },
  { value: "16:9", label: "Paysage 16:9" },
  { value: "4:3", label: "Paysage 4:3" },
];

// Tailles supportées par gpt-image (OpenAI) : passées telles quelles dans `size`.
export const ASPECT_SIZE: ParamOption[] = [
  { value: "1024x1024", label: "Carré 1:1" },
  { value: "1024x1536", label: "Portrait 2:3" },
  { value: "1536x1024", label: "Paysage 3:2" },
];

export function aspectOptionsFor(model: ModelDef): ParamOption[] {
  if (model.aspectVocab === "ratio") return ASPECT_RATIO;
  if (model.aspectVocab === "size") return ASPECT_SIZE;
  return ASPECT_NAMED;
}

export function defaultAspectFor(model: ModelDef): string {
  if (model.aspectVocab === "ratio") return "4:5";
  if (model.aspectVocab === "size") return "1024x1024";
  return "traditional_3_4";
}

// ── Helpers Magnific ──
function mg(id: string, label: string, family: string, endpoint: string): ModelDef {
  return { id, label, family, provider: "magnific", mode: "async", endpoint, aspectKey: "aspect_ratio", aspectVocab: "named", params: [] };
}
function mgRatio(id: string, label: string, family: string, endpoint: string, supportsRefs = false): ModelDef {
  return { id, label, family, provider: "magnific", mode: "async", endpoint, aspectKey: "aspect_ratio", aspectVocab: "ratio", params: [], supportsRefs };
}
// ── Helper OpenAI (gpt-image, synchrone) ──
function oai(id: string, label: string, oaiModel: string): ModelDef {
  return {
    id,
    label,
    family: "OpenAI",
    provider: "openai",
    mode: "sync",
    endpoint: "",
    aspectKey: "aspect_ratio",
    aspectVocab: "size",
    oaiModel,
    params: [
      {
        key: "quality",
        label: "Qualité",
        type: "select",
        default: "medium",
        options: [
          { value: "low", label: "Basse (rapide)" },
          { value: "medium", label: "Moyenne" },
          { value: "high", label: "Haute" },
        ],
      },
    ],
  };
}

export const MODELS: ModelDef[] = [
  // ── Magnific ──
  {
    id: "mystic",
    label: "Mystic",
    family: "Magnific",
    provider: "magnific",
    mode: "async",
    endpoint: "/v1/ai/mystic",
    aspectKey: "aspect_ratio",
    aspectVocab: "named",
    supportsRefs: true,
    params: [
      {
        key: "model",
        label: "Style Mystic",
        type: "select",
        default: "realism",
        options: [
          { value: "realism", label: "Realism" },
          { value: "fluid", label: "Fluid" },
          { value: "zen", label: "Zen" },
          { value: "flexible", label: "Flexible" },
          { value: "super_real", label: "Super Real" },
          { value: "editorial_portraits", label: "Editorial Portraits" },
        ],
      },
      {
        key: "resolution",
        label: "Résolution",
        type: "select",
        default: "2k",
        options: [
          { value: "1k", label: "1K" },
          { value: "2k", label: "2K" },
          { value: "4k", label: "4K" },
        ],
      },
      { key: "creative_detailing", label: "Détail créatif", type: "number", default: 33, min: 0, max: 100 },
    ],
  },

  // Google (Gemini / Nano Banana / Imagen)
  mgRatio("nano-banana-pro", "Nano Banana Pro (Gemini)", "Google", "/v1/ai/text-to-image/nano-banana-pro", true),
  mgRatio("nano-banana-pro-flash", "Nano Banana Pro Flash", "Google", "/v1/ai/text-to-image/nano-banana-pro-flash", true),
  mg("imagen3", "Imagen 3", "Google", "/v1/ai/text-to-image/imagen3"),

  // Flux
  mg("flux-2-pro", "Flux 2 Pro", "Flux", "/v1/ai/text-to-image/flux-2-pro"),
  mg("flux-2-turbo", "Flux 2 Turbo", "Flux", "/v1/ai/text-to-image/flux-2-turbo"),
  mg("flux-2-klein", "Flux 2 Klein", "Flux", "/v1/ai/text-to-image/flux-2-klein"),
  mg("flux-pro-v1-1", "Flux Pro v1.1", "Flux", "/v1/ai/text-to-image/flux-pro-v1-1"),
  mg("flux-dev", "Flux Dev", "Flux", "/v1/ai/text-to-image/flux-dev"),
  mg("hyperflux", "HyperFlux", "Flux", "/v1/ai/text-to-image/hyperflux"),

  // Seedream
  mg("seedream-v4", "Seedream V4", "Seedream", "/v1/ai/text-to-image/seedream-v4"),
  mg("seedream-v4-5", "Seedream V4.5", "Seedream", "/v1/ai/text-to-image/seedream-v4-5"),
  mg("seedream-v5-lite", "Seedream V5 Lite", "Seedream", "/v1/ai/text-to-image/seedream-v5-lite"),

  // Autres
  mg("z-image", "Z-Image", "Autres", "/v1/ai/text-to-image/z-image"),

  // Freepik Classic (synchrone, rapide)
  {
    id: "classic",
    label: "Classic (rapide)",
    family: "Freepik",
    provider: "magnific",
    mode: "sync",
    endpoint: "/v1/ai/text-to-image",
    aspectKey: "image.size",
    aspectVocab: "named",
    params: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "",
        options: [
          { value: "", label: "Auto" },
          { value: "photo", label: "Photo" },
          { value: "digital-art", label: "Digital art" },
          { value: "3d", label: "3D" },
          { value: "anime", label: "Anime" },
        ],
      },
      { key: "guidance_scale", label: "Guidance", type: "number", default: 1, min: 0, max: 2 },
    ],
  },

  // ── OpenAI (utilise OPENAI_API_KEY — la même clé que le chat LLM) ──
  oai("gpt-image-2", "GPT Image 2", "gpt-image-2"),
  oai("gpt-image-1", "GPT Image 1", "gpt-image-1"),
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsByProvider(provider: Provider): ModelDef[] {
  return MODELS.filter((m) => m.provider === provider);
}

// Valeurs de params par défaut pour un modèle.
export function defaultParams(model: ModelDef): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of model.params) {
    if (f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}
