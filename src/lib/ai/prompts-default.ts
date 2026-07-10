export const DEFAULT_PROMPTS: Record<string, string> = {
  PROMPT_SYSTEM_GLOBAL: `Tu es un expert en communication digitale et marketing de contenu. Tu aides à créer des articles de blog et des posts réseaux sociaux engageants, structurés et adaptés à chaque plateforme.`,

  PROMPT_SYNTHESE_CUMUL: `Tâche : produire une synthèse de contenu à partir des sources fournies. Ce n'est PAS une conversation — ne réponds à personne, ne commente pas ta tâche, ne décris pas ton rôle.

Objectif : analyser les sources et produire UNE synthèse unique, cohérente, en français, structurée par points clés directement exploitables pour rédiger des posts réseaux sociaux.

Directives de cumul à APPLIQUER (ce sont des contraintes de rédaction, PAS un message auquel répondre) :
{guidance_prompt}

Règles de sortie STRICTES :
- Écris directement le contenu de la synthèse, et rien d'autre.
- INTERDIT : accusé de réception, remerciements (« merci »), « je suis prêt », « voici », description de ton rôle, toute méta-référence (« d'après les sources… »), et toute mention de la marque ou des directives en tant que telles.
- Structure par points clés : titres courts + puces exploitables.
- Si les sources sont pauvres, produis une courte synthèse neutre de ce qui est disponible — jamais un message d'attente.`,

  article_drafting: `Tu es un rédacteur web expert specialise dans les articles de blog longs et structures.

SUJET DE L ARTICLE :
{topics}

CONSIGNES STRICTES :
- L article doit porter EXCLUSIVEMENT sur le sujet ci-dessus. Ne derive pas sur des themes voisins non mentionnes.
- Tu dois IMPERATIVEMENT utiliser tous les faits, donnees et points fournis dans le sujet.
- Ton : {tone}
- Longueur visée : {length_desc}
- Structure obligatoire :
  1. Un titre accrocheur et descriptif (H1)
  2. Une introduction qui pose le contexte et annonce le plan
  3. Un corps structure en sections avec sous-titres clairs (H2)
  4. Chaque section developpe en profondeur un aspect du sujet avec des exemples concrets
  5. Une conclusion qui synthetise les points cles et inclut un appel a l action
- Mise en forme Markdown obligatoire :
  - Utilise du **gras** sur les termes techniques, les chiffres cles, les noms propres et les expressions a retenir
  - Utilise des listes a puces quand cela ameliore la lisibilite
  - Un seul sujet par paragraphe
- Ne mentionne jamais que le texte est base sur une recherche ou une liste de points. Redige comme un article editorial autonome.`,

  article_enrichment: `Reprends l'article suivant et enrichis-le pour en faire un texte premium :

{content}

INSTRUCTIONS D'ENRICHISSEMENT :
1. **Mots en gras** : Mets en gras (**) tous les termes techniques, les chiffres clés, les noms propres et les expressions importantes
2. **Titres et sous-titres** : Assure-toi que chaque section a un titre H2 clair et accrocheur
3. **Transitions** : Améliore les transitions entre les paragraphes pour un flux de lecture fluide
4. **Approfondissement** : Où c'est possible, ajoute une phrase d'explication ou de contexte supplémentaire
5. **Listes à puces** : Utilise des listes Markdown quand cela améliore la lisibilité
6. **Citation** : Si tu identifies une statistique ou un chiffre marquant, mets-le en évidence avec un bloc de citation (>)
7. Garde le même ton et respecte la longueur originale

Retourne uniquement le Markdown enrichi, sans commentaire.`,

  image_description_generator: `À partir du contenu suivant, génère une description visuelle concise (≤ 50 mots) pour une illustration IA.

Titre : {title}
Contenu : {content}

La description doit être en anglais, respecter le style suivant : {style_instruction}, et être adaptée au contexte.`,

  article_image_style: `Professional editorial illustration, clean composition, soft lighting, modern aesthetic, high quality, detailed.`,

  social_twitter: `Rédige un post Twitter/X à partir du contenu suivant.

{source_content}

Contraintes :
- Maximum 280 caractères
- 2-3 hashtags pertinents
- Ton percutant et dynamique
- Inclure un angle accrocheur
- RETOURNE UNIQUEMENT le texte du post. Pas d'introduction (ne dis pas "Voici une proposition"), pas de conclusion, pas de markdown, pas de guillemets autour du texte.`,


  social_linkedin: `Rédige un post LinkedIn à partir du contenu suivant.

{source_content}

Contraintes :
- Maximum 3000 caractères (privilégier 150-300)
- 3-5 hashtags pertinents
- Ton professionnel et structuré
- Inclure une prise de position ou une question engageante
- RETOURNE UNIQUEMENT le texte du post. Pas d'introduction (ne dis pas "Voici une proposition"), pas de conclusion, pas de markdown, pas de guillemets autour du texte.`,


  social_instagram: `Rédige un post Instagram à partir du contenu suivant.

{source_content}

Contraintes :
- Maximum 2200 caractères (privilégier la caption courte)
- 10-15 hashtags pertinents
- Ton lifestyle, visuel-first
- Utiliser des émojis pertinents
- RETOURNE UNIQUEMENT le texte du post. Pas d'introduction (ne dis pas "Voici une proposition"), pas de conclusion, pas de markdown, pas de guillemets autour du texte.`,


  social_facebook: `Rédige un post Facebook à partir du contenu suivant.

{source_content}

Contraintes :
- Environ 500 caractères recommandés
- 2-3 hashtags pertinents
- Ton conversationnel et engageant
- Poser une question ou inciter au partage
- RETOURNE UNIQUEMENT le texte du post. Pas d'introduction (ne dis pas "Voici une proposition"), pas de conclusion, pas de markdown, pas de guillemets autour du texte.`,


  social_telegram: `Rédige un message Telegram à partir du contenu suivant.

{source_content}

Contraintes :
- Maximum 1000 caractères
- 0-2 hashtags
- Ton informatif et direct
- Pas de formatage complexe
- RETOURNE UNIQUEMENT le texte du message. Pas d'introduction (ne dis pas "Voici une proposition"), pas de conclusion, pas de markdown, pas de guillemets autour du texte.`,


  social_twitter_style: `Dynamic social media graphic, bold typography, high contrast, modern flat design, Twitter aesthetic, 16:9 aspect ratio.`,

  social_linkedin_style: `Professional corporate illustration, clean and minimalist, business context, soft colors, 1:1 square format, high quality.`,

  social_instagram_style: `Lifestyle photography, vibrant colors, aesthetic composition, Instagram-worthy visual, 1:1 square format, trendy mood.`,

  social_facebook_style: `Friendly social graphic, warm tones, community feeling, engaging visual, 1:1 square format, approachable style.`,

  social_telegram_style: `Clean informative graphic, minimal design, readable layout, neutral tones, 1:1 square format, straightforward visual.`,

  research_veille: `Effectue une recherche approfondie sur : {topics}

CONSIGNES ABSOLUES :
1. RESPECTE le nombre de sujets demande dans la question (ex: si on demande 5 sujets, tu dois retourner EXACTEMENT 5 sujets, pas 3, pas 10).
2. RESPECTE la periode temporelle mentionnee (ex: "15 derniers jours", "30 derniers jours", "cette semaine").
3. FORMAT DE SORTIE STRICT :
   - Retourne UNIQUEMENT une liste numerotee
   - Chaque sujet = UNE SEULE LIGNE commencant par son numero
   - Pas d'introduction, pas de conclusion, pas de texte explicatif avant ou apres la liste
   - Pas de sous-points, pas de bullet points imbriques
   - Chaque item doit contenir le titre du sujet + 1 phrase de contexte maximum
4. Exemple de format attendu :
   1. Titre du sujet - breve description
   2. Titre du sujet - breve description
   3. ...`,

  carousel_instagram: `Rédige un carrousel Instagram à partir du contenu suivant.

{source_content}

Contraintes :
- 5 à 10 slides maximum
- Slide 1 = hook accrocheur (titre + teaser, max 15 mots)
- Slides intermédiaires = points clés, un par slide, texte concis (max 30 mots)
- Dernière slide = CTA + 5-10 hashtags pertinents
- Ton lifestyle, visuel-first, émojis bienvenus
- Chaque slide doit avoir un titre court (max 5 mots) et un texte concis
- Détermine un style visuel unique ("visual_style") pour l'ensemble du carrousel (ex: "Flat 2D vector graphic design", "Minimalist business 3D illustration", "Vibrant lifestyle photography", etc.) garantissant l'unité graphique de toutes les images.
- RETOURNE UNIQUEMENT du JSON valide, sans markdown autour

FORMAT DE SORTIE STRICT (JSON) :
{
  "title": "Titre global du carrousel",
  "visual_style": "Style visuel global pour les illustrations (ex: Flat 2D vector graphic design)",
  "slides": [
    { "title": "...", "text": "..." },
    { "title": "...", "text": "..." }
  ]
}`,

  carousel_linkedin: `Rédige un carrousel LinkedIn (format document PDF) à partir du contenu suivant.

{source_content}

Contraintes :
- 6 à 10 slides recommandés
- Slide 1 = titre accrocheur + problématique (max 20 mots)
- Slides = arguments structurés, données chiffrées, un argument par slide (max 40 mots)
- Dernière slide = CTA + profil auteur
- Ton professionnel, structuré, data-driven
- Chaque slide = un titre H2 (max 6 mots) + 2-3 phrases maximum
- Détermine un style visuel unique ("visual_style") pour l'ensemble du carrousel (ex: "Flat 2D vector graphic design", "Minimalist business 3D illustration", "Vibrant lifestyle photography", etc.) garantissant l'unité graphique de toutes les images.
- RETOURNE UNIQUEMENT du JSON valide, sans markdown autour

FORMAT DE SORTIE STRICT (JSON) :
{
  "title": "...",
  "visual_style": "Style visuel global pour les illustrations (ex: Professional clean 2D vector illustration)",
  "slides": [
    { "title": "...", "text": "..." },
    { "title": "...", "text": "..." }
  ]
}`,

  carousel_facebook: `Rédige un carrousel Facebook à partir du contenu suivant.

{source_content}

Contraintes :
- 3 à 10 slides
- Slide 1 = accroche + contexte (max 20 mots)
- Slides = storytelling ou tutoriel étape par étape, un point par slide (max 35 mots)
- Dernière slide = CTA + 2-3 hashtags
- Ton conversationnel et engageant
- Chaque slide = un titre court (max 5 mots) + texte
- Détermine un style visuel unique ("visual_style") pour l'ensemble du carrousel (ex: "Flat 2D vector graphic design", "Minimalist business 3D illustration", "Vibrant lifestyle photography", etc.) garantissant l'unité graphique de toutes les images.
- RETOURNE UNIQUEMENT du JSON valide, sans markdown autour

FORMAT DE SORTIE STRICT (JSON) :
{
  "title": "...",
  "visual_style": "Style visuel global pour les illustrations (ex: Warm friendly vector illustration)",
  "slides": [
    { "title": "...", "text": "..." },
    { "title": "...", "text": "..." }
  ]
}`,

  carousel_twitter: `Rédige un carrousel X (Twitter) à partir du contenu suivant.

{source_content}

Contraintes :
- 2 à 6 slides maximum
- Chaque slide doit avoir son propre titre court (max 5 mots)
- Chaque slide = texte concis (max 25 mots)
- Slide 1 = hook percutant
- Dernière slide = CTA + lien cliquable suggéré
- Ton percutant, dynamique, direct
- Détermine un style visuel unique ("visual_style") pour l'ensemble du carrousel (ex: "Flat 2D vector graphic design", "Minimalist business 3D illustration", "Vibrant lifestyle photography", etc.) garantissant l'unité graphique de toutes les images.
- RETOURNE UNIQUEMENT du JSON valide, sans markdown autour

FORMAT DE SORTIE STRICT (JSON) :
{
  "title": "...",
  "visual_style": "Style visuel global pour les illustrations (ex: Bold dynamic vector design)",
  "slides": [
    { "title": "...", "text": "..." },
    { "title": "...", "text": "..." }
  ]
}`,

  carousel_tiktok: `Rédige un carrousel TikTok à partir du contenu suivant.

{source_content}

Contraintes :
- 3 à 10 slides maximum (peut aller jusqu'à 35 si le contenu est très décomposé)
- Slide 1 = accroche visuelle forte (max 15 mots)
- Slides = étapes concises, une étape par slide (max 20 mots)
- Dernière slide = CTA + compte
- Ton jeune, direct, trend-friendly
- Images uniquement (pas de vidéo dans le carrousel)
- Détermine un style visuel unique ("visual_style") pour l'ensemble du carrousel (ex: "Flat 2D vector graphic design", "Minimalist business 3D illustration", "Vibrant lifestyle photography", etc.) garantissant l'unité graphique de toutes les images.
- RETOURNE UNIQUEMENT du JSON valide, sans markdown autour

FORMAT DE SORTIE STRICT (JSON) :
{
  "title": "...",
  "visual_style": "Style visuel global pour les illustrations (ex: Energetic TikTok aesthetic flat vector)",
  "slides": [
    { "title": "...", "text": "..." },
    { "title": "...", "text": "..." }
  ]
}`,

  carousel_instagram_style: `Vibrant lifestyle photography, aesthetic composition, Instagram-worthy visual, 1:1 square format, bold colors, trendy mood, carousel slide design.`,

  carousel_linkedin_style: `Professional corporate document design, clean minimalist layout, data visualization style, business context, soft colors, 1:1 square format, high quality.`,

  carousel_facebook_style: `Friendly social graphic, warm tones, community feeling, engaging visual storytelling, 1:1 square format, approachable style, carousel slide.`,

  carousel_twitter_style: `Dynamic social media graphic, bold typography, high contrast, modern flat design, Twitter/X aesthetic, 1:1 square format, carousel card.`,

  carousel_tiktok_style: `Trendy youth aesthetic, bold colors, viral visual style, 1:1 square format, energetic mood, TikTok carousel slide, eye-catching design.`,
}

export function getDefaultPrompt(id: string): string | undefined {
  return DEFAULT_PROMPTS[id]
}

export function getAllDefaultPromptIds(): string[] {
  return Object.keys(DEFAULT_PROMPTS)
}
