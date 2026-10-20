# Inventaire chiffré de la maquette — PayEnCash / AJEK

> **Ce document est le témoin de couverture du portage.** Il est produit AVANT tout
> découpage en domaines et AVANT la première ligne de code de plateforme (méthode §8.1).
> Aucun nom d'écran, de table, de colonne ou de route n'y figure sans avoir été **lu**
> dans un fichier du dépôt ; chaque section cite sa source. Ce qui n'est pas ici n'existe
> pas encore pour le portage — et ce qui est ici devra être coché, lot par lot, dans
> « Couverture » (dernière section).

Relevé le 26/08/2026 sur le dépôt `payencash-documentation-2026-07-31`, commit `d04b65a`. **Écrans, tables et chiffres des §1 à §4 recomptés le 18/09/2026 au soir sur le même dépôt.**

> **⚠️ RECOMPTÉ LE 18/09/2026 (soir). Le §4 « inventaire écran par écran » a été REFAIT depuis le disque** (`ls ui/*/*.html`) : chaque ligne correspond à un fichier qui existe, et chaque fichier a sa ligne. **133 écrans**, contre 113 au relevé du 26/08. Les §1, §2 et §3 sont recomptés sur les mêmes sources. Le reste du document (§5 à §11) porte encore les chiffres du 26/08 et est signalé comme tel.
>
> **Ce qui a changé depuis le relevé du 26/08 :**
> - **17/09** — plus de borne ni de commerçant qui encaisse une commande : « Où payer » est devenu « Comment payer », les écrans d'itinéraire vers le point (`fly/04`, `mode/07`) et l'écran manager `28` n'existent plus ; `kiosk_cash_collections` et `partner_onboarding_steps` ont disparu du schéma, `psp_transactions` est arrivée.
> - **18/09** — l'espace `ui/partenaire/` **revient, autrement** : le commerçant partenaire **vend le Bon d’achat PayEnCash** (bon d'achat prépayé émis par AJEK, art. **L521-3** CMF) et **n'encaisse jamais une commande**. Écrans ajoutés : `partenaire/` (8), `commercial/03` et `09`, `manager/29`, `ecrans/25`.
> - **18/09, le soir — L'AGENT DE CAISSE MOBILE EST SUPPRIMÉ.** Le dossier **`ui/coursier/` n'existe plus** (19 écrans), ni les 8 écrans manager de l'agent (`03-livraisons`, `05-coursiers`, `06-zones-dispatch`, `15-coursier-remuneration`, `22-flotte`, `24-planning`, `32-rapprochement`, `33-fonds-caisse`), ni les écrans « recherche d'un agent » (`fly/05`, `mode/06`), ni le suivi de collecte (`ecrans/02-suivi-livraison`). **27 tables** ont été supprimées du schéma côté serveur.
> - **18/09, le soir** — le **reversement mensuel du commerçant est abandonné** : sa carte bancaire enregistrée est **prélevée à chaque vente** du montant moins sa commission, via **Stripe** ; un refus de la banque = aucun bon d’achat émis. ⚠️ **`partner_remittances` n'est donc PAS au schéma** (le bandeau du 18/09 l'annonçait : c'était faux dès le soir même). Ce qui y est : `partners`, `partner_cards`, `partner_charges`, `gift_cards`, `gift_card_movements`, `signature_links`. Le relevé mensuel est une **vue**, `v_partner_monthly_statements`, parce qu'un relevé se calcule et ne se stocke pas.
>
> **Il reste DEUX moyens de paiement sans carte** — Bon d’achat PayEnCash · Bon d’achat PayEnCash  — tous deux achetés au comptoir d'un commerce. La décision Q4 « modèle partenaire avec bornes » reste caduque ; le modèle qui fait foi est « partenaire distributeur du Bon d’achat ».

---

## 1. Ce qui a été lu, et ce qui fait foi

| Source | Emplacement | Volume | Statut |
|---|---|---|---|
| **Maquettes HTML** | `ui/` | **133 fichiers**, 42 499 lignes, 3,6 Mo *(recompté le 18/09 au soir ; 113 fichiers au 26/08)* | **Référence FONCTIONNELLE** — fait foi sur les écrans, les enchaînements, les données affichées, les textes |
| Kit partagé de la maquette | `ui/assets/` | **21 fichiers** ; `payencash-data.js` = **10 327 lignes** *(recompté le 18/09 au soir ; 11 fichiers et 794 lignes au 26/08)* | Données de démonstration (`PEC_DATA`) + charte `payencash-v2.css` |
| **Back existant qui tourne** | `server/` | 10 services, **128 tables**, **3 vues**, **18 enums Postgres** *(recompté le 18/09 au soir ; 56 tables et 14 enums au 26/08, avant l'ajout du domaine Bon d’achat et la suppression de 27 tables avec l'agent)* | Référence d'EXÉCUTION — ce qui est réellement branché aujourd'hui |
| Spécification d'API | `docs/03-api-specs.html` | **114 routes** propres + 12 tierces | Référence documentaire — **diverge** du back existant (§7) |
| Schéma documenté | l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) | 37 tables détaillées | Référence documentaire — **diverge** du schéma qui tourne (§7) |
| Espace commerçant | `ESPACE-COMMERCANT/` | 18 tables + 64 lignes de matrice UC↔écran↔endpoint | Référence documentaire — **troisième** modèle (§7) |

Ni le JS monolithique des maquettes, ni les tableaux en mémoire de `PEC_DATA`, ni le
découpage du `server/` actuel ne se portent tels quels : ils se **traduisent**.

---

## 2. Les chiffres

*(Colonne « 26/08 » conservée : c'est elle qui dit le chemin parcouru. Les valeurs du 18/09 ont toutes été recomptées sur le disque.)*

| | 26/08 | **18/09 (soir)** |
|---|---|---|
| Écrans maquettés | 113 | **133** |
| Espaces de `ui/` contenant des écrans | 10 | **9** *(`coursier/` supprimé)* |
| **Rôles distincts** → nombre de frontends | 8 | **8** *(l'agent part, le commerçant partenaire arrive)* |
| Liens de navigation entre écrans (`href` .html) | 501 → 101 cibles | **832 → 101 cibles distinctes** |
| Tables du schéma qui tourne (`server/db/schema.sql`) | 56 | **108** *(+ 27 supprimées avec l'agent)* |
| Vues du schéma | — | **3** *(dont `v_partner_monthly_statements`)* |
| Enums Postgres (`CREATE TYPE … AS ENUM`) | 14 | **18** |
| Contraintes `CHECK (… IN (…))` — enums implicites à promouvoir | 34 | **100** |
| Routes décrites par `docs/03-api-specs.html` | 114 (hors 12 tierces) | *(non recompté — le document est daté d'août et son API d'encaissement par l'agent est caduque)* |
| Tables détaillées par l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) | 37 | *(non recompté)* |

**Le trou de couverture n'est plus au même endroit.** Au 26/08 il tenait au nombre de routes
servies ; au 18/09 au soir, le schéma a plus que doublé (125 tables) et porte désormais le
domaine du **Bon d’achat PayEnCash** de bout en bout — émission, mouvements, prélèvement du
commerçant, relevé. Ce qui reste non couvert : l'authentification, le manager, le support et
le commercial, exactement comme en août.

---

## 3. Les 8 rôles — un rôle, un front, une page de connexion *(recomptés le 18/09 au soir)*

Le découpage des fronts se lit dans les maquettes, pas dans un catalogue. Trois dossiers
(`ecrans/`, `fly/`, `parcours/`) servent **le même rôle** — le client voyage — et forment
donc **un seul** front ; `mode/` en est séparé, la maquette le dit explicitement
(`ui/mode/08-compte.html` : « App séparée de FLY : son compte propre »).

| Rôle | Front | Dossiers de maquette | Écrans *(18/09, soir)* | Connexion |
|---|---|---|---|---|
| Client voyage | `app-client-fly` | `ecrans/` + `fly/` + `parcours/` | **35** | OTP SMS (`docs/03-api-specs.html` : `POST /auth/otp/request`) |
| Client mode | `app-client-mode` | `mode/` | **21** | compte propre (`ui/mode/08-compte.html`) |
| ~~Agent de caisse mobile (salarié)~~ | ~~`app-agent`~~ | ~~`coursier/`~~ | **0 — SUPPRIMÉ le 18/09 au soir** | — |
| Fournisseur MODE | `app-fournisseur` | `fournisseur/` | **18** | candidature + KYB (`ui/fournisseur/01-connexion-kyb.html`) |
| Commerçant partenaire — vend le Bon d’achat PayEnCash (18/09) | `app-partenaire` | `partenaire/` | **8** | identifiant + mot de passe, vérification e-mail, validation KYB, invitation du gérant (`ui/partenaire/01-connexion.html`) |
| Manager AJEK | `app-manager` | `manager/` | **38** | identifiant + mot de passe, garde de rôle globale (`ui/manager/01-connexion.html`) |
| Commercial & marketing | `app-commercial` | `commercial/` | **11** | `ui/commercial/00-connexion.html` |
| Support (superviseur·e + hôtes) | `app-hotline` | `hotline/` | **2** | `ui/hotline/00-connexion.html` |

**Total : 133 écrans, 8 rôles.** Le nombre de rôles n'a pas bougé depuis le 26/08, mais sa
composition si : l'**agent de caisse mobile part**, le **commerçant partenaire** arrive.

Deux écrans sortent de toute session : `ui/manager/19-invitation.html` (« la seule route de
l'espace manager sans garde ») et `ui/ecrans/00-onboarding.html`. Les pages d'information
client (`04` à `08`, `15`) sont publiques.

---

## 4. Inventaire écran par écran

La colonne « ce que l'écran fait » reprend le commentaire d'intention porté par le fichier
lui-même — c'est la maquette qui parle, pas une reformulation.

### `ecrans/` — Client FLY — pages hors tunnel → **`app-client-fly`** (23 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [00-onboarding.html](../ui/ecrans/00-onboarding.html) <br>PayEnCash FLY — Bienvenue | ONBOARDING premier lancement (fondatrice 23/08, inspiré du cycle Opodo SANS ses travers) : 3 écrans de valeur + 1 écran de pré-permission notifications (la popup iOS ne tombe jamais à froid) + les portes finales avec « Découvrir sans compte » AUSSI visible que le reste (anti dark-pattern). Aucune urgence artificielle, aucun interstitiel : la marque parle, c'est tout. | Passer · Continuer · Activer les notifications · Plus tard · Créer un compte | — |
| 2 | [01-accueil.html](../ui/ecrans/01-accueil.html) <br>PayEnCash — Combien tu as en cash ? | ACCUEIL (onglet « Rechercher ») — calqué sur l'app réelle : app/page.tsx + BudgetSearchForm.tsx. Budget-first : panneau budget sombre + slider + paliers + segmented (Vol / Vol+Hôtel / Hôtel) + départ/destination/dates/voyageurs (bottom sheets) + CTA « Voir N voyages » → tunnel. Le funnel multi-étapes n'est PAS ici (il vit dans tunnel/). Contenu : modèle agent. | 10 € · 30 € · 50 € · 100 € · Vol | `ambassadeurs` `chercherPlaces` `concours` `concoursApresTirage` `nuiteeCities` `places` |
| 3 | [03-mes-codes.html](../ui/ecrans/03-mes-codes.html) <br>PayEnCash — Mes réservations | PAGE « MES CODES » — modèle agent. Onglets : commandes en cours (suivi de l'agent), voyages confirmés (+ NOTATION 1-5★ de l'agent), alertes prix, voyages passés. La 1ʳᵉ carte « en cours » est la variante AU POINT : code-barres présent ICI (réf/montant depuis PEC_DATA) + « M'y rendre » (fly/04) + « Afficher mon code » (fly/02). Le montant à remettre en espèces s'affiche avec sa fenêtre de collecte. Cf. Doc 10 / Doc 1… | À payer · Confirmées · Alertes · Archivées · Créer une alerte prix | — |
| 4 | [04-comment-ca-marche.html](../ui/ecrans/04-comment-ca-marche.html) <br>PayEnCash — Comment ça marche | Page info « Comment ça marche » — alignée stratégie : budget -> vol -> OÙ payer (au point sans frais accès direct / domicile ou lieu de travail dès +7,90 €), prix bloqué 1 h, billets ET pièces (mini-monnayeur), cagnotte + concours, anonymat. Héros clair à accent vert (charte validée). | Et si je change d'avis avant de payer ? · L'agent vient vraiment chez moi ? · Je peux payer en pièces ? · Puis-je annuler ma réservation ? · Quand reçois-je mon billet ? | — |
| 5 | [05-securite-confiance.html](../ui/ecrans/05-securite-confiance.html) <br>PayEnCash — Sécurité & confiance | Page info « Sécurité & confiance » — calquée sur app/(info)/securite/page.tsx, contenu agent. | — | — |
| 6 | [06-faq.html](../ui/ecrans/06-faq.html) <br>PayEnCash — Questions fréquentes | Page info « FAQ » — calquée sur app/(info)/faq/page.tsx, contenu agent. | Comment je paie ? · Qui vient encaisser ? · Combien de temps pour payer ? · Puis-je payer en plusieurs fois ? · Y a-t-il un plafond au paiement en espèce… | — |
| 7 | [07-apropos.html](../ui/ecrans/07-apropos.html) <br>PayEnCash — À propos | Page info « À propos » — calquée sur app/(info)/a-propos/page.tsx, contenu agent. | — | — |
| 8 | [08-contact.html](../ui/ecrans/08-contact.html) <br>PayEnCash — Contact | Page info « Contact » — calquée sur app/(info)/contact/page.tsx + ContactForm.tsx, contenu agent. | Question · Réservation · Mon code · Encaissement · Envoyer le message | — |
| 9 | [09-notifications.html](../ui/ecrans/09-notifications.html) <br>PayEnCash — Notifications | NOTIFICATIONS CLIENT — centre in-app. Les moments qui comptent — agent en route, collecte validée, remboursement en cours — restent RETROUVABLES ici, même si le push a été raté (téléphone verrouillé, permission refusée) : ce ne sont pas de simples alertes qui disparaissent une fois signalées. Chaque notification porte un type et un identifiant de cible, jamais une URL en dur : c'est l'app qui construit la route. Un … | Tout marquer comme lu | — |
| 10 | [10-compte.html](../ui/ecrans/10-compte.html) <br>PayEnCash — Compte | COMPTE — route `/compte`. Maquette RELEVÉE SUR L'ÉCRAN RÉEL (`compte/page.tsx`), dans son ordre réel : carte profil, Voyageurs, Préférences, Confidentialité, Informations légales, Aide & confiance, Actions, version. C'est ici que vivent les droits RGPD — et ils sont répartis à TROIS endroits, ce qui n'est pas évident en lisant la doc : - RECTIFICATION → le crayon de la carte profil (bottom sheet), pas une rangée ; -… | Aéroport de départ Marseille (MRS) · Exporter mes données Télécharger tout ce … · Se déconnecter · Supprimer mon compte | `promos` |
| 11 | [11-suivi-etats-echec.html](../ui/ecrans/11-suivi-etats-echec.html) <br>PayEnCash — Suivi : états d'échec et de remboursement | SUIVI — LES CINQ ÉTATS NON NOMINAUX DE L'ENCAISSEMENT. Ce ne sont PAS cinq routes. C'est la route `/suivi/[orderId]` (voir 02-suivi-livraison.html, « la SEULE UI d'encaissement du produit ») dans ses états non nominaux. Le composant est le même, `CourierTrackingView`, piloté par `orders.status` : COLLECTION_FAILED · EXPIRED · FAILED · CANCELLED · REFUNDED L'écran de suivi couvre aussi ces cas, en plus des six statut… | COLLECTION_FAILED · EXPIRED · FAILED · CANCELLED · REFUNDED | — |
| 12 | [13-mes-voyageurs.html](../ui/ecrans/13-mes-voyageurs.html) <br>PayEnCash — Mes voyageurs | MES VOYAGEURS (fondatrice 23/08 : les pages du Compte doivent être PRO, vraies infos). Les 7 champs exigés par les compagnies (title, given_name, family_name, born_on, gender, email, phone) sont ceux de Duffel POST /air/orders — chiffrés AES-256 chez nous (table order_travelers, cf. audit API §1). Ici : prénoms en clair, le reste masqué. | Modifier · Ajouter un voyageur | — |
| 13 | [14-assistance.html](../ui/ecrans/14-assistance.html) <br>PayEnCash — Assistance | ASSISTANCE v9 — HIÉRARCHIE FONDATRICE (25/08), à la lettre : ① header IDENTIQUE aux autres pages (logo payEnCash ASSISTANCE) + capsule PRIME à droite ② haut de page : l'OBJECTIF de la page + KPIs (délai d'attente estimé, étoiles, clients) ③ CONTACT : être rappelé (compteur transparent) + horaires d'ouverture + chat + WhatsApp ④ TABS : Demandes EN COURS / Demandes CLÔTURÉES (+ déposer une réclamation) ⑤ QUESTIONS FRÉ… | Rappel ~4 min · P Discuter — réponse immédiate Pec — l'as… · Où est mon code de paiement ? · Annuler ma réservation · Mon prix bloqué expire bientôt | `assistance` `chercherTicket` `socialHTML` |
| 14 | [15-moyens-paiement.html](../ui/ecrans/15-moyens-paiement.html) <br>PayEnCash — Moyens de paiement | MOYENS DE PAIEMENT (fondatrice 25/08 soir) — la page de référence sur « avec quoi tu paies ». Reprend les éléments de la bannière « On accepte aussi les pièces » (retirée de l'accueil) et les développe. Plan : ce qu'on accepte → où tu paies → ce qu'on ne fera JAMAIS → les règles du cash → tes justificatifs → dépenser à ta mesure → questions fréquentes. RÈGLES MAISON RESPECTÉES : la carte est un COMPLÉMENT, jamais ob… | Je n'ai pas de carte bancaire. Je peux qu… · J'ai un gros sac de pièces. Vous allez vr… · Et si je n'ai pas assez d'espèces au mome… · Est-ce que mes coordonnées bancaires risq… · Peut-on m'abonner à mon insu ? | — |
| 15 | [16-favoris.html](../ui/ecrans/16-favoris.html) <br>PayEnCash — Mes favoris | MES FAVORIS (fondatrice 27/08) — sous-page du COMPTE. LA POLITIQUE : seuls les HÉBERGEMENTS se mettent en favoris (jamais les vols — prix et places volatils) ; gardés sur l'appareil, retirables ici d'un tap sur le cœur, réservables en hôtel seul. Les métadonnées sont stockées AU MOMENT du toggle (au… | — | — |
| 16 | [17-politiques.html](../ui/ecrans/17-politiques.html) <br>PayEnCash — Nos politiques | ② ANNULER — les packs (source unique PEC_DATA.packs, mêmes ⓘ que les récaps) | — | — |
| 17 | [18-informations-legales.html](../ui/ecrans/18-informations-legales.html) <br>PayEnCash — Informations légales | ② CGV — VENTE DE VOYAGES (rédaction en articles, à la manière des CGV du secteur) | — | — |
| 18 | [19-verification-identite.html](../ui/ecrans/19-verification-identite.html) <br>PayEnCash — Vérification d'identité | VÉRIFICATION D'IDENTITÉ — KYC (créée 28/08, fondatrice : « la page KYC n'est pas faite ?? c'est ici qu'on soumet les demandes »). La page du FAIRE (05-securite-confiance reste la vitrine du POURQUOI) : · statut ACTUEL dérivé DU BUS (spec-kyc-verifications) : le NIVEAU découle de la DÉCISION cliquée … | — | — |
| 19 | [20-mediateur.html](../ui/ecrans/20-mediateur.html) <br>PayEnCash — Médiation | Page MÉDIATION (fondatrice 30/08) : déplacée depuis l'Assistance vers une page dédiée, liée depuis le Compte. Escalade hôte → manager → Médiateur du Tourisme et du Voyage (MTV), le tout depuis PEC_DATA.assistance.escalade (zéro dur). | — | — |
| 20 | [21-politique-especes.html](../ui/ecrans/21-politique-especes.html) <br>PayEnCash — Ce qu'on ne te demande jamais | LA RÉFÉRENCE D'UN ARTICLE, extraite du fondement rédigé « art. X — explication » (même recette que 25-ou-acheter-un-bon) : la page ne réécrit jamais un texte de loi, elle le cite et le garde au survol. | — | — |
| 23 | [25-ou-acheter-un-bon.html](../ui/ecrans/25-ou-acheter-un-bon.html) <br>PayEnCash — Où acheter un Bon d’achat PayEnCash | (18/09) PAGE PUBLIQUE (garde PUBLIQUES.ecrans) — la liste des commerces partenaires ACTIFS (`pointsBons()` : enseigne, adresse, ville), état vide honnête tant qu'il n'y en a pas, mentions du bon d’achat (`ref.bons.mentions`), lien vers 15-moyens-paiement. | — | `partners` |

### `parcours/` — Client FLY — tunnels d'achat → **`app-client-fly`** (4 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [01-vol-aller-simple.html](../ui/parcours/01-vol-aller-simple.html) <br>PayEnCash — Tunnel vol aller simple | TUNNEL A — VOL ALLER SIMPLE. Structure calquée sur l'app réelle : app/(tunnel)/vols/vols-comparator.tsx · app/(tunnel)/recap/page.tsx · lib/tunnel-steps.ts Flow `flight_oneway` = [1. Aller simple · 2. Récap · 3. Collecte]. Écran fixe : TunnelStepper + TunnelHeader (+ filtres) en haut, contenu scrollable, CTA fixe en bas. Voyageurs = BOTTOM SHEET (carnet + formulaire), jamais un écran séparé. Modèle agent : dernière … | − · + · Prix · Vol direct · Horaires | `logoCompagnie` `packs` `promoAstuces` `validerCodePromo` |
| 2 | [02-vol-aller-retour.html](../ui/parcours/02-vol-aller-retour.html) <br>PayEnCash — Tunnel aller-retour | TUNNEL B — VOL ALLER-RETOUR. Calqué sur l'app réelle : lib/tunnel-steps.ts (flow `flight_roundtrip` = [Vol aller · Vol retour · Récap · Collecte]) app/(tunnel)/vols/vols-comparator.tsx (étape retour : header dédié + pill « Aller choisi » + strip de rappel) app/(tunnel)/recap/page.tsx (section « Tes vols » = UNE CARTE PAR TRONÇON, tag Aller/Retour, bagages par sens) Le stepper affiche une FENÊTRE GLISSANTE de 3 cases… | − · + · Prix · Vol direct · Horaires | `logoCompagnie` |
| 3 | [03-vol-hotel.html](../ui/parcours/03-vol-hotel.html) <br>PayEnCash — Tunnel vol + hôtel | TUNNEL C — VOL + HÔTEL (package) et HÔTEL SEUL (stay_only, D12). Calqué sur l'app réelle : lib/tunnel-steps.ts → flow `flight_oneway_stay` = [Aller simple · Hébergement · Récap · Collecte] flow `stay_only` = [Hébergement · Récap · Collecte] app/(tunnel)/sejour/sejour-client.tsx → étape Hébergement : stepper (porte le budget) + header « Hébergement » SANS sous-titre + filtres Prix / Dans mon budget / Petit-déj + cart… | → Aller simple · ⇄ Aller-retour · − · + · Prix | `logoCompagnie` |
| 4 | [04-vol-multi.html](../ui/parcours/04-vol-multi.html) <br>PayEnCash — Tunnel villes multiples | TUNNEL VILLES MULTIPLES (fondatrice 23/08, comme Ryanair « Villes multiples ») — mécanique DUFFEL multi-slices : UNE offer_request avec slices[] {origin, destination, departure_date}, les offers couvrent TOUS les tronçons, UN SEUL order → un seul code, un seul paiement en espèces. On choisit un vol PAR TRONÇON, le total suit. | Choisis un vol par tronçon | — |

### `fly/` — Client FLY — paiement, promos, concours → **`app-client-fly`** (8 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [01-ou-payer.html](../ui/fly/01-ou-payer.html) <br>PayEnCash FLY — Où payer ? | FLY — Où payer ? v5 (process corrigé par la fondatrice) : · s'ouvre DIRECTEMENT après la validation des voyageurs (étape 5 du tunnel) · position = POP-UP d'autorisation par-dessus la carte (pas un écran) — carte des points affichée par défaut · prix bloqué 1 HEURE (pas 30 min) · domicile : adresse d'encaissement = adresse du voyageur 1 PAR DÉFAUT, sinon « autre adresse » (champ nouveau : users.default_collection_add… | Au point Un commerce près de chez toi · z… · On se déplace Domicile ou travail · dépla… · − 500 m · 1 km · 2 km | `prixBloque` `savHTML` |
| 2 | [02-ordre-paiement.html](../ui/fly/02-ordre-paiement.html) <br>PayEnCash FLY — À payer au point | FLY — ordre de paiement AU POINT (F1). Le partenaire scanne le code-barres, encaisse, reçu + code émis. Prix bloqué 1 h. Au clic « J'y suis » → Mes codes (le reçu s'y range). | À régler 1 · Soldé · | — |
| 3 | [03-jeu-concours.html](../ui/fly/03-jeu-concours.html) <br>PayEnCash — Un voyage à gagner chaque mois | Espace concours (F9) — REFONTE fondatrice 24/08 : le LOT est un voyage CONCRET (photo de la destination, valeur, dates, ce qui est inclus) publié par le MARKETING depuis le cockpit (Concours · GED) — source : PEC_DATA.concours. Charte : VERTE dominante, homogène avec le reste du site — le bleu royal reste l'ACCENT unique du concours (badge + compteur). Vrais logos réseaux (socialHTML paths). Gratuit, sans obligation… | — | `concours` `concoursApresTirage` |
| 4 | [06-promos.html](../ui/fly/06-promos.html) <br>PayEnCash FLY — Promos | PROMOS (onglet tabbar) — SANS CODE EN DUR : modes et offres rendus depuis PEC_DATA (source unique partagée avec le récap 07). Règle : commande à 45 jours minimum du départ — tout est édité à J−21 minimum, 4 modes de voyage, chaque promo TOUJOURS moins chère que le prix « en normal ». | Avec hébergement vol A/R + nuits · Vol seul aller-retour | `concours` `concoursApresTirage` |
| 5 | [07-promo-recap.html](../ui/fly/07-promo-recap.html) <br>PayEnCash FLY — Réserver une promo | RÉSERVATION PROMO (F2-promo) — depuis l'onglet Promos : l'offre est FIGÉE (pas de tunnel), on choisit juste le NOMBRE DE VOYAGEURS puis récap direct « avant de payer » -> Où payer. ?o=<id> sélectionne l'offre (catalogue PROMOS ci-dessous, miroir de 06-promos). | — | `promos` |
| 6 | [08-comparatif.html](../ui/fly/08-comparatif.html) <br>PayEnCash FLY — Le comparatif du jour | LE COMPARATIF DU JOUR (fondatrice 22/08, benchmark Opodo) : publié CHAQUE MATIN — relevés Opodo horodatés (captures conservées) vs prix PayEnCash, mêmes vol/date/ passagers. C'est ICI que la com des autres écrans renvoie : on ne dit JAMAIS « ce billet est moins cher », on montre le tableau (pub comparative L122-1 : objective, vérifiable, datée — cadrage avocat au registre). | — | — |
| 7 | [10-reservation-detail.html](../ui/fly/10-reservation-detail.html) <br>PayEnCash FLY — Détail de la réservation | DÉTAIL COMPLET D'UNE RÉSERVATION (fondatrice 22/08 : « les détails orientent vers une page complète ») — ?ref=CMD-… lit PEC_DATA.reservations : en cours → ticket à présenter au tabac (code + minuteur + lieu) · payée → billet émis. | Envoyer ma demande d'annulation | `reservations` |
| 8 | [11-promos-astuces.html](../ui/fly/11-promos-astuces.html) <br>PayEnCash FLY — Promos & astuces | PROMOS & ASTUCES (fondatrice 22/08, page du COMPTE) : listes de réservations à 3 mois ACTUALISÉES CHAQUE JOUR par mode de voyage + codes promo + astuces. Données : PEC_DATA.promoAstuces + promos (J−45) + promosModes. | — | `promoAstuces` |

### `mode/` — Client MODE → **`app-client-mode`** (21 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [01-accueil.html](../ui/mode/01-accueil.html) <br>PayEnCash MODE — Accueil | MODE — accueil ESPRIT ZARA × VINTED (audit marketing/audit-zara.html, 21/08) : hero éditorial plein cadre · catégories numérotées /01/-/05/ dont RECONDITIONNÉ · grille photo-first, NOM EN MAJUSCULES, ligne d'identité « taille · état » (langage Vinted), favoris, badges NEUF / RECONDITIONNÉ. Charte VERTE PayEnCash conservée (décision verrouillée). | — | `carteBadgeHTML` `eur` `mode` |
| 2 | [02-article.html](../ui/mode/02-article.html) <br>PayEnCash MODE — Fiche article | MODE — fiche article ESPRIT ZARA × VINTED (audit marketing/audit-zara.html) : photo d'abord + vignettes · NOM MAJUSCULES + réf. article · état Vinted (Très bon état) avec inspection/authentification incluses (notre différenciateur vs Vinted) · tailles en pastilles (indisponibles barrées — pièce unique) · composition pièce par pièce · livraison/échange/retours · complète ton look · CTA « Ajouter — payer en espèces ». | Me placer en file d'attente · M'alerter s'il se libère | — |
| 3 | [03-panier.html](../ui/mode/03-panier.html) <br>PayEnCash MODE — Panier | PANIER FUSIONNÉ (audit fondatrice 21/08) : « dans panier je vois les commandes en cours, celles déjà passées » — 3 onglets : Mon panier · En cours · Livrées. Design panier d'achat CLAIR : grande photo, quantité, avantages repliés, récap net, total + CTA collés en bas. Zéro code en dur (PEC_DATA). | Panier · · À régler · | — |
| 4 | [04-commande.html](../ui/mode/04-commande.html) <br>PayEnCash MODE — Ma commande | Suivi commande MODE — le client voit TOUT : encaissé (tabac OU agent) → achat ferme → ramassage chez le fournisseur → contrôle & authentification atelier → expédition MONDIAL RELAY (tracking API en direct) → retrait au relais. Rétractation 14 j (L221-18). | — | — |
| 5 | [05-ou-payer.html](../ui/mode/05-ou-payer.html) <br>PayEnCash MODE — Comment veux-tu payer ? | **« COMMENT VEUX-TU PAYER » (MODE)** — réécrit au pivot du 17/09 puis les 18 et 19/09. Le montant à régler est le TOTAL DU PANIER (`panierTotal`), colis Mondial Relay compris : personne ne se déplace, il n'y a plus de frais de déplacement ni de volet agent. Une carte par moyen du pays (`moyensPaiement()`) posées **côte à côte** — le **Bon d'achat PayEnCash d'abord et ouvert d'emblée** *(20/09 — supprimé avec le réseau tiers)*. Le volet du bon a **deux chemins** : « j'ai un bon » (saisie du code, vérification, application ou règlement total) et « **je veux en acheter** », ouvert par défaut — carte des **trois commerces les plus proches** (`pointsBons({pos})`), distances et temps à pied, texte qui dit le **montant exact**, ce qu'on peut donner au comptoir (espèces, monnaie ou carte) et qu'**aucune donnée bancaire ne passe par PayEnCash**. **(19/09, soir) « M'y rendre »** ouvre un **guidage vivant** : `PEC_GEO.suivre()`, trait de direction sur la carte, distance et temps à pied recalculés à chaque pas, paliers `proximiteEtat()` (« c'est tout près » à 500 m, « tu y es » à 60 m — réglables en manager 10) ; la montre de position est coupée à l'arrêt, au changement de chemin et à la sortie de page. Zéro code en dur (PEC_DATA). **(19/09, soir — le flashcode de paiement)** Dans « je veux en acheter », un **flashcode** porte une **demande de bon d'achat** au montant EXACT qui reste dû (`demandeBonCreer` → `voucher_requests`) : le commerçant le scanne, sa caisse s'ouvre au bon montant, il encaisse comme d'habitude, et **le code du bon revient tout seul dans le champ** (même si l'écran avait été fermé — `demandeBonPour`). La demande expire avec la fenêtre d'encaissement, servir deux fois est refusé, et au-dessus du plafond l'écran dit qu'il faut plusieurs bons. | J'ai un bon · Je veux en acheter · M'y rendre · Payer en ligne · Montrer le flashcode | `partners` · `settings proximite.*` |
| 6 | [08-compte.html](../ui/mode/08-compte.html) <br>PayEnCash MODE — Compte | COMPTE MODE — profil, adresse de livraison (Mondial Relay : relais favori), carte cadeau commune FLY/MODE, cagnotte (1 € = 1 pt), KYC gradué. App séparée de FLY : son compte propre. | — | `savHTML` |
| 7 | [09-recherche.html](../ui/mode/09-recherche.html) <br>PayEnCash MODE — Rechercher | RECHERCHE VIVANTE (audit fondatrice : « comment l'utilisateur cherche un article précis sur Zara et Vinted ») : champ temps réel + filtres marque/taille/état/prix façon Vinted + résultats immédiats. La recherche est RÉELLE (PEC_DATA.chercher) : tape, filtre, les résultats bougent. ?q= et ?marque= pré-remplissent. | Pertinence · Prix croissant · Prix décroissant | `chercher` |
| 8 | [10-tendances.html](../ui/mode/10-tendances.html) <br>PayEnCash MODE — Tendances | TENDANCES v2 — ESPRIT MAGAZINE MODE (audit fondatrice) : · « Porté par » = CARROUSEL de grandes photos (scroll-snap) — Prénom Nom en bas à gauche, événement en dessous, typographie éditoriale. TOUT EST REPLIÉ : le clic ouvre les CRÉDITS DE TENUE (« LE JEAN — Levi's, 110 € en boutique ») puis « Vu sur PayEnCash — similaire, moins cher ». · Alimenté en permanence par le Commercial/Marketing (cockpit · GED). · « Les éd… | — | `mode` |
| 9 | [11-code-paiement.html](../ui/mode/11-code-paiement.html) <br>PayEnCash MODE — À payer au point | MODE — LE CODE DE PAIEMENT, design TICKET (refonte « wallet » 21/08, demande fondatrice) : bandeau encre plein cadre, TICKET blanc à encoches et ligne perforée (esprit carte d'embarquement), montant géant, code-barres central. Le client ne clique RIEN : pastille d'attente → bascule auto en « Payé — soldé ». TEXTE JURIDIQUE calé sur le mandat (agent commercial, encaissement accessoire, CMF L521-3-1) : le partenaire e… *(18/09 : relevé daté — le mandat et cette référence sont caducs : L521-3-1 est l'exemption télécoms, jamais applicable ; l'écran dit aujourd'hui « Réglé par Bon d’achat PayEnCash »)* | — | — |
| 10 | [12-favoris.html](../ui/mode/12-favoris.html) <br>PayEnCash MODE — Mes favoris | MES FAVORIS (audit process Vinted×Zara 21/08 : le cœur existait sur la fiche mais AUCUNE page pour les retrouver — chez Vinted c'est central). Grille photo-first, cœur pour retirer (action réelle), rappel PIÈCE UNIQUE (l'urgence Vinted : un favori peut partir), état vide avec CTA boutique. Accès : cœur du header boutique, fiche article, rangée du compte. | — | — |
| 11 | [13-retour.html](../ui/mode/13-retour.html) <br>PayEnCash MODE — Retourner une pièce | RETOURNER UNE PIÈCE (audit process 21/08 : « retour 14 j » était promis partout — CGV, fiche, panier — mais AUCUNE page ne permettait de le FAIRE). Process complet : pièce → motif → mode de remboursement (décision juridique : avoir → espèces au point par l'agent → virement) → étiquette Mondial Relay retour → confirmation. Zéro code en dur (PEC_DATA.mode.retour). | — | `mode` |
| 12 | [15-comment-tu-paies.html](../ui/mode/15-comment-tu-paies.html) <br>PayEnCash MODE — Comment tu paies ? | LES DEUX MOYENS, PEINTS depuis le référentiel : rien n'est écrit ici — ni le nom, ni l'aide, ni les plafonds. Une carte par moyen proposé dans le pays du client (moyensPaiement) ; un moyen retiré du référentiel disparaît d'ici sans que personne y touche. | — | — |
| 13 | [16-mes-commandes.html](../ui/mode/16-mes-commandes.html) <br>PayEnCash MODE — Mes commandes | UNIFIÉ (fondatrice 01/09) : « Mes commandes » a fusionné avec le panier sous « Commandes » (03-panier.html), à 4 onglets En cours · Réglées · Remboursées · Annulées. Cette page redirige vers la vue unifiée (en conservant l'ancre ?tab=). | — | — |
| 14 | [17-politiques.html](../ui/mode/17-politiques.html) <br>PayEnCash MODE — Nos politiques | (18/09, soir) LES MOYENS SONT DÉRIVÉS (.pec-moyens ← moyensPaiementLabel) et les plafonds viennent du BON D’ACHAT ([data-bon] ← bonsRef) : cette clause ne porte plus aucun chiffre ni aucun nom de marque écrit. | — | — |
| 15 | [18-informations-legales.html](../ui/mode/18-informations-legales.html) <br>PayEnCash MODE — Informations légales | (18/09, soir) LA CLAUSE NE PORTE PLUS AUCUN CHIFFRE : les plafonds du Bon d’achat viennent de bonsRef() ([data-bon]), les moyens de moyensPaiementLabel(). Ce que le client règle chez son commerçant ne relève pas du contrat qui nous lie : le contrat dit ce que NOUS ne demandons jamais. | — | — |
| 16 | [19-vendeur.html](../ui/mode/19-vendeur.html) <br>PayEnCash MODE — Vendeur | PROFIL VENDEUR + RÉPUTATION (Phase 2 « confiance ») : différenciateur clé vs Vinted/Vestiaire. Page publique d'un fournisseur — note, ventes, ancienneté, atelier/spécialité, délai de virement, ses pièces en vente (publiées ET encore en stock, dérivées de l'inventaire — 19/09), ses avis clients. Tout dérivé de PEC_DATA (vendeurs, avis, articles). ?v=<id>. Zéro do… | — | — |
| 17 | [20-alertes.html](../ui/mode/20-alertes.html) <br>PayEnCash MODE — Mes alertes | CENTRE D'ALERTES (Phase 3 « découverte ») : les alertes « baisse de prix », « réassort / dispo » et « recherche sauvegardée » étaient factices (un texte qui change). Elles sont désormais PERSISTÉES (PEC_DATA.alertesGet/alerteSupprimer) et pilotées ici : on les voit, on les supprime. Zéro donnée en d… | — | — |
| 18 | [21-inscription.html](../ui/mode/21-inscription.html) <br>PayEnCash MODE — Créer mon compte | déjà connecté : on le dit, on ne bloque pas (un second compte reste possible avec un autre numéro) | — | — |
| 19 | [22-livraisons.html](../ui/mode/22-livraisons.html) <br>PayEnCash MODE — Suivi | LIVRAISONS (fondatrice 04/09) : « Favoris » quitte la tabbar (il reste accessible en haut de page) au profit du SUIVI DE LIVRAISON — le client suit ici les commandes PAYÉES en route Mondial Relay, avec tous les détails transporteur (n° de suivi, relais, arrivée estimée, garde), et retrouve ses comma… | — | — |
| 20 | [23-notifications.html](../ui/mode/23-notifications.html) <br>PayEnCash MODE — Notifications | Les familles du fil : un filtre par nature de fait (kit data-fscope / data-ftag) — les compteurs se calculent | — | — |
| 21 | [24-lien.html](../ui/mode/24-lien.html) <br>PayEnCash MODE — La pièce | L'OUVERTURE EST UN FAIT : la couche de données vérifie que le lien existe, que la pièce existe encore et qu'elle est en vente. Elle seule compte le clic et arme l'attribution — l'écran n'invente rien. | — | — |

### `fournisseur/` — Fournisseur MODE (KYB) → **`app-fournisseur`** (18 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [00-inscription.html](../ui/fournisseur/00-inscription.html) <br>PayEnCash FOURNISSEUR — Créer mon compte | (10/09 — lot 4) le dossier se joint À LA CANDIDATURE, plus après la validation | — | — |
| 2 | [01-connexion-kyb.html](../ui/fournisseur/01-connexion-kyb.html) <br>PayEnCash FOURNISSEUR — Devenir fournisseur | APP FOURNISSEUR — candidature + KYB : SIREN, identité du gérant, RIB (pour les VIREMENTS de ses factures). Statut : dossier en vérification. | — | — |
| 3 | [02-accueil.html](../ui/fournisseur/02-accueil.html) <br>PayEnCash FOURNISSEUR — Accueil | APP FOURNISSEUR — dashboard : pièces au catalogue, vendues, ramassage à venir, factures à émettre. | — | — |
| 4 | [03-ajouter-piece.html](../ui/fournisseur/03-ajouter-piece.html) <br>PayEnCash FOURNISSEUR — Publier un article | PUBLICATION D'ARTICLE — le vrai process dropshipping côté fournisseur (F12) : 6 étapes câblées : catégorie/sous-catégorie → marque & identité → état & authenticité → tailles & STOCK (le stock reste chez le fournisseur jusqu'au ramassage) → photos → prix d'achat & poids (Mondial Relay) → récap → soumission atelier. Cycle de vie : brouillon → soumis → validé (publié MODE) → vendu (ACHAT FERME) → ramassé → contrôlé → e… | Continuer | `mode` |
| 5 | [04-expeditions.html](../ui/fournisseur/04-expeditions.html) <br>PayEnCash FOURNISSEUR — Expéditions | (08/09 — ré-audit fournisseur) editerEtiquette / marquerExpedie journalisent par PEC_BUS : sans lui, aucune trace depuis cette page | — | — |
| 6 | [05-ventes-factures.html](../ui/fournisseur/05-ventes-factures.html) <br>PayEnCash FOURNISSEUR — Ventes & factures | APP FOURNISSEUR — TERMINOLOGIE stricte : achat ferme, facture, virement 7 j. Jamais « reversement des paiements clients ». Le fournisseur ne touche jamais les espèces. | — | — |
| 7 | [06-partage.html](../ui/fournisseur/06-partage.html) <br>PayEnCash FOURNISSEUR — Partager mes pièces | APP FOURNISSEUR — fournisseur-influenceur : lien tracé de SA pièce sur PayEnCash MODE (source attribuée, comme les flyers partenaires). Texte conforme fourni. **(19/09, soir)** La composition du visuel a déménagé dans `assets/payencash-visuel.js` : même dessin, même prix, même QR que la liste du stock — et l'écran gagne **« Partager la pièce (image + lien) »**, la feuille de partage du téléphone. | — | — |
| 8 | [07-codes-promo.html](../ui/fournisseur/07-codes-promo.html) <br>PayEnCash FOURNISSEUR — Mes codes promo | APP FOURNISSEUR — CODES PROMO (décision 21/08) : c'est LE FOURNISSEUR qui édite les codes promo sur SES pièces — AJEK n'édite pas de codes MODE. La remise s'impute sur SON prix d'achat convenu (la marge AJEK est préservée), le prix client baisse d'autant. Visible par le Manager. Rendu depuis PEC_DATA. | Montant (€) · Pourcentage (%) | — |
| 9 | [08-stock.html](../ui/fournisseur/08-stock.html) <br>PayEnCash FOURNISSEUR — Mon stock | (08/09 — ré-audit fournisseur) payencash-filters.js et payencash-docs.js RETIRÉS : aucun attribut du kit ni aucun appel PEC_DOCS sur cette page. La recherche, les filtres d'étape et la pagination (12 par page) restent rendus par la page : la liste est un accordéon qui se REDESSINE à chaque geste, et… **(19/09, soir)** Chaque ligne porte, SANS avoir à la déplier, le **flashcode** de la pièce (vrai QR de son lien tracé), « **Copier le lien** » et « **Télécharger le visuel** » — l'image 1080×1350 composée avec **la photo de CET article**, son prix client et le lien intégré en QR. Le visuel porte, à côté du flashcode, **« Paie chez ton commerçant »** et les moyens du pays (`moyensPaiementLabel()` — Bon d'achat PayEnCash), plus **le lien écrit en clair** sous le QR pour qui ne scanne pas. Un bouton **« Partager »** ouvre la feuille de partage du téléphone avec **l'image ET le lien** : c'est le lien du TEXTE que Snapchat, Instagram ou WhatsApp rendent cliquable — une adresse dessinée dans une image ne l'est jamais, et l'écran le dit. Sans feuille de partage (ordinateur) : téléchargement + légende copiée. La composition vit dans `assets/payencash-visuel.js`, partagée avec 06-partage : une seule implémentation. Une pièce qui n'est pas en vente n'a ni lien ni visuel, et le dit. | — · Flashcode · Copier le lien · Télécharger le visuel | — |
| — | [18-factures.html](../ui/fournisseur/18-factures.html) <br>PayEnCash FOURNISSEUR — Factures | (19/09, soir — fondatrice « à la place d'Accueil mets Factures ») LES FACTURES ONT LEUR ÉCRAN. « Ventes » mélangeait les commandes reçues et les factures à émettre : deux gestes, deux écrans. Ici l'argent — à facturer, émise, virée — et l'action « Émettre la facture ». Les commandes vivent sur 05. | — | — |
| 10 | [09-compte-entreprise.html](../ui/fournisseur/09-compte-entreprise.html) <br>PayEnCash FOURNISSEUR — Mon entreprise | MON ENTREPRISE — HUB (fondatrice 05/09 : « reprends la hiérarchie des onglets, crée des pages, réorganise »). C'était UNE page de huit cartes empilées à plat, le dossier de vérification noyé au milieu. Désormais : l'ESSENTIEL en tête (qui je suis, où en est mon dossier), puis des rangées vers cinq p… | — | — |
| 11 | [10-identite-legale.html](../ui/fournisseur/10-identite-legale.html) <br>PayEnCash FOURNISSEUR — Identité légale | IDENTITÉ LÉGALE — lecture seule : ces mentions viennent de l'immatriculation et alimentent le contrat-cadre. Tout est dérivé de fournisseurEntreprise() via [data-ent]. (08/09 — ré-audit fournisseur) payencash-docs.js est GARDÉ : la page dit l'état de la pièce Kbis (PEC_DOCS) — c'est le Kbis qui fait… | — | — |
| 12 | [11-verification-kyb.html](../ui/fournisseur/11-verification-kyb.html) <br>PayEnCash FOURNISSEUR — Vérification (KYB) | VÉRIFICATION KYB — dépôt RÉEL (PEC_DOCS), contrat-cadre généré puis signé, frais d'examen depuis le référentiel. Cette page était noyée au milieu de « Mon entreprise ». | — | — |
| 13 | [12-contrat-cadre.html](../ui/fournisseur/12-contrat-cadre.html) <br>PayEnCash FOURNISSEUR — Contrat-cadre | CONTRAT-CADRE — le document se GÉNÈRE et se SIGNE (PEC_DOCS), il ne se dépose pas. Les conditions sont dérivées de la fiche. | — | — |
| 14 | [13-coordonnees-bancaires.html](../ui/fournisseur/13-coordonnees-bancaires.html) <br>PayEnCash FOURNISSEUR — Coordonnées bancaires | COORDONNÉES BANCAIRES — édition inline persistée par fournisseurEntrepriseSet (module partagé), jamais un prompt(). (08/09 — ré-audit fournisseur) un IBAN se REMPLACE entier (champ vide, « IBAN actuel : …678 » rappelé), contrôlé par la clé mod 97 (socle) ; la pièce RIB du dossier s'affiche avec son … | — | — |
| 15 | [14-contact-preferences.html](../ui/fournisseur/14-contact-preferences.html) <br>PayEnCash FOURNISSEUR — Contact & préférences | CONTACT & PRÉFÉRENCES — catégories et notifications dérivées de la fiche, bascule persistée. | — | — |
| 16 | [15-reclamations.html](../ui/fournisseur/15-reclamations.html) <br>PayEnCash FOURNISSEUR — Mes réclamations | APP FOURNISSEUR — MES RÉCLAMATIONS (10/09, lot 5) : jusqu'ici le fournisseur n'apprenait JAMAIS qu'une de ses pièces avait été refusée par un client, et rien ne lui était imputé. Cet écran lui montre ce qui le concerne : le dossier, le constat de l'atelier, ce qui lui est débité et pourquoi, son dro… | — | — |
| 17 | [16-notifications.html](../ui/fournisseur/16-notifications.html) <br>PayEnCash FOURNISSEUR — Notifications | (10/09 — lot 5, constat F7) LE FIL DU FOURNISSEUR. Il n'avait aucune notification : un verdict d'atelier (photos à refaire, refus, re-cotation à accepter), un colis en retard chez lui, une facture émise ou virée, un constat de réclamation et son délai de contestation, une décision sur cette contesta… | — | — |
| 18 | [17-reseaux.html](../ui/fournisseur/17-reseaux.html) <br>PayEnCash FOURNISSEUR — Mes réseaux sociaux | MES RÉSEAUX SOCIAUX (12/09 — demande fondatrice « relier leurs réseaux sociaux depuis leur espace »). L'atelier relie SES comptes : ce qui se saisit est un IDENTIFIANT (l'URL se dérive du réseau — jamais un lien libre publié sur une page ouverte au public), chaque lien porte sa visibilité, et rien n… | — | — |

### `partenaire/` — Commerçant partenaire — vend le Bon d’achat PayEnCash → **`app-partenaire`** (8 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [00-inscription.html](../ui/partenaire/00-inscription.html) <br>PayEnCash Partenaire — Inscription | Inscription du point en 4 étapes : dossier (enseigne, adresse, cp, ville, tel, e-mail, responsable, SIRET obligatoire) → code e-mail → pièces du coffre (Kbis, cni du gérant, vidéo) → transmis. Documents acceptés = `ref.documents.partenaire` (CGU partenaire, conditions du Bon d’achat). | `compteCreer`, `_compteLierMetier` (point `contrat_a_signer`, ou rattachement par SIRET / invitation) | `accounts`, `partners`, `kyc_documents`, `consents` |
| 2 | [01-connexion.html](../ui/partenaire/01-connexion.html) <br>PayEnCash Partenaire — Connexion | Connexion, activation d'invitation du gérant (`?invit=`), mot de passe oublié, « Créer le compte de mon point », « Devenir partenaire » (vitrine). | `compteConnecter`, `partenaireConnecter` | `accounts`, `partners` |
| 3 | [02-accueil.html](../ui/partenaire/02-accueil.html) <br>PayEnCash Partenaire — Accueil | Identité du point, bandeau compte, « À faire » dérivé (contrat, dossier), KPI (bons d’achat vendus aujourd'hui / ce mois, net à reverser, échéance), CTA « Vendre un Bon d’achat », cloche PEC_FIL. | `bonsDuPoint`, `reversementPoint`, `PEC_PART.aFaire` | `gift_cards`, `partner_remittances` |
| 4 | [03-vendre.html](../ui/partenaire/03-vendre.html) <br>PayEnCash Partenaire — Vendre un Bon d’achat | Montant (raccourcis + libre, min/max du référentiel), case « J'ai reçu … € en espèces », « Émettre le bon d’achat » → ticket (`bonTicketHTML`) + « Imprimer le ticket » (CSS print) + « Nouveau bon d’achat » ; garde `PEC_PART.garde` (point non actif = vente fermée, motif). **(19/09, soir)** `?d=DB-…` — le commerçant a scanné le flashcode du client : le **montant est posé et non modifiable** (c'est la demande qui fait foi), un bandeau dit qui demande quoi et combien de temps elle reste valable, et l'émission passe par `demandeBonServir` — **le code repart vers l'écran du client**. Demande inconnue, expirée ou déjà servie : l'écran le dit et la vente libre reprend ses droits. Aucune règle de vente assouplie. | `bonEmettre` | `gift_cards`, `gift_card_movements` (issue) |
| 5 | [04-bons.html](../ui/partenaire/04-bons.html) <br>PayEnCash Partenaire — Bons d’achat vendus | Bons d’achat du point (kit data-f*), état dérivé (`bonEtat`), « Annuler » dans les 30 min si non utilisé (motif), « Réimprimer ». | `bonAnnuler` | `gift_cards` |
| 6 | [05-releves.html](../ui/partenaire/05-releves.html) <br>PayEnCash Partenaire — Reversements | Mois courant (nb, ventes, commission HT, TVA, net, échéance, IBAN AJEK = `bons.ibanReversement` ou « à renseigner »), statut, historique (`reversementCompte`), autofactures ouvrables. | — (le virement est un geste du partenaire ; le manager marque reçu) | `partner_remittances`, coffre `autofacture-…` |
| 7 | [07-mon-point.html](../ui/partenaire/07-mon-point.html) <br>PayEnCash Partenaire — Mon point | Fiche (tel, e-mail, responsable), dossier de vérification (`PEC_DOCS.rendreDossier`), contrat de distribution (générer / lire / signer), acceptations, statut du point, déconnexion. | `partenaireEnregistrer`, `PEC_DOCS.signer`, `contratPartenaireSigner` | `partners`, `kyc_documents`, `consents` |
| 8 | [08-notifications.html](../ui/partenaire/08-notifications.html) <br>PayEnCash Partenaire — Notifications | Fil dérivé du journal (`PEC_FIL.rendre(…, 'partenaire', pointId)`) : dossier, contrat, activation / suspension, reversement reçu, retard, autofacture. | — | `audit_log` |

### `manager/` — Manager AJEK (owner / opérateur) → **`app-manager`** (38 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [01-connexion.html](../ui/manager/01-connexion.html) <br>PayEnCash Manager — Connexion | CONNEXION MANAGER — route `/login`. Identifiant + mot de passe (`manager_users`), session JWT. Le rôle est vérifié par un guard GLOBAL côté backend : aucun endpoint manager n'est joignable sans lui, ce qui évite d'en oublier un au cas par cas. | Se connecter | — |
| 2 | [02-tableau-de-bord.html](../ui/manager/02-tableau-de-bord.html) <br>PayEnCash Manager — Tableau de bord | TABLEAU DE BORD — route `/`. Quatre indicateurs et l'activité en direct. « Écarts à traiter » porte un liseré ambre : c'est le seul chiffre de cet écran qui appelle une action humaine, et il ne doit pas se noyer dans les autres. | — | — |
| 3 | [04-commandes.html](../ui/manager/04-commandes.html) <br>PayEnCash Manager — Réservations | RÉSERVATIONS — route `/reservations`. Relevée sur l'écran réel (`ReservationsClient`) : ce n'est PAS un tableau, c'est une liste de cartes, chacune portant sa propre barre d'actions. Le tableau dense qui figurait ici auparavant escamotait les quatre actions sensibles de l'écran. « Incidents & en cours » est un onglet attrape-tout : PAID, PARTIAL, FAILED, EXPIRED, REFUNDED, CANCELLED. Sans lui, une commande passée PA… | En attente · Brouillons · Confirmées · Incidents & en cours · Confirmer le paiement reçu | — |
| 4 | [07-tresorerie.html](../ui/manager/07-tresorerie.html) <br>PayEnCash Manager — Trésorerie | TRÉSORERIE — route `/tresorerie`. L'écran répond à une seule question : où est le cash ? Quatre poches, dans l'ordre du circuit, et une seule est ventilable. Le bouton « Synchroniser » va chercher auprès de Qonto la confirmation que les fonds sont bien arrivés — c'est cette confirmation, et rien d'autre, qui autorise à payer. | Synchroniser Qonto · Ventiler les paies · Examiner | — |
| 5 | [08-finance.html](../ui/manager/08-finance.html) <br>PayEnCash Manager — Suivi financier | SUIVI FINANCIER — route `/finance`. Maquette relevée sur l'écran réel (`FinanceFigures` + `WalletTopup` + `FinanceJournals`), dans son ORDRE réel : bénéfice net réalisé, encaissé du jour, trésorerie, comptes fournisseurs, bénéfice potentiel, détail jour par jour, wallets, puis les deux journaux. Le coût et l'en-transit du prestataire d'encaissement ne sont pas repris ici : le modèle cible les remplace par les quatre… | Recharger | — |
| 6 | [09-appels.html](../ui/manager/09-appels.html) <br>PayEnCash Manager — Centre d’appels | CENTRE D'APPELS — route `/appels`. Relevée sur l'écran réel (`AppelsPage`) : un SÉLECTEUR DE JOUR en tête (la planification du backend accepte n'importe quelle date, pas seulement aujourd'hui) et un bloc SATISFACTION du mois en cours au-dessus de la liste. Les deux manquaient à la maquette. Le numéro du client est déchiffré côté backend et rendu cliquable (`tel:`) : sans ça, l'opérateur recopie un numéro à la main, … | Aujourd’hui · Terminé · Sans réponse · Fermer · 1 | — |
| 7 | [10-configuration.html](../ui/manager/10-configuration.html) <br>PayEnCash Manager — Configuration | CONFIGURATION — route `/config`. Relevée sur l'écran réel (`ConfigEditor`) : chaque marge porte SON bouton « Enregistrer ». Ce n'est pas un détail de mise en page — un bouton global en haut d'écran laisserait croire qu'on enregistre tout d'un coup, alors que l'écran envoie une catégorie à la fois (`updateMargin(category, percentage)`). Les blocs marqués « cible » n'existent pas encore dans l'application : ils sont d… | Enregistrer | — |
| 8 | [11-audit.html](../ui/manager/11-audit.html) <br>PayEnCash Manager — Journal d’audit | JOURNAL D'AUDIT — route `/audit`. Relevée sur l'écran réel (`AuditClient`), sans l'embellir : l'acteur s'affiche en UUID BRUT et les détails en JSON BRUT. En l'état, ce journal ne se lit pas — c'est le sujet à traiter (voir l'encart ci-dessous). Il n'y a NI recherche NI filtre de période. | — | — |
| 9 | [12-commande-detail.html](../ui/manager/12-commande-detail.html) <br>PayEnCash Manager — Commande CMD-Z6DNX8HV | DÉTAIL D'UNE COMMANDE — route `/reservations/[id]`. Écran révélé manquant par l'audit de traçabilité : l'app manager expose déjà `confirm-payment`, `cancel` et `force-cancel`, sans qu'aucune maquette ne les porte. Ces trois actions contournent les garde-fous du flux automatique — elles sont donc isolées dans leur propre panneau, avec motif et journalisation. | Exporter · Confirmer… · Annuler… · Forcer… | — |
| 10 | [13-solde-fournisseur.html](../ui/manager/13-solde-fournisseur.html) <br>PayEnCash Manager — Solde fournisseur | SOLDE FOURNISSEUR — route `/finance/wallets`. Écran révélé manquant par l'audit : `listWallets`, `walletTransactions` et `topUpWallet` existent dans la façade manager sans aucune maquette. Point à ne pas confondre : ce solde est une AVANCE de PayEnCash, distincte de la trésorerie du cash collecté (Doc 8). Le cash rembourse l'avance, il ne l'alimente pas automatiquement. | Recharger le solde · Recharger | — |
| 11 | [14-comptabilite.html](../ui/manager/14-comptabilite.html) <br>PayEnCash Manager — Comptabilité & TVA | COMPTABILITÉ & TVA — écran CIBLE, route `/comptabilite`. N'existe pas encore. Il porte une obligation que la Doc 8 énonce et qu'aucun écran ne tenait : suivre la TVA collectée (∑ `orders.vat_amount_cents` sur PAID / CONFIRMED), la METTRE DE CÔTÉ pour reversement, et cadrer la périodicité déclarative avec l'expert-comptable. Le pendant de l'écran Trésorerie : celui-là répond à « où est notre argent ? », celui-ci à « … | Exporter la période · Exporter | — |
| 12 | [16-communications.html](../ui/manager/16-communications.html) <br>PayEnCash Manager — Communications | COMMUNICATIONS — écran CIBLE, route `/communications`. Neuf e-mails transactionnels partent déjà en production (adaptateur Brevo, 4 jobs CRON) sans qu'aucun écran ne permette de savoir lesquels, ni s'ils sont arrivés. Cet écran comble ce trou et ajoute les notifications in-app, qui n'existent nulle part. Deux registres distincts, volontairement séparés : - SORTANT (`notification_log`) : ce qu'on a expédié. Un e-mail… | Tous · E-mail · SMS · Push · Échecs | — |
| 13 | [17-comptes-manager.html](../ui/manager/17-comptes-manager.html) <br>PayEnCash Manager — Comptes manager | COMPTES MANAGER — écran CIBLE, route `/comptes`. Réservé au rôle `direction` (ROLES_MANAGER). Jusqu'ici, recruter quelqu'un supposait une insertion en base à la main — et l'écarter aussi. La table `manager_users` existait sans aucune interface. Trois partis pris qui viennent de la spec : - DÉSACTIVATION, jamais suppression : `manager_users` est référencé par `margin_config.updated_by` et `customer_calls.assigned_to`. Supprimer une lign… | Inviter · Rétrograder · Désactiver · Promouvoir · Réactiver | — |
| 14 | [18-fiche-client.html](../ui/manager/18-fiche-client.html) <br>PayEnCash Manager — Fiche client | FICHE CLIENT — écran CIBLE, route `/clients`. Deux usages : le support au téléphone, et le traitement des demandes RGPD reçues par quelqu'un qui n'a plus accès à son compte. Les endpoints /me/privacy/* existent déjà mais ne servent qu'un client CONNECTÉ — personne ne pouvait aider les autres. RECHERCHE : téléphone (colonne en clair, c'est l'identifiant de login), e-mail exact (via email_hash, index aveugle HMAC) ou … | Téléphone · E-mail · Réf. commande · Accès à ses données · Rectification | — |
| 15 | [19-invitation.html](../ui/manager/19-invitation.html) <br>PayEnCash Manager — Accepter l’invitation | ACCEPTATION D'UNE INVITATION — écran CIBLE, route `/invitation/[token]`. Hors coque et HORS SESSION : l'invité n'a pas encore de compte, exiger une session rendrait le lien inutilisable. C'est la seule route de l'espace manager sans garde. L'invité CHOISIT son mot de passe : personne d'autre ne le connaît, jamais. C'est ce qui donne leur valeur aux traces nominatives du journal d'audit — un mot de passe communiqué p… | Créer mon compte | — |
| 16 | [20-notifications.html](../ui/manager/20-notifications.html) <br>PayEnCash Manager — Notifications | NOTIFICATIONS MANAGER — écran CIBLE, route `/notifications`. Trou relevé après coup : la table `notifications` documente TROIS audiences — client, agent, manager — et seules les deux premières avaient une interface. Le manager était destinataire de notifications qu'il n'avait nulle part où lire. Deux natures ici, et elles ne se confondent pas : - la notification NOMINATIVE (adressée à une personne précise) ; - la DI… | Tout marquer comme lu | — |
| 17 | [21-compte-resultat.html](../ui/manager/21-compte-resultat.html) <br>AJEK Manager — Compte de résultat | COMPTE DE RÉSULTAT — route `/compte-resultat`. Suivi de gestion (pas la comptabilité légale). Chaque écriture est classée en trois résultats du PCG : exploitation, financier, exceptionnel. Le résultat net et la position bénéficiaire/déficitaire sont calculés en direct. Règles : la TVA collectée est une dette (pas un produit) ; le prix fournisseur encaissé transite ; seule la marge AJEK est un produit. Données : `led… | Exporter (expert-comptable) | — |
| 18 | [23-appels-commerciaux.html](../ui/manager/23-appels-commerciaux.html) <br>AJEK Manager — Appels commerciaux | APPELS COMMERCIAUX — route `/appels-commerciaux`. Silos d'appels planifiables. Déclencheur principal : un utilisateur qui n'achève pas le tunnel (abandon) → un appel de relance est planifié. Distinct du journal d'appels opérationnels (`09-appels`, téléphonie agent/client). Données : `commercial_callbacks`, `abandoned_orders`. Voir NOUVELLES §6/§18.2. Attention : opposition au démarchage (Bloctel). | + Planifier une campagne · Déclarer l'appel fait · Planifier un rappel | — |
| 19 | [25-mode.html](../ui/manager/25-mode.html) <br>AJEK Manager — Ligne Mode | LIGNE MODE — route `/mode`. Achat ferme d'articles de mode à des FOURNISSEURS (dépôts-vente/revendeuses), ramassés par l'agent, expédiés au client par Mondial Relay. AJEK = vendeur. Jeu de factures en 2 temps (fournisseur→AJEK, puis AJEK→client) ; le levier promo du fournisseur = ses CODES PROMO (écran 26). KYB fournisseurs (SIRET, gérant, RIB). Registre des objets mobiliers (art. 321-7). TVA marge/standard. Voir l'… | + Référencer un fournisseur | — |
| 20 | [26-editer-promos.html](../ui/manager/26-editer-promos.html) <br>PayEnCash Manager — Éditer les Promos | ÉDITER LES PROMOS — route `/promos/editer` (fondatrice 22/08 : « depuis le manager j'édite ces offres — je cherche et sélectionne À L'AVANCE, ça crée les packs tout compris selon le mode »). Chaîne : recherche vol A/R (Duffel) + hébergement (centrale) → sélection → composition du pack (mode, prix, prix « en normal » Omnibus) → contrôles BLOQUANTS (prix < normal · départ ≥ J+21) → INSERT promo_offers → visible dans F… | Chercher vols + hébergements · Publier l'offre — visible dans FLY dès va… | `promos` |
| 21 | [26-fournisseurs.html](../ui/manager/26-fournisseurs.html) <br>AJEK Manager — Fournisseurs MODE | FOURNISSEURS — route `/fournisseurs` (F12). La vérification de CHAQUE commerçant-fournisseur : KYB/KYC en attente, pièces soumises à valider (contrôle atelier), conformité des états déclarés, factures à régler (virement ≤ 7 j), retombées des liens influenceurs. Données : `suppliers`, `mode_articles` (pipeline), `article_variants`, `supplier_invoices`, `share_links`. Terminologie : achat ferme / facture / … | Inviter un fournisseur | — |
| 22 | [27-assistance-reclamations.html](../ui/manager/27-assistance-reclamations.html) <br>AJEK Manager — Assistance & réclamations | ASSISTANCE & RÉCLAMATIONS — route `/assistance`. L'espace MANAGER du flux support : les conversations des hôtes (SLA 2 h ouvrées) et les réclamations ESCALADÉES (SLA manager 48 h → geste commercial → Médiateur du Tourisme et du Voyage si 60 j sans accord). SOURCE UNIQUE : PEC_DATA.assistance (les MÊMES ids que l'app client — c'est le flux inter-apps). Tables : support_conversations, support_messages, reclamations, e… | Exporter le registre | `assistance` |
| 23 | [27-journal-flux.html](../ui/manager/27-journal-flux.html) <br>PayEnCash MANAGER — Journal des flux | JOURNAL DES FLUX (fondatrice 27/08) : la preuve noir sur blanc que RIEN ne se règle tout seul — chaque annonce vient du client, chaque règlement vient du COMMERÇANT qui encaisse les espèces au comptoir (le Bon d’achat) ou du PRESTATAIRE de paiement en ligne (sa notification, jamais le navigateur du … | — | — |
| 24 | [29-partenaires.html](../ui/manager/29-partenaires.html) <br>PayEnCash Manager — Commerces partenaires — Bons d’achat | (18/09) Nav « Encaissement » → « Commerces partenaires — Bons d’achat » : candidatures à valider (`comptesAValider('partenaire')` → `compteValider`), réseau (fiche, statut, KYB dérivé du coffre, contrat, bons d’achat vendus, reversement du mois — activer / suspendre / réactiver / clôturer avec motif, inviter le gérant), reversements attendus / reçus (« Marquer reçu » : montant + référence → `reversementRecevoir`, autofacture AFB-…), retards (`reversementsEnRetard`). | `partenaireActiver`, `partenaireSuspendre`, `partenaireReactiver`, `partenaireCloturer`, `partenaireInviterGerant`, `reversementRecevoir` | `partners`, `partner_remittances`, `gift_cards`, `accounts` |
| 25 | [30-carte-operations.html](../ui/manager/30-carte-operations.html) <br>PayEnCash Manager — Carte des opérations | (07/09 — audit manager « connexion table / donnée ») tables du schéma reflétées par cet écran : `partners`, `vouchers`, `orders`, `psp_transactions` — miroir server/db/schema.sql (partie 6) (18/09, soir) « courier_positions » et « couriers » ont quitté cette liste avec les agents. | — | — |
| 26 | [31-comptes-demo.html](../ui/manager/31-comptes-demo.html) <br>PayEnCash Manager — Accès & comptes démo | ACCÈS & COMPTES DE DÉMONSTRATION (28/08 — fondatrice : « les infos de connexion et mots de passe depuis l'espace manager »). Le trousseau de la MAQUETTE : un compte par espace pour tester la chaîne de bout en bout. Les mots de passe sont masqués par défaut, révélés à la demande, copiables. Chaque li… | — | — |
| 27 | [34-atelier.html](../ui/manager/34-atelier.html) <br>AJEK Manager — Atelier MODE | ATELIER MODE — Phase 1 « faire tourner l'opération » (fondatrice 31/08). Le poste de travail qui manquait : réception, contrôle photos (normes → conforme / à refaire), contrôle qualité + authentification (conforme / re-cotée / refusée), avec certificat généré et remboursement client si la pièce a dé… | — | — |
| 28 | [35-stock-mode.html](../ui/manager/35-stock-mode.html) <br>AJEK Manager — Stock MODE | STOCK MODE — Phase 1 « faire tourner l'opération » (fondatrice 31/08). Le tableau qui manquait : disponible = stock − réservations actives, minuteurs de réservation en direct, libération à l'expiration (la pièce revient dispo et la file d'attente est notifiée), file d'attente & alertes de re-dispo. … | — | — |
| 29 | [36-facturation-fournisseurs.html](../ui/manager/36-facturation-fournisseurs.html) <br>AJEK Manager — Facturation fournisseurs MODE | FACTURATION FOURNISSEURS MODE — Phase 1 « faire tourner l'opération » (fondatrice 31/08). L'outil qui manquait : achat ferme (pièce vendue + conforme) → ÉMISSION de la facture (numérotée) → VIREMENT ≤ 7 j → rapprochement. Jamais de « reversement » : les espèces clients restent à AJEK, on vire le fou… | — | — |
| 30 | [37-livre-police.html](../ui/manager/37-livre-police.html) <br>AJEK Manager — Livre de police MODE | LIVRE DE POLICE MODE — Phase 2 « confiance/conformité » (art. 321-7 du code pénal). Obligation d'un revendeur professionnel d'objets mobiliers d'OCCASION : tenir un registre coté et paraphé permettant d'identifier chaque objet ET la personne qui l'a cédé (achat pour revente). Registre IMMUABLE côté … | — | — |
| 31 | [38-invendus-mode.html](../ui/manager/38-invendus-mode.html) <br>AJEK Manager — Invendus &amp; démarque MODE | (07/09) le journal des gestes manager passe par le bus : sans lui, rien n'était tracé | — | — |
| 32 | [39-clients.html](../ui/manager/39-clients.html) <br>AJEK Manager — Clients MODE | (07/09) le journal des gestes manager passe par le bus : sans lui, rien n'était tracé | — | — |
| 33 | [40-comptes.html](../ui/manager/40-comptes.html) <br>AJEK Manager — Comptes & accès | (07/09 — audit manager « connexion table / donnée ») tables du schéma reflétées par cet écran : `accounts`, `manager_users`, `login_events`, `verification_codes` — miroir server/db/schema.sql (partie 6) | — | — |
| 34 | [41-cartes-cadeaux.html](../ui/manager/41-cartes-cadeaux.html) <br>PayEnCash Manager — Bons d’achat PayEnCash & cartes cadeaux | (18/09 — Bon d’achat PayEnCash) le QR du ticket réimprimé (bonTicketHTML) | — | — |
| 35 | [42-verifications.html](../ui/manager/42-verifications.html) <br>PayEnCash Manager — Vérifications KYC / KYB | VÉRIFICATIONS KYC / KYB (fondatrice 05/09 : « où le manager vérifie les KYB/KYC, et comment s'organise le dispatch côté hotline — automatise tout ça »). Le manager a ICI la vue d'ensemble : combien de dossiers attendent, qui les tient, lesquels ont dépassé l'engagement de délai (ils remontent en ESC… | — | — |
| 36 | [43-reclamations-mode.html](../ui/manager/43-reclamations-mode.html) <br>PayEnCash Manager — Réclamations Mode | RÉCLAMATIONS MODE (10/09 — lot 5, politique « politique-reclamations-fournisseur.html »). La chaîne allait du client au remboursement et s'arrêtait là : le fournisseur n'apprenait jamais qu'une de ses pièces avait été refusée. Cet écran tient les quatre gestes qui la bouclent — rembourser le client,… | — | — |
| 37 | [44-expeditions-mode.html](../ui/manager/44-expeditions-mode.html) <br>PayEnCash Manager — Colis Mode | COLIS MODE (10/09 — lot 6, constats C15 / C20 / C21 / C22). Aucun écran manager ne montrait les colis Mode : le fournisseur éditait son étiquette, et après le dépôt plus personne ne savait rien. Le client n'était donc JAMAIS « livré » — ce qui privait la rétractation de 14 jours de son point de dépa… | — | — |

### `commercial/` — Commercial & marketing AJEK → **`app-commercial`** (11 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [00-connexion.html](../ui/commercial/00-connexion.html) <br>PayEnCash Commercial — Connexion | CONNEXION COMMERCIAL (08/09 — audit commercial : l'espace commercial n'avait AUCUNE porte d'entrée ; seule une session manager y passait, et le compte `commercial.m` du trousseau n'ouvrait rien). Même protocole que la hotline (00-connexion) : PEC_DATA.compteConnecter('commercial', identifiant, mdp) … | — | — |
| 2 | [01-pipeline.html](../ui/commercial/01-pipeline.html) <br>PayEnCash PRO — Pipeline | App commercial AJEK — pipeline de recrutement des FOURNISSEURS Mode (17/09 : plus de points partenaires). Étapes : Repérés → Pitchés → En signature → Signés. Chaque prospect porte une prochaine action. Flux : vue pipeline → fiche commerce → pitch (02) → signature (03) → ouverture (04). | — | — |
| 3 | [02-pitch.html](../ui/commercial/02-pitch.html) <br>PayEnCash PRO — Pitch | Pitch au buraliste — simulateur de revenus : ventes/semaine estimées × panier moyen ≈ 250 € → estimation en euros (posture prudente : chiffres indicatifs, la grille contractuelle — confidentielle, par palier en euros, jamais de % — est remise à la signature). Arguments : clientèle apportée, zéro manipulation du risque (caisse AJEK, relève par agent), supports fournis. | — | — |
| 4 | [03-signature.html](../ui/commercial/03-signature.html) <br>PayEnCash PRO — Signature du contrat de distribution | (18/09) Pour un commerce pitché : envoyer le lien de signature au gérant (jeton, validité limitée) ou saisir la signature au comptoir avec le responsable (SIRET 14 chiffres). La signature crée / complète le point `PRT-n` en `contrat_signe`, dépose le contrat au coffre, invite le gérant. | `signatureLienEnvoyer`, `contratPartenaireSigner`, `partenaireInviterGerant` | `sales_leads` (lead_type point, stage signature), `signature_links`, `partners` |
| 5 | [05-campagnes.html](../ui/commercial/05-campagnes.html) <br>PayEnCash PRO — Campagnes | COCKPIT MARKETING (décision 21/08) — les campagnes se LANCENT ET SE PILOTENT ICI : TikTok / Meta / Snap via leurs API Marketing (jamais de copier-coller de dashboards), budget en direct (dépensé vs alloué), CPI par canal, référencement IA (GEO) comme canal. Rendu 100 % depuis PEC_DATA.commercial. | — | `commercial` `eur` |
| 6 | [06-concours.html](../ui/commercial/06-concours.html) <br>PayEnCash PRO — Concours | CENTRE DE COMMANDE DU JEU CONCOURS — la « force commune » (F9) : influenceurs + flyers terrain + pub réseaux + points partenaires convergent sur LE MÊME tirage, chaque canal tracé séparément. PEC_DATA.commercial.concours. | — | `commercial` `concours` `lancement` |
| 7 | [07-ged.html](../ui/commercial/07-ged.html) <br>PayEnCash PRO — GED marketing | GED MARKETING — la bibliothèque unique des supports (print, vidéo, web) : versions, statuts, et la liste des LOTS DE FLYERS avec leur traçage QR. Règle : une créa ne sort en campagne QUE depuis sa version validée ici. | — | `commercial` |
| 8 | [08-agenda.html](../ui/commercial/08-agenda.html) <br>PayEnCash PRO — Agenda marketing | AGENDA MARKETING — la planification pragmatique : tout ce qui doit se passer d'ici le tirage, jour par jour, typé par force (terrain / influenceur / pub / concours / pilotage). PEC_DATA.commercial.agenda. | — | `commercial` |
| 9 | [09-signature-gerant.html](../ui/commercial/09-signature-gerant.html) <br>PayEnCash — Signer le contrat (gérant) | (18/09) PAGE PUBLIQUE jetonnée (`?id=&t=`) : les documents sous les yeux (contrat de distribution, conditions du Bon d’achat, CGU), code OTP envoyé au gérant, « Signer » → `contratPartenaireSigner` via `lien` ; lien expiré ou consommé = refus motivé. | `signatureLienValide`, `signatureOtpEnvoyer`, `signatureOtpVerifier`, `contratPartenaireSigner` | `signature_links`, `partners`, `kyc_documents` |
| 10 | [10-notifications.html](../ui/commercial/10-notifications.html) <br>PayEnCash COMMERCIAL — Notifications | (10/09 — lot 5, constat F7) LE FIL DU COMMERCIAL. Il n'avait aucune notification : un dossier qui avance, un rappel dont l'échéance est passée, une action d'agenda du jour — rien ne venait le chercher, il fallait rouvrir chaque écran. (17/09 — pivot) Les faits qu'il remontait étaient ceux du mandat … | — | — |
| 11 | [11-resultats.html](../ui/commercial/11-resultats.html) <br>PayEnCash PRO — Mes résultats | MES RÉSULTATS — ce que l'agent commercial a apporté. (17/09 — pivot) Cet écran comptait des EUROS : prime de signature d'un point + part d'apport sur la commission que ce point gagnait sur ses ventes (mandat d'agent commercial, art. 9). Cette grille n'existe plus et rien ne la remplace : l'écran com… | — | — |

### `hotline/` — Superviseur·e & hôtes support → **`app-hotline`** (2 écrans, relevés le 18/09)

| # | Écran | Ce que l'écran fait (relevé dans le fichier) | Actions | Données |
|---|---|---|---|---|
| 1 | [00-connexion.html](../ui/hotline/00-connexion.html) <br>PayEnCash Hotline — Connexion | CONNEXION HOTLINE (audit 03/09 : l'espace hotline n'avait AUCUN écran de connexion — le compte `hotline.op` du trousseau existait dans le protocole sans porte d'entrée). Protocole unique des comptes : PEC_DATA.compteConnecter('hotline', identifiant, mdp) — compte de démo (comptesDemo) et conseillers… | — | — |
| 2 | [01-pilotage.html](../ui/hotline/01-pilotage.html) <br>PayEnCash Hotline — Pilotage des appels | HOTLINE — l'espace de l'équipe support DÉLÉGUÉE (fondatrice 24/08 : « le manager ne pourra pas tout faire — anticiper la délégation, accompagner parfaitement nos premiers clients, pas droit à l'erreur au lancement »). RÔLES : la SUPERVISEURE (Naïma) voit tout et ASSIGNE ; chaque HÔTE voit sa file ; SEULES les réclamations montent au manager (écran manager/27). Couvre : appels entrants (0 805), rappels demandés, appe… | Mode lancement | `assistance` |
---

## 5. Le back qui tourne — `server/`

> **⚠️ Les §5 à §11 ci-dessous n'ont PAS été recomptés le 18/09 : ils datent du 26/08 et sont
> conservés comme relevé d'époque.** Trois choses à savoir avant de les lire. ① Le schéma
> compte aujourd'hui **128 tables et 3 vues**, pas 56 : le titre du §5.2 et sa liste sont
> périmés. ② Le service `logistique` et ses trois routes (`GET /couriers/:id`,
> `POST /couriers/:id/deposits`, `POST /cash-services/report`) **n'ont plus d'objet** —
> l'agent est supprimé —, et `POST /partner/scan` non plus : un partenaire ne scanne rien,
> il **vend un bon d’achat**. ③ Les tables `delivery_zones`, `couriers`,
> `partner_settlements`, `cash_deposits` et `bank_deposit_transactions`, citées plus bas,
> **ont été supprimées**. **Vérifier dans `server/db/schema.sql`, jamais ici.**

Huit services Node + une passerelle, une image Docker unique pilotée par `SERVICE`
(`server/Dockerfile`), une base PostgreSQL 16. Vérifié en exécution le 26/08/2026 :
10 conteneurs démarrés, `GET /promos/promos` et `POST /mode/cart/price` répondent 200.

### 5.1 Les 32 routes servies

| Service | Routes | Détail |
|---|---|---|
| `identite` | 2 | `GET /users/:id` · `GET /users/:id/gift-cards` |
| `voyage` | 2 | `GET /offers` · `POST /orders` |
| `promos` | 2 | `GET /promos` · `GET /promos/:slug` |
| `encaissement` | 4 | `GET /payments/:ref/code` · `POST /partner/scan` · `POST /payments/:ref/card-intent` · `POST /payments/:ref/collect` |
| `logistique` | 3 | `GET /couriers/:id` · `POST /couriers/:id/deposits` · `POST /cash-services/report` |
| `mode` | 6 | `GET /articles` · `GET /articles/search` · `GET /articles/:slug` · `POST /cart/price` · `GET /trends` · `GET /orders/:ref/tracking` |
| `fournisseurs` | 6 | `POST /price-preview` · `POST /articles` · `GET /suppliers/:id/invoices` · `GET|POST /suppliers/:id/promo-codes` · `GET /suppliers/:id/share-links` |
| `reporting` | 6 | `GET /indicateurs` · `GET|POST /marketing/campaigns` · `GET /marketing/contest` · `GET /marketing/assets` · `GET /marketing/events` |

**Aucune route d'authentification n'existe** : `server/services/identite/` sert un profil par
`:id`, sans jeton. C'est le premier manque à combler (interdit §10.8 : l'identité vient du jeton).

### 5.2 Les 56 tables du 26/08 — regroupées par périmètre métier *(**125 tables au 18/09 au soir** ; cette liste est un relevé d'époque, pas l'état du schéma)*

Le regroupement ci-dessous est une **lecture** du schéma (transactions et invariants partagés),
pas encore une décision de découpage : celle-ci est prise en §2 de `docs/architecture.md`.

| Périmètre | Tables |
|---|---|
| Comptes & cartes cadeaux | `users` `gift_cards` |
| Réseau & terrain | `partners` `delivery_zones` `couriers` `partner_settlements` |
| Référentiels voyage | `airlines` `places` `nuitee_cities` `place_city_links` |
| Offres voyage (cache) | `flight_offers` `hotel_offers` `hotel_reviews` |
| Promos | `promo_offers` |
| Commande & paiement | `orders` `order_items` `payments` `payment_tenders` `cancellation_requests` |
| Cycle du cash | `cash_deposits` `bank_deposit_transactions` |
| Règlement fournisseurs voyage | `supplier_bookings` `provider_wallets` |
| Catalogue MODE | `mode_articles` `article_variants` `brands` `trend_looks` `look_similars` `collab_drops` |
| Stock & demande MODE | `stock_reservations` `stock_waitlist` `product_alerts` `user_favorites` |
| Achat & logistique MODE | `suppliers` `purchase_orders` `supplier_invoices` `supplier_promo_codes` `shipments` `mode_returns` |
| Marketing & acquisition | `ad_campaigns` `influencer_links` `share_links` `flyer_batches` `ged_assets` `marketing_events` |
| Support & relation client | `support_conversations` `support_messages` `reclamations` `hotline_calls` `satisfaction_responses` `transactional_messages` |
| Traçabilité | `audit_log` `event_log` |

### 5.3 Les 14 enums Postgres — source unique candidate pour `libs/contracts/*/enums/`

| Enum | Valeurs |
|---|---|
| `order_status` | `DRAFT` `PRICE_LOCKED` `AWAITING_CASH` `PAID` `CONFIRMED` `FULFILLED` `CANCELLED` `REFUNDED` `FAILED` |
| `order_line` | `voyage` `promo` `mode` |
| `pay_channel` | `point` `agent` |
| `cash_state` | `collected` `declared` `reconciled` `on_account` `paid_out` |
| `vat_scheme` | `marge_voyage` `marge_occasion` `tva_20` |
| `supplier_status` | `candidate` `kyb_pending` `active` `watch` `suspended` |
| `piece_status` | `soumis` `valide_publie` `vendu_achat_ferme` `ramasse` `controle` `expedie` |
| `piece_controle` | `conforme` `recote` `refuse` |
| `shipment_status` | `label_created` `picked_up` `in_transit` `at_relay` `delivered` `returned` |
| `settlement_status` | `not_due` `settled` `failed` |
| `kyc_level` | `declaratif` `pvid` |
| `reservation_status` | `active` `confirmee` `expiree` `annulee` |
| `return_status` | `demande` `etiquette_emise` `en_transit` `recu_atelier` `conforme_rembourse` `refuse` |
| `refund_method` | `avoir` `especes_point` `virement` |

S'y ajoutent **34 contraintes `CHECK (colonne IN (…))`** qui sont des enums qui ne disent pas
leur nom. **Promues le 27/08/2026** : les 14 + 34 = **48 enums** vivent désormais un par
fichier dans `libs/contracts/src/<domaine>/enums/` de `payencash-platform`, répartis en
10 domaines (`commande` 6 · `encaissement` 3 · `fiscalite` 1 · `voyage` 7 · `mode` 10 ·
`approvisionnement` 2 · `auth` 3 · `support` 9 · `marketing` 5 · `notifications` 2).
Chaque fichier cite sa source. Sans cette promotion, le front redevinerait des valeurs que
le serveur impose (règle §4 bis).

---

## 6. Les 114 routes documentées — et ce qu'elles ajoutent

`docs/03-api-specs.html` décrit une API qui **n'est pas celle qui tourne**. Répartition :

| Préfixe | Routes | Couvre |
|---|---|---|
| `/manager/*` | 51 | tout l'espace manager — **rien n'est implémenté** dans `server/` |
| `/orders/*` | 16 | le tunnel de réservation pas à pas (budget, vols, séjour, voyageurs, récap) |
| `/me/*` | 15 | compte client, voyageurs, consentements, RGPD, alertes prix |
| `/couriers/*` | 9 | candidature, connexion, statut, encours, dépôts, documents |
| `/deliveries/*` | 6 | acceptation, position, collecte, réattribution, suivi |
| `/search/*` `/destinations` `/deposit-points` | 6 | recherche vols/lieux, destinations par budget, points de dépôt |
| `/treasury/*` | 3 | solde, synchronisation Qonto, ventilation des paies |
| `/auth/*` `/notifications/*` `/webhooks/*` `/contact` `/health` | 8 | OTP SMS, notifications in-app, webhooks Duffel |

Douze routes supplémentaires sont celles de **fournisseurs tiers** (`/air/*` Duffel,
`/hotel-api/*` et `/hotel-content-api/*` Hotelbeds, `/media/hotels/*`) : elles n'appartiennent
pas à la plateforme et vivront dans des `*.adapter.ts` (règle §6).

---

## 7. Les divergences — à arbitrer avant le découpage

Trois modèles de données décrivent le même produit et **ne s'accordent pas**. C'est le
principal risque du portage : porter deux d'entre eux en même temps produirait deux versions
de la même logique (interdit §10.12).

| # | Divergence | Modèle A | Modèle B |
|---|---|---|---|
| D1 | **Hébergement** | `hotel_offers` (`server/db/schema.sql:145`, adaptateur Nuitée/LiteAPI) | `stay_offers` + `stay_search_results` (l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`), adaptateur Hotelbeds) |
| D2 | **Course d'encaissement** | pas de table dédiée — `payments.courier_id` + `orders.courier_id` | `deliveries` + `delivery_tracking_events` + `courier_ratings` (l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`)) |
| D3 | **Dépôt d'espèces** | `cash_deposits` + `bank_deposit_transactions` | `courier_deposits` + `deposit_cards` + `bank_report_imports` + `treasury_transfers` |
| D4 | **Voyageurs nominatifs** | colonne JSON `orders.travellers` | table `order_travelers` chiffrée AES-256 (citée aussi par `ui/ecrans/13-mes-voyageurs.html`) |
| D5 | **Point partenaire** | *révisé (18/09) : plus de borne ni d'encaissement ; le partenaire est **distributeur du Bon d’achat PayEnCash** — `partners` (v2), `partner_remittances`, `gift_cards` étendue, `gift_card_movements`, `signature_links`* | *idem, miroir Étape 6* |
| D6 | **Espace manager** | aucune table (`manager_users`, `margin_config`, `customer_calls`, `notifications`, `notification_log`, `manager_invitations` absentes de `schema.sql`) | 6 tables détaillées dans l'Étape 6 (`ESPACE-COMMERCANT/documents/partie-6-donnees.html`) |
| D7 | **Tables citées par les maquettes, absentes partout** | — | `ledger_entries` (`manager/21`), `fleet_vehicles` + `insurance_policies` (`manager/22`), `commercial_callbacks` + `abandoned_orders` (`manager/23`), `courier_availability` + `shifts` + `demand_forecast` + `service_sessions` (`manager/24`), `delivery_fee_config` (`manager/10`), `otp_codes` + `user_sessions` + `price_alerts` (`docs/02`) |

**Règle de résolution appliquée par défaut** (à confirmer, question Q3) : la maquette fait foi
sur le fonctionnel, donc **le modèle que la maquette nomme gagne** ; à fonctionnel égal, le
modèle **qui tourne** (`server/db/schema.sql`) gagne, parce qu'il est prouvé par exécution.
Cela retient A pour D1/D5, B pour D2/D3/D4/D6, et impose de créer D7.

---

## 8. Les invariants métier relevés — la machine devra les refuser

Relevés dans `server/README-DEV.md`, `server/db/schema.sql` et les commentaires des maquettes.
Ils ne sont pas des recommandations : ce sont des contraintes que le code porte déjà.

1. **Centimes partout** (`*_cents`). `62,35 €` est un format, jamais une donnée.
2. ~~Plafond 1 000 € par commande (L112-6 CMF)~~ — **caduc (18/09, soir)** : AJEK ne reçoit plus d'espèces ;
   le règlement au comptoir relève du commerçant. **Remplacé par les plafonds du Bon d’achat PayEnCash**
   (`ref.bons`, jamais en dur) : **minimum 5 €**, **250 € par bon d’achat**, **1 000 € de bons d’achat utilisés
   par client et par jour**, **validité 12 mois**, **annulation au comptoir sous 30 minutes**.
3. ~~Écart de collecte interdit~~ — **caduc (18/09, soir)** : plus de collecte. **Remplacé par** : le montant
   débité sur la carte du commerce **est** la valeur faciale moins la commission TTC, contrainte en base
   (`partner_charges_du`), et un **refus ne produit aucun bon d’achat** (`partner_charges_refus`).
4. ~~Cycle du cash strict `collected → declared → reconciled → on_account → paid_out`~~ — **caduc
   (18/09, soir)** : ces états n'existent plus. **Remplacé par** : un `payment_tenders` en ligne ne devient
   `captured` qu'à la **notification du prestataire** (`psp_transactions.notified_at`), et un tender `bon`
   l'est **au débit, sous verrou**.
5. ~~Rapprochement idempotent du rapport bancaire~~ — **caduc (18/09, soir)** : plus de rapport à importer.
   L'argent entre par deux virements de prestataires qui se rapprochent seuls.
6. ~~Encours agent plafonné à 400 €~~ — **caduc (18/09, soir)** : plus d'agent, plus d'encours.
7. ~~Deux codes, jamais confondus~~ — **révisé (18/09, soir)** : il n'y a plus de code de sécurité révélé à
   l'arrivée d'un agent. **Ce qui reste** : la référence d'une commande *identifie*, et le **code du ticket
   d'un bon d’achat vaut titre** — il n'est **jamais stocké en clair** (seule son empreinte `code_hash` l'est,
   avec un `code_masque` d'affichage), et il n'est pas remplacé en cas de perte ou de vol.
8. **TVA sur la marge jamais détaillée** au client (art. 297 A CGI) ; neuf = « dont TVA 20 % ».
9. **Fournisseur MODE** : facture → virement **≤ 7 jours** (contrainte BDD `delai_7j`).
10. ~~L'agent est salarié~~ — **caduc (18/09, soir)** : le poste est supprimé.
11. **Fenêtre de paiement de 120 minutes** pour toute commande *(18/09, soir : remplace le « prix bloqué
    1 heure après le choix du point de paiement » — il n'y a plus de point à choisir)*.
12. **Promos éditées à J−21 minimum**, commande à J−45 du départ, prix toujours < prix « en normal ».
13. ~~Le partenaire encaisse au nom et pour le compte d'AJEK~~ — **caduc (17/09)** : seuls le prestataire de paiement en ligne (notification), l'agent salarié et — depuis le 18/09 — le **débit d'un Bon d’achat PayEnCash dans le bus** (`payer(..., par:'bon')`, `bonAppliquer`) règlent une commande ; `par:'partenaire'` est refusé.
14. ~~Rémunération partenaire par palier en euros~~ — **caduc (17/09)** ; **(18/09, soir — CORRIGÉ)** le partenaire vend le Bon d’achat et retient **1,10 % HT + TVA**, non plus sur un reversement mensuel — **abandonné** — mais **à chaque vente** : sa carte est prélevée de la valeur faciale moins sa commission, via Stripe. La commission est **autofacturée** par AJEK (art. 289 CGI) depuis la vue `v_partner_monthly_statements`. **Aucun bon d’achat n'est émis si le prélèvement est refusé**, et **aucun bon d’achat n'est remboursé en espèces** : un remboursement le **re-crédite**.
14 bis. **(18/09)** Un point ne vend qu'en statut `actif` (dossier validé ET contrat de distribution signé ET activation manager) ; suspendu ou clos = vente fermée, bons d’achat déjà vendus toujours valables ; un SIRET = un point.
15. ~~Priorité du dispatch à la distance (D5)~~ — **caduc (18/09, soir)** : plus de dispatch.
16. **(18/09, soir) Le prélèvement précède le bon d’achat** : la charge naît **avant** le titre, et le titre
    n'existe que si elle est acceptée. Un refus reste **une ligne inscrite** avec son motif, jamais un silence.
    Une annulation au comptoir **contre-passe** la charge (`refunded`) — le débit ne s'efface pas.
17. **(18/09, soir) Un bon d’achat vendu n'est pas un revenu** : c'est une **dette** tant qu'il n'est pas
    dépensé, la TVA étant due **à l'utilisation** (art. 256 ter CGI).
18. **(18/09, soir) Une seule carte de règlement en cours par point** (`partner_cards_active`), et une carte
    expirée **ne vend plus**.

---

## 9. Les composants récurrents — base de `libs/ui`

La maquette porte déjà un design system : **179 primitives `pec-*` distinctes**, définies une
seule fois dans `ui/assets/payencash-v2.css` (« aucune maquette ne redéclare un token »).
Les plus récurrentes donnent la première tranche de `libs/ui` :

| Primitive | Fichiers | Ce que c'est |
|---|---|---|
| `pec-ico` | 111 | icône du sprite Lucide |
| `pec-scene` `pec-device` `pec-statusbar` | 84 | coque mobile |
| `pec-pill` (+ `--done` `--wait` `--off`) | 69 | étiquette d'état |
| `pec-tabbar` `pec-tab` | 63 | barre d'onglets basse |
| `pec-card` (+ `--elevated`) | 63 | carte |
| `pec-cta` (+ `--tight`) | 59 | bouton d'action principal, collé en bas |
| `pec-admin` `pec-aside` `pec-topbar` `pec-main` `pec-nav` | 27 | coque desktop (manager, commercial) |
| `pec-btn` (+ `--sm` `--ghost`) | 27 | bouton secondaire |
| `pec-panel` `pec-panel-head` `pec-panel-body` | 26 | panneau desktop |
| `pec-notice` (+ `--info`) | 25 | encart d'information |
| `pec-table` | 24 | tableau dense (seule bordure autorisée de la charte) |
| `pec-kpi` | 15 | indicateur chiffré |

Trois écrans partagent le **même composant de suivi** (`CourierTrackingView`, nommé dans
`ui/ecrans/02` et `ui/ecrans/11`) : c'est le premier candidat à l'implémentation unique.
Deux écrans MODE (`05-ou-payer`) et FLY (`fly/01-ou-payer`) portent le **même choix de canal** ;
`mode/06-recherche-agent` reprend mot pour mot l'intention de `fly/05-recherche-agent`.

---

## 10. Ce que la maquette ne disait pas — tranché le 26/08/2026

| # | Question | Décision |
|---|---|---|
| Q1 | Emplacement du monorepo | **Dépôt neuf** `payencash-platform`, à côté ; ce dépôt-ci reste la référence en lecture seule |
| Q2 | Sort du `server/` existant | **Non repris** — on repart de zéro depuis la maquette et les 114 routes documentées |
| Q3 | Arbitrage des divergences §7 | **La maquette d'abord** : le modèle qu'elle nomme gagne ; à fonctionnel égal, celui qui tourne gagne |
| Q4 | Modèle partenaire | **Caduc (17/09)** pour les bornes ; **révisé (18/09)** : le partenaire revient comme **distributeur du Bon d’achat PayEnCash** (art. L521-3 CMF) — jamais comme encaisseur ; **(18/09, soir — CORRIGÉ)** il ne reste que **deux** moyens sans carte, tous deux achetés au comptoir d'un commerce : **Bon d’achat PayEnCash** · **Bon d’achat PayEnCash** . L'agent est supprimé. |
| Q5 | Fournisseur d'hébergement | Découle de Q3 : **Nuitée/LiteAPI** — c'est le nom que portent `ui/assets/payencash-data.js` (`nuiteeCities`) et `hotel_offers.nuitee_hotel_id` |
| Q6 | ~~Remboursement en espèces par l'agent~~ | **TRANCHÉ par disparition (18/09, soir)** — il n'y a plus d'agent et plus d'espèces : un remboursement **re-crédite le Bon d’achat PayEnCash** (`gift_card_movements`), ou passe par un virement au RIB du client. *Résidu à valider par l'avocat : un avoir re-crédité vaut-il remboursement au sens de la rétractation légale de 14 jours ?* |

> **Suite de la décision Q4 (18/09)** : les 8 écrans de `ui/partenaire/` décrivent désormais un commerçant
> **distributeur du Bon d’achat PayEnCash** — aucune borne, aucun encaissement de commande, aucun matériel : un code
> généré et un ticket imprimé. Rien n'est à dessiner avant portage ; ce qui reste, c'est la relecture avocat
> du contrat de distribution (`ESPACE-COMMERCANT/documents/registre-livrables.json`, étape 3).
>
> **Précision du 18/09 au soir** : le **reversement mensuel est abandonné**. La carte bancaire enregistrée du
> commerce est **prélevée à chaque vente**, du montant moins sa commission (1,10 % HT + TVA 20 %), via **Stripe**
> (1,5 % + 0,25 €) ; **un refus de la banque signifie qu'aucun bon d’achat n'est émis**, et la charge reste
> inscrite avec son motif. Le commerçant ne détient donc jamais notre argent, fût-ce un jour. À porter avec le
> domaine : `partner_cards`, `partner_charges`, et la vue `v_partner_monthly_statements` pour l'autofacture de
> commission (art. 289 CGI). **Une question neuve pour le portage, à ne pas oublier** : l'exemption
> d'authentification forte est faite **une fois, à l'enregistrement de la carte** (SetupIntent Stripe) ;
> les prélèvements suivants sont initiés par le marchand — sans cet enregistrement, chaque vente demanderait une authentification du commerçant.

> **(18/09, soir) Une question de plus, qui n'était dans aucune décision du 26/08** : la valeur des bons d’achat
> émis sur **12 mois glissants** doit être comptée, parce qu'au-delà d'**1 M€** une déclaration à l'**ACPR** est
> due (art. L521-3 II CMF). Aucun écran ne la compte aujourd'hui : c'est un manque de couverture, pas un détail
> de conformité.

---

## 11. Couverture — à tenir à jour à chaque lot

| Lot | Périmètre | Écrans couverts | Routes | État |
|---|---|---|---|---|
| 0 | Inventaire | — | — | **fait** (ce document) |
| 1 | Socle : monorepo, tags, frontières, lint prouvé par 13 sondes, `utils`/`contracts`/`backend-commun` | — | — | **fait** — `verif.sh` 5/7, 2 étapes non lançables (aucun front, aucun banc) |
| 1 bis | `libs/ui`, `libs/data-access`, `libs/session` (Angular 22 / Node 22 / TS 6) | — | — | **fait** — 6 bibliothèques taguées, `verif.sh` 5/7, 14 sondes |
| 1 ter | `libs/contracts` — **les 48 enums** (14 `CREATE TYPE` + 34 `CHECK … IN`) promus en source unique, 10 domaines | — | — | **fait** |
| 2 | `svc-auth` + `svc-fichiers` | — | — | à faire |
| 3 | `svc-coeur` | — | — | à faire |
| 4→ | par espace : `api-*` puis son front | **0 / 133** | 0 / 114 | à faire |

**0 écran sur 133 est porté** *(recompté le 18/09 au soir : 133 écrans, pas 113)*. Aucun `api-*` n'existe. Aucun front n'existe.

> **(18/09, soir)** Le lot **1 ter** parle de « **48 enums** (14 `CREATE TYPE` + 34 `CHECK … IN`) » : le schéma
> en compte aujourd'hui **18 `CREATE TYPE` et 100 `CHECK … IN`**. Le lot est marqué « fait » sur le périmètre
> d'août — il devra être **repris** sur le périmètre réel avant le lot 3.

**Écrans ajoutés le 18/09, à porter avec leur domaine** : `partenaire/` (8), `commercial/03` et `09`, `manager/29`, `ecrans/25` — domaine `bons d’achat` (service `server/services/bons`, `lib/bons.js`), tables `partners`, `gift_cards`, `gift_card_movements`, `partner_remittances`, `signature_links`.
