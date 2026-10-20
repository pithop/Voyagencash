# Passe design — prompt de Claude Design (v1, d'après l'archive 61000e6 du 25/09)

> **Ajustements de Claude Code avant application (25/09, après-midi)** — ils priment sur le texte ci-dessous :
> 1. La phrase « "commission" côté partenaire (commissionnaire) est un terme contractuel : ne pas toucher » est DÉPASSÉE : le distributeur nomade devient une SOCIÉTÉ REVENDEUSE (décision de la fondatrice du 25/09) ; la bascule en cours retire « commission » / « commissionnaire » côté nomade. Ne réintroduis jamais ces mots.
> 2. Le prompt a été écrit sur l'archive du matin : une partie est déjà faite (bons vendus en cartes sous 720 px, montants insécables, listes clé/valeur de Mon point, champ #tp-montant, menu du Compte de Mes bons réorganisé, fenêtre de signature et bandeau de cookies ajoutés). Partir du CODE ACTUEL ; ne pas refaire ; signaler les écarts.
> 3. Le tiroir du back-office passe de 900 à 1024 px (comme proposé en 2.3) : payencash-manager.css et payencash-coque.js, commentaire daté.
> 4. La légende sous le code d'un bon (ui/titres/02-titre.html) prend le texte proposé, conforme à la règle « le bon s'utilise uniquement sur le site de la marque » : « Ce code est lié à ton numéro. Il s'utilise uniquement sur le site de la marque : ne le montre qu'au moment de l'utiliser. » (à confirmer par la fondatrice ; réversible).
> 5. Toujours : aucun id ni attribut data-* renommé ou supprimé (le banc les lit) ; les textes testés par le banc qui changent sont déclarés pour mise à jour du banc.

---

> Analyse faite sur le CODE (HTML, CSS de page, gabarits JS, payencash-v2.css, payencash-manager.css, payencash-tech.css), sans rendu navigateur ni captures. Les écrans marqués « audit léger » n'ont été vus que par mesures automatiques (tailles de police, contrastes, styles en ligne, libellés) : applique-leur les règles transverses, et signale tout écart. Absents de l'archive : la fenêtre de signature des trois documents (Mes bons 00) et le bandeau de cookies — NE PAS les créer ni les modifier dans cette passe.

## 1. Contexte

AJEK (SASU, marque PayEnCash) est grossiste en bons d'achat de marque : il achète les bons aux marques ; commerces (tabacs, presses) et distributeurs nomades les revendent ; la personne qui achète un bon le retrouve dans « Mes bons » et l'utilise sur le site de la marque. Slogan : « Vos bons d'achat, notre réseau ».
Maquette cliquable HTML/CSS/JS vanilla, six espaces : Mes bons (ui/titres/, 375 px d'abord), Solution (ui/marchand/, marques, 1280 px + téléphone), Partenaire (ui/distributeur/, 375 px, barre du bas), Manager (ui/manager/, 1280 px), Hotline (ui/hotline/), Vitrine (index.html, portail.html).
Les écrans sont peints en JS depuis ui/assets/payencash-data.js ; le style vient de ui/assets/payencash-v2.css (+ payencash-manager.css, payencash-tech.css, payencash-inscription.css, payencash-comment-payer.css).
Pour ouvrir la maquette : ui/manager/31-comptes-demo.html → « Monter le jeu de démonstration », puis portail.html.
Le système existe et il est solide (jetons, .pec-card, .pec-pill, .pec-cta, .pec-kpi, .pec-table, .pec-vide, .pec-stepper, reduced-motion global). Cette passe corrige surtout : des contrastes sous AA dans les jetons eux-mêmes, une échelle typographique éclatée, des composants redéfinis page par page, les tableaux sur téléphone, et quelques libellés interdits.

### Contraintes non négociables
- Système de design EXISTANT : ui/assets/payencash-v2.css et ses jetons (--color-ink #0f2a24, --color-primary #10a06a, --color-primary-dark #0c7f54, --color-mint #e6f4ec, --color-bg #f4f7f5, --color-surface #fff, --color-card #f7faf8, --color-muted #5c6b64, --color-amber*, --color-nomade*, --color-danger* …), polices Hanken Grotesk (texte) et JetBrains Mono (codes, montants techniques). Pas de nouvelle couleur en dur : si un jeton manque, propose-le nommément (nom + valeur + rôle) pour qu'il soit ajouté au :root.
- Aucune règle métier, aucun montant, aucun texte juridique ne change : tu proposes du design (mise en page, composants, hiérarchie, microcopie d'interface), pas de nouvelles fonctions ni de nouvelles données. Toute valeur affichée vient déjà du data-layer (ui/assets/payencash-data.js) : jamais de valeur écrite en dur.
- Vocabulaire : écriture neutre (jamais « il/elle » pour la personne, jamais « ·e ») ; mots INTERDITS dans l'interface : « wallet », « porte-monnaie », « compte » au sens de réserve d'argent, « solde de compte », « recharge », « monnaie électronique », « carte prépayée », « cagnotte », « commission » côté marque, « fournisseur » pour une marque, « payer sans carte », « sans carte bancaire », « demande de paiement », « page de paiement », « payer / régler / réglé » pour nos propres gestes, « vente du réseau ». Le bon s'utilise UNIQUEMENT sur le site de la marque, jamais dans Mes bons.
- Technique : HTML/CSS/JS vanilla, pas de framework ni de bibliothèque d'interface ; garder tous les id et attributs data-* existants (un banc de tests automatisé les lit) ; téléphone d'abord pour Mes bons et Partenaire ; barre latérale à partir de 1024 px ; cibles ≥ 40 px ; focus visible ; prefers-reduced-motion respecté.

Règles d'exécution supplémentaires :
- Ne renomme aucune classe utilisée par du JS ; quand tu unifies un composant local (.db-msg, .cp-msg…) sur un composant partagé, AJOUTE la classe partagée à côté de l'ancienne, puis vide les règles locales devenues inutiles. Ne supprime jamais un id.
- Les identifiants techniques internes (ex. `fournisseur` dans `modeSso`, `SSO_FOURNISSEURS`, `rechargeMin/Max`) ne sont pas de l'interface : NE PAS les renommer. Seul le texte affiché compte.
- Les commentaires datés du code (« (25/09) … ») sont la mémoire du projet : garde-les, ajoute les tiens au même format.

## 2. Principes transverses (payencash-v2.css d'abord)

### 2.1 Jetons à ajouter au :root (valeurs vérifiées)
Constat : plusieurs jetons servent de couleur de TEXTE sans atteindre 4,5:1.
- `--color-muted-2` #8c988f : 3,00:1 sur blanc, 2,78 sur --color-bg → utilisé en texte dans .pec-kpi .lbl, .pec-table th, .pec-pill--off, .pec-code-caption, .pec-vide-ico.
- `--color-amber-text` #b5781f : 3,70 sur blanc, 3,27 sur --color-amber-well → texte de .pec-pill--wait et des alertes « En attente… » (tech/08).
- `--color-primary` #10a06a : blanc dessus = 3,36:1 → .pec-cta (15 px / 13,5 px) et .pec-btn (13,5 px) sont sous AA.
- `--color-primary-dark` sur --color-mint = 4,43:1 → .pec-pill--live/--done et états actifs.
- `--color-mint-ink` #5c8a78 : 3,92 sur blanc.
- `:focus-visible` en --color-primary : 2,96:1 sur --color-mint (sous 3:1).

À ajouter :
- `--color-primary-ink: #0b7550` — texte et icônes verts posés sur --color-mint ou --color-surface (5,04:1 sur mint, 5,71 blanc dessus).
- `--color-amber-ink: #8f5c12` — texte « en attente / échéance » sur --color-amber-well ou blanc (5,00:1 / 5,66:1). --color-amber-text reste pour les éléments non textuels (icônes ≥ 24 px, bords).
- `--color-focus: var(--color-primary-dark)` — anneau de focus (≥ 4,4:1 sur toutes les surfaces).
- Échelle typographique (remplace les 35 tailles différentes relevées, dont ~700 déclarations entre 9,5 et 12,5 px) :
  `--text-xs: 12px` (minimum absolu : mentions, horodatages) · `--text-sm: 13px` (méta, libellés de tuiles, en-têtes de tableau) · `--text-base: 15px` (corps, champs) · `--text-md: 17px` · `--text-lg: 20px` · `--text-xl: 24px` (titres de page bureau) · `--text-2xl: 28px` (valeur de tuile) · `--text-3xl: 32px` (montant principal d'un écran).
- `--radius-pill: 999px` (déjà en dur partout).

Règles d'usage à écrire en commentaire dans le :root :
- --color-muted-2, --color-disabled, --color-mint-ink, --color-primary, --color-amber, --color-nomade : JAMAIS en couleur de texte < 24 px. Remplacements : texte gris → --color-muted ; texte vert → --color-primary-ink ; texte ambre → --color-amber-ink ; texte nomade → --color-nomade-ink.
- Aucune taille de police < 12 px dans ui/ (hors documents/). Libellé de barre du bas : 11 px minimum, voir .pec-tab.

### 2.2 Composants partagés (corriger / créer dans payencash-v2.css)
1. `.pec-cta`, `.pec-btn` (manager.css) — fond `--color-primary-dark` (blanc 5,02:1), survol/actif `--color-primary-ink` ; --shadow-cta inchangée. Hauteurs conservées (52 / 48 / 40 px). Ajouter `.pec-cta--danger` et `.pec-btn--danger` harmonisés (fond --color-danger-text, blanc dessus 8,4:1) pour les gestes irréversibles (annuler un bon, refuser un dossier).
2. `.pec-pill` — 12 px (`--text-xs`), padding 4px 10px, min-height 24 px. Couleurs : `--wait` → texte --color-amber-ink ; `--off` → texte --color-muted ; `--live` et `--done` → texte --color-primary-ink ET distinguer les deux : `--live` garde fond --color-mint + point 6 px --color-primary devant le texte (via ::before), `--done` fond --color-surface + bord 1px --color-mint-soft. Ajouter `--danger` (fond --color-danger-well, texte --color-danger-text) et `--nomade` (fond --color-nomade-well, texte --color-nomade-ink) s'ils n'existent pas. Créer UNE table état → variante dans un module partagé (ex. `PEC_ETATS` dans payencash-bus.js ou payencash-data.js côté affichage seulement) et l'utiliser partout où une page choisit la classe à la main. Supprimer les surcharges de taille locales (`.bl-table .pec-pill{font-size:9.5px}`).
3. `.pec-kpi` (aujourd'hui dans manager.css) — le déplacer dans payencash-v2.css et en faire LA tuile chiffrée des six espaces : libellé `--text-sm` --color-muted (plus d'uppercase 9,5 px), valeur `--text-2xl` 800 tabular-nums, ligne d'appoint `--text-xs` --color-muted. Variante `--alerte` (valeur en --color-amber-ink + bord 1px --color-amber-soft), `--compact` (valeur `--text-lg`) pour téléphone. Remplace : .tk-kpi (tech.css, qui porte en plus une barre gauche en dur `#1E7A50` → supprimer), .pb-kpi (partenaire/02), .bl-kpi (partenaire/04), .kpis (manager/46). Grille : `.pec-grid--kpi` = 2 colonnes < 720 px, 4 colonnes ≥ 1024 px (3 si 3 tuiles).
4. `.pec-amount` (nouveau) — `font-variant-numeric: tabular-nums; white-space: nowrap;` + tailles `--xl` (--text-3xl), `--lg` (--text-xl), `--md` (--text-md). À poser sur chaque montant peint par D.eur() dans les tuiles, cartes de bon, lignes de liste, colonnes « num ». Un montant ne se coupe jamais sur deux lignes.
5. `.pec-list` / `.pec-list-row` (nouveau dans v2, inspiré de .pec-row existant) — ligne cliquable ≥ 56 px : titre `--text-base` 700 + sous-ligne `--text-sm` à gauche ; `.pec-amount--md` + `.pec-pill` à droite ; chevron si lien. C'est la forme TÉLÉPHONE de tous les tableaux (voir 2.3).
6. `.pec-table` — en-têtes `--text-sm`, --color-muted, sans uppercase (ou uppercase à 12 px minimum), colonnes `.num` alignées à droite en tabular-nums, lignes ≥ 48 px, `th[aria-sort]` conservé. Uniformiser .bl-table (partenaire/04) et les tableaux manager dessus.
7. `.pec-msg` (nouveau) — message en ligne : `--ok` (fond --color-mint, texte --color-primary-ink), `--info` (--color-info-well / --color-info-text), `--wait` (--color-amber-well / --color-amber-ink), `--ko` (--color-danger-well / --color-danger-text, bord --color-danger-line). Icône + texte, `--text-sm`, padding 10px 12px, rayon 12 px. Remplace les 10 variantes locales : .bi-msg, .mb-msg, .db-msg, .rc-msg, .cp-msg, .bo-msg, .bc-msg, .ar-msg, .bl-msg, .tl-msg, .msg (partenaire/07, manager/45), .tk-err, .v-err, .rm-err.
8. `.pec-kv` (nouveau) — paire libellé / valeur (libellé --color-muted `--text-sm` à gauche, valeur 700 à droite, séparateur --color-sep). Remplace .db-kv, .cp-kv, .ar-kv, .v-kv, .rv-kv, .mp-kv.
9. `.pec-sheet` (nouveau, à partir de .scrim/.popup existants) — feuille basse sur téléphone, modale centrée ≥ 1024 px ; `role="dialog" aria-modal="true"`, titre relié par aria-labelledby, bouton fermer 44 px, focus piégé, Échap ferme, focus rendu au déclencheur. Remplace .mb-voile/.mb-feuille (bons/01), .bq-scrim/.bq-sheet (bons/07), .scrim/.feuille (tech/09), .sheet (bons/09 garde sa spécificité carte, mais reprend le haut de feuille). Mettre la logique focus/Échap dans un petit module partagé (payencash-bus.js ou nouveau payencash-feuille.js) plutôt que dans chaque page.
10. `.pec-back` (nouveau) — lien retour : 44 px de haut, chevron + libellé, --color-primary-ink. Remplace les retours écrits en style en ligne (partenaire/11 « ‹ Mes rencontres », manager/42 « File de contrôle »).
11. `.pec-code-num` / `.pec-code-caption` — code du bon `--text-md` (17 px) mono, groupé par 4 avec une espace fine (affichage seulement, la valeur copiée reste brute) ; légende `--text-xs` --color-muted (aujourd'hui 10,5 px en --color-muted-2 : 3:1).
12. `.pec-tab` (barre du bas) — libellé 11 px minimum (aujourd'hui 9,5 px), icône 20 px, cible ≥ 48 px de haut. État actif inchangé (fond --color-ink) : bon contraste.
13. Focus : `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }` ; retirer les `outline:none/0` sans remplacement relevés dans bons/03, bons/07, tech/09 (×2), manager/27-assistance-reclamations, hotline/01 — ou les remplacer par un anneau équivalent.
14. `.pec-field-err` — message d'erreur sous un champ : `--text-sm` --color-danger-text, icône. Les conteneurs d'erreur vides avec `role="alert"` (bons/00 : un par champ) passent en `aria-live="polite"` ; `role="alert"` seulement sur le message d'erreur global du formulaire, pour ne pas faire annoncer chaque champ.

### 2.3 Mise en page par format
- 375 px : une colonne, marges 16 px, zéro défilement horizontal de page. Un tableau de plus de 3 colonnes n'existe pas sous 720 px : même source JS, deux rendus (`<table class="pec-table">` ≥ 720 px, `.pec-list` en dessous) — ou un seul `<table>` transformé en cartes par CSS (`display:block` sur tr, `td::before{content:attr(data-label)}`) en ajoutant `data-label` aux `<td>` depuis le gabarit JS.
- 720 px (tablette) : 2 colonnes de tuiles et de cartes.
- 1024 px : barre latérale. ATTENTION : payencash-manager.css bascule en tiroir sous 900 px (et payencash-coque.js le dit) alors que v2 et la règle projet disent 1024. Aligner manager + hotline sur 1024 : tiroir < 1024 px, barre fixe ≥ 1024 px (garder la logique de payencash-coque.js, changer le point de rupture et le commentaire).
- 1280 px : contenu max --pec-contenu-max (1080 px) ; liste + détail côte à côte quand la page a déjà les deux panneaux (manager/42).
- Styles en ligne : ne pas tout migrer, mais toute déclaration en ligne de couleur, taille de police ou marge répétée sur un écran que tu touches passe en classe (plus gros foyers : tech/10-compte 189, manager/10-configuration 171, hotline/01 108, manager/30 108, manager/29 82, tech/09 74, tech/07 57, manager/42 53).

### 2.4 Hiérarchie par public (sert à trancher)
- Mes bons : ce qu'il me reste, sur quel bon, jusqu'à quand → comment l'utiliser sur le site de la marque → aide.
- Partenaire : vendre d'abord, les chiffres ensuite ; au comptoir, lisible à bout de bras.
- Solution : ce que nous devons à la marque, quand, sur quel RIB → ce qui bloque → le reste.
- Manager / Hotline : ce qui attend une décision → les agrégats.
- Tutoiement dans les apps, vouvoiement sur la vitrine : c'est cohérent, garde-le ; ne mélange jamais les deux sur une même page.

### 2.5 Libellés interdits relevés (texte affiché uniquement)
| Fichier | Actuel | Remplacer par |
|---|---|---|
| index.html (nav, §02, boutons) | « Ce qu'on paie », « Ce que nous vous payons », « Voir ce que nous payons », « Nous achetons vos bons. Vous choisissez quand nous vous payons. », « Plus nous vous payons vite… » | « Nos offres », « Ce que nous vous versons », « Voir nos offres », « Nous achetons vos bons. Vous choisissez quand nous vous les versons. », « Plus le versement est rapide… » |
| ui/manager/45-marchand-paiements.html | titre « Marques à payer », colonne « À payer », vide « Rien à payer : … » | « Versements aux marques », « À verser », « Rien à verser : … » |
| ui/manager/02-tableau-de-bord.html | colonne « Paiement de la marque », indice « rien à payer pour l'instant » | « Versement à la marque », « rien à verser pour l'instant » |
| ui/marchand/02-espace.html, 08-paiement.html, 10-compte.html | liens « régler › » (corriger un point bloquant) | « compléter › » (ou « corriger › » s'il s'agit d'une erreur) |
| ui/titres/02-titre.html | « Dans ton compte depuis le » | « Dans Mes bons depuis le » |
Vérifie ensuite par recherche qu'aucun autre texte affiché ne contient « payer / régler / réglé » pour un geste d'AJEK. « Régler dans Mon point » (partenaire/03) et « ne te fais pas payer » (partenaire/11) désignent le geste du partenaire ou du client : ne pas toucher. [Ajustement 1 : « commission » côté nomade est retirée par la bascule en cours — ne pas la réintroduire.]

## 3. Recommandations écran par écran

Format : fichier — priorité — CE QUI CHANGE → POURQUOI → CRITÈRE.

### 3.1 Mes bons (ui/titres/)

**ui/titres/01-mes-titres.html — P1**
- Carte « Ce qu'il te reste à dépenser » (#mb-total) : valeur en `.pec-amount--xl`, libellé `--text-sm`. Ordre des boutons : « Acheter un bon » reste secondaire, « Mon flashcode » primaire — garder, mais les mettre en grille 2 colonnes égales (pas de retour à la ligne à 375 px).
- Onglets #mb-onglets (Mes bons / En cours / Proposés / Aide) : les passer en contrôle segmenté pleine largeur, 44 px de haut, libellés `--text-sm` 700, compteur en `.pec-pill` quand il y a des éléments ; masquer l'onglet « En cours » quand #achat est vide (au lieu d'un volet vide). « Aide » : garder l'onglet mais le placer à droite, séparé visuellement (c'est une action, pas une liste).
- Carte d'un bon (gabarit `carte(r)`) : la ligne `.mb-meta` concatène validité · enseigne · détail · code en une seule phrase à 12 px. La découper : ligne 1 « Valable jusqu'au … » (`--text-sm`, en --color-amber-ink + `.pec-pill--wait` si l'échéance est proche selon le data-layer) ; ligne 2 « Acheté chez … » `--text-xs` ; code masqué dans une ligne à part en mono. Montant restant `.pec-amount--lg`, « sur 50,00 € » à côté. Les deux actions (« Voir le code », « Utiliser sur son site ») en boutons ≥ 44 px, « Utiliser sur son site » en primaire quand il existe.
- Tri : conserver l'ordre du data-layer (B.liste()) ; ne pas re-trier côté page.
→ Pourquoi : la personne vient voir combien il reste et jusqu'à quand ; aujourd'hui l'échéance est noyée dans une phrase de méta.
→ Critère : à 375 px, sur chaque carte, le reste est l'élément le plus grand, la date de validité est sur sa propre ligne, aucun montant ne passe à la ligne, les deux boutons font ≥ 44 px ; le banc de tests trouve toujours `data-code` et `data-utiliser`.

**ui/titres/02-titre.html — P1**
- Ordre de .db-fiche à 375 px : (1) en-tête émetteur + pastille ; (2) `.pec-kv` « Ce qu'il te reste sur ce bon » en `.pec-amount--xl` + validité ; (3) bouton primaire « Utiliser sur le site de [marque] » (le lien #db-site, aujourd'hui caché en bas de la carte « Où et comment l'utiliser », devient un `.pec-cta` juste sous le montant quand il est présent) ; (4) .pec-code-slab ; (5) « Où et comment l'utiliser » ; (6) « Un problème avec ce bon ? ». À ≥ 1024 px, les deux colonnes .db-col actuelles restent, dans cet ordre.
- Légende sous le code (.pec-code-caption) : 12 px --color-muted. Libellé : voir ajustement 4.
- « Signaler un problème » : garder en secondaire ; le formulaire ouvert utilise `.pec-field-err` et `.pec-msg`.
→ Pourquoi : le geste unique de ce bon (l'utiliser sur le site de la marque) est aujourd'hui le dernier élément de la carte, sous le code.
→ Critère : à 375 × 667, montant restant et bouton « Utiliser sur le site » visibles sans défiler ; aucun texte ne suggère d'utiliser le bon dans Mes bons.

**ui/titres/03-rechercher.html — P2**
- Onglets .choix2 (commerces / distributeurs nomades) : l'onglet nomade porte l'identité nomade (icône et compteur en --color-nomade-ink sur --color-nomade-well) ; la légende de carte #mb-legende, aujourd'hui `aria-hidden="true"`, reste masquée aux lecteurs d'écran mais doit être doublée dans chaque ligne de résultat par un `.pec-pill--nomade` « Se déplace » ou « Commerce ».
- Résultats #mb-resultats en `.pec-list` (nom, distance, horaires en sous-ligne).
- `#rc-aide` : style en ligne 12 px → `.pec-msg--info`.
- Popup de géolocalisation #geopop : passe sur `.pec-sheet` ; bouton « Continuer sans — je cherche une ville ou une adresse » raccourci en « Chercher une ville ou une adresse » (même action).
- Supprimer l'`outline:none` local ou le remplacer.
→ Critère : on peut choisir un point et comprendre s'il est nomade sans regarder la carte ni la couleur.

**ui/titres/09-rencontre.html — P1**
- Aucun `<h1>` : transformer `.rdv-t` de la feuille en `<h1>` (même classe, même id éventuel).
- Feuille #rdv-sheet : poignée + titre + état courant en texte + `.pec-stepper` des étapes de la rencontre (le stepper existe déjà dans le gabarit, vérifier que le libellé de l'étape active est écrit sous la barre, `--text-sm`). Flashcode de remise ≥ 200 px de côté, fond --color-surface.
- Pastille ETA (#rdv-eta) et bouton retour (.retour) : cibles ≥ 44 px, fond --color-surface + --shadow-elevated pour se détacher de la carte.
- 22 styles en ligne : ceux de couleur/taille passent en classes.
- Même vocabulaire d'états que ui/distributeur/11-remise.html (mêmes libellés, mêmes pastilles) — les lire tous deux dans la table PEC_ETATS.
→ Critère : l'état de la rencontre se lit en texte dans la feuille sans la déplier ; lecteur d'écran : un titre de niveau 1.

**ui/titres/00-inscription.html — P1 (hors fenêtre de signature)**
- Fil #bi-fil : afficher « Étape n sur N » en texte au-dessus des segments (réutiliser `.pec-stepper` + `.pec-stepper-labels`), bouton retour `.pec-back`.
- Boutons SSO (#bi-sso-boutons) : même hauteur 52 px, même largeur, logo + « Continuer avec … » ; séparateur « ou avec ton e-mail » en `--text-sm`.
- Erreurs par champ (.bi-e, role="alert" ×n) → `.pec-field-err` + `aria-live="polite"` ; un seul `role="alert"` pour le message global.
- 19 tailles < 12,5 px dans le style de page : ramener aux jetons (`.p` « — facultatif… » en `--text-xs`, pas moins).
→ Critère : à 375 px, le premier champ est visible sans défiler sous les boutons SSO ; aucune erreur annoncée avant la première validation.

**ui/titres/04-compte.html — P2**
- Menu du compte : regrouper les entrées en trois `.pec-list` titrées (« Profil et sécurité » : profil, Mon flashcode, adresses, mot de passe, identité ; « Documents et confidentialité » : documents signés, cookies ; « Aide et session »). « Se déconnecter » isolé en bas, `.pec-btn-secondary` pleine largeur, texte --color-danger-text.
- 36 pastilles et 13 `.pec-tile` : les pastilles d'état d'une section (ex. identité vérifiée) passent par PEC_ETATS.
- 27 tailles < 12,5 px à ramener.
→ Critère : chaque ligne du menu ≥ 56 px, une seule pastille par ligne, lisible à 375 px.

**ui/titres/05-offre.html, 06-connexion.html, 07-boutiques.html, 08-boutique.html, 10-article.html — P2/P3, audit léger**
- 07 : `.bq-scrim/.bq-sheet` (filtres) → `.pec-sheet` ; retirer l'`outline:none`. Filtres actifs rappelés en puces au-dessus de la grille, avec « Tout effacer ».
- 05, 06, 10 : messages locaux → `.pec-msg`, paires → `.pec-kv`, tailles → jetons. 10 : 2 couleurs en dur à remplacer par jetons.
- 08 : vérifier que le prix des articles utilise `.pec-amount`.

### 3.2 Partenaire (ui/distributeur/)

**ui/distributeur/02-accueil.html — P1**
- Deux `<h1>` (#hero-enseigne et #pb-tete-enseigne) : garder `<h1>` sur celui visible selon le format, rétrograder l'autre en `<p>` stylé pareil (ou `aria-hidden` sur le doublon masqué) — garder les deux id.
- Ordre téléphone : aujourd'hui hero → bonjour → bandeau → 4 tuiles → bouton « Vendre ». Monter #cta-vendre juste sous le hero (avant .pb-kpis). À ≥ 1024 px, le bouton reste dans .pec-page-actions (déjà le cas).
- .pb-kpis → `.pec-kpi` + `.pec-grid--kpi` (2×2 à 375 px). La tuile « Ta part gardée » (#kp-gagne) est celle qui compte pour un commerce : la mettre en premier, `.pec-amount--lg`.
- 30 tailles < 12,5 px à ramener.
→ Pourquoi : au comptoir, l'action est « vendre » ; les chiffres se consultent ensuite.
→ Critère : à 375 × 667, le bouton « Vendre un bon de marque » est visible sans défiler ; un seul h1 exposé.

**ui/distributeur/03-vendre.html — P1**
- Ordre du formulaire #v-form conservé (marque → montant → mobile du client → moyen → case « J'ai encaissé » → Émettre), mais : ajouter AVANT le bouton un récapitulatif `.pec-kv` alimenté par les valeurs déjà calculées (#v-du : marque, montant du bon en `.pec-amount--xl`, ce que tu dois, ta part) — le bloc #v-du existe, le rendre toujours visible dès que marque et montant sont valides, et le styler en carte récapitulative.
- Montant (#v-montant) : 20 px, 600, tabular-nums, champ 56 px ; « ex. 40 » → placeholder conservé, les bornes (#v-limites) sous le champ en `--text-sm`.
- Moyens de paiement (.v-moyen) : cases à cocher en tuiles 48 px (déjà 46 → 48), état coché avec coche visible en plus de la couleur.
- `.pec-actionbar` (nouveau, dans v2) : sur téléphone, le bouton « Émettre le bon » colle en bas au-dessus de la barre d'onglets, avec le montant rappelé à gauche.
- Résultat (#v-resultat) : « ✓ Bon émis » (#v-ok, 12,5 px) → `.pec-msg--ok` 15 px ; le ticket (#v-ticket) affiche le code du bon en `.pec-code-num` ≥ 24 px (lisible à bout de bras, à la manière d'un ticket de code au comptoir).
- Carte « La vente est fermée » (#v-ferme) → `.pec-msg--wait` + bouton.
- Erreur #v-erreur → `.pec-msg--ko`.
→ Critère : à 375 px, une vente complète au pouce ; le montant du bon et ce que le point doit sont visibles au moment d'appuyer sur « Émettre le bon ».

**ui/distributeur/04-titres.html — P1**
- Tableau .bl-table (7 colonnes, 11 px, en-têtes 10 px, pastilles 9,5 px, défilement horizontal) : sous 720 px, rendu en `.pec-list` — ligne 1 : marque + `.pec-amount--md` ; ligne 2 : date · code masqué (mono) · `.pec-pill` ; « Je dois » et « Vendu par » en sous-ligne quand ils sont affichés ; actions (réimprimer, annuler) derrière un bouton « … » 44 px ou dans le panneau ticket. ≥ 720 px : `.pec-table`, tailles jetons (14 px corps, 13 px en-têtes). Conserver `data-fsortable`, `data-fsearch="#bl-rows > tr"` : si tu changes la structure, adapte les sélecteurs de payencash-filters.js SANS casser les autres pages (ou garde des `<tr>` rendus en cartes par CSS, solution préférée).
- .bl-kpi (3 colonnes à 375 px, libellés 10,5 px) → `.pec-kpi--compact` en 3 colonnes seulement ≥ 720 px, sinon 2 + 1.
- Panneau d'annulation #bl-motif : « Annuler ce bon » passe en `.pec-cta--danger` ; « Garder » secondaire à gauche. Textarea : `<label>` visible « Motif » (aujourd'hui placeholder seul).
→ Critère : à 375 px, aucune colonne coupée, aucun défilement horizontal ; chaque bon tient sur une carte ; montant et pastille sur une ligne ; le tri et la recherche fonctionnent toujours.

**ui/distributeur/11-remise.html — P1**
- Lien retour en ligne → `.pec-back`. Styles en ligne des boutons (`width:auto…`) → classes.
- Zone caméra #rm-cadre : état (#rm-etat) en texte `--text-base` sous le viseur. Saisie manuelle : champ `.pec-input--code` 20 px mono, bouton « Vérifier » à côté (56 px) ; erreur → `.pec-msg--ko`.
- Mêmes libellés d'états que bons/09.
→ Critère : le partenaire peut vérifier un code sans caméra en moins de 3 gestes, cibles ≥ 44 px.

**ui/distributeur/00-inscription.html — P2** — 8 étapes : `.pec-stepper` + « Étape n sur 8 » ; une section par écran sur téléphone ; erreurs → `.pec-field-err`.
**ui/distributeur/05-releves.html — P2** — 21 styles en ligne ; montants en `.pec-amount`, paires .rv-kv → `.pec-kv` ; chaque relevé = `.pec-list-row` (période, total, pastille).
**ui/distributeur/07-mon-point.html — P2** — page longue (9 sections h2) : ajouter une sous-navigation d'ancres en haut (réutiliser le motif `.tk-sousnav` de l’espace marchand) ; .mp-kv → `.pec-kv` ; .msg → `.pec-msg`.
**ui/distributeur/08, 09, 10 — P3, audit léger** — tailles aux jetons, pastilles par PEC_ETATS.

### 3.3 Solution (ui/marchand/)

**ui/marchand/08-paiement.html — P1**
- En tête de #tp-corps, `.tk-somme` devient une `.pec-kpi` « Ce que nous te devons » (`.pec-amount--xl`) avec, en ligne d'appoint, la prochaine échéance et le RIB de destination (valeurs déjà peintes plus bas). Les blocages (« Sans RIB, rien ne part », « En attente du contrôle de ton nouveau RIB », « Aucune carte enregistrée », « débit refusé ») sortent des lignes `.tk-row` et remontent juste sous la tuile en `.pec-msg--wait` / `.pec-msg--ko` avec leur lien — aujourd'hui en `<b style="color:var(--color-amber-text)">` (3,7:1).
- Historique (`.tk-row` « Arrêté … », « Remise … ») : `.pec-list` à 375 px, `.pec-table` ≥ 1024 px (date, référence mono, bons, montant `.num`).
- Le bloc « lien de vente / montant précis » (tp-precis, tp-url) concerne les bons proposés, pas ce que nous devons : le placer en dernier, sous un titre de section distinct, ou ajouter un lien vers 06-demandes — sans supprimer l'élément.
- `.tk-note` à 10,5 px (« Un bon d'achat valable uniquement chez toi… ») → `--text-xs`.
→ Pourquoi : une marque ouvre cette page pour savoir combien, quand et sur quel compte bancaire elle reçoit.
→ Critère : à 1280 px et à 375 px, montant dû + échéance + blocage éventuel visibles sans défiler ; aucun texte d'alerte sous 4,5:1.

**ui/marchand/09-outils.html — P1 (publier un article)**
- Formulaire de l'assistant (#ed-modal) : 8 champs sans `<label>` (libellés en `div.fl`, `div.wt`). Transformer chaque `.fl` en `<label for="…">` (même classe) relié à son champ ; les groupes de puces (#ed-cats, #ed-subs, #ed-genres) en `role="radiogroup"` avec `aria-labelledby` sur leur `.wt`.
- Points d'étapes #ed-dots → `.pec-stepper` + « Étape n sur N — Catégorie ».
- ≥ 1024 px : la `.feuille` devient une modale large (max 960 px) en deux colonnes — formulaire à gauche, aperçu de l'article à droite (l'aperçu existe-t-il dans le gabarit ? si oui, le déplacer ; sinon, ne rien créer et le signaler).
- `.pec-actionbar` en pied de feuille : « Retour » secondaire, « Continuer / Publier » primaire, toujours visibles.
- 38 tailles < 12,5 px et 74 styles en ligne ; 2 `outline:none` à remplacer.
→ Critère : chaque champ a un libellé lu par le lecteur d'écran ; les boutons d'étape restent visibles quelle que soit la hauteur du formulaire à 375 px.

**ui/marchand/02-espace.html — P2**
- Colonne principale : .tk-kpis → `.pec-grid--kpi` de `.pec-kpi` (retirer la barre gauche en dur) ; `#te-todo` (« Il te reste à faire ») remonte AU-DESSUS des tuiles quand il est visible (à 375 px il est dans l'aside `.pec-avant-mobile`, vérifier qu'il sort bien en premier).
- Carte du réseau : hauteur fixe raisonnable (240 px à 375 px), la liste des villes en dessous.
- 26 styles en ligne à passer en classes.
**ui/marchand/10-compte.html — P2** — hub de 9 sections, 189 styles en ligne : sous-navigation `.tk-sousnav` collante sous l'en-tête ; chaque section = une carte titrée ; pastilles d'état par PEC_ETATS ; liens « régler › » → « compléter › ».
**ui/marchand/00-inscription.html — P2** — mêmes règles que Partenaire 00.
**ui/marchand/06-demandes.html, 07-lien.html — P2** — 07 (page publique d'un bon proposé) : montant `.pec-amount--xl` en tête, un seul primaire ; 5 couleurs en dur (hors thème de marque) → jetons ; 57 styles en ligne.
**ui/marchand/03, 04, 11, 12, 13, 14, widget — P3, audit léger** — 04-boutique-demo et 11-site portent 30 et 18 couleurs en dur : ce sont des sites de marque simulés, les laisser, mais isoler ces couleurs dans des variables locales en tête de page (`--demo-…`) avec un commentaire. payencash-tech-widget.js : vérifier cible ≥ 44 px et focus visible du bouton « Bon d'achat ».

### 3.4 Manager (ui/manager/) et Hotline (ui/hotline/)

**Transverse back-office — P1** : point de rupture tiroir à 1024 px (voir 2.3) ; `.pec-kpi .lbl` et `.pec-table th` passent de --color-muted-2 (3:1) à --color-muted ; `.pec-btn` sur --color-primary-dark.

**ui/manager/42-verifications.html — P1**
- Aujourd'hui, ouvrir un dossier masque la file (#kyb-panneau-file hidden / #kyb-panneau-detail visible). ≥ 1280 px : les afficher côte à côte (grille 5/7), la ligne ouverte surlignée (fond --color-mint, `aria-current="true"`). < 1280 px : comportement actuel.
- #kyb-detail-actions (Valider / Refuser) : collées en haut du panneau de détail (`position:sticky`), « Refuser » en `.pec-btn--danger`, motif obligatoire dans une `.pec-sheet` avec `<label>` visible.
- Le long texte explicatif de chaque `.pec-panel-head .s` → une ligne, le reste dans un `<details>` « Règles ».
- 53 styles en ligne ; le lien retour → `.pec-back`.
→ Critère : à 1280 px, contrôler trois dossiers d'affilée sans perdre la file de vue.

**ui/manager/46-marques.html — P1**
- `.kpis` locale → `.pec-grid--kpi` de `.pec-kpi`. `.mq-grille` : chaque carte de marque = en-tête (nom + `.pec-pill` d'état via PEC_ETATS), 3 `.pec-kv` (offre, bons, dû), actions en pied. Filtre #mq-filtre : garder, ajouter le nombre par état dans les options si le data-layer le donne.
- Sous-titre de page (4 lignes) → une phrase ; le reste en `<details>`.
**ui/manager/02-tableau-de-bord.html — P2** — tableau de 8 colonnes : colonnes monétaires `.num` ; libellés « Paiement de la marque » → « Versement à la marque » (2.5).
**ui/manager/45-marchand-paiements.html — P1 (vocabulaire) / P2** — libellés 2.5 ; 29 pastilles par PEC_ETATS ; `.msg` → `.pec-msg`.
**ui/manager/07, 08, 09, 10, 11, 14, 16, 17, 18, 19, 20, 21, 27×2, 29, 30, 31, 40 — P2/P3, audit léger** — `.pec-table` et `.pec-kpi` harmonisés suffisent ; 10-configuration (171 styles en ligne, 64 champs pour 0 `<label>`) : chaque réglage `.pec-setting` reçoit un `<label for>` (les `aria-label` actuels peuvent rester) — P2 ; 27-assistance-reclamations : retirer l'`outline:none`.

**ui/hotline/01-pilotage.html — P2**
- 6 tuiles `.pec-kpi` en `.pec-grid--3` : ordre par urgence — « En retard », « Non assignés », « Appels en file », « Dossiers à contrôler », puis « Satisfaction », « Questionnaires » ; la tuile « En retard » en `.pec-kpi--alerte` quand la valeur > 0.
- 23 tailles < 12,5 px, 108 styles en ligne, 1 `outline:none`.
**ui/hotline/00-connexion.html — P3** — --color-muted-2 en texte ×4 → --color-muted.

### 3.5 Vitrine
**index.html — P1 (vocabulaire) / P2**
- Libellés « payer » de 2.5.
- Numérotation décorative « |01| » des sections : garder si voulu, mais `aria-hidden="true"` sur `.n`.
- 20 tailles < 12,5 px et --color-muted-2 en texte ×4 → jetons.
- Hero : `<img alt="">` décoratif correct ; vérifier le contraste du texte du hero sur la photo (voile --color-ink à 60 % minimum sous le texte).
**portail.html — P3** — interne ; « commission » ×1 : vérifier que ce n'est pas côté marque.

## 4. Ne PAS toucher
- ui/assets/payencash-data.js (règles, montants, données), documents/*.html et documents/controle-version.js (textes juridiques).
- Tous les id, attributs data-* (data-code, data-utiliser, data-fsearch, data-fsortable, data-fpage, data-part-menu, data-bons-menu, data-pec-marque, data-pec-ou, data-onglet…), noms de fichiers, liens entre pages, ordre et nombre des entrées de navigation.
- Les identifiants JS internes contenant des mots interdits (fournisseur SSO, rechargeMin/Max…).
- Les sites de marque simulés (tech/04-boutique-demo, tech/11-site) : leurs couleurs propres restent.
- La fenêtre de signature des trois documents et le bandeau de cookies (prochaine archive).
- La palette : aucune couleur hors jetons ; les trois jetons ajoutés sont listés en 2.1.
- Le tutoiement des apps et le vouvoiement de la vitrine.

## 5. Ordre de mise en œuvre
1. Rapport initial (sans modifier) : occurrences des libellés de 2.5 ; liste des `outline:none` ; liste des déclarations `color: var(--color-muted-2|--color-disabled|--color-mint-ink|--color-primary|--color-amber-text)` sur du texte.
2. Jetons 2.1, puis composants 2.2 dans payencash-v2.css (déplacer .pec-kpi depuis manager.css, créer .pec-amount, .pec-list, .pec-msg, .pec-kv, .pec-sheet, .pec-back, .pec-actionbar, .pec-field-err, PEC_ETATS), focus global, point de rupture 1024 du back-office.
3. P1 dans cet ordre : partenaire/04, partenaire/03, partenaire/02, bons/02, bons/01, bons/09 + partenaire/11, bons/00, tech/08, tech/09, manager/42, manager/46, libellés (index, manager/45, manager/02, tech/02-08-10, bons/02).
4. P2, puis P3.
5. Pour CHAQUE écran modifié : vérifier à 375 px et 1280 px (et 720 / 1024 px pour les écrans à tableau) avec le jeu de démonstration monté ; aucun défilement horizontal à 375 px ; tabulation complète au clavier avec focus visible ; relancer le banc de tests. Terminer par un rapport : écrans modifiés, critères vérifiés, écarts entre ce prompt et le code réel, et la légende de bons/02 en attente de validation.
