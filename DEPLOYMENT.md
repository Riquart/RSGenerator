# Guide de Déploiement Next.js Standalone sur Hostinger (Managed Node.js)

Ce document compile les connaissances et solutions techniques élaborées pour déployer avec succès une application **Next.js 15 App Router** en mode **standalone** sur l'hébergement mutualisé/Cloud de **Hostinger (Node.js Web App)** via un pipeline **GitHub Actions**.

---

## 1. Architecture cible sur Hostinger

Hostinger utilise **Phusion Passenger** (intégré sous LiteSpeed) pour gérer les applications Node.js. L'architecture repose sur une séparation en deux dossiers :
*   `public_html/` : Le dossier racine du domaine. Il ne contient pas le code de l'application mais héberge le fichier `.htaccess` de configuration du serveur web.
*   `nodejs/` : Le dossier de l'application (`PassengerAppRoot`). Il contient les fichiers compilés du dossier de build Next.js `.next/standalone` (le code serveur `server.js`, `node_modules`, `package.json`, `public` et les fichiers statiques de build).

---

## 2. Pièges critiques rencontrés & Solutions

### 🚀 Piège 1 : Erreur de permission (`EACCES`) lors de l'assistant de configuration hPanel
**Problème** : Lors de la création initiale de l'application Node.js via le panneau Hostinger, le système tente d'installer et de compiler l'application sur le serveur de production, ce qui plante avec des erreurs de permission (`EACCES`) car les ressources système sur hébergement partagé sont trop limitées pour compiler un projet Next.js.
**Solution** :
1. Préparer un fichier d'installation fictif `dummy-app.zip` contenant uniquement :
   * Un fichier `server.js` minimal (serveur HTTP natif basique écoutant sur `process.env.PORT`).
   * Un fichier `package.json` neutralisé où le script de build fait juste un `echo` (ex: `"build": "echo bypassed"`).
2. Uploader ce zip dans l'assistant hPanel. Le build Hostinger réussit immédiatement et l'application passe à l'état **"Running"**.
3. Déployer ensuite la vraie application de production en écrasant les fichiers via le pipeline de déploiement automatique GitHub Actions (qui fait le build lourd sur les machines GitHub gratuites).

---

### 🔌 Piège 2 : Le bug du port / Unix Domain Socket (Erreur 503)
**Problème** : Par défaut, le fichier `server.js` généré par le build Next.js standalone fait un cast entier du port de démarrage : `parseInt(process.env.PORT, 10) || 3000`.
Or, Phusion Passenger transmet un chemin vers un **Unix Domain Socket** (ex: `/tmp/passenger.XXXX/socket`) dans la variable `process.env.PORT` plutôt qu'un numéro de port. Le `parseInt` renvoie donc `NaN`, Next.js démarre sur le port TCP `3000` par défaut, et Passenger ne peut pas communiquer avec, ce qui produit un timeout et une erreur `503 Service Unavailable`.
**Solution** : 
Nous devons modifier le fichier `.next/standalone/server.js` post-build sur le runner CI/CD pour qu'il teste si le port fourni est une chaîne textuelle (chemin de socket) et, si oui, qu'il le transmette tel quel à Next.js.
Nous utilisons un script de post-build dédié `scripts/patch-server.js` :
```javascript
// scripts/patch-server.js
const fs = require('fs');
const file = '.next/standalone/server.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'const currentPort = parseInt(process.env.PORT, 10) || 3000',
  'const currentPort = process.env.PORT && isNaN(process.env.PORT) ? process.env.PORT : (parseInt(process.env.PORT, 10) || 3000)'
);
fs.writeFileSync(file, content, 'utf8');
```

---

### 📁 Piège 3 : Crash silencieux de Node au démarrage (`preload-timestamp.js` manquant)
**Problème** : Hostinger génère automatiquement dans le fichier `.htaccess` de `public_html` une variable d'environnement `NODE_OPTIONS` :
`SetEnv NODE_OPTIONS "--require /home/uXXXX/domains/tondomaine.com/.builds/config/preload-timestamp.js"`
Si le dossier `.builds/` ou le script `preload-timestamp.js` est absent (supprimé lors d'un nettoyage ou d'un push), Node.js plante instantanément au chargement de l'environnement avec une erreur `MODULE_NOT_FOUND`, avant même d'exécuter la première ligne de `server.js` ou d'écrire dans les logs.
**Solution** :
Dans le workflow CI/CD GitHub Actions, avant de nettoyer le serveur, nous recréons obligatoirement un dossier et un fichier `preload-timestamp.js` vide (fictif) aux deux chemins potentiels (le dossier parent et `public_html/`) pour neutraliser ce crash :
```bash
PARENT_DIR=$(dirname "$PUBLIC_HTML_DIR")
mkdir -p $PARENT_DIR/.builds/config $PUBLIC_HTML_DIR/.builds/config
echo '// dummy' > $PARENT_DIR/.builds/config/preload-timestamp.js
echo '// dummy' > $PUBLIC_HTML_DIR/.builds/config/preload-timestamp.js
```

---

## 3. Configuration Recommandée

### next.config.ts (ou next.config.js)
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Génère le serveur Node autonome dans .next/standalone
  images: {
    unoptimized: true, // Recommandé pour éviter la surcharge processeur
  }
};

export default nextConfig;
```

### Script de diagnostic remote utile (`scripts/diag.sh`)
Ce script permet de tester le comportement de l'application en arrière-plan directement sur la machine distante et de capturer les logs de démarrage réels :
```bash
#!/bin/bash
NODEJS_DIR="$1"
cd "$NODEJS_DIR"
# Lancement de test en arrière-plan
/opt/alt/alt-nodejs22/root/bin/node server.js > console.log 2>&1 &
PID=$!
sleep 3
# Envoi de requête locale pour valider le code 200 OK
curl -i http://127.0.0.1:3000/
# Affichage des logs
cat console.log
kill -9 $PID || true
```

---

## 4. Pipeline GitHub Actions minimal (`.github/workflows/deploy.yml`)

Le pipeline doit :
1. Lancer `npm ci` et `npm run build`.
2. Exécuter `node scripts/patch-server.js` pour patcher la liaison du port.
3. Copier les dossiers `public/` et `.next/static/` dans le répertoire standalone.
4. Créer les fichiers `preload-timestamp.js` fictifs sur Hostinger.
5. Nettoyer les fichiers résiduels Node de `public_html/` pour éviter les conflits de routing.
6. Synchroniser `.next/standalone/` vers `nodejs/` via `rsync` (en excluant `.htaccess`, `.env*` et les fichiers de base de données persistants de production).
7. Mettre à jour `.htaccess` pour renseigner le chemin absolu du fichier log `LSNODE_CONSOLE_LOG`.
