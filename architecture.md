# ARCHITECTURE SYSTÈME : BIBLIOTHÈQUE MUSICALE LOCALE AVANCÉE

**Projet :** Lecteur et gestionnaire de bibliothèque musicale hautes performances
**Propriétaire de la structure :** Colin Bossu Réaubourg (Wartets)

---

## 1. VUE D'ENSEMBLE ET PARADIGME ARCHITECTURAL

Le système est conçu comme une application web locale exécutée dans un environnement de bureau natif (de type Electron, Tauri ou architecture Client/Serveur local). Cette approche permet de combiner la fluidité et les interfaces riches des technologies web modernes avec un accès bas niveau au système de fichiers (lecture/écriture de métadonnées physiques, suppression, déplacement).

Le système est entièrement hors-ligne, hermétique aux services externes (aucune dépendance sociale ou cloud), et optimisé pour gérer une arborescence très stricte (Groupes > Projets > Dossiers > Fichiers audio et artworks).

L'architecture se divise en trois couches principales :

1. **La Couche de Données (Data Layer) :** Stockage hybride basé sur le fichier `musicBib.json` généré en amont, couplé à une base de données locale dynamique (IndexedDB/SQLite) pour les états changeants (statistiques, playlists).
2. **Le Moteur Logique (Core Engine) :** Scripts tournant en arrière-plan (Web Workers / Processus Main) gérant l'audio, l'indexation, la recherche et la manipulation de fichiers.
3. **L'Interface Utilisateur (UI Layer) :** Single Page Application (SPA) réactive, axée sur la performance d'affichage (Virtual DOM, Lazy Loading).

---

## 2. MODÈLE DE DONNÉES ET INDEXATION (Data Layer)

### 2.1. Ingestion du `musicBib.json`

Le fichier généré par `indexation.bat` sert de "Single Source of Truth" (Source Unique de Vérité) pour l'état physique de la bibliothèque.
L'application charge ce fichier au démarrage. Pour garantir des performances de recherche et de tri instantanées (Feature 12), ce JSON est parsé et injecté dans une base de données interne relationnelle en mémoire (ou IndexedDB), éclatée en plusieurs tables :

* **Table Tracks :** ID, Hash SHA256 (clé primaire), chemins, durées, formats.
* **Table Metadatas :** Titres, Artistes, Albums, Genres, Années, BPM.
* **Table Hierarchy :** Groupes (Album 2, Album 3, Single...), Projets (Album 3.1, Projet 8...), Dossiers pistes.
* **Table Artworks :** Chemins relatifs des images, ratios, et `dominant_color` (utilisé pour le theming adaptatif de l'UI).

### 2.2. Base de données utilisateur (User Data Store)

Puisque le `musicBib.json` est écrasé/mis à jour par le script Batch, l'application maintient un fichier séparé (ex: `userdata.db`) lié par le *Hash SHA256* des fichiers. Il contient :

* **Statistiques de lecture :** Compteur de lectures, dernière lecture, historique.
* **Curation locale :** Playlists manuelles, règles de playlists intelligentes, notations (étoiles), favoris.
* **États UI :** Historique de recherche, personnalisation des colonnes, thème choisi.

### 2.3. Cycle de vie de l'indexation (Feature 1.1 & 1.3)

* **Indexation initiale :** Validation des chemins, vérification physique (les fichiers listés existent-ils ?), détection et signalement des doublons basés sur le Hash SHA256.
* **Surveillance (Watchers) :** Un processus écoute les modifications dans `C:\Users\Colin\Music\Colin Bossu Réaubourg\`. Tout ajout déclenche une indexation incrémentale en tâche de fond.
* **Nettoyage :** Si un fichier audio est supprimé ou renommé, l'application met à jour la base de données interne. Les entrées orphelines sont détectées, et le `musicBib.json` interne est réconcilié.
* **Gestion des artefacts :** Exclusion automatique des fichiers `.DS_Store` ou fichiers systèmes cachés.

---

## 3. ORGANISATION LOGIQUE ET VUES (Feature 1.2 & 2)

Le Core Engine doit être capable de pivoter les données de la base interne pour générer des vues dynamiques instantanées :

### 3.1. Vues Principales (Routage Interne)

* **Vue Morceaux :** Tableau plat de toutes les versions indexées (`total_tracks_versions`), affichage par colonnes personnalisables (Titre, Version, Dossier, Poids, Bitrate).
* **Vue Albums / Projets :** Regroupement par `logic.hierarchy.album` ou `metadata.album`. Fusion automatique des disques multiples si détectée. S'il n'y a pas d'artwork, un placeholder vectoriel dynamique est généré en utilisant la couleur dominante de l'album.
* **Vue Groupes (Chronologique) :** Exploitation stricte du Niveau 1 de l'arborescence (Album 2, Album 3, Single).
* **Vues Méta :** Par Artistes, Compositeurs (Wartets/Colin Bossu Réaubourg), Genres, Années.
* **Vues Techniques :** Par qualité (Lossless: WAV/FLAC vs Lossy), Format, Dossiers physiques, Date d'ajout (basée sur `epoch_created`).

### 3.2. Tri et Filtrage (Feature 2.3)

Chaque vue est enveloppée dans un contrôleur d'état permettant :

* Des tris multi-niveaux (ex: Tri par Année puis par Artiste).
* Des filtres croisés en temps réel appliqués en mémoire (ex: "Afficher uniquement les formats Lossless ET ayant une note > 4 étoiles").

---

## 4. MOTEUR AUDIO ET LECTURE (Audio Engine) (Feature 3 & 7)

C'est le composant critique du système. Il interagit directement avec les API audio du système pour garantir une fidélité parfaite (Bit-perfect si possible).

### 4.1. Gestion de la Lecture (Core Audio)

* **Décodage local :** Support natif de tous les formats via des décodeurs intégrés (MP3, AAC, M4A, WAV, FLAC, AIFF).
* **Hi-Res & Lossless :** Détection via `audio_specs.is_lossless` et `audio_specs.sample_rate`. Un badge "Hi-Res" ou "Lossless" s'illumine dans le lecteur.
* **Gapless Playback (Lecture sans blanc) :** Pré-chargement du fichier suivant dans un buffer secondaire 5 secondes avant la fin de la piste actuelle pour assurer une transition au sample près.
* **Traitements (DSP) :** Implémentation de la Web Audio API pour :
  * Égaliseur paramétrique.
  * Fondu enchaîné (Crossfade) configurable.
  * Gestion de la balance stéréo.
  * Normalisation du volume (basée sur l'analyse RMS des fichiers).

### 4.2. File d'attente (Queue Manager)

Structure de données en liste doublement chaînée gérant :

* L'historique (pistes précédentes).
* La piste en cours.
* La file "Up Next" (dynamique, modifiable par glisser-déposer).
* **Modes de progression :** Linéaire, Répétition (1 / Tous), Aléatoire (Shuffle algorithmique utilisant Fisher-Yates, avec contexte : shuffle total vs shuffle dans un dossier).

### 4.3. Interface du Lecteur

* Barre de progression calculée avec précision (TimeUpdate).
* Affichage des paroles (LRC synchronisé s'il existe dans le dossier, sinon texte statique).
* Visualiseur audio analysant les fréquences via un `AnalyserNode` branché sur le flux audio.

---

## 5. MOTEUR DE RECHERCHE AVANCÉE (Feature 4)

Un Web Worker dédié maintient un index inversé en mémoire (type lunr.js ou recherche FTS SQLite) pour ne pas bloquer le thread principal de l'UI.

* **Recherche Instantanée ("As You Type") :** Interrogation globale sur `track_name`, `metadata.title`, `hierarchy.folder`.
* **Recherche Typée :** Syntaxe avancée dans la barre de recherche (ex: `genre:electronic bitrate:>320 year:2020-2023`).
* **Algorithme de similarité :** Tolérance aux fautes de frappe (distance de Levenshtein) pour retrouver un projet même mal orthographié.

---

## 6. GESTION DES PLAYLISTS ET CURATION (Feature 5)

Les playlists sont stockées dans le `userdata.db` de l'application.

* **Playlists Manuelles :** Table d'association simple `[PlaylistID, TrackHash, Ordre]`. L'utilisateur peut y assigner une jaquette personnalisée et une description. Exportable au format M3U standard.
* **Playlists Intelligentes (Smart Playlists) :** Constructeur de requêtes visuel. Les playlists intelligentes ne stockent pas de pistes, mais *une requête sérialisée* (ex: `SELECT tracks WHERE play_count > 50 AND is_lossless = true ORDER BY epoch_modified DESC`). Évaluation en temps réel à chaque ouverture de la playlist.
* **Générateur de Statistiques :** Module d'analyse lisant le `userdata.db` pour générer des graphiques (Répartition par genre, top morceaux de la période 2021-2023, temps total d'écoute).

---

## 7. GESTION DES FICHIERS ET MÉTADONNÉES (Feature 6 & 9)

Cette architecture doit communiquer avec l'OS local pour manipuler les fichiers physiques de l'arborescence.

### 7.1. Édition des Tags (Metadata Writer)

* Utilisation d'une librairie bas niveau (ex: `node-id3` ou équivalent `ffprobe/ffmpeg`) pour écrire physiquement les modifications de tags (Titre, Album, Année) *dans* le fichier `.mp3`, `.m4a`, etc.
* **Modification en lot :** Appliquer un changement d'artiste à l'intégralité d'un dossier ("Projet 8") en une seule transaction.
* Mise à jour immédiate du `musicBib.json` interne suite à l'écriture.

### 7.2. Manipulation des Artworks

* Outil d'import permettant de copier/remplacer une image `artwork.jpg` dans le dossier de la piste.
* Redimensionnement automatique à la volée avant sauvegarde pour optimiser le poids du dossier.
* Mise en cache immédiate, recalcul de la couleur dominante (`dominant_color`) et re-rendu de l'UI.

### 7.3. Gestion Physique

* Renommage de fichiers massifs selon un template (ex: `%track_number% - %title% - %version%.%ext%`).
* Déplacement de dossiers physiques (ex: Passer "Projet 19" de l'Album 6 à l'Album 7) via l'interface, exécutant une commande système de déplacement (`mv`).
* Ouverture directe du chemin dans l'Explorateur Windows.

---

## 8. ARCHITECTURE DE L'INTERFACE ET UX (Feature 8)

L'UI est structurée en grilles dynamiques et responsives, fortement inspirée par l'ergonomie des lecteurs natifs haut de gamme, mais ultra-personnalisable.

### 8.1. Disposition Spatiale

* **Barre Latérale (Gauche) :** Navigation principale (Bibliothèque, Vues, Playlists, Recherche, Paramètres).
* **Zone Centrale :** Affichage de contenu dynamique. Utilisation stricte de *Virtual Scrolling* (recyclage des éléments du DOM) pour afficher 5000+ pistes sans chute de framerate.
* **Barre de Lecture (Bas) :** Contrôles constants, volume, indicateurs techniques de la piste en cours.
* **Volet Droit (Contextuel) :** Révélé à la demande pour afficher l'inspecteur de fichier (Chemin, Poids, Hash), l'historique de lecture ou les paroles.

### 8.2. Moteur de Rendu Visuel (Theming)

* Support natif Clair/Sombre/Système.
* **Thème Adaptatif (Chameleon UI) :** Lors de la lecture d'une piste, l'interface extrait la propriété `dominant_color` du JSON (calculée au préalable par l'analyse Bitmap du Batch). Cette couleur est convertie en variables CSS HSL pour générer des dégradés subtils en fond d'écran et teinter les boutons d'action de l'application.

### 8.3. Interaction

* Support extensif du Drag & Drop HTML5 (fichiers vers une playlist, réorganisation de la file d'attente).
* Mappage de raccourcis clavier globaux (Espace = Play/Pause, Ctrl+F = Recherche).
* Menus contextuels personnalisés (Clic droit sur une piste pour ouvrir l'éditeur de métadonnées, voir dans l'explorateur, etc.).

---

## 9. EXTRAS MULTIMÉDIAS (Feature 10)

L'architecture va au-delà du simple fichier audio :

* **Détection des fichiers associés :** Si un fichier PDF ou un fichier texte (notes de composition) se trouve dans le même dossier de niveau 3 que la piste (ex: dans `Album 4.2\End of Chapter one\`), le lecteur affiche une icône "Livret disponible" et intègre une visionneuse de document.
* **Pistes à tiroirs :** Si une piste dépasse une certaine durée avec un long silence (analysable dynamiquement ou via métadonnées `comment`), le lecteur permet un affichage des "chapitres audio" ou marqueurs de section.

---

## 10. PERFORMANCES ET OPTIMISATIONS (Feature 12)

Le système est taillé pour la vitesse absolue, quel que soit le volume de l'arborescence :

* **Multithreading :** Les processus lourds (indexation, recherche, analyse de fichiers corrompus) tournent sur des Web Workers distincts.
* **Mise en cache des images :** Les images `artwork.jpg` sont montées en Blob URLs au démarrage ou interceptées par un Service Worker local pour éviter de recharger l'image physique depuis le disque dur à chaque défilement.
* **Memoization React/Vue :** Les composants de la liste des pistes ne se re-rendent que si leurs données internes changent (via la comparaison des `hash_sha256`).
* **Pagination / Infinite Scroll :** Rendu au viewport uniquement. Même si l'Album 3 contient des centaines de versions (comme le montre le `structure.txt` pour `155 151 163 163 040 165`), le DOM ne contiendra jamais plus d'éléments que ce qui est visible à l'écran.

---

## 11. DIAGNOSTICS ET SÉCURITÉ LOCALE (Feature 11)

Même si l'application est locale, elle nécessite des routines de maintenance :

* **Journalisation (Logging) :** Tout événement d'indexation, erreur de lecture, ou échec d'écriture de tag est écrit dans un fichier texte local `app_diagnostic.log`.
* **Analyse d'intégrité :** Routine déclenchable pour comparer le `musicBib.json` avec l'état réel des fichiers. Détection des fichiers dont le poids a changé à l'insu de l'application.
* **Backups automatiques :** Sauvegarde rotative du fichier `userdata.db` (historique, playlists) pour prévenir toute corruption. Possibilité d'importer/exporter cet état.
