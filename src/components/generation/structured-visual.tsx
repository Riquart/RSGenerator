"use client";

import { useEffect, useState } from "react";
import { Loader2, Download, Wand2, LayoutPanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Zone {
  text: string;
  bg: string;
}

const FORMATS = [
  { value: "portrait_4_5", label: "Portrait 4:5" },
  { value: "story_9_16", label: "Story 9:16" },
  { value: "square_1_1", label: "Carré 1:1" },
];

// Palette de secours si la charte n'est pas chargée.
const FALLBACK_COLORS = ["#0E254F", "#F26A3A", "#E6EAED", "#FFF1C2", "#FCE4E4", "#FFFFFF"];

// Découpe un texte en n blocs à peu près équilibrés (phrases regroupées).
function splitIntoZones(text: string, n: number): string[] {
  const parts = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return Array.from({ length: n }, () => "");
  const per = Math.ceil(parts.length / n);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(parts.slice(i * per, (i + 1) * per).join(" "));
  return out.map((s) => s || "");
}

export function StructuredVisual({ baseText }: { baseText: string }) {
  const [palette, setPalette] = useState<string[]>(FALLBACK_COLORS);
  const [logo, setLogo] = useState<string | undefined>();
  const [useLogo, setUseLogo] = useState(true);

  const [format, setFormat] = useState("portrait_4_5");
  const [nbZones, setNbZones] = useState(4);
  const [zones, setZones] = useState<Zone[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({ text: "", bg: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imgUrl, setImgUrl] = useState<string | undefined>();

  // Charge la charte (couleurs + logo) pour piloter la DA.
  useEffect(() => {
    fetch("/api/ai/brand")
      .then((r) => r.json())
      .then((d) => {
        const brand = d?.brand;
        if (!brand) return;
        const cols = (brand.colors || [])
          .filter((c: { enabled?: boolean; hex?: string }) => c.enabled && c.hex)
          .map((c: { hex: string }) => c.hex);
        const pal = [...cols, "#FFFFFF"];
        if (pal.length > 1) {
          setPalette(pal);
          setZones((cur) => cur.map((z, i) => ({ ...z, bg: pal[i % pal.length] })));
        }
        if (brand.logoBase64) setLogo(brand.logoBase64);
      })
      .catch(() => {});
  }, []);

  const changeNbZones = (n: number) => {
    setNbZones(n);
    setZones((cur) => {
      const next = [...cur];
      while (next.length < n) next.push({ text: "", bg: palette[next.length % palette.length] });
      return next.slice(0, n);
    });
  };

  const patchZone = (i: number, patch: Partial<Zone>) =>
    setZones((cur) => cur.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));

  const autofill = () => {
    const texts = splitIntoZones(baseText || "", nbZones);
    setZones((cur) => cur.map((z, i) => ({ ...z, text: texts[i] || z.text })));
  };

  const generate = async () => {
    if (zones.every((z) => !z.text.trim())) {
      setError("Remplis au moins une zone (ou clique « Auto-remplir »).");
      return;
    }
    setError("");
    setLoading(true);
    setImgUrl(undefined);
    try {
      const res = await fetch("/api/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          zones: zones.map((z) => ({ text: z.text, bg: z.bg })),
          ...(useLogo && logo ? { logo: { dataUrl: logo, size: 120 } } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Rendu impossible");
      }
      const blob = await res.blob();
      setImgUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] space-y-1">
          <Label className="text-xs">Gabarit</Label>
          <Select value="column-n" onValueChange={() => {}}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="column-n">Colonne à N zones</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px] space-y-1">
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[110px] space-y-1">
          <Label className="text-xs">Nb de zones</Label>
          <Select value={String(nbZones)} onValueChange={(v) => changeNbZones(Number(v))}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} zones
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={autofill} className="h-9">
          <Wand2 className="mr-1 h-4 w-4" />
          Auto-remplir depuis le contexte
        </Button>
      </div>

      {/* Zones : texte + couleur de fond */}
      <div className="space-y-2">
        {zones.map((z, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border bg-slate-50 p-2">
            <span className="mt-2 w-6 shrink-0 text-center text-xs font-bold text-slate-400">{i + 1}</span>
            <Textarea
              value={z.text}
              onChange={(e) => patchZone(i, { text: e.target.value })}
              placeholder={`Texte de la zone ${i + 1}`}
              className="min-h-10 flex-1 bg-white text-sm"
            />
            <div className="flex flex-wrap gap-1" style={{ maxWidth: 120 }}>
              {palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patchZone(i, { bg: c })}
                  title={c}
                  className={`h-6 w-6 rounded border ${z.bg === c ? "ring-2 ring-[#10aee2] ring-offset-1" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {logo && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={useLogo} onChange={(e) => setUseLogo(e.target.checked)} />
            Logo de marque
          </label>
        )}
        <Button onClick={generate} disabled={loading} className="bg-[#10aee2] hover:bg-[#0d92be] text-white">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutPanelTop className="mr-2 h-4 w-4" />}
          Générer le visuel
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {imgUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="Visuel structuré" className="max-h-[520px] rounded-lg border" />
          <Button asChild variant="outline" size="sm">
            <a href={imgUrl} download="visuel.png">
              <Download className="mr-1 h-4 w-4" />
              Télécharger
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
