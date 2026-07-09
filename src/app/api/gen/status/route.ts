import { NextRequest, NextResponse } from "next/server";
import { getServerKey } from "@/lib/ai/server-keys";
import { getModel } from "@/lib/ai/magnific-registry";
import { MAGNIFIC_BASE, magnificHeaders, readAsyncStatus } from "@/lib/ai/magnific-client";

// Poll du statut d'une tâche async Magnific. Pas de rate-limit : appelé en boucle
// par le client (déjà protégé par l'auth middleware).
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

    const key = getServerKey("magnific");
    if (!key) {
      return NextResponse.json({ error: "MAGNIFIC_API_KEY non configurée." }, { status: 500 });
    }

    const res = await fetch(`${MAGNIFIC_BASE}${model.endpoint}/${taskId}`, {
      method: "GET",
      headers: magnificHeaders(key),
    });

    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // non-JSON
    }

    if (!res.ok) {
      const msg =
        (json as { message?: string; error?: string })?.message ||
        (json as { error?: string })?.error ||
        `HTTP ${res.status}`;
      return NextResponse.json({ status: "FAILED", error: `Magnific : ${msg}` }, { status: 200 });
    }

    const { status, imageUrl } = readAsyncStatus(json);
    return NextResponse.json({ status: status || "IN_PROGRESS", imageUrl });
  } catch (error) {
    console.error("/api/gen/status error:", error);
    return NextResponse.json(
      { status: "FAILED", error: error instanceof Error ? error.message : "Erreur interne" },
      { status: 200 }
    );
  }
}
