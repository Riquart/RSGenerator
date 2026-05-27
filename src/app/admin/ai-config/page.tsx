"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  KeyRound,
  TestTube,
  Cpu,
  RefreshCw,
} from "lucide-react";
import type { AIProvider } from "@/lib/ai/server-keys";
import { useAIConfig } from "@/context/AIConfigContext";

interface ProviderStatus {
  gemini: boolean;
  openai: boolean;
  perplexity: boolean;
  deepseek: boolean;
  fal: boolean;
  leonardo: boolean;
  freepik: boolean;
  magnific: boolean;
}

const ALL_PROVIDERS: AIProvider[] = [
  "gemini",
  "openai",
  "perplexity",
  "deepseek",
  "fal",
  "leonardo",
  "freepik",
  "magnific",
];

const providerLabels: Record<AIProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  perplexity: "Perplexity",
  deepseek: "DeepSeek",
  fal: "Fal.ai",
  leonardo: "Leonardo AI",
  freepik: "Freepik AI",
  magnific: "Magnific",
};

interface Assignment {
  txt: boolean;
  web: boolean;
  img: boolean;
  vid: boolean;
}

export default function AIConfigPage() {
  const { config, setProvider, updateConfig } = useAIConfig();

  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [testLoading, setTestLoading] = useState<AIProvider | null>(null);
  const [saveKeyLoading, setSaveKeyLoading] = useState<AIProvider | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    gemini: "",
    openai: "",
    perplexity: "",
    deepseek: "",
    fal: "",
    leonardo: "",
    freepik: "",
    magnific: "",
  });
  const [saveMessages, setSaveMessages] = useState<Record<string, string>>({});

  const [assignments, setAssignments] = useState<Record<AIProvider, Assignment>>(() => {
    const init: Record<string, Assignment> = {};
    ALL_PROVIDERS.forEach((p) => {
      init[p] = { txt: false, web: false, img: false, vid: false };
    });
    ALL_PROVIDERS.forEach((p) => {
      if (p === config.textProvider) init[p].txt = true;
      if (p === config.researchProvider) init[p].web = true;
      if (p === config.imageProvider) init[p].img = true;
      if (p === config.videoProvider) init[p].vid = true;
    });
    return init as Record<AIProvider, Assignment>;
  });

  const [assignSaveMsg, setAssignSaveMsg] = useState("");

  const [models, setModels] = useState({
    text: config.textModel,
    social: config.socialModel,
    research: config.researchModel,
    image: config.imageModel,
    video: config.videoModel,
  });
  const [modelSaveMsg, setModelSaveMsg] = useState("");

  const [restartLoading, setRestartLoading] = useState(false);
  const [restartMessage, setRestartMessage] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/ai/providers");
      const data = await res.json();
      setStatus(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    setModels({
      text: config.textModel,
      social: config.socialModel,
      research: config.researchModel,
      image: config.imageModel,
      video: config.videoModel,
    });
  }, [
    config.textModel,
    config.socialModel,
    config.researchModel,
    config.imageModel,
    config.videoModel,
  ]);

  const testProvider = async (provider: AIProvider) => {
    setTestLoading(provider);
    try {
      const res = await fetch("/api/settings/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${providerLabels[provider]} -- ${data.message} (${data.modelUsed})`);
      } else {
        alert(`${providerLabels[provider]} -- Erreur : ${data.error || "Inconnue"}`);
      }
    } catch {
      alert(`${providerLabels[provider]} -- Erreur reseau`);
    } finally {
      setTestLoading(null);
      fetchStatus();
    }
  };

  const saveKey = async (provider: AIProvider) => {
    const key = apiKeys[provider].trim();
    if (!key) return;
    setSaveKeyLoading(provider);
    try {
      const res = await fetch("/api/settings/save-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessages((prev) => ({ ...prev, [provider]: data.message }));
        setApiKeys((prev) => ({ ...prev, [provider]: "" }));
        fetchStatus();
      } else {
        setSaveMessages((prev) => ({ ...prev, [provider]: `Erreur : ${data.error}` }));
      }
    } catch {
      setSaveMessages((prev) => ({ ...prev, [provider]: "Erreur reseau" }));
    } finally {
      setSaveKeyLoading(null);
    }
  };

  const toggleAssignment = (provider: AIProvider, col: keyof Assignment) => {
    setAssignments((prev) => {
      const next = { ...prev };
      ALL_PROVIDERS.forEach((p) => {
        if (p !== provider) {
          next[p] = { ...next[p], [col]: false };
        }
      });
      next[provider] = { ...next[provider], [col]: !prev[provider][col] };
      return next;
    });
  };

  const saveAssignments = () => {
    const txtProvider = ALL_PROVIDERS.find((p) => assignments[p].txt);
    const webProvider = ALL_PROVIDERS.find((p) => assignments[p].web);
    const imgProvider = ALL_PROVIDERS.find((p) => assignments[p].img);
    const vidProvider = ALL_PROVIDERS.find((p) => assignments[p].vid);

    if (txtProvider) {
      setProvider("textProvider", txtProvider);
      setProvider("socialProvider", txtProvider);
    }
    if (webProvider) {
      setProvider("researchProvider", webProvider);
    }
    if (imgProvider) {
      setProvider("imageProvider", imgProvider);
    }
    if (vidProvider) {
      setProvider("videoProvider", vidProvider);
    }

    setAssignSaveMsg(
      `Providers enregistres -- TXT: ${txtProvider || "aucun"}, WEB: ${webProvider || "aucun"}, IMG: ${imgProvider || "aucun"}, VID: ${vidProvider || "aucun"}`
    );
  };

  const saveModels = () => {
    updateConfig({
      textModel: models.text.trim(),
      socialModel: models.social.trim(),
      researchModel: models.research.trim(),
      imageModel: models.image.trim(),
      videoModel: models.video.trim(),
    });
    setModelSaveMsg("Modeles enregistres. Aucun redemarrage necessaire.");
  };

  const restartServer = async () => {
    setRestartLoading(true);
    setRestartMessage("");
    try {
      const res = await fetch("/api/settings/restart", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRestartMessage(data.message);
        setTimeout(() => {
          window.location.reload();
        }, 6000);
      } else {
        setRestartMessage(`Erreur : ${data.error}`);
      }
    } catch {
      setRestartMessage("Erreur reseau lors du redemarrage");
    } finally {
      setRestartLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration IA</h1>
        <p className="text-muted-foreground mt-2">
          Gerez vos cles API, choisissez les providers par usage et configurez les modeles.
        </p>
      </div>

      {/* --- SECTION 1 -- CLES API + ASSIGNATION --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Cles API & Choix des providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[820px] space-y-2">
              <div className="grid grid-cols-[170px_260px_360px] items-center gap-3 px-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Provider</span>
                <span>Cle API</span>
                <div className="grid grid-cols-[56px_56px_56px_56px_44px_44px] justify-end gap-2 text-center">
                  <span>TXT</span>
                  <span>WEB</span>
                  <span>IMG</span>
                  <span>VID</span>
                  <span className="text-[10px]">Save</span>
                  <span className="text-[10px]">Test</span>
                </div>
              </div>

              {ALL_PROVIDERS.map((provider) => {
                const configured = status?.[provider] ?? false;
                return (
                  <div key={provider} className="rounded-lg border bg-card p-3">
                    <div className="grid grid-cols-[170px_260px_360px] items-center gap-3">
                      <div className="flex w-full items-center gap-2">
                        {configured ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <span className="text-sm font-medium">{providerLabels[provider]}</span>
                        <Badge variant={configured ? "default" : "secondary"} className="text-[10px]">
                          {configured ? "OK" : "Manquant"}
                        </Badge>
                      </div>

                      <Input
                        type="password"
                        placeholder={configured ? "Modifier la cle..." : `Cle ${providerLabels[provider]}...`}
                        value={apiKeys[provider]}
                        onChange={(e) =>
                          setApiKeys((prev) => ({ ...prev, [provider]: e.target.value }))
                        }
                        className="w-full text-sm"
                      />

                      <div className="grid grid-cols-[56px_56px_56px_56px_44px_44px] items-center justify-end gap-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={assignments[provider].txt}
                            onCheckedChange={() => toggleAssignment(provider, "txt")}
                            aria-label={`${providerLabels[provider]} pour texte`}
                          />
                        </div>

                        <div className="flex justify-center">
                          <Checkbox
                            checked={assignments[provider].web}
                            onCheckedChange={() => toggleAssignment(provider, "web")}
                            aria-label={`${providerLabels[provider]} pour recherche web`}
                          />
                        </div>

                        <div className="flex justify-center">
                          <Checkbox
                            checked={assignments[provider].img}
                            onCheckedChange={() => toggleAssignment(provider, "img")}
                            aria-label={`${providerLabels[provider]} pour images`}
                          />
                        </div>

                        <div className="flex justify-center">
                          <Checkbox
                            checked={assignments[provider].vid}
                            onCheckedChange={() => toggleAssignment(provider, "vid")}
                            aria-label={`${providerLabels[provider]} pour videos`}
                          />
                        </div>

                        <Button
                          size="sm"
                          variant="default"
                          disabled={!apiKeys[provider].trim() || saveKeyLoading === provider}
                          onClick={() => saveKey(provider)}
                          className="w-10"
                        >
                          {saveKeyLoading === provider ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={testLoading === provider}
                          onClick={() => testProvider(provider)}
                          className="w-10"
                        >
                          {testLoading === provider ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <TestTube className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {saveMessages[provider] && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {saveMessages[provider]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={saveAssignments}>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer le choix des providers
            </Button>
            {assignSaveMsg && (
              <span className="text-sm text-muted-foreground">{assignSaveMsg}</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>TXT</strong> = generation de texte (redaction + sociaux) &middot;{" "}
            <strong>WEB</strong> = recherche web / scraping &middot;{" "}
            <strong>IMG</strong> = generation d images &middot;{" "}
            <strong>VID</strong> = generation de videos
          </p>
        </CardContent>
      </Card>

      {/* --- SECTION 2 -- MODELES --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Modeles par categorie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Redaction (texte)</Label>
              <Input
                value={models.text}
                onChange={(e) => setModels((m) => ({ ...m, text: e.target.value }))}
                placeholder="gemini-2.5-flash, gpt-4o-mini..."
              />
              <p className="text-xs text-muted-foreground">
                Provider : <Badge variant="outline">{config.textProvider}</Badge>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Posts sociaux</Label>
              <Input
                value={models.social}
                onChange={(e) => setModels((m) => ({ ...m, social: e.target.value }))}
                placeholder="gemini-2.5-flash, gpt-4o-mini..."
              />
              <p className="text-xs text-muted-foreground">
                Provider : <Badge variant="outline">{config.socialProvider}</Badge>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Recherche web</Label>
              <Input
                value={models.research}
                onChange={(e) => setModels((m) => ({ ...m, research: e.target.value }))}
                placeholder="sonar-pro, gpt-4o..."
              />
              <p className="text-xs text-muted-foreground">
                Provider : <Badge variant="outline">{config.researchProvider}</Badge>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Generation image</Label>
              <Input
                value={models.image}
                onChange={(e) => setModels((m) => ({ ...m, image: e.target.value }))}
                placeholder="gpt-image-2, flux/dev..."
              />
              <p className="text-xs text-muted-foreground">
                Provider : <Badge variant="outline">{config.imageProvider}</Badge>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Generation video</Label>
              <Input
                value={models.video}
                onChange={(e) => setModels((m) => ({ ...m, video: e.target.value }))}
                placeholder="wan-2-7-text-to-video, kling-o1..."
              />
              <p className="text-xs text-muted-foreground">
                Provider : <Badge variant="outline">{config.videoProvider}</Badge>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={saveModels}>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer les modeles
            </Button>
            {modelSaveMsg && (
              <span className="text-sm text-muted-foreground">{modelSaveMsg}</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Les modeles sont envoyes dynamiquement a chaque appel API.{" "}
            <strong>Aucun redemarrage necessaire</strong> pour modifier un modele.
          </p>
        </CardContent>
      </Card>

      {/* --- SECTION 3 -- REDEMARRAGE --- */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <RefreshCw className="h-5 w-5" />
            Redemarrage serveur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apres avoir ajoute ou modifie une <strong>cle API</strong>, le serveur doit etre redemarre pour la prendre en compte. Le changement de <strong>modele</strong> ou de <strong>provider</strong> via les cases a cocher ne necessite pas de redemarrage.
          </p>
          <Button
            variant="destructive"
            onClick={restartServer}
            disabled={restartLoading}
          >
            {restartLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Redemarrer le serveur
          </Button>
          {restartMessage && (
            <p className="text-sm font-medium text-muted-foreground">
              {restartMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
