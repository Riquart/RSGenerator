import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { ReactElement } from "react";

export const runtime = "nodejs";

const SIZES: Record<string, [number, number]> = {
  square_1_1: [1080, 1080],
  portrait_4_5: [1080, 1350],
  story_9_16: [1080, 1920],
  landscape_16_9: [1920, 1080],
};

function fontData(file: string): Buffer {
  return readFileSync(path.join(process.cwd(), "assets", "fonts", file));
}

function idealText(hex: string): string {
  const c = (hex || "#0E254F").replace("#", "");
  if (c.length < 6) return "#FFFFFF";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#0E254F" : "#FFFFFF";
}

interface Zone {
  text: string;
  bg?: string;
  color?: string;
  bgImage?: string;
}
interface Logo {
  dataUrl?: string;
  size?: number;
}

function logoNode(logo?: Logo): ReactElement | null {
  if (!logo?.dataUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.dataUrl} alt="" width={logo.size || 120} style={{ position: "absolute", right: 40, bottom: 36 }} />
  );
}

// Calques de fond image pour Satori : un <img> en cover + un voile sombre.
// (Satori ne gère pas `background-image: linear-gradient(...), url(...)` — on empile
// des calques absolus ; le texte, placé APRÈS dans le DOM, se dessine au-dessus.)
function bgImageLayers(bgImage?: string): ReactElement | null {
  if (!bgImage) return null;
  return (
    <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bgImage} alt="" width="100%" height="100%" style={{ objectFit: "cover" }} />
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.45)" }} />
    </div>
  );
}

// ── Gabarit : colonne à N zones ──
function columnN(zones: Zone[], fmt: string, logo?: Logo): ReactElement {
  const base = fmt === "story_9_16" ? 56 : 48;
  const fontSize = Math.max(28, Math.round(base - (zones.length - 2) * 6));
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", fontFamily: "Inter" }}>
      {zones.map((z, i) => {
        const bg = z.bg || "#0E254F";
        const color = z.bgImage ? "#FFFFFF" : z.color || idealText(bg);
        return (
          <div key={i} style={{ position: "relative", overflow: "hidden", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 64px", backgroundColor: bg }}>
            {bgImageLayers(z.bgImage)}
            <div style={{ display: "flex", fontSize, fontWeight: 700, color, textAlign: "center", lineHeight: 1.25 }}>{z.text}</div>
          </div>
        );
      })}
      {logoNode(logo)}
    </div>
  );
}

// ── Gabarit : slide de carrousel (titre + texte + n°) ──
function carouselSlide(o: { title?: string; text?: string; bg?: string; bgImage?: string; index?: number; total?: number; logo?: Logo }): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = o.bgImage ? "#FFFFFF" : idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 80, position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage)}
      {o.total ? (
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color, opacity: 0.6 }}>{(o.index ?? 0) + 1}/{o.total}</div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        {o.title ? <div style={{ display: "flex", fontSize: 60, fontWeight: 700, color, lineHeight: 1.15 }}>{o.title}</div> : null}
        {o.text ? <div style={{ display: "flex", fontSize: 34, fontWeight: 400, color, marginTop: 28, lineHeight: 1.35 }}>{o.text}</div> : null}
      </div>
      {logoNode(o.logo)}
    </div>
  );
}

// ── Gabarit : cover de carrousel ──
function carouselCover(o: { title?: string; text?: string; bg?: string; bgImage?: string; logo?: Logo }): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = o.bgImage ? "#FFFFFF" : idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 90, justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage)}
      {o.title ? <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color, lineHeight: 1.1 }}>{o.title}</div> : null}
      {o.text ? <div style={{ display: "flex", fontSize: 36, fontWeight: 400, color, marginTop: 28, lineHeight: 1.3 }}>{o.text}</div> : null}
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color, opacity: 0.7, marginTop: 48 }}>Swipe →</div>
      {logoNode(o.logo)}
    </div>
  );
}

// ── Gabarit : quote-card ──
function quoteCard(o: { quote?: string; author?: string; bg?: string; bgImage?: string; logo?: Logo }): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = o.bgImage ? "#FFFFFF" : idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 96, justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage)}
      <div style={{ display: "flex", fontSize: 140, fontWeight: 700, color, opacity: 0.35, lineHeight: 0.7 }}>“</div>
      <div style={{ display: "flex", fontSize: 50, fontWeight: 700, color, lineHeight: 1.25 }}>{o.quote || ""}</div>
      {o.author ? <div style={{ display: "flex", fontSize: 32, fontWeight: 400, color, opacity: 0.85, marginTop: 32 }}>— {o.author}</div> : null}
      {logoNode(o.logo)}
    </div>
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const template: string = body.template || "column-n";
    const format: string = body.format || (template === "column-n" ? "portrait_4_5" : "square_1_1");
    const [w, h] = SIZES[format] || SIZES.square_1_1;
    const logo: Logo | undefined = body.logo;

    let element: ReactElement;
    if (template === "carousel-slide") {
      element = carouselSlide({ ...body, logo });
    } else if (template === "carousel-cover") {
      element = carouselCover({ ...body, logo });
    } else if (template === "quote-card") {
      element = quoteCard({ ...body, logo });
    } else {
      const zones: Zone[] = Array.isArray(body.zones) ? body.zones.slice(0, 6) : [];
      if (zones.length === 0) {
        return NextResponse.json({ error: "Au moins une zone est requise." }, { status: 400 });
      }
      element = columnN(zones, format, logo);
    }

    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts: [
        { name: "Inter", data: fontData("inter-400.woff"), weight: 400, style: "normal" },
        { name: "Inter", data: fontData("inter-700.woff"), weight: 700, style: "normal" },
      ],
    });
  } catch (error) {
    console.error("/api/visual error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur rendu visuel" },
      { status: 500 }
    );
  }
}
