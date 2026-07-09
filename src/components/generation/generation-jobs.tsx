"use client";

import { useState } from "react";
import { ImagePlus, Loader2, Play, Trash2, AlertCircle } from "lucide-react";
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
import {
  PROVIDERS,
  modelsByProvider,
  aspectOptionsFor,
  defaultAspectFor,
  getModel,
  defaultParams,
  type Provider,
} from "@/lib/ai/magnific-registry";
import { useAIConfig } from "@/context/AIConfigContext";

interface Slide {
  title: string;
  text: string;
}

interface JobImage {
  status: "pending" | "done" | "error";
  url?: string;
  error?: string;
}

interface Job {
  id: string;
  provider: Provider;
  modelId: string;
  prompt: string;
  aspect: string;
  series: boolean;
  count: number;
  describe: boolean;
  params: Record<string, string | number>;
  running: boolean;
  images: JobImage[];
}

interface DescribeOpts {
  describe: boolean;
  textProvider?: string;
  textModel?: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 min

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Lance UNE génération pour un prompt, renvoie l'URL de l'image ou lève une erreur.
async function generateOne(
  modelId: string,
  prompt: string,
  aspect: string,
  params: Record<string, string | number>,
  opts: DescribeOpts
): Promise<string> {
  const res = await fetch("/api/gen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, prompt, aspect, params, ...opts }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Génération impossible");

  if (data.mode === "sync") {
    if (!data.imageUrl) throw new Error("Aucune image renvoyée");
    return data.imageUrl;
  }

  // async : poll
  const taskId = data.taskId as string;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const s = await fetch(
      `/api/gen/status?modelId=${encodeURIComponent(modelId)}&taskId=${encodeURIComponent(taskId)}`
    );
    const sd = await s.json();
    if (sd.status === "COMPLETED" && sd.imageUrl) return sd.imageUrl;
    if (sd.status === "FAILED") throw new Error(sd.error || "La génération a échoué");
  }
  throw new Error("Délai dépassé (génération trop longue)");
}

export function GenerationJobs({
  targetId,
  baseText,
  slides,
}: {
  targetId: string;
  baseText: string;
  slides?: Slide[];
}) {
  const { config } = useAIConfig();
  const [jobs, setJobs] = useState<Job[]>([]);
  const hasSlides = Array.isArray(slides) && slides.length > 0;

  const patchJob = (id: string, patch: Partial<Job>) =>
    setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const addJob = () => {
    const provider: Provider = "magnific";
    const model = modelsByProvider(provider)[0];
    setJobs((cur) => [
      ...cur,
      {
        id: crypto.randomUUID(),
        provider,
        modelId: model.id,
        prompt: baseText.slice(0, 400),
        aspect: defaultAspectFor(model),
        series: false,
        count: hasSlides ? slides!.length : 3,
        describe: true,
        params: defaultParams(model),
        running: false,
        images: [],
      },
    ]);
  };

  const removeJob = (id: string) => setJobs((cur) => cur.filter((j) => j.id !== id));

  const changeProvider = (id: string, provider: Provider) => {
    const model = modelsByProvider(provider)[0];
    if (!model) return;
    patchJob(id, { provider, modelId: model.id, params: defaultParams(model), aspect: defaultAspectFor(model) });
  };

  const changeModel = (id: string, modelId: string) => {
    const model = getModel(modelId);
    if (!model) return;
    patchJob(id, { modelId, params: defaultParams(model), aspect: defaultAspectFor(model) });
  };

  const launch = async (job: Job) => {
    // Construit la liste des prompts à générer.
    let prompts: string[];
    if (job.series && hasSlides) {
      prompts = slides!.map((s) => `${job.prompt}\n\n${s.title}. ${s.text}`);
    } else if (job.series) {
      prompts = Array.from({ length: job.count }, () => job.prompt);
    } else {
      prompts = [job.prompt];
    }

    patchJob(job.id, {
      running: true,
      images: prompts.map(() => ({ status: "pending" as const })),
    });

    const opts: DescribeOpts = {
      describe: job.describe,
      textProvider: config.textProvider,
      textModel: config.textModel,
    };

    await Promise.all(
      prompts.map(async (p, idx) => {
        try {
          const url = await generateOne(job.modelId, p, job.aspect, job.params, opts);
          setJobs((cur) =>
            cur.map((j) => {
              if (j.id !== job.id) return j;
              const images = [...j.images];
              images[idx] = { status: "done", url };
              return { ...j, images };
            })
          );
        } catch (err) {
          setJobs((cur) =>
            cur.map((j) => {
              if (j.id !== job.id) return j;
              const images = [...j.images];
              images[idx] = { status: "error", error: err instanceof Error ? err.message : "Erreur" };
              return { ...j, images };
            })
          );
        }
      })
    );

    patchJob(job.id, { running: false });
  };

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Visuels</span>
        <Button variant="outline" size="sm" onClick={addJob} className="text-[#10aee2] border-[#10aee2]/30">
          <ImagePlus className="mr-1 h-4 w-4" />
          + Image(s)
        </Button>
      </div>

      {jobs.map((job) => {
        const model = getModel(job.modelId)!;
        return (
          <div key={job.id} className="rounded-lg border bg-slate-50 p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <div className="flex overflow-hidden rounded-md border">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => changeProvider(job.id, p.id)}
                      className={`px-3 py-1.5 text-sm transition ${
                        job.provider === p.id
                          ? "bg-[#10aee2] text-white"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-[180px] space-y-1">
                <Label className="text-xs">Modèle</Label>
                <Select value={job.modelId} onValueChange={(v) => changeModel(job.id, v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelsByProvider(job.provider).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.family} · {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[140px] space-y-1">
                <Label className="text-xs">Format</Label>
                <Select value={job.aspect} onValueChange={(v) => patchJob(job.id, { aspect: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aspectOptionsFor(model).map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Params propres au modèle */}
              {model.params.map((field) => (
                <div key={field.key} className="min-w-[130px] space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  {field.type === "select" ? (
                    <Select
                      value={String(job.params[field.key] ?? field.default ?? "")}
                      onValueChange={(v) =>
                        patchJob(job.id, { params: { ...job.params, [field.key]: v } })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((o) => (
                          <SelectItem key={o.value || "auto"} value={o.value || "auto"}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      className="h-9"
                      min={field.min}
                      max={field.max}
                      value={String(job.params[field.key] ?? "")}
                      onChange={(e) =>
                        patchJob(job.id, { params: { ...job.params, [field.key]: e.target.value } })
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prompt visuel</Label>
              <Textarea
                value={job.prompt}
                onChange={(e) => patchJob(job.id, { prompt: e.target.value })}
                className="min-h-16 bg-white text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                className="flex items-center gap-2 text-sm text-slate-600"
                title="Une IA transforme le texte en description visuelle (image moins littérale) et applique la charte graphique / DA de la marque."
              >
                <input
                  type="checkbox"
                  checked={job.describe}
                  onChange={(e) => patchJob(job.id, { describe: e.target.checked })}
                />
                Description visuelle IA + DA
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={job.series}
                  onChange={(e) => patchJob(job.id, { series: e.target.checked })}
                />
                {hasSlides ? `Série (1 image / slide — ${slides!.length})` : "Série de variantes"}
              </label>
              {job.series && !hasSlides && (
                <Input
                  type="number"
                  min={2}
                  max={10}
                  className="h-8 w-20"
                  value={job.count}
                  onChange={(e) => patchJob(job.id, { count: Number(e.target.value) || 1 })}
                />
              )}

              <Button
                size="sm"
                onClick={() => launch(job)}
                disabled={job.running || !job.prompt.trim()}
                className="bg-[#10aee2] hover:bg-[#0d92be] text-white"
              >
                {job.running ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1 h-4 w-4" />
                )}
                Lancer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeJob(job.id)}
                className="text-slate-400 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {job.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {job.images.map((img, i) => (
                  <div
                    key={i}
                    className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-white"
                  >
                    {img.status === "done" && img.url ? (
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    ) : img.status === "error" ? (
                      <div className="flex flex-col items-center p-2 text-center text-[10px] text-red-600">
                        <AlertCircle className="mb-1 h-4 w-4" />
                        {img.error}
                      </div>
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-[#10aee2]" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
