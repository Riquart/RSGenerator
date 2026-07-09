import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerKey } from "@/lib/ai/server-keys";
import { getModel } from "@/lib/ai/magnific-registry";
import {
  MAGNIFIC_BASE,
  magnificHeaders,
  buildBody,
  extractSyncImage,
  readAsyncStatus,
} from "@/lib/ai/magnific-client";
import { LEONARDO_BASE, leonardoHeaders, parseWH, readLeonardoCreate } from "@/lib/ai/leonardo-client";
import { getClientIP } from "@/lib/get-ip";
import { checkRateLimit } from "@/lib/rate-limit";

const genSchema = z.object({
  modelId: z.string(),
  prompt: z.string().min(3),
  aspect: z.string(),
  params: z.record(z.any()).optional().default({}),
});

function errMsg(json: unknown, text: string, status: number): string {
  return (
    (json as { message?: string; error?: string })?.message ||
    (json as { error?: string })?.error ||
    text ||
    `HTTP ${status}`
  );
}

// Crée une génération : renvoie l'image directement (sync) ou un task_id à poller (async).
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  if (!checkRateLimit(ip).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Max 20 req/min." }, { status: 429 });
  }

  try {
    const parsed = genSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Requête invalide", details: parsed.error.format() }, { status: 400 });
    }

    const { modelId, prompt, aspect, params } = parsed.data;
    const model = getModel(modelId);
    if (!model) {
      return NextResponse.json({ error: `Modèle inconnu : ${modelId}` }, { status: 400 });
    }

    // ── Leonardo ──
    if (model.provider === "leonardo") {
      const key = getServerKey("leonardo");
      if (!key) {
        return NextResponse.json({ error: "LEONARDO_API_KEY non configurée sur le serveur." }, { status: 500 });
      }
      const { width, height } = parseWH(aspect);
      const body = { prompt, modelId: model.leoModelId, width, height, num_images: 1 };
      const res = await fetch(`${LEONARDO_BASE}/generations`, {
        method: "POST",
        headers: leonardoHeaders(key),
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok) {
        return NextResponse.json({ error: `Leonardo (${model.label}) : ${errMsg(json, text, res.status)}` }, { status: 502 });
      }
      const genId = readLeonardoCreate(json);
      if (!genId) {
        return NextResponse.json({ error: `Leonardo (${model.label}) : generationId manquant.` }, { status: 502 });
      }
      return NextResponse.json({ mode: "async", taskId: genId, status: "CREATED" });
    }

    // ── Magnific ──
    const key = getServerKey("magnific");
    if (!key) {
      return NextResponse.json({ error: "MAGNIFIC_API_KEY non configurée sur le serveur." }, { status: 500 });
    }

    const body = buildBody(model, prompt, aspect, params);
    const res = await fetch(`${MAGNIFIC_BASE}${model.endpoint}`, {
      method: "POST",
      headers: magnificHeaders(key),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}

    if (!res.ok) {
      return NextResponse.json({ error: `Magnific (${model.label}) : ${errMsg(json, text, res.status)}` }, { status: 502 });
    }

    if (model.mode === "sync") {
      const imageUrl = extractSyncImage(json);
      if (!imageUrl) {
        return NextResponse.json({ error: `Magnific (${model.label}) : aucune image renvoyée.` }, { status: 502 });
      }
      return NextResponse.json({ mode: "sync", imageUrl });
    }

    const { taskId, status } = readAsyncStatus(json);
    if (!taskId) {
      return NextResponse.json({ error: `Magnific (${model.label}) : task_id manquant.` }, { status: 502 });
    }
    return NextResponse.json({ mode: "async", taskId, status: status || "CREATED" });
  } catch (error) {
    console.error("/api/gen error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
