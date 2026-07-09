// Client bas niveau Leonardo.ai (API v1). Utilisé par /api/gen et /api/gen/status.
// Doc: https://docs.leonardo.ai/reference/creategeneration
export const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";

export function leonardoHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
  };
}

// Parse un ratio Leonardo "LARGEURxHAUTEUR" (ex: "832x1216") -> { width, height }.
export function parseWH(aspect: string): { width: number; height: number } {
  const [w, h] = String(aspect).split("x").map((n) => parseInt(n, 10));
  return {
    width: Number.isFinite(w) ? w : 1024,
    height: Number.isFinite(h) ? h : 1024,
  };
}

// Extrait le generationId de la réponse POST /generations.
export function readLeonardoCreate(json: unknown): string | undefined {
  return (json as { sdGenerationJob?: { generationId?: string } })?.sdGenerationJob?.generationId;
}

// Lit le statut d'une réponse GET /generations/{id}.
// status Leonardo: PENDING | COMPLETE | FAILED  -> on normalise vers IN_PROGRESS/COMPLETED/FAILED.
export function readLeonardoStatus(json: unknown): { status: string; imageUrl?: string } {
  const pk = (json as {
    generations_by_pk?: { status?: string; generated_images?: { url?: string }[] };
  })?.generations_by_pk;
  const raw = pk?.status || "PENDING";
  const status = raw === "COMPLETE" ? "COMPLETED" : raw === "FAILED" ? "FAILED" : "IN_PROGRESS";
  const imageUrl = Array.isArray(pk?.generated_images) ? pk?.generated_images[0]?.url : undefined;
  return { status, imageUrl };
}
