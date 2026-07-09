import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerKey, type AIProvider } from "@/lib/ai/server-keys";
import { getModel } from "@/lib/ai/magnific-registry";
import {
  MAGNIFIC_BASE,
  magnificHeaders,
  buildBody,
  extractSyncImage,
  readAsyncStatus,
  applyReferences,
} from "@/lib/ai/magnific-client";
import { aiManager } from "@/lib/ai/provider-manager";
import { loadBrandIdentityServer } from "@/lib/brand-identity-server";
import { buildBrandVisualBlock, type BrandIdentity } from "@/lib/brand-identity";
import { getClientIP } from "@/lib/get-ip";
import { checkRateLimit } from "@/lib/rate-limit";

const genSchema = z.object({
  modelId: z.string(),
  prompt: z.string().min(3),
  aspect: z.string(),
  params: z.record(z.any()).optional().default({}),
  // Passe de description visuelle (rend l'image moins littérale) + charte/DA.
  describe: z.boolean().optional().default(true),
  useRefs: z.boolean().optional().default(true),
  textProvider: z.string().optional(),
  textModel: z.string().optional(),
  visualStyle: z.string().optional(),
});

// Construit le prompt image final : description visuelle IA (optionnelle) + charte/DA marque.
async function buildImagePrompt(
  prompt: string,
  describe: boolean,
  visualStyle: string | undefined,
  textProvider: string | undefined,
  textModel: string | undefined,
  brand: BrandIdentity | null
): Promise<string> {
  const visualBlock = buildBrandVisualBlock(brand); // couleurs, mood, typo, exclusions = DA
  const styleText = [visualStyle, visualBlock].filter(Boolean).join(". ");

  if (describe) {
    try {
      const { description } = await aiManager.generateImageDescription(
        prompt.slice(0, 100),
        prompt,
        (textProvider as AIProvider) || undefined,
        textModel,
        styleText || undefined
      );
      return [description, visualBlock].filter(Boolean).join(". ");
    } catch {
      // fallback : texte brut + DA
    }
  }
  return [prompt, visualBlock].filter(Boolean).join(visualBlock ? "\n\n" : "");
}

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

    const { modelId, prompt, aspect, params, describe, useRefs, textProvider, textModel, visualStyle } = parsed.data;
    const model = getModel(modelId);
    if (!model) {
      return NextResponse.json({ error: `Modèle inconnu : ${modelId}` }, { status: 400 });
    }

    // Charte/DA marque chargée une fois (prompt + images de référence).
    const brand = loadBrandIdentityServer();

    // Prompt image enrichi : description visuelle IA (optionnelle) + charte/DA marque.
    const imagePrompt = await buildImagePrompt(prompt, describe, visualStyle, textProvider, textModel, brand);

    // ── OpenAI (gpt-image, synchrone) ──
    if (model.provider === "openai") {
      const key = getServerKey("openai");
      if (!key) {
        return NextResponse.json({ error: "OPENAI_API_KEY non configurée sur le serveur." }, { status: 500 });
      }
      const quality = (params.quality as string) || "medium";
      const body = { model: model.oaiModel, prompt: imagePrompt, size: aspect, n: 1, quality };
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok) {
        const msg = (json as { error?: { message?: string } })?.error?.message || errMsg(json, text, res.status);
        return NextResponse.json({ error: `OpenAI (${model.label}) : ${msg}` }, { status: 502 });
      }
      const first = (json as { data?: { b64_json?: string; url?: string }[] })?.data?.[0];
      const imageUrl = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined);
      if (!imageUrl) {
        return NextResponse.json({ error: `OpenAI (${model.label}) : aucune image renvoyée.` }, { status: 502 });
      }
      return NextResponse.json({ mode: "sync", imageUrl });
    }

    // ── Magnific ──
    const key = getServerKey("magnific");
    if (!key) {
      return NextResponse.json({ error: "MAGNIFIC_API_KEY non configurée sur le serveur." }, { status: 500 });
    }

    const body = buildBody(model, imagePrompt, aspect, params);
    if (useRefs && model.supportsRefs && brand?.referenceImages?.length) {
      applyReferences(model, body, brand.referenceImages);
    }
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
