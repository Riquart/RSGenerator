import { NextRequest, NextResponse } from "next/server";
import { getServerKey } from "@/lib/ai/server-keys";
import { getModel } from "@/lib/ai/magnific-registry";
import { MAGNIFIC_BASE, magnificHeaders, readAsyncStatus } from "@/lib/ai/magnific-client";
import { LEONARDO_BASE, leonardoHeaders, readLeonardoStatus } from "@/lib/ai/leonardo-client";

// Poll du statut d'une tâche async. Pas de rate-limit : appelé en boucle par le
// client (déjà protégé par l'auth middleware).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("modelId") || "";
    const taskId = searchParams.get("taskId") || "";

    if (!taskId) {
      return NextResponse.json({ error: "taskId manquant" }, { status: 400 });
    }
    const model = getModel(modelId);
    if (!model) {
      return NextResponse.json({ error: `Modèle inconnu : ${modelId}` }, { status: 400 });
    }

    // ── Leonardo ──
    if (model.provider === "leonardo") {
      const key = getServerKey("leonardo");
      if (!key) {
        return NextResponse.json({ status: "FAILED", error: "LEONARDO_API_KEY non configurée." }, { status: 200 });
      }
      const res = await fetch(`${LEONARDO_BASE}/generations/${taskId}`, {
        method: "GET",
        headers: leonardoHeaders(key),
      });
      const text = await res.text();
      let json: unknown = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok) {
        return NextResponse.json({ status: "FAILED", error: `Leonardo : HTTP ${res.status}` }, { status: 200 });
      }
      const { status, imageUrl } = readLeonardoStatus(json);
      return NextResponse.json({ status, imageUrl });
    }

    // ── Magnific ──
    const key = getServerKey("magnific");
    if (!key) {
      return NextResponse.json({ status: "FAILED", error: "MAGNIFIC_API_KEY non configurée." }, { status: 200 });
    }

    const res = await fetch(`${MAGNIFIC_BASE}${model.endpoint}/${taskId}`, {
      method: "GET",
      headers: magnificHeaders(key),
    });

    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}

    if (!res.ok) {
      const msg =
        (json as { message?: string; error?: string })?.message ||
        (json as { error?: string })?.error ||
        `HTTP ${res.status}`;
      return NextResponse.json({ status: "FAILED", error: `Magnific : ${msg}` }, { status: 200 });
    }

    const { status, imageUrl } = readAsyncStatus(json);
    // Surface la raison d'un échec Magnific (le champ data varie selon le modèle).
    let error: string | undefined;
    if (status === "FAILED") {
      const data = (json as { data?: unknown })?.data;
      const detail = typeof data === "string" ? data : JSON.stringify(data);
      error = `Échec du modèle. ${detail ? detail.slice(0, 200) : ""}`.trim();
    }
    return NextResponse.json({ status: status || "IN_PROGRESS", imageUrl, error });
  } catch (error) {
    console.error("/api/gen/status error:", error);
    return NextResponse.json(
      { status: "FAILED", error: error instanceof Error ? error.message : "Erreur interne" },
      { status: 200 }
    );
  }
}
