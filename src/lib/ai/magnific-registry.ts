// Registre curé des modèles image Magnific/Freepik.
// Source de vérité partagée UI (formulaires de params) + backend (routage + body).
// Spec: docs/generation-jobs.md
//
// Deux modes d'appel Freepik (base https://api.freepik.com) :
//  - 'sync'  : POST renvoie directement { data: [{ base64 }] }
//  - 'async' : POST renvoie { data: { task_id, status } } ; on poll GET <endpoint>/<task_id>
//              jusqu'à data.status === 'COMPLETED' → data.generated[] (URLs)

export type GenMode = "sync" | "async";

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
  endpoint: string; // chemin sous https://api.freepik.com
  aspectKey: "aspect_ratio" | "image.size"; // où placer le ratio dans le body
  params: ParamField[]; // champs propres au modèle (hors prompt / ratio / quantité)
  note?: string;
}

// Ratios communs (enums Freepik).
export const ASPECT_OPTIONS: ParamOption[] = [
  { value: "square_1_1", label: "Carré 1:1" },
  { value: "social_post_4_5", label: "Portrait 4:5" },
  { value: "social_story_9_16", label: "Story 9:16" },
  { value: "widescreen_16_9", label: "Paysage 16:9" },
  { value: "classic_4_3", label: "Classique 4:3" },
];

export const DEFAULT_ASPECT = "social_post_4_5";

export const MODELS: ModelDef[] = [
  {
    id: "mystic",
    label: "Mystic",
    family: "Magnific",
    mode: "async",
    endpoint: "/v1/ai/mystic",
    aspectKey: "aspect_ratio",
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
  {
    id: "classic",
    label: "Classic (rapide)",
    family: "Freepik",
    mode: "sync",
    endpoint: "/v1/ai/text-to-image",
    aspectKey: "image.size",
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
  {
    id: "flux-dev",
    label: "Flux Dev",
    family: "Flux",
    mode: "async",
    endpoint: "/v1/ai/text-to-image/flux-dev",
    aspectKey: "aspect_ratio",
    params: [{ key: "seed", label: "Seed (optionnel)", type: "number", min: 0, max: 1000000 }],
  },
  {
    id: "flux-2-pro",
    label: "Flux 2 Pro",
    family: "Flux",
    mode: "async",
    endpoint: "/v1/ai/text-to-image/flux-2-pro",
    aspectKey: "aspect_ratio",
    params: [],
  },
  // Seedream 4.5 : endpoint OK mais "Validation error" sur le body — params à caler
  // (probablement le champ ratio ou un champ requis). À réactiver après vérif API reference.
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
