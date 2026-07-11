# Refonte de la cinématique de génération (RS Generator)

Proposition validée. Direction : **type-first** (choix explicite du livrable avant de générer),
séparation nette **TEXTE / VISUELS**, régénération granulaire via les cartes-jobs existantes.
Priorité : **Phases 1 & 2 d'abord**, puis Phase 3 (gabarits).

> Contrainte forte : **réemployer tout ce qui fonctionne déjà**. Le back-end couvre l'essentiel ;
> le seul vrai chantier neuf est le **moteur de gabarits** (Phase 3).

## Diagnostic
Aujourd'hui « Générer » (`generateTextOnly`) boucle sur `formats × réseaux` (multi-select) et produit
tout d'un bloc → l'intention est floue, le format « Image » est un hybride, la vidéo est marginale.
Le marché (Predis, PostNitro, Canva, Buffer…) impose : **choisir le livrable d'abord**, **séparer
texte et visuels**, **régénérer élément par élément**.

## Cible : 3 familles de génération explicites
```
1. SOURCES → 2. SYNTHÈSE (opt., + web) → 3. JE VEUX CRÉER :
   ┌──────────────────────┬─────────────────────┬───────────────────────────┐
   │  CONTENU ①           │  IMAGES ②           │  VISUEL STRUCTURÉ ③ (P3)  │
   │  Post(réseau)/Article│  prompt + contexte  │  gabarit multi-zones :    │
   │  /Carrousel (texte)  │  sources + DA/refs  │  fond IA + texte NET      │
   └──────────┬───────────┴──────────┬──────────┴─────────────┬─────────────┘
              ▼ texte éditable        ▼ grille d'images        ▼ slides/visuels
              └────────► cartes-jobs « + Image(s) / + Visuel » (régén. indépendante)
```

## Briques réutilisées (ne rien casser)
| Existant | Rôle |
|---|---|
| `generatePost` / `generateCarouselText` / `generateArticle` (+ prompts `social_*`, `carousel_*`, `article_draft`) | Texte des livrables ① |
| `optionBlock` (ton/CTA/hashtags/emojis) | Réglages en chips |
| Sources + `synthesizeSources` (+ enrichissement web) | Base commune |
| `GenerationJobs` + `/api/gen` (+ `/status`) + `magnific-registry` | Moteur images ② + fonds de gabarits ③ |
| `buildImagePrompt` + `applyReferences` + `brand-identity` (couleurs, logo, refs, visualMood) | DA & refs |
| `GeneratedItem` (post/carousel/article/image) | Structure des résultats |
| Refonte éditoriale (sections numérotées, barre sticky) | Cadre UI conservé |

---

## PHASE 1 — Contenu « type-first » *(priorité 1, faible effort, réutilise tout)*

### But
Remplacer le multi-select « Formats + Réseaux » par un **choix explicite d'UN livrable**, qui ne
génère que **le texte** de ce livrable. Les visuels restent séparés (cartes-jobs sous le résultat).

### UI (section ③ « Créer », layout éditorial conservé)
1. **Sélecteur de type** (3 tuiles) : **Post** · **Article** · **Carrousel**.
2. Si **Post** ou **Carrousel** → **1 réseau** au choix (LinkedIn / Instagram / Facebook / X). Article = universel (pas de réseau).
3. **Réglages contextuels** (chips/selects), selon le type :
   - Post : ton, CTA, hashtags, emojis, langue.
   - Carrousel : ton, **nb de slides**, hashtags/emojis, réseau.
   - Article : longueur cible, ton.
4. Barre sticky **« Générer »** → génère **le texte du livrable choisi uniquement**.

### Comportement
- Post → `generatePost(platform, source)` → 1 `GeneratedItem{type:'post'}`.
- Article → `generateArticle(source)` → 1 `{type:'article'}`.
- Carrousel → `generateCarouselText(platform, source, slideCount)` → 1 `{type:'carousel', slides:[{title,text}]}` (texte seul, images via cartes-jobs).

### Changements d'état (dashboard)
- Remplacer `selectedWorks: WorkType[]` + `selectedPlatforms: Platform[]`
  par **`deliverableType: 'post'|'article'|'carousel'`** (single) + **`targetPlatform: Platform`** (single, ignoré pour Article).
- Conserver `tone`, `cta`, `withHashtags`, `withEmojis`, `slideCount`, `optionBlock`.
- Compteurs de la barre sticky : `Sources / Type / Réseau` (au lieu de Sources/Réseaux/Formats).
- La fonction de génération devient un `switch(deliverableType)` réutilisant les 3 générateurs existants
  (retirer la boucle multi × ; retirer le format « Image » du contenu — il passe en famille ② ; la
  vidéo sort du 1er niveau, réintroductible plus tard en option).

### Réutilisé tel quel
`getGenerationSourceContent`, rendu des résultats, `GenerationJobs` monté sous post/article/carrousel,
prompts LLM, providers.

---

## PHASE 2 — « Images seules » comme mode de 1er niveau *(priorité 2, quasi déjà fait)*

### But
Exposer la génération d'images **indépendamment** d'un post, alimentée par **les sources / la synthèse**,
avec prompt éditable + contrôles (DA on/off, refs on/off, format, nombre de variantes).

### UI
- Ajouter **Images** comme famille de 1er niveau (onglet/tuile à côté de Contenu).
- Réutiliser **`GenerationJobs`** (déjà : provider/modèle, format, prompt, `describe`=DA, `useRefs`, `series/count`).
- **Injecter le contexte des sources** : `baseText` = synthèse si présente, sinon contenu des sources actives
  (via `getGenerationSourceContent`). Prompt pré-rempli + éditable. Petit libellé « Contexte : synthèse/sources ».
- Génération **par carte** (bouton « Lancer » existant), grille de résultats, **régénération par image**.

### Réutilisé tel quel
`GenerationJobs`, `/api/gen`, `magnific-registry`, `buildImagePrompt` (DA), `applyReferences` (refs),
formats/aspects, poll async.

### Petit ajout
Passer le contexte sources en `baseText` du mode Images autonome (aujourd'hui `baseText={synthesisText}`
→ fallback sur le contenu des sources si pas de synthèse).

---

## PHASE 3 — Visuel structuré (gabarits) *(le vrai chantier neuf, après 1 & 2)*

### Principe (validé par la recherche)
Les modèles d'image **ne rendent pas de texte fiable** en zones précises (fiable ≈ 1-3 mots). Donc un visuel
multi-zones **contrôlé** = **composition par gabarit** : **fond généré par l'IA** (avec DA/refs/couleurs) **+
texte NET posé en calques** (vrai texte vectoriel) **+ logo**. C'est ce que font PostNitro/Predis/AdCreative.

### Stack technique recommandée (Next.js App Router)
- **`next/og` (Satori)** : HTML/CSS **flexbox → PNG**, déjà inclus (aucune dépendance lourde), idéal pour
  **zones empilées** + texte net + logo + couleurs de marque. (Limites Satori : flexbox/absolu seulement,
  pas de grid/calc, fonts ttf/otf, bundle ≤ 500 Ko → fetch assets au runtime.)
- **`sharp`** : composer un **fond IA** (pipeline image actuel) sous les calques de texte si besoin.
- Compatible serverless/standalone (contrairement à Puppeteer, trop lourd).

### Modèle de gabarit
`Template = { format, zones: [{ background: couleurDA | imageIA | uni, text, style }], logo? }`.
Gabarits de départ (reco validée) : **1) Colonne à N zones** (l'exemple utilisateur), **2) Cover de carrousel**,
**3) Quote-card**. Extensible ensuite.

### Effets de bord positifs
Le **carrousel** bascule sur ce moteur : chaque slide = instance de gabarit (fond IA + texte net) → texte
fiable, fini le « 1 image IA par slide avec texte baké ».

---

## PHASE 4 — Options avancées *(plus tard)*
- Contrôles image « de marque » exposés progressivement : **palette imposée**, **prompt négatif**, **seed**
  (reproduire/varier), en plus des refs/format déjà là.
- Déclinaison **multi-réseaux** d'un post « maître » avec **preview par plateforme** (école ContentStudio/Vista).
- Templates de copywriting nommés (AIDA, HOOK, storytelling…) en presets de ton.

---

## Décisions actées
1. Flux **type-first** (livrable d'abord). ✔
2. Ordre : **Phase 1 + 2 d'abord**, puis Phase 3. ✔
3. Gabarits de départ : **colonne N-zones + cover carrousel + quote-card**. ✔
4. Proposition **persistée** (ce fichier). ✔

## Références (recherche)
- Séparation texte/visuel + régén. granulaire : PostNitro, Taplio, Predis, Canva, Buffer, ContentStudio.
- Visuels structurés = composition par gabarit : PostNitro carousel maker, AdCreative template builder,
  APIs autofill (Bannerbear/Placid). Modèles d'image ≠ texte fiable multi-zones.
- Stack : `next/og`/Satori, `sharp` (compositing), repli Puppeteer only.
