"use client";

import { useEffect, useState } from "react";
import { Loader2, Images, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Slide {
  title: string;
  text: string;
}

const FALLBACK = ["#0E254F", "#F26A3A"];

// Génère les visuels d'un carrousel via le moteur de gabarits (/api/visual) :
// slide 0 = cover, slides suivantes = carousel-slide. Texte NET (pas d'IA baké).
export function CarouselVisuals({ slides }: { slides: Slide[] }) {
  const [palette, setPalette] = useState<string[]>(FALLBACK);
  const [logo, setLogo] = useState<string | undefined>();
  const [format, setFormat] = useState("square_1_1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/ai/brand")
      .then((r) => r.json())
      .then((d) => {
        const brand = d?.brand;
        if (!brand) return;
        const cols = (brand.colors || [])
          .filter((c: { enabled?: boolean; hex?: string }) => c.enabled && c.hex)
          .map((c: { hex: string }) => c.hex);
        if (cols.length) setPalette(cols);
        if (brand.logoBase64) setLogo(brand.logoBase64);
      })
      .catch(() => {});
  }, []);

  const render = async (payload: object): Promise<string> => {
    const res = await fetch("/api/visual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Rendu impossible");
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  const generateAll = async () => {
    if (!slides || slides.length === 0) return;
    setError("");
    setLoading(true);
    setImages([]);
    try {
      const logoOpt = logo ? { logo: { dataUrl: logo, size: 120 } } : {};
      // allSettled : une slide qui échoue n'empêche pas les autres de s'afficher.
      const settled = await Promise.allSettled(
        slides.map((s, i) => {
          const bg = palette[i % palette.length];
          const common = { format, title: s.title, text: s.text, bg, ...logoOpt };
          return i === 0
            ? render({ template: "carousel-cover", ...common })
            : render({ template: "carousel-slide", index: i, total: slides.length, ...common });
        })
      );
      const urls = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);
      const failed = settled.length - urls.length;
      setImages(urls);
      if (urls.length === 0) {
        const first = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        setError(first ? `Rendu impossible : ${first.reason?.message || first.reason}` : "Aucun visuel généré.");
      } else if (failed > 0) {
        setError(`${failed} slide(s) sur ${settled.length} n'ont pas pu être rendues.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Visuels du carrousel (gabarit, texte net)</span>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="square_1_1">Carré 1:1</SelectItem>
            <SelectItem value="portrait_4_5">Portrait 4:5</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={generateAll}
          disabled={loading}
          className="bg-[#10aee2] hover:bg-[#0d92be] text-white"
        >
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Images className="mr-1 h-4 w-4" />}
          Générer les visuels
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((url, i) => (
            <div key={i} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Slide ${i + 1}`} className="w-full rounded-md border" />
              <a
                href={url}
                download={`slide-${i + 1}.png`}
                className="flex items-center gap-1 text-xs text-[#10aee2] hover:underline"
              >
                <Download className="h-3 w-3" />
                Slide {i + 1}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
