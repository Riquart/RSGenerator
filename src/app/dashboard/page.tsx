"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  Camera,
  Check,
  Copy,
  FileText,
  ImageIcon,
  Layers3,
  Link2,
  Loader2,
  MessageSquareText,
  Newspaper,
  PlaySquare,
  Settings,
  Sparkles,
  X,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAIConfig } from "@/context/AIConfigContext";
import type { CarouselPlatform, SocialPlatform } from "@/lib/ai/provider-manager";
import { GenerationJobs } from "@/components/generation/generation-jobs";
import { StructuredVisual } from "@/components/generation/structured-visual";
import { CarouselVisuals } from "@/components/generation/carousel-visuals";

type SourceKind = "text" | "url" | "pdf" | "image";
type WorkType = "post" | "carousel" | "image" | "video" | "article";
type DeliverableType = "post" | "article" | "carousel";
type Platform = "linkedin" | "instagram" | "facebook" | "twitter";

interface SourceItem {
  id: string;
  kind: SourceKind;
  title: string;
  content: string;
  selected: boolean;
}

interface GeneratedItem {
  id: string;
  type: WorkType;
  title: string;
  platform?: Platform;
  text?: string;
  imageUrl?: string;
  slides?: { title: string; text: string; imageUrl?: string }[];
}

const PLATFORM_OPTIONS: {
  id: Platform;
  label: string;
  icon: ElementType;
  note: string;
}[] = [
  { id: "linkedin", label: "LinkedIn", icon: Briefcase, note: "Post pro, clair, expert" },
  { id: "instagram", label: "Instagram", icon: Camera, note: "Visuel, court, engageant" },
  { id: "facebook", label: "Facebook", icon: MessageSquareText, note: "Accessible et conversationnel" },
  { id: "twitter", label: "Twitter / X", icon: Sparkles, note: "Synthétique et direct" },
];

const WORK_OPTIONS: {
  id: WorkType;
  label: string;
  description: string;
  icon: ElementType;
}[] = [
  { id: "post", label: "Post", description: "Texte prêt à publier", icon: MessageSquareText },
  { id: "carousel", label: "Carrousel", description: "Slides prêtes à poster", icon: Layers3 },
  { id: "image", label: "Image", description: "Visuel inspiré marque", icon: ImageIcon },
  { id: "video", label: "Vidéo", description: "Prompt Magnific", icon: PlaySquare },
  { id: "article", label: "Article", description: "Base blog en français", icon: Newspaper },
];

const platformToSocial = (platform: Platform): SocialPlatform =>
  platform === "twitter" ? "twitter" : platform;

const platformToCarousel = (platform: Platform): CarouselPlatform =>
  platform === "twitter" ? "twitter" : platform;

function makeId() {
  return crypto.randomUUID();
}

function truncate(value: string, length = 140) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}...`;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config } = useAIConfig();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [guidancePrompt, setGuidancePrompt] = useState("");
  const [synthesisText, setSynthesisText] = useState("");
  const autoUrlHandledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPrompt = localStorage.getItem("guidance_prompt");
      if (storedPrompt) setGuidancePrompt(storedPrompt);
    }
  }, []);

  const handleGuidanceChange = (val: string) => {
    setGuidancePrompt(val);
    localStorage.setItem("guidance_prompt", val);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (e) {
      console.error("Logout failed", e);
    }
  };
  const [draftText, setDraftText] = useState("");
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [deliverableType, setDeliverableType] = useState<DeliverableType>("post");
  const [targetPlatform, setTargetPlatform] = useState<Platform>("linkedin");
  const [tone, setTone] = useState("expert-rassurant");
  const [cta, setCta] = useState("prendre-contact");
  const [slideCount, setSlideCount] = useState("5");
  const [withHashtags, setWithHashtags] = useState(true);
  const [withEmojis, setWithEmojis] = useState(false);
  const [includeScreenshotsInVisuals, setIncludeScreenshotsInVisuals] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [copiedId, setCopiedId] = useState("");
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [webEnrichment, setWebEnrichment] = useState(false);
  const [synthesisCitations, setSynthesisCitations] = useState<{ url: string; title: string }[]>([]);
  const [synthesisEnriched, setSynthesisEnriched] = useState<boolean | null>(null);

  // Option A : la synthèse est liée aux sources. Aucune source active = zone de synthèse vide
  // (évite un texte de synthèse « fantôme » persistant qui polluerait aussi le prompt visuel).
  useEffect(() => {
    if (sources.filter((s) => s.selected).length === 0) {
      setSynthesisText("");
      setSynthesisCitations([]);
      setSynthesisEnriched(null);
      if (typeof window !== "undefined") localStorage.removeItem("synthesis_text");
    }
  }, [sources]);

  const activeContent = useMemo(() => {
    return sources
      .filter((source) => source.selected && source.content.trim())
      .map((source) => `[${source.title}]\n${source.content.trim()}`)
      .join("\n\n---\n\n");
  }, [sources]);

  const optionBlock = useMemo(() => {
    const toneLabel = {
      "expert-rassurant": "expert et rassurant",
      pedagogique: "pédagogique",
      direct: "direct et opérationnel",
      chaleureux: "chaleureux et accessible",
    }[tone];
    const ctaLabel = {
      "prendre-contact": "inviter à prendre contact",
      "decouvrir-solution": "inviter à découvrir la solution",
      commenter: "encourager les commentaires",
      aucun: "ne pas ajouter de call-to-action commercial",
    }[cta];

    return [
      `Ton demandé : ${toneLabel}.`,
      `Call-to-action : ${ctaLabel}.`,
      withHashtags ? "Inclure des hashtags pertinents." : "Ne pas inclure de hashtags.",
      withEmojis ? "Les emojis sont autorisés avec sobriété." : "Ne pas utiliser d'emojis.",
      "Langue obligatoire : français.",
      includeScreenshotsInVisuals
        ? "Si une capture d'écran est fournie, elle peut inspirer ou structurer le visuel."
        : "Les captures d'écran servent d'abord à comprendre le contenu, pas à être recopiées dans le visuel.",
    ].join("\n");
  }, [cta, includeScreenshotsInVisuals, tone, withEmojis, withHashtags]);

  const combinedPrompt = activeContent
    ? `${activeContent}\n\n[Paramètres de génération]\n${optionBlock}`
    : "";

  const addSource = (source: Omit<SourceItem, "id" | "selected">) => {
    setSources((current) => [{ ...source, id: makeId(), selected: true }, ...current]);
  };

  const toggleSource = (id: string) => {
    setSources((current) =>
      current.map((source) =>
        source.id === id ? { ...source, selected: !source.selected } : source
      )
    );
  };

  const removeSource = (id: string) => {
    setSources((current) => current.filter((source) => source.id !== id));
  };

  const needsPlatform = deliverableType === "post" || deliverableType === "carousel";

  const ingestText = () => {
    const content = draftText.trim();
    if (!content) return;
    addSource({ kind: "text", title: "Texte collé", content });
    setDraftText("");
  };

  const ingestUrl = async (urlToIngest = url.trim()) => {
    if (!urlToIngest.trim()) return null;
    setError("");
    setLoadingLabel("Analyse de l'URL");
    try {
      const res = await fetch("/api/ai/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToIngest }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Analyse impossible");
      const source = {
        kind: "url",
        title: data.title || urlToIngest,
        content: data.content || "",
      } satisfies Omit<SourceItem, "id" | "selected">;
      addSource(source);
      setUrl("");
      return source;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'analyser l'URL");
      return null;
    } finally {
      setLoadingLabel("");
    }
  };

  // Deep link : le veille-app ouvre /dashboard?url=<encodé>. Le champ URL est
  // déjà pré-rempli (voir useState ci-dessus) ; ici on lance le scrape une seule
  // fois au montage pour que la source soit prête sans clic.
  useEffect(() => {
    if (autoUrlHandledRef.current) return;
    const incoming = searchParams.get("url");
    if (!incoming || !/^https?:\/\//i.test(incoming)) return;
    autoUrlHandledRef.current = true;
    void ingestUrl(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ingestPdf = async (file: File) => {
    setError("");
    setLoadingLabel("Extraction du PDF");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ai/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Extraction impossible");
      addSource({
        kind: "pdf",
        title: file.name,
        content: data.content || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'extraire le PDF");
    } finally {
      setLoadingLabel("");
    }
  };

  const ingestImage = async (file: File) => {
    setError("");
    setLoadingLabel("Analyse de l'image");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("provider", config.textProvider);
      formData.append("intent", includeScreenshotsInVisuals ? "reuse_visual" : "analyze_content");
      const res = await fetch("/api/ai/vision", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Analyse impossible");
      addSource({
        kind: "image",
        title: file.name,
        content: data.content || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'analyser l'image");
    } finally {
      setLoadingLabel("");
    }
  };

  const getResultText = (result: GeneratedItem) => {
    if (result.text) return result.text;
    if (!result.slides) return "";

    return result.slides
      .map((slide, index) => `Slide ${index + 1}\n${slide.title}\n${slide.text}`)
      .join("\n\n");
  };

  const copyText = async (text: string | undefined, id = "copy") => {
    if (!text?.trim()) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? "" : current)), 1600);
  };

  const generatePost = async (
    platform: Platform,
    sourceContent: string
  ): Promise<GeneratedItem> => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "social_post",
        sourceContent,
        platform: platformToSocial(platform),
        provider: config.socialProvider,
        model: config.socialModel,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Génération post impossible");
    return {
      id: makeId(),
      type: "post",
      platform,
      title: `Post ${PLATFORM_OPTIONS.find((item) => item.id === platform)?.label}`,
      text: data.text,
    };
  };

  const generateArticle = async (sourceContent: string): Promise<GeneratedItem> => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "article_draft",
        topics: sourceContent,
        tone: "Expert & Rassurant",
        lengthTarget: "medium",
        provider: config.textProvider,
        model: config.textModel,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Génération article impossible");
    return {
      id: makeId(),
      type: "article",
      title: data.title || "Article de blog",
      text: data.content,
    };
  };

  const generateVideoPrompt = async (sourceContent: string): Promise<GeneratedItem> => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "video_prompt_enhance",
        provider: config.textProvider,
        model: config.textModel,
        blocks: {
          scene: `Créer une vidéo courte en français à partir de ces sources : ${sourceContent.slice(0, 1800)}`,
          style: "moderne, professionnel, clair, inspiré d'un éditeur logiciel santé",
          camera: "plans propres, rythme calme, transitions lisibles",
          movement: "mouvements fluides et sobres",
          lighting: "lumière nette, ambiance confiance et expertise",
          duration: "8 à 12 secondes",
          aspectRatio: "adaptable 1:1, 4:5 et 16:9",
        },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Génération vidéo impossible");
    return {
      id: makeId(),
      type: "video",
      title: "Prompt vidéo Magnific",
      text: data.enhancedPrompt,
    };
  };

  const getGenerationSourceContent = () => {
    if (synthesisText.trim()) {
      return `${synthesisText}\n\n[Paramètres de génération]\n${optionBlock}`;
    }
    return combinedPrompt;
  };

  const generateSynthesis = async () => {
    if (!activeContent.trim()) {
      setError("Sélectionnez au moins une source active pour générer la synthèse.");
      return;
    }
    setError("");
    setLoadingLabel(webEnrichment ? "Recherche web en cours…" : "Génération de la synthèse");
    try {
      const res = await fetch("/api/ai/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcesText: activeContent,
          guidancePrompt,
          provider: config.textProvider,
          model: config.textModel,
          webEnrichment,
          allowedDomains: [],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Génération de la synthèse impossible");
      const text = data.content || data.text || "";
      setSynthesisText(text);
      localStorage.setItem("synthesis_text", text);
      setSynthesisCitations(Array.isArray(data.citations) ? data.citations : []);
      setSynthesisEnriched(webEnrichment ? Boolean(data.enriched) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La génération de la synthèse a échoué");
    } finally {
      setLoadingLabel("");
    }
  };

  const handleResetSynthesisZone = () => {
    setGuidancePrompt("");
    setSynthesisText("");
    setError("");
    localStorage.removeItem("guidance_prompt");
    localStorage.removeItem("synthesis_text");
  };

  const generateCarouselText = async (
    platform: Platform,
    sourceContent: string
  ): Promise<GeneratedItem> => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "carousel_script",
        sourceContent: `${sourceContent}\n\nNombre de slides souhaité : ${slideCount}.`,
        platform: platformToCarousel(platform),
        provider: config.textProvider,
        model: config.textModel,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Génération carrousel impossible");

    const targetCount = Number(slideCount);
    const slides = (data.slides || []).slice(0, targetCount);

    return {
      id: makeId(),
      type: "carousel",
      platform,
      title: data.title || `Carrousel ${platform}`,
      slides: slides.map((slide: { title?: string; text?: string }, index: number) => ({
        title: String(slide.title || `Slide ${index + 1}`),
        text: String(slide.text || ""),
        imageUrl: undefined,
      })),
    };
  };

  const generateImageText = async (
    platform: Platform,
    sourceContent: string
  ): Promise<GeneratedItem> => {
    const post = await generatePost(platform, sourceContent);
    return {
      id: makeId(),
      type: "image",
      platform,
      title: `Image ${PLATFORM_OPTIONS.find((item) => item.id === platform)?.label}`,
      text: post.text,
      imageUrl: undefined,
    };
  };

  const generateTextOnly = async () => {
    let sourceContent = getGenerationSourceContent();

    if (!sourceContent.trim() && url.trim()) {
      const source = await ingestUrl(url.trim());
      if (!source) return;
      sourceContent = `[${source.title}]\n${source.content}`;
    }

    if (!sourceContent.trim()) {
      setError("Ajoute au moins une source avant de générer.");
      return;
    }

    setError("");
    setResults([]);
    const nextResults: GeneratedItem[] = [];

    try {
      if (deliverableType === "post") {
        setLoadingLabel(`Post ${targetPlatform}`);
        nextResults.push(await generatePost(targetPlatform, sourceContent));
      } else if (deliverableType === "carousel") {
        setLoadingLabel(`Carrousel ${targetPlatform}`);
        nextResults.push(await generateCarouselText(targetPlatform, sourceContent));
      } else if (deliverableType === "article") {
        setLoadingLabel("Article blog");
        nextResults.push(await generateArticle(sourceContent));
      }
      setResults([...nextResults]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La génération a échoué");
    } finally {
      setLoadingLabel("");
    }
  };

  const isBusy = Boolean(loadingLabel);

  return (
    <main className="min-h-screen bg-[#f7f9fb] text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-[#10aee2] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#10aee2]">
                RSMedium
              </p>
              <h1 className="text-xl font-semibold tracking-tight">Generatore</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin">
                <Settings className="h-4 w-4" />
                Admin
              </Link>
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 pb-28 sm:px-6 lg:px-8">
        <section className="space-y-6">
          <div className="pt-2">
            <div className="max-w-3xl">
              <Badge className="mb-4 bg-[#10aee2]/10 text-[#087aa0] hover:bg-[#10aee2]/10">
                Studio de création
              </Badge>
              <h2 className="text-4xl font-bold leading-tight tracking-tight">
                Transforme tes sources en contenus{" "}
                <span className="bg-gradient-to-r from-[#10aee2] to-[#6366f1] bg-clip-text text-transparent">
                  prêts à publier.
                </span>
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
                Dépose un texte, un PDF, une URL ou une capture, choisis tes réseaux et
                lance une seule génération. Zéro prompt, zéro réglage de modèle.
              </p>
            </div>
          </div>

          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-sm font-bold text-[#10aee2]">1</span>
                  Sources
                </CardTitle>
                <span className="text-sm text-slate-400">Ajoute une ou plusieurs entrées</span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <Label>Texte libre</Label>
                <Textarea
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  placeholder="Colle ici un brief, une note interne, un extrait d'article..."
                  className="min-h-32"
                />
                <Button variant="outline" onClick={ingestText} disabled={!draftText.trim()}>
                  <FileText className="h-4 w-4" />
                  Ajouter ce texte
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <Label>URL web</Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://..."
                  />
                  <Button variant="outline" onClick={() => void ingestUrl()} disabled={!url.trim() || isBusy}>
                    <Link2 className="h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Clique sur Ajouter, ou lance directement la génération : l'URL sera ajoutée automatiquement.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <Label>PDF</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void ingestPdf(file);
                    event.currentTarget.value = "";
                  }}
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <Label>Image ou capture d'écran</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void ingestImage(file);
                    event.currentTarget.value = "";
                  }}
                  disabled={isBusy}
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <Checkbox
                    checked={includeScreenshotsInVisuals}
                    onCheckedChange={() => setIncludeScreenshotsInVisuals((value) => !value)}
                  />
                  Réutilisable comme inspiration visuelle
                </label>
              </div>

              <div className="xl:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Sources actives</h3>
                  <Badge variant="secondary">{sources.filter((source) => source.selected).length} sélectionnée(s)</Badge>
                </div>
                {sources.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">
                    Les sources ajoutées apparaîtront ici. Tu pourras les activer ou les retirer avant génération.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3"
                      >
                        <Checkbox checked={source.selected} onCheckedChange={() => toggleSource(source.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{source.kind}</Badge>
                            <p className="font-medium">{source.title}</p>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {truncate(source.content)}
                          </p>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => removeSource(source.id)}
                          aria-label="Retirer la source"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-[#10aee2]/20 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-sm font-bold text-[#10aee2]">2</span>
                  <span>
                    Interprétation &amp; synthèse
                    <span className="block text-xs font-normal text-slate-400">
                      Optionnel — génère une base commune à partir de tes sources
                    </span>
                  </span>
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setSynthesisOpen((o) => !o)}
                  className="shrink-0 text-sm font-medium text-[#10aee2] hover:text-[#0d92be]"
                >
                  {synthesisOpen ? "Replier ▲" : "Déplier ▼"}
                </button>
              </div>
            </CardHeader>
            {synthesisOpen && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="guidance-prompt">Directives de guidage (optionnel)</Label>
                  <span className="text-xs text-slate-500">
                    {sources.filter((s) => s.selected).length} source(s) active(s)
                  </span>
                </div>
                <Textarea
                  id="guidance-prompt"
                  value={guidancePrompt}
                  onChange={(e) => handleGuidanceChange(e.target.value)}
                  placeholder="Exemple : Insiste sur la sécurité des données, adopte un ton bienveillant, synthétise les points clés..."
                  className="min-h-20"
                />
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-[#10aee2]/20 bg-[#10aee2]/5 p-3">
                <Checkbox
                  checked={webEnrichment}
                  onCheckedChange={() => setWebEnrichment((v) => !v)}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-sm font-medium text-slate-800">Enrichir avec une recherche web</span>
                  <span className="block text-xs text-slate-500">
                    Complète la synthèse avec des informations web à jour et sourcées. Ajoute quelques secondes à la génération.
                  </span>
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={generateSynthesis}
                  disabled={sources.filter((s) => s.selected).length === 0 || isBusy}
                  className="bg-[#10aee2] hover:bg-[#0d92be] text-white"
                >
                  {loadingLabel === "Génération de la synthèse" || loadingLabel === "Recherche web en cours…" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {loadingLabel === "Recherche web en cours…" ? "Recherche web…" : "Générer la synthèse"}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetSynthesisZone}
                  className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  Réinitialiser la zone
                </Button>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="synthesis-text">Texte de synthèse cumulé</Label>
                <Textarea
                  id="synthesis-text"
                  value={synthesisText}
                  onChange={(e) => {
                    setSynthesisText(e.target.value);
                    localStorage.setItem("synthesis_text", e.target.value);
                  }}
                  placeholder="Le résultat de la synthèse des sources apparaîtra ici. Ce texte servira de base unique pour la génération des posts."
                  className="min-h-40 bg-slate-50 font-mono text-sm"
                />
              </div>

              {synthesisCitations.length > 0 && (
                <div className="space-y-2 rounded-lg border border-[#10aee2]/20 bg-white p-3">
                  <Label className="flex items-center gap-2 text-[#087aa0]">
                    <Link2 className="h-4 w-4" />
                    Sources web ({synthesisCitations.length})
                  </Label>
                  <ul className="space-y-1">
                    {synthesisCitations.map((c, i) => (
                      <li key={i} className="text-sm">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#10aee2] hover:underline break-all"
                        >
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {synthesisEnriched === false && (
                <p className="text-xs text-slate-400">
                  Enrichissement web indisponible — synthèse standard affichée.
                </p>
              )}
            </CardContent>
            )}
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-sm font-bold text-[#10aee2]">3</span>
                Réglages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Type de contenu</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  {WORK_OPTIONS.filter(
                    (w) => w.id === "post" || w.id === "article" || w.id === "carousel"
                  ).map((work) => (
                    <button
                      key={work.id}
                      type="button"
                      onClick={() => setDeliverableType(work.id as DeliverableType)}
                      className={`rounded-lg border p-3 text-left transition ${
                        deliverableType === work.id
                          ? "border-[#10aee2] bg-[#10aee2]/5"
                          : "bg-white hover:border-slate-300"
                      }`}
                    >
                      <work.icon className="mb-3 h-5 w-5 text-[#10aee2]" />
                      <p className="text-sm font-medium">{work.label}</p>
                      <p className="mt-1 text-xs leading-4 text-slate-500">{work.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {needsPlatform && (
                <div>
                  <Label className="mb-3 block">Réseau destinataire</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {PLATFORM_OPTIONS.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => setTargetPlatform(platform.id)}
                        className={`rounded-lg border p-4 text-left transition ${
                          targetPlatform === platform.id
                            ? "border-[#10aee2] bg-[#10aee2]/5"
                            : "bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <platform.icon className="h-5 w-5 text-[#10aee2]" />
                            <div>
                              <p className="font-medium">{platform.label}</p>
                              <p className="text-xs text-slate-500">{platform.note}</p>
                            </div>
                          </div>
                          {targetPlatform === platform.id && <Check className="h-4 w-4 text-[#10aee2]" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Ton</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expert-rassurant">Expert et rassurant</SelectItem>
                      <SelectItem value="pedagogique">Pédagogique</SelectItem>
                      <SelectItem value="direct">Direct et opérationnel</SelectItem>
                      <SelectItem value="chaleureux">Chaleureux</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {needsPlatform && (
                  <div className="space-y-2">
                    <Label>Call-to-action</Label>
                    <Select value={cta} onValueChange={setCta}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prendre-contact">Prendre contact</SelectItem>
                        <SelectItem value="decouvrir-solution">Découvrir la solution</SelectItem>
                        <SelectItem value="commenter">Commenter</SelectItem>
                        <SelectItem value="aucun">Aucun CTA commercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {deliverableType === "carousel" && (
                  <div className="space-y-2">
                    <Label>Slides carrousel</Label>
                    <Select value={slideCount} onValueChange={setSlideCount}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 slides</SelectItem>
                        <SelectItem value="5">5 slides</SelectItem>
                        <SelectItem value="7">7 slides</SelectItem>
                        <SelectItem value="10">10 slides</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {needsPlatform && (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={withHashtags} onCheckedChange={() => setWithHashtags((value) => !value)} />
                    Hashtags
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={withEmojis} onCheckedChange={() => setWithEmojis((value) => !value)} />
                    Emojis
                  </label>
                </div>
              )}

            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-[#10aee2]" />
                Générateur d'images (par modèle)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                Génère des visuels (images seules) à partir de tes sources / ta synthèse, avec le modèle
                de ton choix. Le prompt est pré-rempli depuis le contexte et reste éditable ; DA et
                références de marque activables par carte. Chaque « + Image(s) » ouvre une carte de tâche.
              </p>
              <GenerationJobs targetId="standalone" baseText={synthesisText || activeContent} />
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers3 className="h-5 w-5 text-[#10aee2]" />
                Visuel structuré (gabarit)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-500">
                Compose un visuel à zones (ex. colonne à N parties empilées) avec <strong>texte net</strong> et
                couleurs de ta charte. Le texte peut être auto-rempli depuis tes sources / ta synthèse.
              </p>
              <StructuredVisual baseText={synthesisText || activeContent} />
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-[#10aee2]" />
                Résultats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {results.length === 0 && !isBusy ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                  Les contenus générés apparaîtront ici, avec des boutons copier et télécharger.
                </div>
              ) : (
                <div className="grid gap-4">
                  {results.map((result) => (
                    <div key={result.id} className="rounded-lg border bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{result.type}</Badge>
                            {result.platform && <Badge variant="outline" className="capitalize text-[10px]">{result.platform}</Badge>}
                          </div>
                          <h3 className="mt-2 font-semibold">{result.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyText(getResultText(result), result.id)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            {copiedId === result.id ? "Copié" : "Copier"}
                          </Button>
                        </div>
                      </div>

                      {result.text && (
                        <Textarea value={result.text} readOnly className="min-h-40 bg-slate-50 mb-4" />
                      )}

                      {result.slides && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {result.slides.map((slide, index) => {
                            return (
                              <div key={`${result.id}-${index}`} className="rounded-lg border bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <Badge>Slide {index + 1}</Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        copyText(
                                          `Slide ${index + 1}\n${slide.title}\n${slide.text}`,
                                          `${result.id}-${index}`
                                        )
                                      }
                                      title={copiedId === `${result.id}-${index}` ? "Copié" : "Copier le texte"}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                <p className="font-medium text-sm">{slide.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{slide.text}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {result.slides && result.slides.length > 0 && (
                        <CarouselVisuals slides={result.slides} />
                      )}

                      {(result.type === "post" ||
                        result.type === "article" ||
                        result.type === "carousel" ||
                        result.type === "image") && (
                        <GenerationJobs
                          targetId={result.id}
                          baseText={getResultText(result)}
                          slides={result.slides}
                        />
                      )}
                    </div>
                  ))}
                  {isBusy && (
                    <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingLabel}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Barre d'action sticky */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/20 bg-[#1e2e3d] text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xl font-bold leading-none">
                {sources.filter((source) => source.selected).length}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Sources</div>
            </div>
            <div>
              <div className="text-lg font-bold leading-none">
                {deliverableType === "post" ? "Post" : deliverableType === "article" ? "Article" : "Carrousel"}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Type</div>
            </div>
            <div>
              <div className="text-lg font-bold leading-none">
                {needsPlatform
                  ? PLATFORM_OPTIONS.find((p) => p.id === targetPlatform)?.label ?? targetPlatform
                  : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Réseau</div>
            </div>
          </div>
          <Button
            type="button"
            onClick={generateTextOnly}
            disabled={isBusy}
            size="lg"
            className="bg-gradient-to-r from-[#10aee2] to-[#3b82f6] text-white hover:opacity-90"
          >
            {isBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Générer
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f7f9fb] text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#10aee2]" />
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
