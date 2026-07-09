// Registre curé des modèles image Magnific/Freepik.
// Source de vérité partagée UI (formulaires de params) + backend (routage + body).
// Spec: docs/generation-jobs.md — endpoints vérifiés en direct avec la clé de prod.
//
// Deux modes d'appel Magnific (base https://api.magnific.com) :
//  - 'sync'  : POST renvoie directement { data: [{ base64 }] }
//  - 'async' : POST renvoie { data: { task_id, status } } ; on poll GET <endpoint>/<task_id>
//              jusqu'à data.status === 'COMPLETED' → data.generated[] (URLs)
//
// Deux vocabulaires de ratio selon le modèle :
//  - 'named' : square_1_1, social_post_4_5, ...  (Mystic, Flux, Seedream, Classic, Imagen)
//  - 'ratio' : 1:1, 4:5, 9:16, ...               (Nano Banana / Gemini)

export type GenMode = "sync" | "async";
export type AspectVocab = "named" | "ratio";

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
  mode: GenMode;
  endpoint: string; // chemin sous https://api.magnific.com
  aspectKey: "aspect_ratio" | "image.size"; // où placer le ratio dans le body
  aspectVocab: AspectVocab;
  params: ParamField[]; // champs propres au modèle (hors prompt / ratio / quantité)
}

// Sous-ensemble de ratios accepté par TOUS les modèles "named" (vérifié via l'API :
// mystic, flux*, imagen3, seedream*, z-image). D'autres valeurs existent mais ne sont
// pas universelles (ex: social_post_4_5 rejeté par imagen3/seedream).
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
  { value: "4:3", label: "Classique 4:3" },
];

export function aspectOptionsFor(model: ModelDef): ParamOption[] {
  return model.aspectVocab === "ratio" ? ASPECT_RATIO : ASPECT_NAMED;
}

export function defaultAspectFor(model: ModelDef): string {
  return model.aspectVocab === "ratio" ? "4:5" : "traditional_3_4";
}

// Helper interne pour les modèles "génériques" (prompt + ratio, vocab nommé, sans params).
function simple(id: string, label: string, family: string, endpoint: string): ModelDef {
  return { id, label, family, mode: "async", endpoint, aspectKey: "aspect_ratio", aspectVocab: "named", params: [] };
}

// Idem mais avec le vocabulaire de ratio 'ratio' (Nano Banana / Gemini).
function simpleRatio(id: string, label: string, family: string, endpoint: string): ModelDef {
  return { id, label, family, mode: "async", endpoint, aspectKey: "aspect_ratio", aspectVocab: "ratio", params: [] };
}

export const MODELS: ModelDef[] = [
  // ── Magnific ──
  {
    id: "mystic",
    label: "Mystic",
    family: "Magnific",
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

  // ── Google (Gemini / Nano Banana / Imagen) ──
  simpleRatio("nano-banana-pro", "Nano Banana Pro (Gemini)", "Google", "/v1/ai/text-to-image/nano-banana-pro"),
  simpleRatio("nano-banana-pro-flash", "Nano Banana Pro Flash", "Google", "/v1/ai/text-to-image/nano-banana-pro-flash"),
  simple("imagen3", "Imagen 3", "Google", "/v1/ai/text-to-image/imagen3"),

  // ── Flux ──
  simple("flux-2-pro", "Flux 2 Pro", "Flux", "/v1/ai/text-to-image/flux-2-pro"),
  simple("flux-2-turbo", "Flux 2 Turbo", "Flux", "/v1/ai/text-to-image/flux-2-turbo"),
  simple("flux-2-klein", "Flux 2 Klein", "Flux", "/v1/ai/text-to-image/flux-2-klein"),
  simple("flux-pro-v1-1", "Flux Pro v1.1", "Flux", "/v1/ai/text-to-image/flux-pro-v1-1"),
  simple("flux-dev", "Flux Dev", "Flux", "/v1/ai/text-to-image/flux-dev"),
  simple("hyperflux", "HyperFlux", "Flux", "/v1/ai/text-to-image/hyperflux"),

  // ── Seedream ──
  simple("seedream-v4", "Seedream V4", "Seedream", "/v1/ai/text-to-image/seedream-v4"),
  simple("seedream-v4-5", "Seedream V4.5", "Seedream", "/v1/ai/text-to-image/seedream-v4-5"),
  simple("seedream-v5-lite", "Seedream V5 Lite", "Seedream", "/v1/ai/text-to-image/seedream-v5-lite"),

  // ── Autres ──
  simple("z-image", "Z-Image", "Autres", "/v1/ai/text-to-image/z-image"),

  // ── Freepik Classic (synchrone, rapide) ──
  {
    id: "classic",
    label: "Classic (rapide)",
    family: "Freepik",
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
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

// Valeurs de params par défaut pour un modèle.
export function defaultParams(model: ModelDef): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of model.params) {
    if (f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}
