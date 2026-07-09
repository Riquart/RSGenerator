"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Camera,
  Check,
  Copy,
  ExternalLink,
  FileImage,
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
  Upload,
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

type SourceKind = "text" | "url" | "pdf" | "image";
type WorkType = "post" | "carousel" | "image" | "video" | "article";
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
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const autoUrlHandledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPrompt = localStorage.getItem("guidance_prompt");
      const storedSynthesis = localStorage.getItem("synthesis_text");
      if (storedPrompt) setGuidancePrompt(storedPrompt);
      if (storedSynthesis) setSynthesisText(storedSynthesis);
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    "linkedin",
    "instagram",
  ]);
  const [selectedWorks, setSelectedWorks] = useState<WorkType[]>(["post", "carousel"]);
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

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  };

  const toggleWork = (work: WorkType) => {
    setSelectedWorks((current) =>
      current.includes(work) ? current.filter((item) => item !== work) : [...current, work]
    );
  };

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

  const generateImageResult = async (
    platform: Platform,
    sourceContent: string
  ): Promise<GeneratedItem> => {
    const post = await generatePost(platform, sourceContent);
    const res = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        networkPost: post.text || sourceContent.slice(0, 800),
        sourceContent,
        platform,
        provider: config.imageProvider,
        modelId: config.imageModel,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Génération image impossible");
    return {
      id: makeId(),
      type: "image",
      platform,
      title: `Image ${PLATFORM_OPTIONS.find((item) => item.id === platform)?.label}`,
      text: post.text,
      imageUrl: data.imageUrl,
    };
  };

  const generateCarousel = async (
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
    setLoadingLabel(`Images carrousel 1-${slides.length}/${slides.length}`);
    const slidesWithImages = await Promise.all(
      slides.map(async (slide: { title?: string; text?: string }, index: number) => {
      const imageRes = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          networkPost: `${slide.title}\n${slide.text}`,
          sourceContent,
          platform,
          provider: config.imageProvider,
          modelId: config.imageModel,
        }),
      });
      const imageData = await imageRes.json();

      return {
        title: String(slide.title || `Slide ${index + 1}`),
        text: String(slide.text || ""),
        imageUrl: imageData.imageUrl,
      };
      })
    );

    return {
      id: makeId(),
      type: "carousel",
      platform,
      title: data.title || `Carrousel ${platform}`,
      slides: slidesWithImages,
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
    setLoadingLabel("Génération de la synthèse");
    try {
      const res = await fetch("/api/ai/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcesText: activeContent,
          guidancePrompt,
          provider: config.textProvider,
          model: config.textModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Génération de la synthèse impossible");
      const text = data.content || data.text || "";
      setSynthesisText(text);
      localStorage.setItem("synthesis_text", text);
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
    if (selectedWorks.length === 0 || selectedPlatforms.length === 0) {
      setError("Sélectionne au moins un format et un réseau.");
      return;
    }

    setError("");
    setResults([]);
    setLoadingLabel("Génération des textes...");
    const nextResults: GeneratedItem[] = [];

    try {
      for (const work of selectedWorks) {
        if (work === "post") {
          for (const platform of selectedPlatforms) {
            setLoadingLabel(`Post ${platform}`);
            const item = await generatePost(platform, sourceContent);
            nextResults.push(item);
            setResults([...nextResults]);
          }
        }
        if (work === "carousel") {
          for (const platform of selectedPlatforms) {
            setLoadingLabel(`Carrousel text ${platform}`);
            const item = await generateCarouselText(platform, sourceContent);
            nextResults.push(item);
            setResults([...nextResults]);
          }
        }
        if (work === "image") {
          for (const platform of selectedPlatforms) {
            setLoadingLabel(`Image text ${platform}`);
            const item = await generateImageText(platform, sourceContent);
            nextResults.push(item);
            setResults([...nextResults]);
          }
        }
        if (work === "article") {
          setLoadingLabel("Article blog");
          const item = await generateArticle(sourceContent);
          nextResults.push(item);
          setResults([...nextResults]);
        }
        if (work === "video") {
          setLoadingLabel("Prompt vidéo");
          const item = await generateVideoPrompt(sourceContent);
          nextResults.push(item);
          setResults([...nextResults]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "La génération de texte a échoué");
    } finally {
      setLoadingLabel("");
    }
  };

  const generateImagesOnly = async () => {
    if (results.length === 0) {
      await generateAll();
      return;
    }

    setError("");
    const sourceContent = getGenerationSourceContent();

    try {
      const promises = results.map(async (result) => {
        if (result.type === "image") {
          setLoadingImages((curr) => ({ ...curr, [result.id]: true }));
          try {
            const res = await fetch("/api/ai/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                networkPost: result.text || sourceContent.slice(0, 800),
                sourceContent,
                platform: result.platform || "linkedin",
                provider: config.imageProvider,
                modelId: config.imageModel,
              }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Génération image impossible");
            
            setResults((currResults) =>
              currResults.map((r) =>
                r.id === result.id ? { ...r, imageUrl: data.imageUrl } : r
              )
            );
          } catch (err) {
            console.error("Error generating image for post:", err);
            setError(err instanceof Error ? err.message : "Erreur génération d'une image");
          } finally {
            setLoadingImages((curr) => ({ ...curr, [result.id]: false }));
          }
        } else if (result.type === "carousel" && result.slides) {
          const slidePromises = result.slides.map(async (slide, index) => {
            const slideKey = `${result.id}-${index}`;
            setLoadingImages((curr) => ({ ...curr, [slideKey]: true }));
            try {
              const res = await fetch("/api/ai/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  networkPost: `${slide.title}\n${slide.text}`,
                  sourceContent,
                  platform: result.platform || "linkedin",
                  provider: config.imageProvider,
                  modelId: config.imageModel,
                }),
              });
              const data = await res.json();
              if (!res.ok || data.error) throw new Error(data.error || "Génération image carrousel impossible");
              
              setResults((currResults) =>
                currResults.map((r) => {
                  if (r.id !== result.id || !r.slides) return r;
                  const newSlides = [...r.slides];
                  newSlides[index] = { ...newSlides[index], imageUrl: data.imageUrl };
                  return { ...r, slides: newSlides };
                })
              );
            } catch (err) {
              console.error(`Error generating image for slide ${index}:`, err);
              setError(err instanceof Error ? err.message : "Erreur génération image slide");
            } finally {
              setLoadingImages((curr) => ({ ...curr, [slideKey]: false }));
            }
          });
          await Promise.all(slidePromises);
        }
      });

      await Promise.all(promises);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La génération des images a échoué");
    }
  };

  const regenerateSingleImage = async (id: string) => {
    const result = results.find((r) => r.id === id);
    if (!result) return;
    setError("");
    setLoadingImages((curr) => ({ ...curr, [id]: true }));
    try {
      const sourceContent = getGenerationSourceContent();
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          networkPost: result.text || sourceContent.slice(0, 800),
          sourceContent,
          platform: result.platform || "linkedin",
          provider: config.imageProvider,
          modelId: config.imageModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Régénération image impossible");
      
      setResults((currResults) =>
        currResults.map((r) =>
          r.id === id ? { ...r, imageUrl: data.imageUrl } : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "La régénération de l'image a échoué");
    } finally {
      setLoadingImages((curr) => ({ ...curr, [id]: false }));
    }
  };

  const regenerateCarouselSlideImage = async (resultId: string, slideIndex: number) => {
    const result = results.find((r) => r.id === resultId);
    if (!result || !result.slides || !result.slides[slideIndex]) return;
    const slide = result.slides[slideIndex];
    const slideKey = `${resultId}-${slideIndex}`;
    setError("");
    setLoadingImages((curr) => ({ ...curr, [slideKey]: true }));
    try {
      const sourceContent = getGenerationSourceContent();
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          networkPost: `${slide.title}\n${slide.text}`,
          sourceContent,
          platform: result.platform || "linkedin",
          provider: config.imageProvider,
          modelId: config.imageModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Régénération image slide impossible");
      
      setResults((currResults) =>
        currResults.map((r) => {
          if (r.id !== resultId || !r.slides) return r;
          const newSlides = [...r.slides];
          newSlides[slideIndex] = { ...newSlides[slideIndex], imageUrl: data.imageUrl };
          return { ...r, slides: newSlides };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "La régénération de l'image de la slide a échoué");
    } finally {
      setLoadingImages((curr) => ({ ...curr, [slideKey]: false }));
    }
  };

  const generateAll = async () => {
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
    if (selectedWorks.length === 0 || selectedPlatforms.length === 0) {
      setError("Sélectionne au moins un format et un réseau.");
      return;
    }

    setError("");
    setResults([]);
    const nextResults: GeneratedItem[] = [];

    try {
      for (const work of selectedWorks) {
        if (work === "post") {
          for (const platform of selectedPlatforms) {
            setLoadingLabel(`Post ${platform}`);
            nextResults.push(await generatePost(platform, sourceContent));
            setResults([...nextResults]);
          }
        }
        if (work === "carousel") {
          for (const platform of selectedPlatforms) {
            setLoadingLabel(`Carrousel ${platform}`);
            nextResults.push(await generateCarousel(platform, sourceContent));
            setResults([...nextResults]);
          }
        }
        if (work === "image") {
          for (const platform of selectedPlatforms) {
            setLoadingLabel(`Image ${platform}`);
            nextResults.push(await generateImageResult(platform, sourceContent));
            setResults([...nextResults]);
          }
        }
        if (work === "article") {
          setLoadingLabel("Article blog");
          nextResults.push(await generateArticle(sourceContent));
          setResults([...nextResults]);
        }
        if (work === "video") {
          setLoadingLabel("Prompt vidéo");
          nextResults.push(await generateVideoPrompt(sourceContent));
          setResults([...nextResults]);
        }
      }
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

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={generateSynthesis}
                  disabled={sources.filter((s) => s.selected).length === 0 || isBusy}
                  className="bg-[#10aee2] hover:bg-[#0d92be] text-white"
                >
                  {loadingLabel === "Génération de la synthèse" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Générer la synthèse
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
                <Label className="mb-3 block">Réseaux destinataires</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {PLATFORM_OPTIONS.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        selectedPlatforms.includes(platform.id)
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
                        {selectedPlatforms.includes(platform.id) && <Check className="h-4 w-4 text-[#10aee2]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Formats à générer</Label>
                <div className="grid gap-3 md:grid-cols-5">
                  {WORK_OPTIONS.map((work) => (
                    <button
                      key={work.id}
                      type="button"
                      onClick={() => toggleWork(work.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selectedWorks.includes(work.id)
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
              </div>

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
                Génère des visuels avec le modèle de ton choix, sans dépendre d'un post.
                Chaque « + Image(s) » ouvre une carte de tâche.
              </p>
              <GenerationJobs targetId="standalone" baseText={synthesisText} />
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
                          {result.type === "image" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => regenerateSingleImage(result.id)}
                              disabled={loadingImages[result.id]}
                              className="text-[#10aee2] border-[#10aee2]/20 hover:bg-[#10aee2]/5"
                            >
                              <ImageIcon className="h-4 w-4 mr-1" />
                              Régénérer l'image
                            </Button>
                          )}
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

                      {result.type === "image" && (
                        <div className="relative mb-4 overflow-hidden rounded-lg border bg-slate-50 min-h-[200px] flex items-center justify-center">
                          {result.imageUrl ? (
                            <img
                              src={result.imageUrl}
                              alt={result.title}
                              className={`max-h-[520px] w-full object-contain transition-all duration-300 ${
                                loadingImages[result.id] ? "blur-md scale-95" : ""
                              }`}
                            />
                          ) : (
                            <div className="text-center p-6 text-slate-400">
                              <ImageIcon className="mx-auto h-12 w-12 stroke-1 mb-2 text-slate-300" />
                              <p className="text-sm">Aucune image générée</p>
                            </div>
                          )}
                          
                          {loadingImages[result.id] && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-10 transition-all duration-300">
                              <Loader2 className="h-8 w-8 animate-spin text-[#10aee2]" />
                              <span className="mt-2 text-xs font-medium text-slate-600">Génération de l'image...</span>
                            </div>
                          )}
                        </div>
                      )}

                      {result.text && (
                        <Textarea value={result.text} readOnly className="min-h-40 bg-slate-50 mb-4" />
                      )}

                      {result.slides && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {result.slides.map((slide, index) => {
                            const slideKey = `${result.id}-${index}`;
                            return (
                              <div key={`${result.id}-${index}`} className="rounded-lg border bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <Badge>Slide {index + 1}</Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => regenerateCarouselSlideImage(result.id, index)}
                                      disabled={loadingImages[slideKey]}
                                      title="Régénérer l'image de cette slide"
                                      className="text-[#10aee2]"
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </Button>
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
                                
                                <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-md border bg-slate-100 flex items-center justify-center">
                                  {slide.imageUrl ? (
                                    <img
                                      src={slide.imageUrl}
                                      alt={slide.title}
                                      className={`h-full w-full object-cover transition-all duration-300 ${
                                        loadingImages[slideKey] ? "blur-md scale-95" : ""
                                      }`}
                                    />
                                  ) : (
                                    <div className="text-center p-4 text-slate-400">
                                      <ImageIcon className="mx-auto h-8 w-8 stroke-1 mb-1 text-slate-300" />
                                      <p className="text-xs">Aucune image</p>
                                    </div>
                                  )}
                                  
                                  {loadingImages[slideKey] && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-10">
                                      <Loader2 className="h-6 w-6 animate-spin text-[#10aee2]" />
                                      <span className="mt-1 text-[10px] font-medium text-slate-600">Génération...</span>
                                    </div>
                                  )}
                                </div>

                                <p className="font-medium text-sm">{slide.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{slide.text}</p>
                                {slide.imageUrl && (
                                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                                    <a href={slide.imageUrl} target="_blank" rel="noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Ouvrir
                                    </a>
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(result.type === "post" ||
                        result.type === "article" ||
                        result.type === "carousel") && (
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
              <div className="text-xl font-bold leading-none">{selectedPlatforms.length}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Réseaux</div>
            </div>
            <div>
              <div className="text-xl font-bold leading-none">{selectedWorks.length}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Formats</div>
            </div>
          </div>
          <Button
            type="button"
            onClick={generateAll}
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
