# Génération Image/Vidéo par « jobs » (cartes de tâche)

Spec de conception — **à valider avant tout code**. Statut : design accepté, détail des composants à venir.

## But
Remplacer la matrice figée « un provider/modèle global » par des **lots de génération (jobs)** configurés à la volée et rattachés à un post/article. Un job = un modèle + ses params + une quantité (1 image ou carrousel de N), lancé indépendamment, exécuté en parallèle. Plusieurs jobs = variantes multi-modèles comparables.

Objectif double : **simplifier** (choix du modèle au moment de générer, plus de réglage global piégeux) et **enrichir** (variantes en //, chaque modèle avec ses seuls params utiles).

## Décisions validées
- **Portée** : un job est rattaché à **un post/article précis** ; les variantes s'affichent sous ce contenu.
- **Périmètre v1** : **images d'abord** (image simple + carrousel). Vidéo en phase 2, même mécanique.
- **Catalogue** : **unifié Magnific** (Freepik API). Gemini/OpenAI sont dans ce catalogue → une seule clé `MAGNIFIC_API_KEY`.
- **Registre** : **curé** (~7-8 modèles de référence), extensible ligne à ligne.
- **Async** : poll **côté client** (pas de webhook au départ).
- **Carrousel** : 1 prompt **par slide**, dérivé du script de slides déjà produit par l'app.
- **Coûts crédits** : hors périmètre pour l'instant.
- **Migration** : builder Magnific construit à côté de l'existant → tests → suppression des accès directs Gemini/OpenAI et de leurs clés.

## Plateforme API
- Base : `https://api.freepik.com`
- Auth : header `x-freepik-api-key: <MAGNIFIC_API_KEY>` *(à confirmer au moment de coder)*
- Toutes les générations sont **asynchrones** : `POST` → `{ task_id, status }` puis `GET .../{task_id}` jusqu'à `COMPLETED` (URLs d'images) ou `FAILED`.

## Modèles curés (proposition — à confirmer)
| id | Modèle | Famille | Bon pour | Refs | Endpoint (à figer) |
|---|---|---|---|---|---|
| `nano-banana` | Nano Banana (Gemini 2.5 Flash Image) | Google | Défaut actuel, refs marque | oui | `/v1/ai/text-to-image/nano-banana` |
| `mystic` | Mystic | Magnific | Photoréalisme signature | oui | `/v1/ai/mystic` |
| `imagen3` | Imagen 3 | Google | Photoréalisme, qualité brute | — | `/v1/ai/text-to-image/imagen3` |
| `gpt-image` | GPT image | OpenAI | Rendu type ChatGPT | oui | `/v1/ai/text-to-image/gpt-image` |
| `flux-2-pro` | Flux 2 Pro | Flux | Qualité, jusqu'à 8 refs | oui | `/v1/ai/text-to-image/flux-2-pro` |
| `ideogram-3` | Ideogram 3 | Ideogram | Design + **typographie** | oui | `/v1/ai/text-to-image/ideogram-3` |
| `seedream-4-5` | Seedream 4.5 | Seedream | Polyvalent haute qualité | oui | `/v1/ai/text-to-image/seedream-v4-5` |
| `flux-dev` | Flux Dev | Flux | Volume/vitesse (variantes rapides) | — | `/v1/ai/text-to-image/flux-dev` |

> Chemins exacts de `nano-banana` / `imagen3` / `gpt-image` / `ideogram-3` à confirmer depuis l'API reference (modèles confirmés dispos ; paths non résolus par la doc synthétique).

## Le registre (source de vérité UI + backend)
```ts
type Capability = 'text-to-image' | 'image-edit' | 'upscale' | 'video'

interface ParamField {
  key: string                 // ex: 'aspect_ratio'
  label: string
  type: 'select' | 'number' | 'text' | 'toggle'
  options?: string[]          // pour select
  default?: unknown
}

interface ModelDef {
  id: string
  label: string
  family: string              // regroupement dans le menu
  capability: Capability
  endpoint: string            // routage backend
  supportsReferences: boolean // images de marque
  params: ParamField[]        // UNIQUEMENT les champs utiles au modèle
}

const REGISTRY: ModelDef[] = [ /* les 7-8 lignes ci-dessus */ ]
```
Exemples de params par modèle :
```
ideogram-3 : [aspect_ratio, style_type, magic_prompt, rendering_speed, seed]
nano-banana: [aspect_ratio, num_images, reference_images]
flux-2-pro : [aspect_ratio, num_images, reference_images(≤8), seed]
```
→ Le registre génère **automatiquement** le formulaire « au cas par cas » et l'appel API. Ajouter un modèle = ajouter une ligne.

## Modèle de données — job
```ts
interface GenJob {
  id: string
  targetId: string                 // le post/article illustré
  kind: 'image' | 'carousel'
  modelId: string                  // clé du registre
  params: Record<string, unknown>
  count: number                    // 1, ou N slides pour un carrousel
  status: 'idle' | 'running' | 'done' | 'error'
  taskIds: string[]                // 1 par image (poll)
  results: string[]                // URLs au fil de l'eau
  error?: string
}
```

## Backend — un provider Magnific + tâches async
- `POST /api/gen` `{ modelId, kind, params, prompt, refs, targetId }`
  → route via `REGISTRY[modelId].endpoint`, crée la/les tâche(s) Freepik, renvoie `{ taskIds }`.
- `GET /api/gen/:taskId`
  → `{ status, imageUrl? }` (proxy du GET Freepik).
- Une seule clé `MAGNIFIC_API_KEY`. Le routage et les schémas de params viennent du registre partagé.

## Cinématique UI (v1 images)
```
[Post Twitter généré]
  ▸ + Image(s)
     ┌ Carte Job #1 ───────────────────────────────┐
     │ Modèle : Nano Banana ▼   (menu groupé par famille)
     │ Type   : ● Image   ○ Carrousel (N = nb slides du post)
     │ Params : [ratio 4:5] [☑ refs marque] …   (issus du registre)
     │ [ Lancer ]                                   │
     └───────────────────────────────────────────────┘
  ▸ + Image(s) → Job #2 (Flux 2 Pro)   → variante
  ▸ + Image(s) → Job #3 (Ideogram, carrousel)
  Résultats en // sous le post : [#1][#2][#3 slide1..N]
  Statut par carte : en attente / en cours / prêt / erreur
```
Chaque carte **poll son propre `taskId`** (côté client) → parallélisme naturel, variantes côte à côte. Feedback clair par carte (règle aussi le « rien ne se passe » observé avec l'ancien bouton global).

## Carrousel
Un job `carousel` = N générations partageant **modèle + params** mais **un prompt par slide**, dérivé du **script de slides déjà produit** par l'app (titre + texte de chaque slide). « + Image(s) → Carrousel » réutilise donc les slides existantes du post.

## Migration (progressive, sans casse)
1. Construire le builder de jobs branché **Magnific**, à côté de l'existant.
2. Tester : image simple, carrousel, variantes multi-modèles.
3. Une fois validé → retirer les chemins directs Gemini/OpenAI + leurs clés (redondants). Une seule clé, une seule facturation.

## Points ouverts / TODO implémentation
- [ ] Confirmer le header d'auth Freepik (`x-freepik-api-key`) et le format du GET de polling.
- [ ] Figer les **chemins exacts** des endpoints par modèle (nano-banana, imagen3, gpt-image, ideogram-3).
- [ ] Lister les **params réels** de chaque endpoint (depuis l'API reference) pour remplir `params[]`.
- [ ] (Plus tard) Coûts crédits par modèle ; vidéo (Kling/Hailuo/Wan/Seedance) ; upscale/expand.
```
