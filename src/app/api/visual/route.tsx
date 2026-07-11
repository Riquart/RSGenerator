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

function rgb(hex: string): [number, number, number] {
  const c = (hex || "#0E254F").replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function idealText(hex: string): string {
  const [r, g, b] = rgb(hex);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#0E254F" : "#FFFFFF";
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
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

// Calques de fond image (Satori) : <img> en dimensions PIXELS + voile TEINTÉ de la
// couleur de la zone (pas noir). Le texte, placé APRÈS dans le DOM, se dessine au-dessus.
function bgImageLayers(bgImage: string | undefined, w: number, h: number, tint: string): ReactElement | null {
  if (!bgImage) return null;
  return (
    <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: w, height: h }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bgImage} alt="" width={w} height={h} style={{ objectFit: "cover" }} />
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: w, height: h, backgroundColor: tint }} />
    </div>
  );
}

// ── Gabarit : colonne à N zones ──
function columnN(zones: Zone[], w: number, h: number, fmt: string, logo?: Logo): ReactElement {
  const base = fmt === "story_9_16" ? 56 : 48;
  const fontSize = Math.max(28, Math.round(base - (zones.length - 2) * 6));
  const zoneH = Math.round(h / zones.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", fontFamily: "Inter" }}>
      {zones.map((z, i) => {
        const bg = z.bg || "#0E254F";
        const color = z.color || idealText(bg);
        return (
          <div key={i} style={{ position: "relative", overflow: "hidden", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 64px", backgroundColor: bg }}>
            {bgImageLayers(z.bgImage, w, zoneH, rgba(bg, 0.55))}
            <div style={{ display: "flex", fontSize, fontWeight: 700, color, textAlign: "center", lineHeight: 1.25 }}>{z.text}</div>
          </div>
        );
      })}
      {logoNode(logo)}
    </div>
  );
}

// ── Gabarit : slide de carrousel ──
function carouselSlide(o: { title?: string; text?: string; bg?: string; bgImage?: string; index?: number; total?: number; logo?: Logo }, w: number, h: number): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 80, position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage, w, h, rgba(bg, 0.55))}
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
function carouselCover(o: { title?: string; text?: string; bg?: string; bgImage?: string; logo?: Logo }, w: number, h: number): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 90, justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage, w, h, rgba(bg, 0.55))}
      {o.title ? <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color, lineHeight: 1.1 }}>{o.title}</div> : null}
      {o.text ? <div style={{ display: "flex", fontSize: 36, fontWeight: 400, color, marginTop: 28, lineHeight: 1.3 }}>{o.text}</div> : null}
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color, opacity: 0.7, marginTop: 48 }}>Swipe →</div>
      {logoNode(o.logo)}
    </div>
  );
}

// ── Gabarit : quote-card ──
function quoteCard(o: { quote?: string; author?: string; bg?: string; bgImage?: string; logo?: Logo }, w: number, h: number): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 96, justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage, w, h, rgba(bg, 0.55))}
      <div style={{ display: "flex", fontSize: 140, fontWeight: 700, color, opacity: 0.35, lineHeight: 0.7 }}>“</div>
      <div style={{ display: "flex", fontSize: 50, fontWeight: 700, color, lineHeight: 1.25 }}>{o.quote || ""}</div>
      {o.author ? <div style={{ display: "flex", fontSize: 32, fontWeight: 400, color, opacity: 0.85, marginTop: 32 }}>— {o.author}</div> : null}
      {logoNode(o.logo)}
    </div>
  );
}

// ── Gabarit : liste (titre + puces) ──
function listCard(o: { title?: string; items?: string[]; bg?: string; bgImage?: string; logo?: Logo }, w: number, h: number): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = idealText(bg);
  const items = (Array.isArray(o.items) ? o.items : []).filter((s) => s && s.trim());
  const itemSize = Math.max(28, 48 - items.length * 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 90, position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage, w, h, rgba(bg, 0.55))}
      {o.title ? <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color, lineHeight: 1.15, marginBottom: 40 }}>{o.title}</div> : null}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", marginBottom: 22 }}>
            <div style={{ display: "flex", fontSize: itemSize, fontWeight: 700, color, marginRight: 20 }}>•</div>
            <div style={{ display: "flex", fontSize: itemSize, fontWeight: 400, color, lineHeight: 1.3 }}>{it}</div>
          </div>
        ))}
      </div>
      {logoNode(o.logo)}
    </div>
  );
}

// ── Gabarit : comparatif (2 colonnes) ──
function comparatif(o: { title?: string; leftTitle?: string; leftItems?: string[]; rightTitle?: string; rightItems?: string[]; bg?: string; bgImage?: string; logo?: Logo }, w: number, h: number): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = idealText(bg);
  const L = (Array.isArray(o.leftItems) ? o.leftItems : []).filter((s) => s && s.trim());
  const R = (Array.isArray(o.rightItems) ? o.rightItems : []).filter((s) => s && s.trim());
  const col = { display: "flex", flexDirection: "column" as const, flex: 1, padding: "0 32px" };
  const item = (it: string, i: number) => (
    <div key={i} style={{ display: "flex", fontSize: 30, fontWeight: 400, color, marginBottom: 16, lineHeight: 1.3 }}>{it}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 80, position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage, w, h, rgba(bg, 0.55))}
      {o.title ? <div style={{ display: "flex", justifyContent: "center", fontSize: 52, fontWeight: 700, color, marginBottom: 44 }}>{o.title}</div> : null}
      <div style={{ display: "flex", flexDirection: "row", flex: 1 }}>
        <div style={col}>
          {o.leftTitle ? <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color, marginBottom: 26 }}>{o.leftTitle}</div> : null}
          {L.map(item)}
        </div>
        <div style={{ display: "flex", width: 2, backgroundColor: rgba(color, 0.3) }} />
        <div style={col}>
          {o.rightTitle ? <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color, marginBottom: 26 }}>{o.rightTitle}</div> : null}
          {R.map(item)}
        </div>
      </div>
      {logoNode(o.logo)}
    </div>
  );
}

// ── Gabarit : chiffre-clé ──
function chiffreCle(o: { figure?: string; label?: string; bg?: string; bgImage?: string; logo?: Logo }, w: number, h: number): ReactElement {
  const bg = o.bg || "#0E254F";
  const color = idealText(bg);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 90, justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg }}>
      {bgImageLayers(o.bgImage, w, h, rgba(bg, 0.55))}
      <div style={{ display: "flex", fontSize: 220, fontWeight: 700, color, lineHeight: 1 }}>{o.figure || ""}</div>
      {o.label ? <div style={{ display: "flex", fontSize: 44, fontWeight: 400, color, textAlign: "center", marginTop: 28, lineHeight: 1.3 }}>{o.label}</div> : null}
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
      element = carouselSlide({ ...body, logo }, w, h);
    } else if (template === "carousel-cover") {
      element = carouselCover({ ...body, logo }, w, h);
    } else if (template === "quote-card") {
      element = quoteCard({ ...body, logo }, w, h);
    } else if (template === "liste") {
      element = listCard({ ...body, logo }, w, h);
    } else if (template === "comparatif") {
      element = comparatif({ ...body, logo }, w, h);
    } else if (template === "chiffre-cle") {
      element = chiffreCle({ ...body, logo }, w, h);
    } else {
      const zones: Zone[] = Array.isArray(body.zones) ? body.zones.slice(0, 6) : [];
      if (zones.length === 0) {
        return NextResponse.json({ error: "Au moins une zone est requise." }, { status: 400 });
      }
      element = columnN(zones, w, h, format, logo);
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
