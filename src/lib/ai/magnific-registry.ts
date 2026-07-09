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

export type Provider = "magnific" | "leonardo";
export type GenMode = "sync" | "async";
export type AspectVocab = "named" | "ratio" | "wh";

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
  leoModelId?: string; // UUID du modèle Leonardo (provider 'leonardo')
}

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "magnific", label: "Magnific" },
  { id: "leonardo", label: "Leonardo" },
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

export const ASPECT_WH: ParamOption[] = [
  { value: "1024x1024", label: "Carré 1:1" },
  { value: "832x1216", label: "Portrait 3:4" },
  { value: "768x1344", label: "Story 9:16" },
  { value: "1344x768", label: "Paysage 16:9" },
  { value: "1216x832", label: "Paysage 4:3" },
];

export function aspectOptionsFor(model: ModelDef): ParamOption[] {
  if (model.aspectVocab === "ratio") return ASPECT_RATIO;
  if (model.aspectVocab === "wh") return ASPECT_WH;
  return ASPECT_NAMED;
}

export function defaultAspectFor(model: ModelDef): string {
  if (model.aspectVocab === "ratio") return "4:5";
  if (model.aspectVocab === "wh") return "832x1216";
  return "traditional_3_4";
}

// ── Helpers Magnific ──
function mg(id: string, label: string, family: string, endpoint: string): ModelDef {
  return { id, label, family, provider: "magnific", mode: "async", endpoint, aspectKey: "aspect_ratio", aspectVocab: "named", params: [] };
}
function mgRatio(id: string, label: string, family: string, endpoint: string): ModelDef {
  return { id, label, family, provider: "magnific", mode: "async", endpoint, aspectKey: "aspect_ratio", aspectVocab: "ratio", params: [] };
}
// ── Helper Leonardo ──
function leo(id: string, label: string, leoModelId: string): ModelDef {
  return { id, label, family: "Leonardo", provider: "leonardo", mode: "async", endpoint: "", aspectKey: "aspect_ratio", aspectVocab: "wh", params: [], leoModelId };
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
  mgRatio("nano-banana-pro", "Nano Banana Pro (Gemini)", "Google", "/v1/ai/text-to-image/nano-banana-pro"),
  mgRatio("nano-banana-pro-flash", "Nano Banana Pro Flash", "Google", "/v1/ai/text-to-image/nano-banana-pro-flash"),
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

  // ── Leonardo (nécessite LEONARDO_API_KEY) ──
  // UUID récupérés en direct via /platformModels du compte.
  leo("leo-lucid-origin", "Lucid Origin", "7b592283-e8a7-4c5a-9ba6-d18c31f258b9"),
  leo("leo-lucid-realism", "Lucid Realism", "05ce0082-2d80-4a2d-8653-4d1c85e2418e"),
  leo("leo-phoenix-1", "Phoenix 1.0", "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"),
  leo("leo-kino-xl", "Kino XL (cinéma)", "aa77f04e-3eec-4034-9c07-d0f619684628"),
  leo("leo-vision-xl", "Vision XL (photo)", "5c232a9e-9061-4777-980a-ddc8e65647c6"),
  leo("leo-anime-xl", "Anime XL", "e71a1c2f-4f80-4800-934f-2c68979d8cc8"),
  leo("leo-lightning-xl", "Lightning XL (rapide)", "b24e16ff-06e3-43eb-8d33-4416c2d75876"),
  leo("leo-flux-dev", "Flux Dev", "b2614463-296c-462a-9586-aafdb8f00e36"),
  leo("leo-albedo-xl", "AlbedoBase XL", "2067ae52-33fd-4a82-bb92-c2c55e7d2786"),
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
