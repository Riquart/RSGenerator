"use client";

import { useEffect, useState } from "react";
import { Loader2, Download, Wand2, LayoutPanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  bgImage?: string; // fond image IA (optionnel)
}

type Gabarit = "column-n" | "quote-card" | "liste" | "comparatif" | "chiffre-cle";

const GABARITS: { value: Gabarit; label: string }[] = [
  { value: "column-n", label: "Colonne à N zones" },
  { value: "liste", label: "Liste (titre + puces)" },
  { value: "comparatif", label: "Comparatif (2 colonnes)" },
  { value: "chiffre-cle", label: "Chiffre-clé" },
  { value: "quote-card", label: "Quote-card" },
];

// Découpe un textarea en items (une ligne = un item).
const toItems = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);

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

  const [gabarit, setGabarit] = useState<Gabarit>("column-n");
  const [panelBg, setPanelBg] = useState("#0E254F");
  // quote-card
  const [quote, setQuote] = useState("");
  const [author, setAuthor] = useState("");
  // liste
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState("");
  // comparatif
  const [cmpTitle, setCmpTitle] = useState("");
  const [cmpLeftTitle, setCmpLeftTitle] = useState("Avant");
  const [cmpLeftItems, setCmpLeftItems] = useState("");
  const [cmpRightTitle, setCmpRightTitle] = useState("Après");
  const [cmpRightItems, setCmpRightItems] = useState("");
  // chiffre-clé
  const [figFigure, setFigFigure] = useState("");
  const [figLabel, setFigLabel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imgUrl, setImgUrl] = useState<string | undefined>();
  const [bgLoading, setBgLoading] = useState<Record<number, boolean>>({});

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
          setPanelBg(pal[0]);
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

  // Fond image IA pour une zone (modèle sync 'classic', pas de texte dessiné).
  const generateZoneBg = async (i: number) => {
    const promptBase = (zones[i].text || baseText || "arrière-plan de marque").slice(0, 280);
    setError("");
    setBgLoading((c) => ({ ...c, [i]: true }));
    try {
      const res = await fetch("/api/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: "classic",
          prompt: `${promptBase} — arrière-plan abstrait, sobre, sans texte`,
          aspect: "square_1_1",
          params: {},
          describe: false,
          useRefs: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Fond IA impossible");
      if (data.imageUrl) patchZone(i, { bgImage: data.imageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur fond IA");
    } finally {
      setBgLoading((c) => ({ ...c, [i]: false }));
    }
  };

  const autofill = () => {
    const texts = splitIntoZones(baseText || "", nbZones);
    setZones((cur) => cur.map((z, i) => ({ ...z, text: texts[i] || z.text })));
  };

  const generate = async () => {
    if (gabarit === "quote-card" && !quote.trim()) {
      setError("Écris une citation.");
      return;
    }
    if (gabarit === "column-n" && zones.every((z) => !z.text.trim())) {
      setError("Remplis au moins une zone (ou clique « Auto-remplir »).");
      return;
    }
    if (gabarit === "liste" && toItems(listItems).length === 0) {
      setError("Ajoute au moins une puce (une par ligne).");
      return;
    }
    if (gabarit === "chiffre-cle" && !figFigure.trim()) {
      setError("Renseigne le chiffre-clé.");
      return;
    }
    setError("");
    setLoading(true);
    setImgUrl(undefined);
    try {
      const logoOpt = useLogo && logo ? { logo: { dataUrl: logo, size: 120 } } : {};
      let payload: Record<string, unknown>;
      if (gabarit === "quote-card") {
        payload = { template: "quote-card", format, quote, author, bg: panelBg, ...logoOpt };
      } else if (gabarit === "liste") {
        payload = { template: "liste", format, title: listTitle, items: toItems(listItems), bg: panelBg, ...logoOpt };
      } else if (gabarit === "comparatif") {
        payload = {
          template: "comparatif",
          format,
          title: cmpTitle,
          leftTitle: cmpLeftTitle,
          leftItems: toItems(cmpLeftItems),
          rightTitle: cmpRightTitle,
          rightItems: toItems(cmpRightItems),
          bg: panelBg,
          ...logoOpt,
        };
      } else if (gabarit === "chiffre-cle") {
        payload = { template: "chiffre-cle", format, figure: figFigure, label: figLabel, bg: panelBg, ...logoOpt };
      } else {
        payload = {
          template: "column-n",
          format,
          zones: zones.map((z) => ({ text: z.text, bg: z.bg, bgImage: z.bgImage })),
          ...logoOpt,
        };
      }
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
      setImgUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const renderBgPicker = () => (
    <div className="space-y-1">
      <Label className="text-xs">Fond</Label>
      <div className="flex flex-wrap gap-1">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setPanelBg(c)}
            title={c}
            className={`h-7 w-7 rounded border ${panelBg === c ? "ring-2 ring-[#10aee2] ring-offset-1" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[190px] space-y-1">
          <Label className="text-xs">Gabarit</Label>
          <Select value={gabarit} onValueChange={(v) => setGabarit(v as Gabarit)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GABARITS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
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
        {gabarit === "column-n" && (
          <>
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
          </>
        )}
      </div>

      {/* Zones : texte + couleur de fond (colonne à N zones) */}
      {gabarit === "column-n" && (
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
              <div className="flex flex-col items-end gap-1" style={{ width: 132 }}>
                <div className="flex flex-wrap justify-end gap-1">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patchZone(i, { bg: c, bgImage: undefined })}
                      title={c}
                      className={`h-6 w-6 rounded border ${z.bg === c && !z.bgImage ? "ring-2 ring-[#10aee2] ring-offset-1" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {z.bgImage && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={z.bgImage} alt="" className="h-6 w-6 rounded border object-cover" />
                      <button
                        type="button"
                        onClick={() => patchZone(i, { bgImage: undefined })}
                        title="Retirer le fond IA"
                        className="text-[11px] text-slate-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => generateZoneBg(i)}
                    disabled={bgLoading[i]}
                    className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-[#10aee2] hover:bg-[#10aee2]/5"
                  >
                    {bgLoading[i] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    Fond IA
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote-card */}
      {gabarit === "quote-card" && (
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Citation</Label>
            <Textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="La phrase à mettre en avant…"
              className="min-h-16 bg-white text-sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] space-y-1">
              <Label className="text-xs">Auteur (optionnel)</Label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="ex : Vega"
                className="h-9 bg-white"
              />
            </div>
            {renderBgPicker()}
          </div>
        </div>
      )}

      {/* Liste */}
      {gabarit === "liste" && (
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Titre</Label>
            <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="ex : 3 points à retenir" className="h-9 bg-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Puces (une par ligne)</Label>
            <Textarea
              value={listItems}
              onChange={(e) => setListItems(e.target.value)}
              placeholder={"Premier point\nDeuxième point\nTroisième point"}
              className="min-h-24 bg-white text-sm"
            />
          </div>
          {renderBgPicker()}
        </div>
      )}

      {/* Comparatif */}
      {gabarit === "comparatif" && (
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Titre (optionnel)</Label>
            <Input value={cmpTitle} onChange={(e) => setCmpTitle(e.target.value)} placeholder="ex : Avant / Après 2027" className="h-9 bg-white" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Input value={cmpLeftTitle} onChange={(e) => setCmpLeftTitle(e.target.value)} placeholder="Titre colonne gauche" className="h-9 bg-white" />
              <Textarea value={cmpLeftItems} onChange={(e) => setCmpLeftItems(e.target.value)} placeholder={"Élément 1\nÉlément 2"} className="min-h-24 bg-white text-sm" />
            </div>
            <div className="space-y-1">
              <Input value={cmpRightTitle} onChange={(e) => setCmpRightTitle(e.target.value)} placeholder="Titre colonne droite" className="h-9 bg-white" />
              <Textarea value={cmpRightItems} onChange={(e) => setCmpRightItems(e.target.value)} placeholder={"Élément 1\nÉlément 2"} className="min-h-24 bg-white text-sm" />
            </div>
          </div>
          {renderBgPicker()}
        </div>
      )}

      {/* Chiffre-clé */}
      {gabarit === "chiffre-cle" && (
        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] space-y-1">
              <Label className="text-xs">Chiffre-clé</Label>
              <Input value={figFigure} onChange={(e) => setFigFigure(e.target.value)} placeholder="ex : 2027" className="h-9 bg-white" />
            </div>
            {renderBgPicker()}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Légende</Label>
            <Textarea value={figLabel} onChange={(e) => setFigLabel(e.target.value)} placeholder="ex : l'année du changement pour les IDEL" className="min-h-16 bg-white text-sm" />
          </div>
        </div>
      )}

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
