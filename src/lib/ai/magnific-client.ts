// Client bas niveau Magnific/Freepik. Utilisé par /api/gen et /api/gen/status.
import type { ModelDef } from "./magnific-registry";

export const MAGNIFIC_BASE = "https://api.freepik.com";

// Les docs Magnific mentionnent `x-magnific-api-key`, l'API Freepik `x-freepik-api-key`.
// On envoie les deux avec la même clé pour couvrir les deux conventions.
export function magnificHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-magnific-api-key": key,
    "x-freepik-api-key": key,
  };
}

// Construit le corps de requête à partir du modèle, du prompt, du ratio et des params.
export function buildBody(
  model: ModelDef,
  prompt: string,
  aspect: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt };

  if (model.aspectKey === "image.size") {
    body.image = { size: aspect };
  } else {
    body.aspect_ratio = aspect;
  }

  for (const field of model.params) {
    const raw = params[field.key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = field.type === "number" ? Number(raw) : raw;
    if (field.type === "number" && Number.isNaN(value)) continue;

    // Classic (sync) attend le style sous styling.style
    if (model.id === "classic" && field.key === "style") {
      body.styling = { ...(body.styling as object), style: value };
      continue;
    }
    body[field.key] = value;
  }

  if (model.mode === "sync") body.num_images = 1;
  return body;
}

// Extrait une image d'une réponse SYNCHRONE ({ data: [{ base64 }] }).
export function extractSyncImage(json: unknown): string | undefined {
  const data = (json as { data?: Array<{ base64?: string; url?: string }> })?.data;
  const first = Array.isArray(data) ? data[0] : undefined;
  if (first?.url) return first.url;
  if (first?.base64) return `data:image/png;base64,${first.base64}`;
  return undefined;
}

// Lit le statut d'une réponse ASYNC (POST ou GET) : { data: { task_id, status, generated } }.
export function readAsyncStatus(json: unknown): {
  taskId?: string;
  status?: string;
  imageUrl?: string;
} {
  const data = (json as { data?: { task_id?: string; status?: string; generated?: string[] } })?.data;
  return {
    taskId: data?.task_id,
    status: data?.status,
    imageUrl: Array.isArray(data?.generated) ? data?.generated[0] : undefined,
  };
}
