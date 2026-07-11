import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export const runtime = "nodejs";

// Tailles de sortie par format social.
const SIZES: Record<string, [number, number]> = {
  square_1_1: [1080, 1080],
  portrait_4_5: [1080, 1350],
  story_9_16: [1080, 1920],
  landscape_16_9: [1920, 1080],
};

function fontData(file: string): Buffer {
  return readFileSync(path.join(process.cwd(), "assets", "fonts", file));
}

// Couleur de texte lisible sur un fond donné (navy marque sur clair, blanc sur foncé).
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
  bg?: string; // hex de fond
  color?: string; // couleur texte (sinon auto)
  bgImage?: string; // data URL / URL image de fond (optionnel)
}

// Gabarit "colonne à N zones" : zones empilées, texte net centré, logo optionnel.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const format: string = body.format || "portrait_4_5";
    const [w, h] = SIZES[format] || SIZES.portrait_4_5;
    const zones: Zone[] = Array.isArray(body.zones) ? body.zones.slice(0, 6) : [];
    const logo: { dataUrl?: string; size?: number } | undefined = body.logo;

    if (zones.length === 0) {
      return NextResponse.json({ error: "Au moins une zone est requise." }, { status: 400 });
    }

    const regular = fontData("inter-400.woff");
    const bold = fontData("inter-700.woff");

    // Taille de police adaptée au nombre de zones (plus il y a de zones, plus petit).
    const base = format === "story_9_16" ? 56 : 48;
    const fontSize = Math.max(28, Math.round(base - (zones.length - 2) * 6));

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            position: "relative",
            fontFamily: "Inter",
          }}
        >
          {zones.map((z, i) => {
            const bg = z.bg || "#0E254F";
            const color = z.color || idealText(bg);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 64px",
                  background: bg,
                  ...(z.bgImage
                    ? {
                        backgroundImage: `url(${z.bgImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize,
                    fontWeight: 700,
                    color,
                    textAlign: "center",
                    lineHeight: 1.25,
                  }}
                >
                  {z.text}
                </div>
              </div>
            );
          })}

          {logo?.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo.dataUrl}
              alt=""
              width={logo.size || 120}
              style={{ position: "absolute", right: 32, bottom: 28 }}
            />
          ) : null}
        </div>
      ),
      {
        width: w,
        height: h,
        fonts: [
          { name: "Inter", data: regular, weight: 400, style: "normal" },
          { name: "Inter", data: bold, weight: 700, style: "normal" },
        ],
      }
    );
  } catch (error) {
    console.error("/api/visual error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur rendu visuel" },
      { status: 500 }
    );
  }
}
