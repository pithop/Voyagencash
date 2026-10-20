/* ══ PAYENCASH — « COMMENT VEUX-TU PAYER ? », PARTAGÉ PAR MODE ET PAR FLY (20/09, soir) ══════════════════
   Décision fondatrice : « revérifie tout le code mort et doublon, supprime-les ; mets à niveau la page
   Comment veux-tu payer sur Fly ». Les deux pages portaient CHACUNE leur copie du chemin des commerces —
   quinze fonctions recopiées, déjà divergentes — et Fly n'avait ni le trio, ni le chemin de l'agent. Une
   troisième copie aurait réglé Fly et aggravé le reste. Le choix vit donc ICI, une fois :
     · le TRIO (en ligne · chez un partenaire · un agent se déplace) et la navigation qui y amène ;
     · CHEZ UN PARTENAIRE — la carte, la recherche, le rayon, la liste, le guidage « M'y rendre » ;
     · UN AGENT SE DÉPLACE — l'adresse de rencontre (carnet, position, recherche), le récap, la modale de
       mise en relation, jusqu'à l'écran de la rencontre ;
     · la modale d'accord de position, et un seul montage de carte pour les deux chemins.
   CE QUI RESTE À LA PAGE : ce qu'on paie (le sac pour Mode, la réservation pour Fly), et le champ du bon
   — chemin ① — qui règle cette chose-là. Le module ne sait pas CE qu'on paie : il demande combien
   (`montantDu`), il dit les refus (`refus`), et il sait où mène une rencontre (`urlRencontre`).
   Le balisage reste dans chaque page, avec les MÊMES identifiants : c'est lui qui déclare les trois volets,
   le module les anime. Rien ici n'est écrit en dur — tout vient de PEC_DATA, PEC_BUS et PEC_GEO.
   (21/09, fondatrice : « la modale qui s'ouvre doit être celle COMMENT PAYER, en sachant que c'est pour la
   boutique connectée » ; « ça doit être toujours la même animation ») ET PAYENCASH SOLUTION AUSSI : la
   page de paiement d'une boutique connectée — son lien comme la fenêtre de son widget — monte CE module, avec
   le réseau de CETTE boutique (`o.reseau`) : ses revendeurs sous contrat, ses bons. Même trio, même carte,
   même recherche, même guidage, même animation. Une troisième copie du choix, c'est ce qui avait eu lieu. ══ */
(function () {
  /* ══ LE BALISAGE DU CHOIX — recopié tel quel de la page de Mode, avec ses commentaires et ses
     identifiants : c'est sur eux que s'appuient la logique ci-dessous, le banc et l'audit. La page ne
     déclare plus que trois points d'accroche (data-pec-ou="trio" · "acheter" · "modales"). ══ */
  var GAB_TRIO = [
    "      <!-- ══ (19/09, soir — décision fondatrice « donc comment vous payer : en ligne, ou chez un partenaire, ou un",
    "           agent se déplace ») LES TROIS CHEMINS, AU PREMIER NIVEAU ═════════════════════════════════════",
    "           La question à poser d'abord n'est pas « quel moyen » mais « OÙ » : c'est ce que disait l'écran d'avant le",
    "           changement de modèle, et c'est ce que le modèle du bon d'achat demande. Le moyen, lui, est",
    "           ou le code d'un bon d'achat déjà en main) vit DANS le chemin « en ligne » ; les deux autres chemins",
    "           mènent à l'achat d'un bon d'achat, au comptoir ou en main propre. -->",
    "      <div class=\"choix2 duo3\" role=\"tablist\" id=\"op-ou\" aria-label=\"Comment veux-tu payer ?\">",
    "        <button type=\"button\" class=\"tap\" id=\"op-ou-enligne\" role=\"tab\" aria-selected=\"true\">",
    "          <span class=\"ic2\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:17px\"><use href=\"#i-smartphone\"/></svg></span>",
    "          <span class=\"txt2\"><b>En ligne</b><small id=\"op-ou-enligne-s\">—</small></span>",
    "        </button>",
    "        <button type=\"button\" class=\"tap\" id=\"op-ou-partenaire\" role=\"tab\" aria-selected=\"false\">",
    "          <span class=\"ic2\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:17px\"><use href=\"#i-store\"/></svg></span>",
    "          <span class=\"txt2\"><b id=\"op-ou-partenaire-t\">—</b><small id=\"op-ou-partenaire-s\">—</small></span>",
    "        </button>",
    "        <button type=\"button\" class=\"tap\" id=\"op-ou-agent\" role=\"tab\" aria-selected=\"false\">",
    "          <span class=\"ic2\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:17px\"><use href=\"#i-map-pin\"/></svg></span>",
    "          <span class=\"txt2\"><b id=\"op-ou-agent-t\">—</b><small id=\"op-ou-agent-s\">—</small></span>",
    "        </button>",
    "      </div>"
  ].join('\n');
  var GAB_ACHETER = [
    "          <!-- (19/09, soir — décision fondatrice « tu dois réintégrer à “comment veux-tu payer” : chez un partenaire",
    "               ou un agent se déplace ») DEUX FAÇONS D'ACHETER SON BON D'ACHAT. Le contrat de distribution est le",
    "               MÊME pour les deux — l'un tient un commerce, l'autre se déplace. Les libellés viennent du référentiel",
    "               (PARTENAIRE_MODES) : le jour où un mode change de nom, l'écran suit. -->",
    "",
    "          <div class=\"pec-card\" id=\"ach-carte-commerce\" style=\"margin-top:12px;padding:14px 16px\">",
    "            <div style=\"font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted)\">Acheter un bon d’achat</div>",
    "            <div style=\"font-size:16px;font-weight:800;letter-spacing:-0.01em;color:var(--color-ink);margin-top:3px\">Les commerces les plus proches</div>",
    "            <!-- (23/09, fondatrice : « pour la modale de paiement, ajoute pour API et lien envoyé … notre réseau accepte",
    "                 espèces, pièces et CB ; ses bons d'achat sont utilisés sur le site de l'émetteur ; une fois utilisé, non",
    "                 remboursable ; pas de possibilité d'utiliser un bon sur un autre site ; réseau limité ») CE QU'IL FAUT",
    "                 SAVOIR, rendu par le RÉSEAU (R.rappel) : la page d'une marque en a un, Mode et Fly non — sans `rappel`,",
    "                 ce bloc est retiré du balisage au montage. -->",
    "            <div class=\"pec-rappel\" id=\"ach-rappel\" hidden></div>",
    "            <!-- (19/09, nuit — décision fondatrice « supprime ce qui est sur la capture ») DEUX PAVÉS DE TEXTE",
    "                 ET UNE CARTE DE MONTANT ONT VÉCU ICI : comment s'achète un bon, ce que vendent les points",
    "                 la somme exacte à demander et l'avertissement « il te faudra plusieurs bons ».",
    "                 Tout cela était vrai et inutile : au comptoir on demande la somme de sa commande, le",
    "                 commerçant découpe tout seul si elle dépasse le plafond, et la fiche de chaque point dit",
    "                 déjà ce qu'on y achète. Un tunnel de paiement se lit en deux secondes, pas en deux minutes. -->",
    "            <p class=\"plaisir\">Fais-toi plaisir — ou fais plaisir à quelqu’un : un bon d’achat s’offre aussi.</p>",
    "",
    "            <div class=\"mapwrap pec-map-canvas\" id=\"ach-mapwrap\" hidden><div id=\"ach-map\" style=\"position:absolute;inset:0\"></div></div>",
    "",
    "            <!-- LE GUIDAGE (19/09, soir) : visible seulement quand un commerce a été choisi, et que la position suit. -->",
    "            <div class=\"navb\" id=\"ach-nav\" hidden>",
    "              <span class=\"dt\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:18px\"><use href=\"#i-map-pin\"/></svg></span>",
    "              <span style=\"flex:1;min-width:0\">",
    "                <span class=\"tt\" id=\"ach-nav-titre\">—</span>",
    "                <span class=\"ss\" id=\"ach-nav-txt\" style=\"display:block\">—</span>",
    "              </span>",
    "              <button type=\"button\" class=\"st tap\" id=\"ach-nav-stop\">Arrêter</button>",
    "            </div>",
    "",
    "            <!-- L'accord de position ne se demande pas par un bouton quand il est connu (règle PEC_GEO) :",
    "                 autoLocaliser part seul. Sinon, on dit D'ABORD à quoi la position sert. -->",
    "            <div class=\"geoask\" id=\"ach-geoask\" hidden>",
    "              <b>Pour te montrer les points de vente les plus proches</b>, on a besoin de ta position — c'est tout ce qu'elle sert ici.",
    "              <span data-geo-retention=\"tu\"></span>",
    "              <button type=\"button\" class=\"pec-btn-secondary tap\" id=\"ach-geook\" style=\"display:block;width:100%;margin-top:9px;font-weight:800\">Autoriser ma position</button>",
    "              <p id=\"ach-geoerr\" hidden style=\"margin:8px 0 0;font-size:11.5px;font-weight:700;color:#8E2A1E\"></p>",
    "            </div>",
    "",
    "            <!-- LE RAYON EN MÈTRES, REPRIS DE L'ÉCRAN D'AVANT (« − 500 m · 1 km · 2 km ») : il ne s'affiche que si",
    "                 l'on sait d'où mesurer — sans position, un rayon ne veut rien dire. -->",
    "            <!-- (19/09, soir) LA RECHERCHE ET LES VILLES, REPRISES DE L'ÉCRAN D'AVANT LE CHANGEMENT DE MODÈLE :",
    "                 chercher autour de soi est le défaut, mais on peut chercher PAR VILLE (on prépare un déplacement)",
    "                 ou par nom. Dès qu'une ville ou une recherche est active, le rayon ne bride plus : on regarde",
    "                 CETTE ville, pas un cercle autour de soi — c'était déjà la règle, elle revient avec. -->",
    "            <input class=\"pec-input\" id=\"ach-q\" type=\"search\" placeholder=\"Chercher un commerce ou une ville…\" style=\"width:100%;height:34px;padding:0 12px;font-size:12px;margin-top:10px\">",
    "            <div id=\"ach-villes\" style=\"display:flex;gap:6px;flex-wrap:wrap;margin-top:8px\"></div>",
    "            <div class=\"seclbl\" id=\"ach-rayon-l\" hidden style=\"display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px\">",
    "              <b id=\"ach-rayon-txt\" style=\"font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--color-muted)\">—</b>",
    "              <span id=\"ach-rayon\" style=\"display:flex;gap:6px\">",
    "                <button type=\"button\" class=\"pec-pill tap\" data-km=\"500\" aria-pressed=\"false\">− 500 m</button>",
    "                <button type=\"button\" class=\"pec-pill tap\" data-km=\"1000\" aria-pressed=\"false\">1 km</button>",
    "                <button type=\"button\" class=\"pec-pill pec-pill--done tap\" data-km=\"2000\" aria-pressed=\"true\">2 km</button>",
    "              </span>",
    "            </div>",
    "            <div id=\"ach-liste\" style=\"margin-top:8px\"></div>",
    "            <div class=\"vide\" id=\"ach-vide\" hidden>—</div>",
    "            <p id=\"ach-note\" hidden style=\"margin:8px 0 0;font-size:10.5px;line-height:1.5;color:var(--color-muted)\">Distances à vol d'oiseau depuis ta position · <span data-geo-retention=\"tu\"></span></p>",
    "          </div>",
    "          <a class=\"ptcard tap\" id=\"bon-ou-acheter\" href=\"../ecrans/25-ou-acheter-un-bon.html\" style=\"margin-top:10px\">",
    "            <span class=\"ic\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:19px\"><use href=\"#i-map-pin\"/></svg></span>",
    "            <span class=\"mid\"><span class=\"lblc\">La liste complète, les filtres, la recherche</span><span class=\"valc\">Voir tous les commerces qui vendent le Bon d’achat</span></span>",
    "            <span class=\"chev\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-chevron-right\"/></svg></span>",
    "          </a>",
    "",
    "          <!-- L'AGENT QUI SE DÉPLACE — le client dit OÙ et pour combien, un distributeur mobile de la zone prend",
    "               la demande. (20/09) L'endroit est une ADRESSE, celle du compte par défaut : il n'y a plus de choix",
    "               entre « chez moi » et « un lieu public », parce que dans les deux cas il vient à un endroit qui",
    "               s'écrit pareil — et c'est le client qui dit lequel. -->",
    "          <div class=\"pec-card\" id=\"ach-carte-agent\" hidden style=\"margin-top:12px;padding:14px 16px\">",
    "            <div style=\"font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted)\">Un agent se déplace</div>",
    "            <!-- (20/09, fondatrice : « c'est trop redondant, beaucoup de double information ») LE SOUS-TITRE",
    "                 DU VOLET A ÉTÉ SUPPRIMÉ : il recopiait mot pour mot le sous-titre de la carte « Un agent se",
    "                 déplace », à trois centimètres au-dessus. Le titre reste — lui dit COMBIEN de bons. -->",
    "            <div style=\"font-size:16px;font-weight:800;letter-spacing:-0.01em;color:var(--color-ink);margin-top:3px\" id=\"agt-titre\">—</div>",
    "",
    "            <div id=\"agt-encours\" hidden class=\"pec-mint-banner\" style=\"margin-top:10px;font-size:12.5px;line-height:1.5\"></div>",
    "            <!-- (19/09, soir — « vérifie que l'agent apparaît bien sur une carte ») LA CARTE DE LA RENCONTRE : le",
    "                 point de rendez-vous, et l'agent dès qu'il partage sa position. Même montage que la carte des",
    "                 commerces (MapLibre, init paresseuse, conteneur visible exigé). -->",
    "            <div class=\"mapwrap pec-map-canvas\" id=\"agt-mapwrap\" hidden><div id=\"agt-map\" style=\"position:absolute;inset:0\"></div></div>",
    "            <!-- (19/09, nuit) LA LÉGENDE DU POINT : précis (position partagée) ou approché (centre de la ville).",
    "                 On ne laisse jamais croire à un point pointé au mètre près quand c'est un centre-ville. -->",
    "            <p id=\"agt-pt\" hidden style=\"margin:7px 0 0;font-size:11px;line-height:1.5;color:var(--color-muted)\"></p>",
    "            <!-- (20/09) L'ENCART QUI RÉCLAMAIT LA POSITION EST PARTI AVEC LE LIEU PUBLIC. Le rendez-vous se pose",
    "                 désormais à une ADRESSE, jamais là où se trouve le téléphone : demander la position à l'arrivée",
    "                 sur ce volet, c'était demander pour rien. Elle se demande au moment où elle sert vraiment —",
    "                 quand la cliente touche « Utiliser ma position » pour remplir son adresse — et la modale",
    "                 d'accord s'ouvre alors, avant la question du navigateur. -->",
    "",
    "            <div id=\"agt-form\">",
    "              <!-- ══ (20/09, décision fondatrice : « pour agent enlève CHEZ MOI, uniquement ADRESSE DE RENCONTRE,",
    "                   par défaut l'adresse de compte de l'utilisateur ; il peut changer par SA POSITION ou une ADRESSE",
    "                   SAISIE — numéro de rue, rue, code postal, ville ; attention récupère le nom des rues ; ET JE NE",
    "                   VOIS PAS ») UNE SEULE ADRESSE, ENTIÈREMENT À L'ÉCRAN ═══════════════════════════════════════════",
    "                   Le duo « Chez moi / Un lieu public » posait une question qui n'en était pas une : dans les deux",
    "                   cas le distributeur vient à un ENDROIT, et cet endroit s'écrit pareil — numéro, voie, code",
    "                   postal, commune. Il ne reste donc qu'un bloc, servi d'office avec l'adresse du compte.",
    "                   Et il n'y a plus rien à déplier pour en changer : la recherche d'adresse et « ma position »",
    "                   sont ouvertes dès l'arrivée. Elles vivaient derrière « Changer » puis « ＋ Nouvelle adresse » :",
    "                   deux clics, et la fondatrice ne les voyait pas. ══ -->",
    "              <div id=\"adr-bloc\" style=\"margin-top:12px\">",
    "                <div style=\"font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted)\">Adresse de rencontre <span class=\"req\">· requis</span></div>",
    "                <p class=\"aide\" id=\"adr-quoi\" style=\"margin:5px 0 0\">—</p>",
    "                <!-- LE CARNET DU COMPTE — une pastille par adresse enregistrée, plus « une autre adresse ». Les",
    "                     libellés de type viennent du data-layer (ADRESSE_TYPES) : l'écran n'écrit pas « Domicile ». -->",
    "                <div id=\"lieux\" style=\"display:flex;gap:7px;flex-wrap:wrap;margin-top:9px\"></div>",
    "                <!-- (20/09, soir — fondatrice : « quand “un mot pour…” est séparé de la section, d'un coup le",
    "                     design change ») LE FORMULAIRE N'EST PLUS UNE CARTE DANS LA CARTE. Encadré et décalé, il",
    "                     cassait l'alignement : les champs de l'adresse ne tombaient pas sur la même colonne que",
    "                     « Quand ? », « Un mot pour cette rencontre » et le montant, et l'œil lisait deux écrans",
    "                     cousus. Un simple filet le sépare désormais, à la même marge que tout le reste. -->",
    "                <div id=\"dom-form\" style=\"border-top:1px solid var(--color-sep);padding-top:12px;margin-top:11px\">",
    "                  <!-- ① MA POSITION — et elle rapporte le NUMÉRO ET LE NOM DE LA RUE (reverse de la Base Adresse",
    "                       Nationale), pas des degrés décimaux : c'est ce qui la rend utilisable dans un formulaire. -->",
    "                  <button type=\"button\" id=\"df-geoloc\" class=\"pec-btn-secondary tap\" style=\"display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-bottom:9px;font-weight:800\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:16px\"><use href=\"#i-locate\"/></svg> <span id=\"df-geoloc-txt\">Utiliser ma position</span></button>",
    "                  <!-- ② OU JE LA CHERCHE — Base Adresse Nationale : la suggestion choisie remplit les quatre",
    "                       champs ET arrive géolocalisée, c'est ce qui permet au distributeur d'être guidé. Les",
    "                       champs restent dessous, pour corriger ou tout saisir à la main. -->",
    "                  <label class=\"pec-input-label\" for=\"df-q\">Ou cherche une autre adresse</label>",
    "                  <div style=\"position:relative;margin-bottom:9px\">",
    "                    <input class=\"pec-input\" id=\"df-q\" type=\"search\" autocomplete=\"off\" placeholder=\"Numéro et rue, puis la commune…\" style=\"width:100%\">",
    "                  </div>",
    "                  <p id=\"df-q-aide\" style=\"margin:-4px 0 10px;font-size:10.5px;line-height:1.45;color:var(--color-muted)\">Choisis une suggestion : le numéro, la voie, le code postal, la commune et la position se remplissent tout seuls. Tu peux aussi tout saisir à la main.</p>",
    "                  <div style=\"display:flex;gap:7px;margin-bottom:8px\">",
    "                    <input class=\"pec-input\" id=\"df-numero\" type=\"text\" inputmode=\"numeric\" aria-label=\"Numéro de voie\" placeholder=\"N°\" style=\"flex:0 0 64px;min-width:0\">",
    "                    <input class=\"pec-input\" id=\"df-voie\" type=\"text\" aria-label=\"Voie\" placeholder=\"Voie (rue, avenue, quai…)\" style=\"flex:1;min-width:0\">",
    "                  </div>",
    "                  <div style=\"display:flex;gap:7px;margin-bottom:9px\">",
    "                    <input class=\"pec-input\" id=\"df-cp\" type=\"text\" inputmode=\"numeric\" maxlength=\"5\" aria-label=\"Code postal\" placeholder=\"Code postal\" style=\"flex:0 0 96px;min-width:0\">",
    "                    <input class=\"pec-input\" id=\"df-ville\" type=\"text\" aria-label=\"Commune\" placeholder=\"Commune\" style=\"flex:1;min-width:0\">",
    "                  </div>",
    "                  <p id=\"df-err\" hidden style=\"margin:0 0 9px;font-size:11px;font-weight:700;color:#8E2A1E\"></p>",
    "                  <!-- ③ LES PRÉCISIONS D'ACCÈS, PAR ADRESSE (fondatrice 20/09 : « pour chaque il peut ajouter des",
    "                       précisions, si portail, étage etc. ») : elles restent attachées à CETTE adresse et",
    "                       repartent à chaque rencontre — on ne les retape pas tous les mois. -->",
    "                  <div style=\"font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--color-muted);margin-bottom:7px\">Précisions d'accès <span class=\"opt\">· facultatif</span></div>",
    "                  <div style=\"display:flex;gap:7px;margin-bottom:8px\">",
    "                    <input class=\"pec-input\" id=\"df-etage\" type=\"text\" aria-label=\"Étage\" placeholder=\"Étage\" style=\"flex:1;min-width:0\">",
    "                    <input class=\"pec-input\" id=\"df-porte\" type=\"text\" aria-label=\"Porte ou interphone\" placeholder=\"Porte / interphone\" style=\"flex:1.5;min-width:0\">",
    "                  </div>",
    "                  <!-- (20/09) « Il lira : étage 2 » a été supprimé : les champs sont À L'ÉCRAN, juste au-dessus.",
    "                       La phrase garde son sens dans le Compte, où la liste ne montre pas les champs. -->",
    "                  <input class=\"pec-input\" id=\"df-instructions\" type=\"text\" aria-label=\"Instructions d'accès\" placeholder=\"Portail, cour, bâtiment, digicode…\" style=\"width:100%\">",
    "                  <!-- ④ (20/09, soir — fondatrice : « il y a doublon sur adresse, deux fois Travail, Domicile",
    "                       etc. ») LE TYPE NE SE CHOISIT PLUS EN PASTILLES. Deux rangées de pastilles identiques se",
    "                       suivaient — celles du CARNET (quelle adresse) et celles du TYPE (comment la ranger) — et",
    "                       les mêmes mots y figuraient deux fois. Le type n'est pas un choix de parcours : c'est une",
    "                       étiquette de rangement. Il descend donc en bas du formulaire, dans un menu, où il ne",
    "                       ressemble plus à rien d'autre. Les options viennent du data-layer (ADRESSE_TYPES). -->",
    "                  <label class=\"pec-input-label\" for=\"df-type\" style=\"margin-top:10px\">Ranger cette adresse comme</label>",
    "                  <select class=\"pec-input\" id=\"df-type\" style=\"width:100%\"></select>",
    "                </div>",
    "              </div>",
    "              <!-- (20/09, soir — décision fondatrice : « le choix d'horaire est illogique CAR LES COMMANDES",
    "                   SONT BLOQUÉES, enlève ça ») IL N'Y A PLUS D'HEURE À CHOISIR. La commande est verrouillée le",
    "                   temps de la fenêtre d'encaissement : proposer « demain 9 h 30 » à quelqu'un dont la commande",
    "                   expire dans deux heures, c'est lui faire choisir un rendez-vous qui n'aura pas lieu. Le",
    "                   rendez-vous se tient DANS la fenêtre, et c'est elle que l'écran annonce (`agt-dispo`). -->",
    "              <!-- LE MOT DU JOUR — distinct des précisions d'accès ci-dessus : celles-là valent à chaque fois,",
    "                   celui-ci ne vaut que pour CETTE rencontre. Le data-layer les porte séparément (`note`). -->",
    "              <div class=\"frow\" style=\"margin-top:8px\"><label class=\"pec-input-label\" for=\"agt-note\">Un mot pour cette rencontre <span class=\"opt\">· facultatif</span></label>",
    "                <input class=\"pec-input\" id=\"agt-note\" type=\"text\" autocomplete=\"off\" maxlength=\"200\" aria-describedby=\"agt-note-aide\" placeholder=\"je suis en terrasse, veste rouge…\">",
    "                <p class=\"aide\" id=\"agt-note-aide\">Ce qui change aujourd'hui seulement — l'étage et la porte sont déjà dans l'adresse.</p></div>",
    "              <!-- (20/09, soir — fondatrice : « dans agent, REGROUPE LE TEXTE … avec la capture d'écran »)",
    "                   CE QU'IL Y A À SAVOIR AVANT DE DEMANDER TIENT DANS UNE CARTE. Trois paragraphes se",
    "                   suivaient à des tailles et des couleurs différentes — le montant, la disponibilité, la",
    "                   mention du contrat — et l'œil ne voyait pas qu'ils répondaient à la même question. Ils",
    "                   prennent la forme des règles du bas de page : une icône, une ligne, un filet. -->",
    "              <div class=\"pec-card\" id=\"agt-recap\" style=\"margin-top:12px;padding:4px 14px\">",
    "                <div class=\"agt-lig\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-receipt\"/></svg><span id=\"agt-montant\">—</span></div>",
    "                <div class=\"agt-lig\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-map-pin\"/></svg><span id=\"agt-dispo\">—</span></div>",
    "                <div class=\"agt-lig\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-shield\"/></svg><span id=\"agt-garantie\">Il te vend un <b style=\"color:var(--color-ink)\">bon d’achat</b> ; il n'encaisse pas ta commande.</span></div>",
    "              </div>",
    "              <p id=\"agt-erreur\" hidden style=\"margin:8px 0 0;font-size:12px;font-weight:700;line-height:1.5;color:#8E2A1E\"></p>",
    "              <button type=\"button\" class=\"pec-cta tap\" id=\"agt-demander\" style=\"display:block;width:100%;text-align:center;margin-top:11px\">Rechercher un agent</button>",
    "            </div>",
    "            <div id=\"agt-liste\" style=\"margin-top:10px\"></div>",
    "          </div>"
  ].join('\n');
  var GAB_MODALES = [
    "  <!-- (19/09, nuit) LA MODALE D'ACCORD DE POSITION — elle ne s'affiche QUE si la question n'a jamais été",
    "       posée, et jamais deux fois. Accord déjà donné : la localisation part seule, sans rien demander. -->",
    "  <div class=\"scrim\" id=\"geopop\" hidden>",
    "    <div class=\"popup\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"geopop-t\">",
    "      <span class=\"pic\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:22px\"><use href=\"#i-locate\"/></svg></span>",
    "      <h3 id=\"geopop-t\">Autoriser PayEnCash à utiliser ta position ?</h3>",
    "      <p id=\"geopop-p\">—</p>",
    "      <button type=\"button\" class=\"allow tap\" id=\"geopop-ok\">Autoriser ma position</button>",
    "      <button type=\"button\" class=\"deny tap\" id=\"geopop-non\">Continuer sans — je saisis une adresse</button>",
    "      <p class=\"err\" id=\"geopop-err\" hidden></p>",
    "    </div>",
    "  </div>",
    "",
    "  <!-- ══ (19/09, nuit — « ça doit mettre en relation et un appel pour confirmer ») LA MISE EN RELATION ═════",
    "       Reprise de l'écran d'avant le changement de modèle : avant d'envoyer la demande aux distributeurs, on",
    "       dit ce qui va se passer, on MONTRE le numéro qu'on va appeler (celui du compte, qu'elle peut corriger),",
    "       on lui laisse choisir le canal, et on ne part qu'avec son accord. Le distributeur ne bouge qu'après",
    "       l'appel : c'est la règle, pour elle comme pour lui. -->",
    "  <div class=\"scrim\" id=\"rdvpop\" hidden>",
    "    <div class=\"popup lg\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"rdvpop-t\">",
    "      <span class=\"pic\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\" style=\"font-size:22px\"><use href=\"#i-headset\"/></svg></span>",
    "      <h3 id=\"rdvpop-t\">On te met en relation</h3>",
    "      <p id=\"rdvpop-p\">—</p>",
    "      <div class=\"recap\" id=\"rdvpop-recap\">—</div>",
    "      <div class=\"tel\" id=\"rdvpop-tel-compte\">",
    "        <div class=\"k\">On t'appelle sur le numéro de ton compte</div>",
    "        <div style=\"display:flex;align-items:center;gap:8px;margin-top:5px\">",
    "          <span class=\"v\" id=\"rdvpop-tel\">—</span>",
    "          <span class=\"pec-pill pec-pill--done\" style=\"font-size:9.5px;padding:2px 8px\">Vérifié</span>",
    "        </div>",
    "        <a href=\"../ecrans/10-compte.html\" class=\"tap\" style=\"display:inline-block;margin-top:4px;font-size:11px;font-weight:800;color:var(--color-primary-dark);text-decoration:none\">Ce n'est pas le bon numéro ?</a>",
    "      </div>",
    "      <!-- (21/09) SANS COMPTE, LE NUMÉRO SE LAISSE ICI — sur la page d'une boutique, personne n'a de compte chez nous. -->",
    "      <div class=\"tel\" id=\"rdvpop-tel-saisie\" hidden>",
    "        <label class=\"k\" for=\"rdvpop-tel-in\">Le numéro où il t'appelle</label>",
    "        <input class=\"pec-input\" id=\"rdvpop-tel-in\" type=\"tel\" inputmode=\"tel\" autocomplete=\"tel\" placeholder=\"06 12 34 56 78\" style=\"width:100%;margin-top:6px;background:var(--color-card)\">",
    "      </div>",
    "      <p class=\"pec-section-label\" style=\"margin:12px 0 0\">Comment préfères-tu être contacté·e ?</p>",
    "      <div class=\"canaux\" id=\"rdvpop-canaux\">",
    "        <button type=\"button\" class=\"tap\" data-canal=\"appel\" aria-pressed=\"true\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-phone\"/></svg><span>Appel</span></button>",
    "        <button type=\"button\" class=\"tap\" data-canal=\"whatsapp\" aria-pressed=\"false\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-chat\"/></svg><span>WhatsApp</span></button>",
    "        <button type=\"button\" class=\"tap\" data-canal=\"facetime\" aria-pressed=\"false\"><svg class=\"pec-ico\" viewBox=\"0 0 24 24\"><use href=\"#i-headset\"/></svg><span>Visio</span></button>",
    "      </div>",
    "      <label class=\"rgpdrow\" for=\"rdvpop-rgpd\">",
    "        <input type=\"checkbox\" id=\"rdvpop-rgpd\">",
    "        <span id=\"rdvpop-rgpd-txt\">—</span>",
    "      </label>",
    "      <p class=\"err\" id=\"rdvpop-err\" hidden></p>",
    "      <button type=\"button\" class=\"allow tap\" id=\"rdvpop-ok\" style=\"margin-top:12px;opacity:.45\" aria-disabled=\"true\">J'ai compris — appelez-moi</button>",
    "      <button type=\"button\" class=\"deny tap\" id=\"rdvpop-non\">Revenir en arrière</button>",
    "    </div>",
    "  </div>"
  ].join('\n');

  /* POSER LE BALISAGE AVANT D'Y BRANCHER QUOI QUE CE SOIT. Un point d'accroche absent n'est pas une
     erreur : une page peut ne vouloir que certains volets. */
  function poser() {
    var t = document.querySelector('[data-pec-ou="trio"]'); if (t) t.outerHTML = GAB_TRIO;
    var a = document.querySelector('[data-pec-ou="acheter"]'); if (a) a.innerHTML = GAB_ACHETER;
    var p = document.querySelector('[data-pec-ou="modales"]'); if (p) p.outerHTML = GAB_MODALES;
  }
  window.PEC_OU = {
    /* o.montantDu()      → { cents, … } : ce qui reste à régler (la page sait ce qu'elle vend)
       o.refus(msg)       → affiche un refus dans le bandeau de la page
       o.urlRencontre(id) → l'adresse de l'écran de la rencontre, vue depuis CETTE page
       o.reseau           → le réseau dont on montre les points (défaut : le Bon d'achat PayEnCash, ci-dessous)
       o.champBon         → les identifiants du champ du bon de la page, où « Régler maintenant » porte un code
       o.utiliserCode(c)  → (réseau d'une marque, 23/09) la page n'a pas de champ : un bon de marque s'utilise depuis
                            l'app Mes bons, et c'est elle qu'on ouvre avec le code remis par le mandataire */
    monter: function (o) {
      o = o || {};
      var D = window.PEC_DATA, B = window.PEC_BUS;
      var esc = function (v) { return D.esc ? D.esc(v) : String(v == null ? '' : v); };
      /* ══ (21/09) LE RÉSEAU — celui du Bon d'achat PayEnCash par défaut (Mode, Fly). Une page PayEnCash
         Solution passe celui de LA BOUTIQUE connectée (PEC_TECH.reseauOu) : ses revendeurs sous contrat,
         ses bons. Ce qui change tient ici ; le choix, la carte, la recherche, le rayon, le guidage et
         l'animation ne changent pas.
           points(opts)        → même contrat que pointsBons ({ pos, rayon, q, ville })
           listeComplete       → l'adresse de la liste de référence de ces points, ou null s'il n'y en a pas
           videTxt(filtre)     → ce qu'on dit (HTML échappé) quand personne ne vend ici
           trio()              → { enligne, partenaire: { t, s }, agent: { t, s } } — les trois s'ouvrent toujours
           rencontre           → s'il est donné, la rencontre de CE réseau (sans compte, sans hôte : voir
                                 PEC_TECH.reseauOu) ; sinon c'est la demande PayEnCash — le carnet du compte,
                                 la hotline qui confirme, et l'écran de la rencontre (25-rencontre).
         Le volet de l'agent est le MÊME dans les deux cas : la carte du point de rendez-vous, l'adresse (ma
         position, la recherche, les champs), le mot du jour, le récap, puis la mise en relation. ══ */
      var R = o.reseau || {
        points: function (opts) { return D.pointsBons ? D.pointsBons(opts) : []; },
        listeComplete: '../ecrans/25-ou-acheter-un-bon.html',
        videTxt: function (filtre) {
          var autres = D.moyensPaiement ? D.moyensPaiement().filter(function (m) { return m.k !== 'bon'; }).map(function (m) { return D.libelleMoyen(m.k); }) : [];
          /* (23/09, fondatrice : « enlève "payer sans carte" de partout ») on nomme les moyens, on ne promet rien. */
          return '<b>Aucun point de vente ici</b>' + (filtre ? ' pour cette recherche — élargis le rayon, ou efface le filtre.' : ' — le réseau ouvre ville par ville. Pour régler cette commande tout de suite : ' + (autres.length ? esc(autres.join(' ou ')) : 'les autres moyens ci-dessus') + '.');
        },
        trio: function () {
          var M2 = D.PARTENAIRE_MODES || {};
          /* (23/09) PLUS DE TARIF ANNONCÉ SUR LA CARTE. Il n'y a plus de prix de réseau : chaque commissionnaire
             propose le sien, et le client choisit. Annoncer « dès X € » ici reviendrait à afficher un tarif que
             nous ne fixons pas — et, vu du droit, à le fixer quand même. On dit donc ce qui est vrai : aller chez
             un commerçant ne coûte rien, et un déplacement se négocie. */
          return {
            enligne: 'Tu as déjà ton bon d’achat : saisis son code, tout de suite.',
            partenaire: { t: (M2.sedentaire || {}).clientLbl || 'Chez un partenaire', s: ((M2.sedentaire || {}).clientAide || '') + ' Aucun déplacement à payer.', dispo: true },
            agent: { t: (M2.mobile || {}).clientLbl || 'Un agent se déplace', s: ((M2.mobile || {}).clientAide || '') + ' Chacun propose son tarif de déplacement, tu choisis.', dispo: true }
          };
        },
        rencontre: null
      };
      poser();
      /* SANS COMPTE, PAS DE CARNET : sur la page d'une boutique, les pastilles d'adresses et « Ranger cette adresse
         comme » serviraient le carnet d'un compte PayEnCash — qui n'a rien à y faire, et qu'on y aurait montré. On
         les retire ; l'adresse se relève de la position, se cherche, ou se tape, comme sur Mode. */
      if (R.rencontre) {
        ['lieux', 'adr-quoi', 'df-type'].forEach(function (id) { var n = document.getElementById(id); if (n) n.remove(); });
        var lt = document.querySelector('label[for="df-type"]'); if (lt) lt.remove();
      }
      /* (23/09) LE RAPPEL DU RÉSEAU N'EXISTE QUE SI LE RÉSEAU EN A UN (PEC_TECH.reseauOu → rappel) : sur Mode et Fly le
         bloc est RETIRÉ, pas caché — un balisage vide finit toujours par s'afficher un jour. */
      if (!R.rappel) { var zr0 = document.getElementById('ach-rappel'); if (zr0) zr0.remove(); }
      var $ = function (id) { return document.getElementById(id); };
      var cid = function () { return (D.clientActifGet && D.clientActifGet()) || null; };
      var montantDu = o.montantDu || function () { return { cents: 0 }; };
      var refus = o.refus || function () {};
      var urlRencontre = o.urlRencontre || function (id) { return '25-rencontre.html?rdv=' + encodeURIComponent(id); };

    /* ══ (18/09, soir) LE VOLET DU BON D’ACHAT — CHEMIN ② « JE VEUX EN ACHETER » : LA CARTE GÉOGRAPHIQUE ═══════════════════
       Décision fondatrice : « si je veux utiliser un bon d’achat OU L'ACHETER : principe de la carte géographique, liste des
       partenaires, distance ». Ici, les TROIS plus proches (un tunnel de paiement n'est pas un annuaire) ; la liste
       complète, les filtres de rayon et la recherche vivent sur ecrans/25, page de référence.
       LA DISTANCE VIENT DU DATA-LAYER : `pointsBons({pos})` rend distM / distTxt / pied et trie, exactement comme
       `pointsBons({pos})` — quatre pages la recalculaient chacune à sa façon jusqu'au 18/09 au soir. */
      /* (18/09, soir) LE TEMPS À PIED EST CALCULÉ PAR `D.fmtPied` : il rend une chaîne vide au-delà d'une marche
         raisonnable (« 327 min à pied » pour 26 km était vrai, calculé, et ridicule). Le seuil est une donnée du
         référentiel, plus un chiffre recopié dans quatre pages. */
      function achPied(p) { return p.pied ? (' · ' + p.pied) : ''; }
    var ACH_MAX = 3;                               // combien de commerces tiennent dans un volet de paiement (donnée de la page)
    var achRayon = 2000;   // (19/09, soir) − 500 m · 1 km · 2 km — le défaut de l'écran d'avant
    var achQ = '', achVille = '';   // (19/09, soir) chercher par nom, ou par ville — repris de l'écran d'avant
    var achPos = null, achMap = null, achMkUser = null, achMkPts = {}, achVu = null, achPeint = false;
    var achSuivi = null, achCible = null;          // (19/09, soir) le guidage : la montre de position, et le commerce visé
    // combien de points la LISTE DE RÉFÉRENCE montrerait — zéro quand le réseau n'en a pas : pas de lien vers rien
    function achNbBon() { return R.listeComplete ? R.points({}).length : 0; }
    function achPoints() {
      /* (18/09, soir) LA DISTANCE VIENT DU DATA-LAYER. Elle se recalculait ici, et dans trois autres pages, chacune
         à sa façon : `pointsBons({pos})` rend distM / distTxt / pied et trie, pour tout le monde.
         Un commerce sans géoposition saisie est placé au centre de sa ville et le dit (`geoApprox`). */
      /* (19/09, soir) LE RAYON EN MÈTRES, repris de l'écran d'avant le changement de modèle : il ne s'applique
         que si l'on sait d'où mesurer — c'est le data-layer qui tranche (pointsBons), pas l'écran. */
      var o = achPos ? { pos: achPos, rayon: achRayon } : {};
      if (achQ) o.q = achQ;
      if (achVille) o.ville = achVille;
      return R.points(o);
    }
    /* LA CARTE — montage éprouvé (fly/04-itineraire-point, 28/08 puis 04/09) : init PARESSEUSE (MapLibre exige un
       conteneur visible — ce volet est masqué à l'ouverture de la page), bounds étendu point par point (un tableau
       mal ordonné donne une carte monde), canvas masqué tant que les tuiles n'ont pas chargé (WebGL peint BLANC
       par-dessus le fond CSS .pec-map-canvas), bandeau « carte indisponible » au bout de 4 s. */
    /* ══ (20/09, soir — décision fondatrice : « pourquoi la carte de “chez un partenaire” et celle de “un agent
       se déplace” sont différentes ?? UTILISE LA CARTE DE CHEZ UN PARTENAIRE, ELLE EST PLUS PRÉCISE »)
       UN SEUL MONTAGE DE CARTE ═══════════════════════════════════════════════════════════════════════════
       Les deux volets montaient la leur chacun de son côté. Même fond, mêmes marqueurs — mais une seule
       savait attendre les tuiles avant de dévoiler la toile, et DIRE « carte indisponible » au bout de quatre
       secondes ; l'autre laissait un cadre gris, sans un mot, qu'on prenait pour une carte vide. Ce n'était
       pas un choix, c'était deux codes. Le montage vit ici, une fois, et les deux volets l'appellent. ══ */
    /* (21/09) LE MONTAGE DE CARTE VIT DANS LE SOCLE (PEC_GEO.carte), pour les quatre écrans qui en ont une : le
       module avait le sien depuis le 20/09 au soir — et trois autres écrans, leur copie. */
    function achCarte(pts) {
      var wrap = $('ach-mapwrap');
      if (!pts.length) { wrap.hidden = true; return; }
      wrap.hidden = false;
      if (typeof maplibregl === 'undefined') return;
      var centre = achPos || pts[0].geo || D.posReference;
      if (!achMap) achMap = PEC_GEO.carte('ach-map', { centre: centre, zoom: 13, cadre: wrap });
      else achMap.resize();                       // le volet vient de s'ouvrir : le conteneur a enfin une taille
      if (!achMap) return;                        // pas de carte sur ce navigateur : le bandeau le dit, la liste reste
      if (achPos) {
        if (!achMkUser) { var u = document.createElement('div'); u.className = 'mk-user'; achMkUser = new maplibregl.Marker({ element: u }).setLngLat([achPos.lng, achPos.lat]).addTo(achMap); }
        else achMkUser.setLngLat([achPos.lng, achPos.lat]);
        // la pastille RESPIRE tant que la position suit : on distingue à l'œil un relevé vivant d'un relevé figé
        if (achMkUser.getElement) achMkUser.getElement().classList.toggle('live', !!achSuivi);
      }
      Object.keys(achMkPts).forEach(function (id) { if (!pts.some(function (p) { return p.id === id; })) { achMkPts[id].remove(); delete achMkPts[id]; } });
      pts.forEach(function (p) {
        if (!p.geo) return;
        if (!achMkPts[p.id]) {
          var el = document.createElement('div'); el.className = 'mk-pt';
          el.innerHTML = '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-map-pin"/></svg>' + esc(p.enseigne);
          el.addEventListener('click', function () { achVu = p.id; achListe(); var f = document.querySelector('[data-cmz="' + p.id + '"]'); if (f) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
          achMkPts[p.id] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.geo.lng, p.geo.lat]).addTo(achMap);
        } else achMkPts[p.id].setLngLat([p.geo.lng, p.geo.lat]);
      });
      /* EN GUIDAGE, LA CAMÉRA APPARTIENT AU TRAJET : cadrer les trois commerces à chaque pas ramènerait sans cesse
         la vue en arrière. `achNav` s'en charge, et ne bouge que si l'on sort du cadre. */
      if (achCible) { achNav(); return; }
      var avecGeo = pts.filter(function (p) { return p.geo; });
      if (!avecGeo.length && !achPos) return;
      var d0 = achPos ? [achPos.lng, achPos.lat] : [avecGeo[0].geo.lng, avecGeo[0].geo.lat];
      var bb = new maplibregl.LngLatBounds(d0, d0);
      avecGeo.forEach(function (p) { bb.extend([p.geo.lng, p.geo.lat]); });
      achMap.fitBounds(bb, { padding: { top: 40, bottom: 40, left: 34, right: 52 }, maxZoom: 15.5, duration: document.hidden ? 0 : 400 });
    }
    /* ══ LE GUIDAGE (19/09, soir) — « la carte comme Uber où on avance en direction du partenaire » ══════════
       Ce qu'on fait : une position QUI SUIT (PEC_GEO.suivre, pas un relevé unique), un trait vers le commerce visé,
       la distance et les paliers qui se recalculent à chaque pas.
       Ce qu'on NE fait PAS, et qu'on ne laisse pas croire : un itinéraire de navigation. Le trait est une DIRECTION
       à vol d'oiseau — nous n'avons pas de moteur de calcul de trajet, et afficher un chemin qui passerait à
       travers un immeuble serait un mensonge poli. La liste et le bandeau le disent. ══ */
    function achCouleurTrait() {
      var c = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
      return (c && c.trim()) || '#10a06a';
    }
    function achTrace(cible) {
      if (!achMap || typeof maplibregl === 'undefined') return;
      if (!achMap.isStyleLoaded()) { achMap.once('load', function () { achTrace(cible); }); return; }
      var coords = (achPos && cible && cible.geo) ? [[achPos.lng, achPos.lat], [cible.geo.lng, cible.geo.lat]] : [];
      var gj = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
      var src = achMap.getSource('ach-cap');
      if (src) { src.setData(gj); return; }
      if (!coords.length) return;                  // rien à tracer : on ne crée pas une couche vide
      achMap.addSource('ach-cap', { type: 'geojson', data: gj });
      achMap.addLayer({ id: 'ach-cap', type: 'line', source: 'ach-cap', layout: { 'line-cap': 'round' },
        paint: { 'line-color': achCouleurTrait(), 'line-width': 4, 'line-dasharray': [1.4, 1.4], 'line-opacity': .85 } });
    }
    /* LA CAMÉRA NE SE REJOUE PAS À CHAQUE PAS : un fitBounds par relevé GPS donne une carte qui tressaute et qu'on
       ne peut plus manipuler à la main. Elle ne recadre que si l'un des deux points est SORTI du cadre. */
    function achCadrer(cible) {
      if (!achMap || !achPos || !cible || !cible.geo || typeof maplibregl === 'undefined') return;
      if (achMap.isMoving && achMap.isMoving()) return;   // ni pendant sa propre animation, ni pendant que la cliente déplace la carte
      var b = achMap.getBounds();
      if (b && b.contains([achPos.lng, achPos.lat]) && b.contains([cible.geo.lng, cible.geo.lat])) return;
      var bb = new maplibregl.LngLatBounds([achPos.lng, achPos.lat], [achPos.lng, achPos.lat]);
      bb.extend([cible.geo.lng, cible.geo.lat]);
      // marge large à gauche et à droite : l'étiquette d'une épingle déborde de son ancre et se faisait couper au bord
      achMap.fitBounds(bb, { padding: { top: 46, bottom: 46, left: 66, right: 66 }, maxZoom: 16.5, duration: document.hidden ? 0 : 600 });
    }
    function achNav() {
      var b = $('ach-nav'); if (!b) return;
      var cible = achCible ? achPoints().filter(function (x) { return x.id === achCible; })[0] : null;
      if (!cible || !achSuivi) { b.hidden = true; return; }
      b.hidden = false;
      var dm = (achPos && cible.geo && D.distanceM) ? D.distanceM(achPos, cible.geo) : null;
      var e = D.proximiteEtat ? D.proximiteEtat(dm) : { cle: 'inconnu', titre: '—', texte: '' };
      b.classList.toggle('arrive', e.cle === 'arrive');
      $('ach-nav-titre').textContent = e.titre + ' · ' + cible.enseigne;
      $('ach-nav-txt').textContent = e.texte + (cible.geoApprox ? ' Position du commerce approchée (centre de la ville).' : '');
      achTrace(cible); achCadrer(cible);
    }
    function achGuider(id) {
      if (!window.PEC_GEO || !PEC_GEO.suivre) return;
      var p = achPoints().filter(function (x) { return x.id === id; })[0];
      if (!p || !p.geo) return;                    // sans géoposition du commerce, il n'y a rien vers quoi avancer
      if (achCible === id) { achArreter(); return; }   // re-cliquer le commerce suivi arrête le suivi
      if (achSuivi) { achSuivi.stop(); achSuivi = null; }
      achCible = id; achVu = id;
      achSuivi = PEC_GEO.suivre(function (f) {
        if (PEC_GEO.noterAccord) PEC_GEO.noterAccord();
        if (PEC_GEO.appliquerRetention) PEC_GEO.appliquerRetention();
        achPos = f; $('ach-geoask').hidden = true;
        achListe(); achNav();
      }, function (msg) {
        if (!achPos) {                             // refusée d'entrée : on arrête, on ne laisse pas un bandeau vide tourner
          achArreter();
          var g = $('ach-geoask'), er = $('ach-geoerr');
          if (g) g.hidden = false;
          if (er) { er.hidden = false; er.textContent = msg; }
          return;
        }
        var t = $('ach-nav-txt'); if (t) t.textContent = msg + ' — dernière position connue conservée.';
      });
      if (!achSuivi) { achCible = null; return; }  // pas de géolocalisation du tout : on ne fait pas semblant de guider
      achListe(); achNav();
    }
    function achArreter() {
      if (achSuivi) { achSuivi.stop(); achSuivi = null; }
      achCible = null;
      achTrace(null);
      if (achMkUser && achMkUser.getElement) achMkUser.getElement().classList.remove('live');
      var b = $('ach-nav'); if (b) { b.hidden = true; b.classList.remove('arrive'); }
      achListe();
    }
    /* ══ (23/09, fondatrice : « pour la modale de paiement, ajoute pour API et lien envoyé, modale qui s'ouvre : notre
       réseau accepte espèces, pièces et CB ; ses bons d'achat sont utilisés sur le site de l'émetteur ; une fois
       utilisé, non remboursable ; pas de possibilité d'utiliser un bon sur un autre site ; réseau limité »)
       CE QU'IL FAUT SAVOIR — sous le titre de « Acheter un bon d'achat », avant la carte ═══════════════════════
       Les mots ne sont pas ici : le RÉSEAU les rend (R.rappel, PEC_TECH.reseauOu), depuis le référentiel. Le bloc se
       repeint avec le volet, et seulement s'il change — ses réglages sont vifs, pas ses tics. Mode et Fly n'ont ni
       rappel ni bloc : rien ne s'y passe. ══ */
    var achRappelPeint = '';
    function achRappel() {
      var z = $('ach-rappel'); if (!z || !R.rappel) return;
      var h = R.rappel() || '';
      if (h === achRappelPeint) return;
      achRappelPeint = h; z.innerHTML = h; z.hidden = !h;
    }
    function achListe() {
      var tous = achPoints(), pts = tous.slice(0, ACH_MAX);
      /* LE COMMERCE SUIVI NE DISPARAÎT JAMAIS DE LA LISTE : en marchant on peut en dépasser un autre, et voir sa
         cible s'effacer du volet pendant qu'on avance vers elle serait absurde. */
      if (achCible && !pts.some(function (p) { return p.id === achCible; })) {
        var c = tous.filter(function (x) { return x.id === achCible; })[0];
        if (c) pts = pts.slice(0, Math.max(0, ACH_MAX - 1)).concat([c]);
      }
      /* (19/09, nuit) UN DE NOS COMMERCES GARDE TOUJOURS SA PLACE. Le volet sert à acheter un bon d'achat ;
         un commerce trop loin le ferait disparaître du tunnel. Le plus
         proche des nôtres reste affiché, même s'il est plus loin — et sa pastille dit ce qu'il est. */
      if (!pts.length) {
        var n1 = tous[0];
        if (n1) pts = pts.slice(0, Math.max(0, ACH_MAX - 1)).concat([n1]);
      }
      var liste = $('ach-liste'), vide = $('ach-vide'), lien = $('bon-ou-acheter'), note = $('ach-note');
      if (!tous.length) {
        // ÉTAT VIDE HONNÊTE : on ne promet pas un réseau qui n'existe pas — on renvoie sur ce qui marche AUJOURD'HUI
        liste.innerHTML = ''; achCarte([]);
        vide.hidden = false;
        vide.innerHTML = R.videTxt(!!(achQ || achVille));
        if (lien) lien.hidden = true;                // pas de lien vers une liste vide : il ne mènerait à rien
        if (note) note.hidden = true;
        return;
      }
      /* LE COMPTE À MOINS DE X — la phrase de l'écran d'avant : « POINTS PARTENAIRES — 3 À MOINS DE 2 KM ».
         Sans position, aucun rayon ne s'affiche : on ne peut pas dire « à moins de » sans savoir d'où. */
      /* LES VILLES OÙ IL Y A RÉELLEMENT UN COMMERCE — dérivées de la liste, jamais écrites : on ne propose pas
         une ville où personne ne vend. */
      var zv = $('ach-villes');
      if (zv) {
        var villes = []; R.points({}).forEach(function (p) { if (p.ville && villes.indexOf(p.ville) === -1) villes.push(p.ville); });
        zv.hidden = villes.length < 2;
        zv.innerHTML = villes.length < 2 ? '' : villes.map(function (v) {
          var on = achVille === v;
          return '<button type="button" class="pec-pill tap' + (on ? ' pec-pill--done' : '') + '" data-ville="' + esc(v) + '" aria-pressed="' + on + '">' + esc(v) + '</button>';
        }).join('');
      }
      /* LE RAYON NE BRIDE PLUS dès qu'une ville ou une recherche est active : le libellé le dit, comme avant. */
      var zr = $('ach-rayon-l'), brider = !!achPos && !achQ && !achVille;
      if (zr) {
        zr.hidden = !achPos;
        if (achPos) $('ach-rayon-txt').textContent = 'Points de vente — ' + pts.length
          + (brider ? ' à moins de ' + (achRayon >= 1000 ? (achRayon / 1000) + ' km' : achRayon + ' m')
                    : (achVille ? ' à ' + achVille : ' pour « ' + achQ + ' »'));
        [].forEach.call($('ach-rayon').querySelectorAll('[data-km]'), function (b) { b.disabled = !brider; b.style.opacity = brider ? '' : '.45'; });
      }
      vide.hidden = true;
      /* (19/09, nuit) LE LIEN MÈNE À LA PAGE DE RÉFÉRENCE DU BON D'ACHAT — qui ne liste que NOS commerces.
         Tant qu'aucun n'est activé, il ouvrirait une page vide : on ne le montre pas.
         carte ne s'y trouvent pas, et ils ont leur propre bouton sur leur fiche. */
      if (lien) { lien.hidden = !achNbBon(); if (R.listeComplete) lien.href = R.listeComplete; }
      if (note) note.hidden = !achPos;
      liste.innerHTML = '<div class="pec-card" style="padding:2px 13px 4px">' + pts.map(function (p, i) {
        var adr = [p.adresse, [p.cp, p.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        return '<div class="cmz' + (p.id === achVu ? ' vu' : '') + '" data-cmz="' + esc(p.id) + '">' +
          '<span class="rg">' + (achPos ? (i + 1) : '<svg class="pec-ico" viewBox="0 0 24 24" style="font-size:14px"><use href="#i-map-pin"/></svg>') + '</span>' +
          '<div style="min-width:0;flex:1"><div class="nm">' + esc(p.enseigne) + '</div>'
          + '<div class="ad">' + esc(adr) + (p.horaires ? ' · ' + esc(p.horaires) : '') + '</div>' +
          // la distance ne s'affiche QUE si elle a été calculée : pas de position, pas de distance inventée
          (p.distTxt ? '<span class="di">' + esc(p.distTxt) + esc(achPied(p)) + '</span>' : '') +
          /* LA FICHE OUVERTE DIT CE QU'ON REPART AVEC — la phrase vient de la donnée (`achete`), pas de l'écran. */
          (p.id === achVu ? '<div class="qo">' + esc(p.achete || '') + '</div>' : '') +
          /* (20/09) CE `</div>` FERME LA COLONNE DU MILIEU, et il avait été emporté avec la pastille de réseau et
             le bouton du second titre : chaque fiche restait alors ouverte, la suivante s'imbriquait dedans, et
             la liste se lisait en escalier — des colonnes de plus en plus étroites au lieu de lignes empilées.
             « M'y rendre » est un frère de cette colonne, pas son enfant : `.cmz .go` le place à droite. */
          '</div>' +
          /* « M'y rendre » n'apparaît que si le commerce a une géoposition ET que l'appareil sait suivre : un bouton
             qui ne peut rien faire est pire que pas de bouton. Le premier clic déclenche la demande de position. */
          ((p.geo && window.PEC_GEO && PEC_GEO.suivre) ? '<button type="button" class="go tap" data-go="' + esc(p.id) + '" aria-pressed="' + (p.id === achCible ? 'true' : 'false') + '">' + (p.id === achCible ? 'Suivi…' : 'M’y rendre') + '</button>' : '') +
          '</div>';
      }).join('') + '</div>'
        + (tous.length > pts.length ? '<p style="margin:7px 2px 0;font-size:10.5px;font-weight:700;color:var(--color-muted)">' + (tous.length - pts.length) + ' autre' + (tous.length - pts.length > 1 ? 's' : '') + ' point' + (tous.length - pts.length > 1 ? 's' : '') + ' de vente plus loin — élargis le rayon, ou cherche ta ville.</p>' : '');
      achCarte(pts);
    }
    /* ══ (19/09, nuit — « où est la modale pour accepter le partage de position ») L'ACCORD SE DEMANDE ════
       La règle de PEC_GEO n'a pas changé : accord déjà donné → `autoLocaliser` part seul, on ne demande RIEN.
       Accord jamais donné → on dit d'abord à quoi la position sert, dans une modale, et c'est SON bouton qui
       déclenche la popup native du téléphone. On ne la pose qu'une fois par visite : refusée, l'encart discret
       du volet reste disponible pour revenir dessus, mais on ne harcèle personne.
       « Continuer sans » n'est pas un cul-de-sac : chez un partenaire on cherche par ville, avec un agent on
       passe au carnet d'adresses — c'est ce que dit le bouton.
       RÉPONDU, pas « vu » : tant que la cliente n'a pas tranché, la modale peut se reposer — et son texte SUIT
       le chemin ouvert. Elle disait « trier les points de vente » à quelqu'un qui venait de demander un agent :
       la même question, mais pour autre chose. ══ */
    var geopopRepondu = false;
    /* BLOQUÉ ≠ RÉPONDU. « Répondu », c'est la cliente qui a tranché — on ne la relance plus de la séance.
       « Bloqué », c'est le NAVIGATEUR, et cet état SE RELIT à chaque fois : elle vient peut-être de le
       débloquer dans les réglages. Ce drapeau ne sert donc qu'à ne pas réécrire le même refus à chaque
       peinture — jamais à cesser de regarder. */
    var geopopBloque = false;
    var geopopApres = null;   // le geste qui attend l'accord (relever son adresse), rejoué dès qu'il est donné
    function geopopFermer() { var z = $('geopop'); if (z) z.hidden = true; }
    /* ══ (20/09, fondatrice : « http://localhost:8777/ui/mode/05-ou-payer.html JE NE VOIS PAS ») ═══════════
       ON NE DEMANDE PLUS UN ACCORD QUI NE VIENDRA JAMAIS. Quand le navigateur a BLOQUÉ le site (un « Bloquer »
       cliqué une fois, et il ne repose plus la question), cette modale s'ouvrait à CHAQUE chargement, par-dessus
       toute la page : l'écran arrivait voilé, et la seule issue était de la fermer à la main — à chaque fois.
       On lit donc d'abord ce que le navigateur en pense ; si c'est « bloqué », la modale ne s'ouvre pas du tout,
       le refus se dit UNE fois à l'endroit qui en dépend, et la recherche par ville prend le relais. */
    function geopopOuvrir() {
      var z = $('geopop'); if (!z || geopopRepondu || window.__pecSansPosition) return;
      if (!window.PEC_GEO || achPos || PEC_GEO.accordConnu()) { z.hidden = true; return; }
      if (!PEC_GEO.permissionEtat) { geopopPeindre(); return; }
      PEC_GEO.permissionEtat(function (etat) {
        if (etat === 'denied') { z.hidden = true; if (!geopopBloque) { geopopBloque = true; direRefusPosition(); } return; }
        geopopPeindre();
      });
    }
    /* LE REFUS SE DIT LÀ OÙ IL A UNE CONSÉQUENCE — sur la carte des commerces, qui ne peut plus trier par
       distance — et il nomme le geste (PEC_GEO.messageErreur). Pas de modale, pas de mur : la liste reste
       lisible, la recherche par ville est juste en dessous. */
    function direRefusPosition() {
      var ga = $('ach-geoask'), e = $('ach-geoerr');
      if (!ga || !e || ouChemin !== 'partenaire') return;
      ga.hidden = false;
      e.hidden = false;
      e.textContent = PEC_GEO.messageErreur({ code: 1 });
    }
    function geopopPeindre() {
      var z = $('geopop'); if (!z) return;
      var p = $('geopop-p');
      if (p) {
        p.textContent = ouChemin === 'agent'
          ? 'Uniquement pour retrouver le numéro et le nom de ta rue, et poser le point de rendez-vous au bon endroit. '
          : 'Uniquement pour calculer les distances et trier les points de vente du plus proche au plus loin. ';
        var sp = document.createElement('span');
        sp.setAttribute('data-geo-retention', 'tu');
        p.appendChild(sp);
        p.appendChild(document.createTextNode(' Ton téléphone te demandera son autorisation.'));
        if (PEC_GEO.appliquerRetention) PEC_GEO.appliquerRetention(z);
      }
      $('geopop-err').hidden = true;
      $('geopop-non').textContent = ouChemin === 'agent'
        ? 'Continuer sans — je saisis mon adresse'
        : 'Continuer sans — je cherche par ville';
      z.hidden = false;
    }
    if ($('geopop-ok')) $('geopop-ok').addEventListener('click', function () {
      var b = this, e = $('geopop-err');
      e.hidden = true; b.textContent = 'Localisation…';
      PEC_GEO.localiser(function (f) {
        PEC_GEO.noterAccord();
        geopopRepondu = true;
        b.textContent = 'Autoriser ma position';
        geopopFermer();
        achPos = f;
        if (PEC_GEO.appliquerRetention) PEC_GEO.appliquerRetention();
        var ga = $('ach-geoask'); if (ga) ga.hidden = true;
        achListe(); peindreAgent();
        /* CE QUI ATTENDAIT L'ACCORD REPREND SON COURS : la modale n'est qu'une explication posée DEVANT la
           question du navigateur — une fois répondue, le geste que la cliente avait lancé doit aboutir seul. */
        if (geopopApres) { var suite = geopopApres; geopopApres = null; suite(f); }
      }, function (msg) {
        /* REFUS OU ÉCHEC : on le DIT dans la modale, et on laisse la porte de sortie ouverte — jamais une
           coordonnée inventée, jamais un écran bloqué sur une permission qu'on n'aura pas. */
        b.textContent = 'Réessayer';
        e.hidden = false; e.textContent = msg;
      });
    });
    if ($('geopop-non')) $('geopop-non').addEventListener('click', function () {
      geopopRepondu = true; geopopApres = null;
      geopopFermer();
      /* « CONTINUER SANS » N'EST PAS UN CUL-DE-SAC : on renvoie sur l'autre façon de faire la même chose — la
         recherche d'adresse côté agent, la recherche par ville côté commerces. */
      var q = $(ouChemin === 'agent' ? 'df-q' : 'ach-q');
      if (q) { q.scrollIntoView({ block: 'center', behavior: 'smooth' }); q.focus(); }
    });
    function achFix(f) {
      achPos = f;
      $('ach-geoask').hidden = true;
      if (window.PEC_GEO && PEC_GEO.appliquerRetention) PEC_GEO.appliquerRetention();
      achListe();
    }
    /* LE VOLET S'INITIALISE À SA PREMIÈRE OUVERTURE, jamais avant : MapLibre a besoin d'un conteneur VISIBLE, et
       on ne demande pas une position pour un chemin que la cliente n'a pas encore choisi. */
    function achOuvrir() {
      achListe();
      if (achPeint) { if (achMap) achMap.resize(); return; }
      achPeint = true;
      if (!window.PEC_GEO) return;
      var d = PEC_GEO.dernierePos ? PEC_GEO.dernierePos() : null;
      if (d) { achPos = d; achListe(); }            // on DÉMARRE sur la dernière position connue (pas de saut visuel)
      var auto = PEC_GEO.autoLocaliser(achFix, function (msg) {
        var e = $('ach-geoerr'); if (e && !achPos) { $('ach-geoask').hidden = false; e.hidden = false; e.textContent = msg; }
      });
      // on ne demande PAS une position pour trier une liste vide : on ne pose la question qu'avec des points
      if (!auto && !PEC_GEO.accordConnu() && achPoints().length) { $('ach-geoask').hidden = false; geopopOuvrir(); }
      var b = $('ach-geook');
      if (b) b.addEventListener('click', function () {
        var e = $('ach-geoerr'); if (e) e.hidden = true;
        b.textContent = 'Localisation…';
        PEC_GEO.localiser(function (f) { PEC_GEO.noterAccord(); b.textContent = 'Autoriser ma position'; achFix(f); },
          function (msg) { b.textContent = 'Autoriser ma position'; if (e) { e.hidden = false; e.textContent = msg; } });
      });
    }
    // cliquer une fiche recentre la carte sur SON épingle (l'inverse du clic sur l'épingle)
    /* (19/09, soir) LES PASTILLES DE RAYON — même geste que l'écran d'avant : un clic, la liste et la carte
       se refont sur ce rayon. La pastille active porte `pec-pill--done`, comme avant. */
    (function () {
      var q = $('ach-q');
      if (q) q.addEventListener('input', function () { achQ = q.value.trim(); if (achQ) achVille = ''; achListe(); });
      var zv = $('ach-villes');
      if (zv) zv.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-ville]') : null; if (!b) return;
        var v = b.getAttribute('data-ville');
        achVille = (achVille === v) ? '' : v;   // re-cliquer la ville active la retire : on revient autour de soi
        if (achVille && q) { q.value = ''; achQ = ''; }
        achListe();
      });
    })();
    (function () {
      var z = $('ach-rayon'); if (!z) return;
      z.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-km]') : null; if (!b) return;
        achRayon = parseInt(b.getAttribute('data-km'), 10) || 2000;
        [].forEach.call(z.querySelectorAll('[data-km]'), function (x) {
          var on = x === b;
          x.setAttribute('aria-pressed', String(on));
          x.classList.toggle('pec-pill--done', on);
        });
        achListe();   // la liste, la carte et le compte « à moins de X » se refont sur ce rayon
      });
    })();
    $('ach-liste').addEventListener('click', function (e) {
      var g = e.target.closest ? e.target.closest('[data-go]') : null;
      if (g) { achGuider(g.getAttribute('data-go')); return; }     // le bouton avant la fiche : sinon le recentrage l'avale
      var f = e.target.closest ? e.target.closest('[data-cmz]') : null; if (!f) return;
      achVu = f.getAttribute('data-cmz');
      var p = achPoints().filter(function (x) { return x.id === achVu; })[0];
      achListe();
      if (achMap && p && p.geo) achMap.flyTo({ center: [p.geo.lng, p.geo.lat], zoom: 15.5, duration: document.hidden ? 0 : 400 });
    });
    // LES DEUX CHEMINS : un seul ouvert à la fois. « Je veux en acheter » initialise la carte à sa PREMIÈRE ouverture.
    if ($('ach-nav-stop')) $('ach-nav-stop').addEventListener('click', achArreter);
    /* ON NE LAISSE JAMAIS UNE MONTRE DE POSITION TOURNER DERRIÈRE SOI : quitter l'écran, ou repasser sur « j'ai un
       bon », coupe le suivi. Une géolocalisation continue oubliée vide la batterie et collecte pour rien. */
    window.addEventListener('pagehide', achArreter);
    /* (19/09, soir) `voie()` pilotait le duo « j'ai un bon / je veux en acheter », remplacé par le trio du
       premier niveau. Elle reste comme raccourci : « jai » = le chemin en ligne, « acheter » = chez un partenaire. */
    function voie(quoi) { ouChemin = (quoi === 'jai') ? 'enligne' : 'partenaire'; peindreOu();
      if (quoi === 'jai') { var i2 = $('bon-code'); if (i2 && !i2.disabled) i2.focus(); } }
    /* ══ (19/09, soir) OÙ ACHETER SON BON : CHEZ UN COMMERÇANT, OU UN AGENT SE DÉPLACE ═══════════════════
       Le même contrat de distribution des deux côtés (mandat d'encaissement pour compte de tiers) : l'un tient un
       commerce, l'autre se déplace. Les libellés viennent de PARTENAIRE_MODES, la liste des villes du référentiel,
       le montant du sac — rien n'est écrit ici. */
    /* ══ LE TRIO COMMANDE TOUT L'ÉCRAN (19/09, soir) ═════════════════════════════════════════════
       'enligne'    → le champ du bon d'achat déjà en main : on règle tout de suite.
       'partenaire' → la carte des commerces, le rayon en mètres, la liste : on va chercher son bon au comptoir.
       'agent'      → la demande de rencontre : un distributeur mobile vient le vendre.
       Les libellés des deux derniers viennent de PARTENAIRE_MODES — l'écran n'écrit aucun nom de mode. */
    /* (19/09, nuit — décision fondatrice « je souhaite que ce soit par défaut sur chez un partenaire »)
       C'est le chemin de la plupart des clientes : elles n'ont pas encore de bon en main. Le champ de code et
       le champ du code reste à un doigt, sur « En ligne ». */
    var ouChemin = 'partenaire';
    function agtMontant() { var du = montantDu(); return Math.round(du.cents) / 100; }
    function peindreOu() {
      var bl = $('op-ou-enligne'), bp = $('op-ou-partenaire'), bg = $('op-ou-agent');
      if (!bl || !bp || !bg) return;
      var T3 = R.trio();
      $('op-ou-enligne-s').textContent = T3.enligne;
      $('op-ou-partenaire-t').textContent = T3.partenaire.t;
      $('op-ou-partenaire-s').textContent = T3.partenaire.s;
      $('op-ou-agent-t').textContent = T3.agent.t;
      $('op-ou-agent-s').textContent = T3.agent.s;
      [[bl, 'enligne'], [bp, 'partenaire'], [bg, 'agent']].forEach(function (x) {
        x[0].setAttribute('aria-selected', String(ouChemin === x[1]));
        x[0].classList.toggle('on', ouChemin === x[1]);
      });
      /* CE QUI S'AFFICHE SOUS LE TRIO. Un seul chemin à la fois : on ne laisse pas deux façons de payer ouvertes
         en même temps, c'est ce qui rendait l'écran illisible. */
      /* `pane-bon` est le CONTENEUR des trois chemins — le masquer masquait la carte des commerces et le volet de
         l'agent, qui vivent dedans. Il reste ouvert ; ce sont les deux voies à l'intérieur qui basculent. */
      var pb = $('pane-bon'); if (pb) pb.classList.add('active');
      var vj = $('voie-jai-z'); if (vj) vj.classList.toggle('on', ouChemin === 'enligne');
      var va = $('voie-acheter-z'); if (va) va.classList.toggle('on', ouChemin !== 'enligne');
      $('ach-carte-commerce').hidden = ouChemin !== 'partenaire';
      $('bon-ou-acheter').hidden = ouChemin !== 'partenaire' || !achNbBon();
      $('ach-carte-agent').hidden = ouChemin !== 'agent';
      achRappel();   // (23/09) le rappel du réseau, dans la carte des commerces — rien sur Mode et Fly
      if (ouChemin === 'partenaire') achOuvrir();
      if (ouChemin === 'agent') agtOuvrir();
      /* (20/09) LA MODALE D'ACCORD NE CONCERNE PLUS QUE LA CARTE DES COMMERCES. Elle s'ouvrait aussi sur le
         chemin de l'agent, pour poser le rendez-vous là où était le téléphone ; le rendez-vous est désormais à
         une ADRESSE, et la position n'y sert qu'à la REMPLIR — sur le geste de la cliente, jamais avant. Sur
         tout autre chemin, elle s'efface au lieu de bloquer l'écran pour rien. */
      /* On REPOSE la question à chaque entrée sur le chemin des commerces (la fonction se garde elle-même :
         accord connu, déjà répondu, ou site bloqué → elle n'ouvre rien). Ne la rappeler que si la modale était
         DÉJÀ ouverte empêchait de la revoir après avoir débloqué le site dans les réglages du navigateur. */
      if (ouChemin === 'partenaire') geopopOuvrir();
      else geopopFermer();
    }
    /* ══ (19/09, soir) LA CARTE DE LA RENCONTRE — le point de rendez-vous, et l'agent quand il vient ═════════
       Même montage que la carte des commerces : MapLibre exige un conteneur VISIBLE, donc init à la première
       ouverture du volet. Deux épingles : le lieu (celui que le client a proposé) et l'agent (sa position vive,
       s'il la partage). Rien à montrer → la carte reste masquée : on ne dessine pas une carte vide. */
    var agtMap = null, agtMkLieu = null, agtMkAgent = null, agtPeint = false;
    /* (19/09, nuit) LE POINT DE RENDEZ-VOUS EXISTE AVANT LA DEMANDE. La carte ne s'allumait qu'une fois la
       rencontre créée : le client choisissait un lieu à l'aveugle, puis découvrait où l'agent viendrait.
       (20/09) C'est la géoposition de l'ADRESSE, sinon le centre de sa commune — et la légende le dit.
       Même règle que `rencontreDemander` côté données : une seule façon de poser ce point. */
    /* ══ (20/09, décision fondatrice : « uniquement ADRESSE DE RENCONTRE, par défaut l'adresse de compte de
       l'utilisateur ; il peut changer par sa position ou une adresse saisie ») LE CARNET SERT LE FORMULAIRE ══
       Le carnet du COMPTE (jamais une adresse posée d'avance) alimente les pastilles ; le FORMULAIRE, lui, est
       toujours ouvert et porte l'adresse qui servira à la rencontre. `adrChoisieId` dit laquelle du carnet y
       est chargée — null quand la cliente en saisit une nouvelle, ce que le titre du formulaire annonce. ══ */
    var adrChoisieId = null;   // l'adresse du carnet chargée dans le formulaire — null = nouvelle adresse
    var dfGeo = null;          // la géoposition de CE QUI EST à l'écran, ou null dès qu'on retape la voie
    try {
      var __lc = JSON.parse(localStorage.getItem('pec-lieu-choisi') || 'null');
      if (__lc && __lc.id) adrChoisieId = __lc.id;
    } catch (e__) {}
    function agtLieuMemo() {
      try { localStorage.setItem('pec-lieu-choisi', JSON.stringify({ id: adrChoisieId })); } catch (e) {}
    }
    // l'adresse RETENUE au carnet : celle qu'on a choisie, sinon celle par défaut du compte — jamais une invention
    function adrCourante() {
      if (!D.adresses) return null;
      var l = D.adresses();
      if (!l.length) return null;
      return (adrChoisieId ? l.filter(function (a) { return a.id === adrChoisieId; })[0] : null) || (D.adresseDefaut ? D.adresseDefaut() : l[0]) || l[0];
    }
    function adrType() { var e = $('df-type'); return (e && e.value) || 'domicile'; }
    /* CE QUI EST À L'ÉCRAN, TEL QU'IL PARTIRA : le formulaire fait foi, jamais le souvenir d'un clic précédent.
       C'est lui qui donne la commune (donc les distributeurs joignables) et le point de la carte, en direct. */
    function adrSaisie() {
      var v = function (id) { var e = $(id); return e ? e.value.trim() : ''; };
      var num = v('df-numero'), voie = v('df-voie'), cp = v('df-cp'), ville = v('df-ville');
      return { id: adrChoisieId, type: adrType(), numero: num, voie: voie, cp: cp, ville: ville,
        adresse: (num ? num + ' ' : '') + voie + ((cp || ville) ? ', ' + cp + ' ' + ville : ''),
        etage: v('df-etage'), porte: v('df-porte'), instructions: v('df-instructions'),
        geo: dfGeo || undefined };
    }
    // deux adresses sont LA MÊME quand leur partie postale l'est — la casse et les espaces ne comptent pas
    function adrClef(a) {
      return [a.numero || '', a.voie || a.adresse || '', a.cp || '', a.ville || ''].join('|').toLowerCase().replace(/\s+/g, ' ').trim();
    }
    // LA VILLE vient de l'adresse de rencontre — elle ne se saisit jamais deux fois
    function agtVille() { var e = $('df-ville'); return e ? e.value.trim() : ''; }
    /* LE POINT DE RENDEZ-VOUS, DANS CET ORDRE ET PAS UN AUTRE — le même que `rencontreDemander`, pour que la
       carte montre EXACTEMENT le point qui partira avec la demande :
         · la géoposition de l'adresse (relevée de la position, ou rapportée par la recherche) ;
         · sinon le centre de sa commune, et la légende DIT qu'il est approché.
       Jamais la position du téléphone : le rendez-vous est à CETTE adresse, et la cliente peut très bien
       commander d'ailleurs — envoyer le distributeur là où est le téléphone serait un mensonge. */
    function agtPointRdv() {
      var ville = agtVille();
      if (dfGeo && isFinite(dfGeo.lat) && isFinite(dfGeo.lng)) return { geo: dfGeo, geoApprox: false, ville: ville, adresse: adrSaisie() };
      var g = (D.villeGeo && ville) ? D.villeGeo(ville) : null;
      return g ? { geo: g, geoApprox: true, ville: ville } : null;
    }
    /* LES PASTILLES DU CARNET — une par adresse enregistrée, plus « une autre adresse ». Les libellés de type
       viennent du data-layer (ADRESSE_TYPES), l'écran n'écrit pas « Domicile ». La pastille allumée est celle
       qui est CHARGÉE dans le formulaire ; « ＋ Une autre adresse » le vide pour en saisir une neuve. */
    function rendreLieux() {
      var z = $('lieux'); if (!z || !D.adresses) return;
      var l = D.adresses();
      /* (20/09, fondatrice : « beaucoup de double information ») UNE PASTILLE SE DISTINGUE DE SA VOISINE.
         Elles ne portaient que le TYPE : deux adresses « Autre » donnaient deux pastilles identiques, et il
         fallait cliquer pour savoir laquelle était laquelle. Le type ne suffit que s'il est unique ; sinon la
         voie le suit. Rien n'est écrit d'avance : le libellé de type vient du data-layer, la voie de l'adresse. */
      var parType = {};
      l.forEach(function (a) { parType[a.type] = (parType[a.type] || 0) + 1; });
      z.innerHTML = l.map(function (a) {
        var on = a.id === adrChoisieId;
        var lbl = D.adresseTypeLbl(a.type) + (parType[a.type] > 1 ? ' · ' + (a.voie || a.adresse || '').slice(0, 18) : '');
        return '<button type="button" class="pec-pill tap' + (on ? ' pec-pill--done' : '') + '" data-adr-id="' + esc(a.id) + '" aria-pressed="' + on + '">' + esc(lbl) + (a.defaut ? ' ✓' : '') + '</button>';
      }).join('') + (l.length
        ? '<button type="button" class="pec-pill tap' + (adrChoisieId ? '' : ' pec-pill--done') + '" id="adr-ajouter" aria-pressed="' + (!adrChoisieId) + '" style="font-weight:800;color:var(--color-primary-dark)">＋ Une autre adresse</button>'
        : '');
      var q = $('adr-quoi');
      /* (20/09) UNE LIGNE, PAS QUATRE. Elle énumérait les trois façons d'entrer une adresse — que les trois
         contrôles juste en dessous montrent déjà. Elle ne dit plus que ce qu'ils ne disent pas : d'où vient
         celle qui est là, et qu'elle sera gardée. */
      if (q) q.textContent = l.length ? 'Celle de ton compte, par défaut.' : 'Elle sera gardée dans ton compte pour les prochaines fois.';
    }
    /* LES OPTIONS VIENNENT DU RÉFÉRENTIEL (ADRESSE_TYPES) : l'écran n'écrit pas « Domicile ». */
    function dfTypeSet(t) {
      var e = $('df-type'); if (!e) return;
      if (!e.options.length) {
        var T = D.ADRESSE_TYPES || {};
        e.innerHTML = Object.keys(T).map(function (k) { return '<option value="' + esc(k) + '">' + esc(T[k]) + '</option>'; }).join('');
      }
      e.value = t;
      if (!e.value) e.selectedIndex = 0;
    }
    function dfAide(txt) { var a = $('df-q-aide'); if (a) a.textContent = txt; }
    var DF_AIDE_NEUVE = 'Choisis une suggestion : tout se remplit, et l’adresse arrive géolocalisée.';
    /* CHARGER UNE ADRESSE DANS LE FORMULAIRE : celle du carnet (a), ou rien du tout pour en saisir une neuve.
       C'est le SEUL endroit qui écrit dans les champs — la frappe de la cliente ne passe jamais par ici. */
    function adrCharger(a) {
      if (!$('df-numero')) return;
      adrChoisieId = a ? a.id : null;
      dfGeo = (a && a.geo && isFinite(a.geo.lat) && isFinite(a.geo.lng)) ? a.geo : null;
      dfTypeSet(a ? a.type : ((D.adresses && D.adresses().length) ? 'autre' : 'domicile'));
      $('df-numero').value = a ? (a.numero || '') : '';
      $('df-voie').value = a ? (a.voie || a.adresse || '') : '';
      $('df-cp').value = a ? (a.cp || '') : '';
      $('df-ville').value = a ? (a.ville || '') : '';
      $('df-etage').value = a ? (a.etage || '') : '';
      $('df-porte').value = a ? (a.porte || '') : '';
      $('df-instructions').value = a ? (a.instructions || '') : '';
      [].forEach.call(document.querySelectorAll('#dom-form .pec-input.ko'), function (x) { x.classList.remove('ko'); });
      $('df-err').hidden = true;
      if ($('df-q')) $('df-q').value = '';
      $('df-geoloc-txt').textContent = 'Utiliser ma position';
      dfAide(dfGeo ? 'Adresse géolocalisée : il sera guidé jusqu’à la porte.' : DF_AIDE_NEUVE);
      rendreLieux();
    }
    /* CHANGER DE RUE N'EST PAS CORRIGER LA SIENNE. Dès que ce qui arrive (position relevée, suggestion
       choisie) n'est plus l'adresse du carnet qui est chargée, on bascule sur « nouvelle adresse » — sinon
       « Domicile » serait réécrit en silence parce que la rencontre du jour se passe ailleurs. */
    function adrDetacherSiAutre(n) {
      var a = adrChoisieId ? D.adresse(adrChoisieId) : null;
      if (!a || adrClef(a) === adrClef(n)) return;
      adrChoisieId = null;
      dfTypeSet('autre');
      rendreLieux();   // la pastille « ＋ Une autre adresse » s'allume : c'est elle qui dit ce qui sera écrit
    }
    /* L'ADRESSE DE RENCONTRE S'ÉCRIT AU CARNET AU MOMENT OÙ ON CHERCHE UN AGENT : il n'y a aucun bouton
       « enregistrer » à trouver avant de pouvoir avancer, c'est le MÊME geste. Les contrôles sont ceux du
       carnet du Compte (numéro, voie, code postal à 5 chiffres, commune) et le champ fautif est marqué. */
    function adrEnregistrer() {
      var n = adrSaisie(), err = $('df-err'), manque = [];
      if (!n.numero) manque.push('le numéro de voie');
      if (!n.voie) manque.push('la voie');
      if (!/^\d{5}$/.test(n.cp)) manque.push('le code postal (5 chiffres)');
      if (!n.ville) manque.push('la commune');
      if (manque.length) {
        err.hidden = false;
        err.textContent = 'Il manque ' + manque.join(', ') + ' — il doit pouvoir te trouver sans téléphoner.';
        var ch = $(!n.numero ? 'df-numero' : !n.voie ? 'df-voie' : !/^\d{5}$/.test(n.cp) ? 'df-cp' : 'df-ville');
        if (ch) { ch.classList.add('ko'); if (ch.focus) ch.focus(); if (ch.scrollIntoView) ch.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return null;
      }
      err.hidden = true;
      var res = D.adresseEnregistrer({
        id: adrChoisieId || undefined, type: n.type,
        adresse: n.numero + ' ' + n.voie + ', ' + n.cp + ' ' + n.ville,
        numero: n.numero, voie: n.voie, cp: n.cp, ville: n.ville,
        etage: n.etage, porte: n.porte, instructions: n.instructions,
        geo: dfGeo || undefined,
        defaut: adrChoisieId ? undefined : D.adresses().length === 0
      });
      /* `adresseEnregistrer` rend null quand l'écriture est refusée : sans ce contrôle on partait chercher un
         agent pour une adresse qui aurait disparu au rechargement. */
      if (!res) { err.hidden = false; err.textContent = 'L\'adresse n\'a PAS été enregistrée : le stockage de cet appareil est plein. Libère de la place et recommence.'; return null; }
      adrChoisieId = res.id; agtLieuMemo();
      rendreLieux();
      return res;
    }
    function agtCarte(r) {
      var wrap = $('agt-mapwrap'); if (!wrap) return;
      var pos = (r && r.statut === 'acceptee' && window.PEC_BUS && PEC_BUS.positionAgent) ? PEC_BUS.positionAgent(r.id) : null;
      if (!r || !r.geo || typeof maplibregl === 'undefined') { wrap.hidden = true; return; }
      wrap.hidden = false;
      /* (20/09, soir) MÊME MONTAGE QUE LA CARTE DES COMMERCES — c'est la demande, et c'était un défaut : ce
         volet-ci ne disait rien quand les tuiles ne venaient pas. */
      if (!agtMap) agtMap = PEC_GEO.carte('agt-map', { centre: r.geo, zoom: 14, cadre: wrap });
      else agtMap.resize();      // le volet vient de s'ouvrir : le conteneur a enfin une taille
      if (!agtMap) return;
      var lbl = r.ref ? 'Rendez-vous' : 'Ton point de rendez-vous';
      if (!agtMkLieu) {
        var el = document.createElement('div'); el.className = 'mk-pt';
        el.innerHTML = '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-map-pin"/></svg><span class="lb"></span>';
        agtMkLieu = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([r.geo.lng, r.geo.lat]).addTo(agtMap);
      } else agtMkLieu.setLngLat([r.geo.lng, r.geo.lat]);
      var sp = agtMkLieu.getElement().querySelector('.lb'); if (sp) sp.textContent = lbl;
      /* HORS RENCONTRE ACCEPTÉE, LA CAMÉRA SUIT LE POINT : changer de ville doit déplacer la carte, sinon elle
         montre encore la précédente. Une fois l'agent en route, c'est le cadrage à deux épingles qui commande. */
      if (!r.statut || r.statut === 'demandee') agtMap.easeTo({ center: [r.geo.lng, r.geo.lat], zoom: r.geoApprox ? 12.5 : 14.5, duration: document.hidden ? 0 : 400 });
      if (pos) {
        if (!agtMkAgent) {
          var ea = document.createElement('div'); ea.className = 'mk-pt live';
          ea.innerHTML = '<svg class="pec-ico" viewBox="0 0 24 24"><use href="#i-store"/></svg>' + esc(r.distributeur || 'ton agent');
          agtMkAgent = new maplibregl.Marker({ element: ea, anchor: 'bottom' }).setLngLat([pos.lng, pos.lat]).addTo(agtMap);
        } else agtMkAgent.setLngLat([pos.lng, pos.lat]);
        var bb = new maplibregl.LngLatBounds([r.geo.lng, r.geo.lat], [r.geo.lng, r.geo.lat]);
        bb.extend([pos.lng, pos.lat]);
        /* L'épingle de l'agent porte son nom : sans marge à droite, l'étiquette sort du cadre. */
        agtMap.fitBounds(bb, { padding: { top: 40, bottom: 40, left: 40, right: 90 }, maxZoom: 15.5, duration: document.hidden ? 0 : 400 });
      } else if (agtMkAgent) { agtMkAgent.remove(); agtMkAgent = null; }
    }
    /* (20/09) LE VOLET S'OUVRE SUR L'ADRESSE DU COMPTE, ET NE DEMANDE PLUS RIEN. Il réclamait la position à
       l'arrivée : elle servait alors à poser le rendez-vous en lieu public. Le rendez-vous est désormais à une
       ADRESSE — la position ne sert qu'à la REMPLIR, sur le geste de la cliente. La demander avant, c'était la
       demander pour rien : exactement ce que la minimisation interdit. */
    function agtOuvrir() {
      if (!agtPeint) { agtPeint = true; adrCharger(R.rencontre ? null : adrCourante()); }
      peindreAgent();
      if (agtMap) agtMap.resize();
    }
    /* ══ (20/09) PORTER UN CODE JUSQU'AU CHAMP, et le vérifier : c'est le geste que la cliente allait faire.
       UNE SEULE fonction, deux portes — le bouton « Régler maintenant » d'ici, et le lien de l'écran de la
       rencontre (25-rencontre → `?bon=…`). Le champ de saisie vit ICI : on ne le duplique pas là-bas. ══ */
    var CHAMP_BON = o.champBon || { code: 'bon-code', verifier: 'bon-verifier' };
    function poserCode(code) {
      if (!code) return;
      /* (23/09, fondatrice : « app obligatoire pour utiliser un bon de marque ») SUR LA PAGE D'UNE MARQUE, il n'y a
         pas de champ : on ouvre l'app Mes bons avec le code, c'est là que le bon s'utilise — retraçable. */
      if (o.utiliserCode) { o.utiliserCode(code); return; }
      var i2 = $(CHAMP_BON.code);
      ouChemin = 'enligne'; peindreOu();
      if (i2) { i2.value = code; i2.dispatchEvent(new Event('input', { bubbles: true })); }
      var bv = $(CHAMP_BON.verifier); if (bv && !bv.disabled) bv.click();
      var pb = $('pane-bon') || i2; if (pb && pb.scrollIntoView) pb.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    /* UN BON DÉJÀ POSÉ : la rencontre est servie ET l'un de ses codes est déjà utilisé (épuisé) ou déjà
       appliqué au sac. On ne relance alors plus la cliente : elle a fait ce qu'il fallait. */
    function bonDejaPose(r) {
      try {
        var poses = (D.panierBonsCodes ? D.panierBonsCodes() : []) || [];
        return (r.codes || []).some(function (code) {
          if (poses.indexOf(code) > -1) return true;
          var b = D.bonParCode ? D.bonParCode(code) : null;
          return !!b && D.bonEtat(b) !== 'actif';
        });
      } catch (e) { return false; }
    }
    /* ══ (21/09, fondatrice : « pourquoi c'est pas comme Fly et Mode, la carte etc. ») LA RENCONTRE D'UN RÉSEAU
       DE BOUTIQUE — le même volet que celui de PayEnCash, ses mêmes états, lus chez CE réseau ═══════════════
       Demandée : on attend qu'un revendeur la prenne. Acceptée : il vient, et il appelle. Servie : il a remis
       le bon — on ouvre l'app Mes bons avec son code, c'est là qu'il s'utilise (23/09). Pas d'écran de suivi à part :
       un revendeur de boutique ne partage pas sa position, la carte n'a que le point de rendez-vous à montrer,
       et elle le montre ici. */
    function peindreAgentReseau() {
      var RR = R.rencontre, m = agtMontant();
      var enc = RR.enCours(), serv = enc ? null : RR.servie();
      var zb = $('agt-encours');
      zb.hidden = !(enc || serv);
      $('agt-form').style.display = (enc || serv) ? 'none' : '';
      $('agt-titre').textContent = RR.titre(enc ? enc.montant : m);
      if (enc) {
        zb.innerHTML = '<b>' + esc(D.rencontreStatutLbl(enc.statut)) + '</b> — ' + esc(enc.ref) + ' · ' + esc(D.eur(enc.montant)) + ' · ' + esc(enc.lieu)
          + (enc.revendeur
              ? '<br>' + esc(enc.revendeur) + ' vient te rejoindre : il t’appelle au ' + esc(D.telFrLbl(enc.tel)) + ' pour convenir du moment.'
              : '<br>En attente qu’un revendeur la prenne <span class="dots"><i></i><i></i><i></i></span>')
          + '<button type="button" id="agt-annuler" class="pec-btn-secondary tap" style="display:block;width:100%;margin-top:10px;font-weight:800">Annuler ma demande</button>';
        $('agt-liste').innerHTML = '';
        var zp0 = $('agt-pt'); if (zp0) zp0.hidden = !enc.geoApprox;
        if (zp0 && enc.geoApprox) zp0.innerHTML = 'Point <b>approché</b> — centre de ' + esc(enc.ville) + '.';
        agtCarte(enc);
        return;
      }
      if (serv) {
        zb.innerHTML = '<b>' + esc(serv.revendeur || 'Ton revendeur') + ' t’a remis ton bon.</b>'
          + '<div style="margin-top:7px;font-family:var(--font-mono,monospace);font-size:14px;font-weight:800;letter-spacing:.08em;color:var(--color-ink)">'
          + serv.codes.map(function (x) { return esc(x); }).join('<br>') + '</div>'
          + '<p style="margin:6px 0 0;font-size:11.5px;line-height:1.5;color:var(--color-muted)">Il ne reste qu’à l’utiliser : range-le dans l’app Mes bons, puis choisis-le pour cette commande.</p>'
          + '<button type="button" id="agt-payer" class="pec-cta tap" style="display:block;width:100%;text-align:center;margin-top:10px">Ouvrir Mes bons avec ce bon</button>';
        $('agt-liste').innerHTML = '';
        var zp1 = $('agt-pt'); if (zp1) zp1.hidden = true;
        agtCarte(null);
        return;
      }
      var prdv = agtPointRdv();
      agtCarte(prdv);
      var zpt = $('agt-pt');
      if (zpt) {
        var flou = !!prdv && prdv.geoApprox;
        zpt.hidden = !flou;
        if (flou) zpt.innerHTML = 'Point <b>approché</b> — centre de ' + esc(prdv.ville) + '. « Utiliser ma position » ou une suggestion d’adresse le pose au mètre.';
      }
      $('agt-montant').innerHTML = RR.montantHTML(m);
      $('agt-garantie').innerHTML = RR.garantieHTML;
      var ville = agtVille(), ags = ville ? RR.joignables(ville) : [];
      var fen = ' Ta demande reste ouverte ' + D.rencontreFenetreMin() + ' min.';
      $('agt-dispo').textContent = !ville
        ? 'Saisis l’adresse où il vient te rejoindre — c’est sa commune qui dit à quels revendeurs proposer la course.'
        : (ags.length ? ags.length + ' revendeur' + (ags.length > 1 ? 's' : '') + ' se déplace' + (ags.length > 1 ? 'nt' : '') + ' à ' + ville + '.' + fen
                      : RR.personneTxt(ville));
      $('agt-liste').innerHTML = ags.map(function (a) {
        return '<div class="agtc"><span style="flex:1;min-width:0"><span class="nm">' + esc(a.enseigne) + '</span>'
          + '<span class="zn" style="display:block">' + esc(a.zoneLbl) + '</span></span></div>';
      }).join('');
      $('agt-demander').textContent = RR.cta;
      $('agt-demander').disabled = !(m > 0) || (!!ville && !ags.length);
    }
    function peindreAgent() {
      if (R.rencontre) { peindreAgentReseau(); return; }
      var m = agtMontant();
      /* UNE RENCONTRE EN COURS SE DIT, ET REMPLACE LE FORMULAIRE : on n'en demande pas deux. */
      var cid2 = cid(), enc2 = cid2 && D.rencontresClient ? D.rencontresClient(cid2).filter(function (r) { return r.statut === 'demandee' || r.statut === 'acceptee'; })[0] : null;
      $('agt-encours').hidden = !enc2; $('agt-form').style.display = enc2 ? 'none' : '';
      if (enc2) {
        /* ══ (20/09) ON NE REJOUE PLUS L'ÉCRAN DE LA RENCONTRE ICI ═══════════════════════════════════════
           Ce bandeau portait tout : l'appel de l'hôte, la position vive, l'heure d'arrivée, l'annulation —
           au milieu d'un écran dont le métier est de CHOISIR comment payer, et sous deux autres cartes. Tout
           cela vit maintenant sur son propre écran (25-rencontre), carte en fond. Ici, il reste ce qu'il faut
           pour ne pas en demander une seconde : l'état, la référence, et le chemin pour y aller. */
        var e3 = (enc2.statut === 'acceptee' && D.rencontreEta) ? D.rencontreEta(enc2.id) : null;
        $('agt-encours').innerHTML = '<b>' + esc(D.rencontreStatutLbl(enc2.statut)) + '</b> — ' + esc(enc2.ref) + ' · ' + esc(D.eur(enc2.montant)) + ' · ' + esc(enc2.lieu) + ' (' + esc(enc2.ville) + ')'
          + (enc2.distributeur ? '<br>' + esc(enc2.distributeur) + ' vient te rejoindre.'
              : '<br>En attente qu\'un distributeur la prenne <span class="dots"><i></i><i></i><i></i></span>')
          + (e3 ? '<br>' + (e3.arrive ? '<b>Il est arrivé</b> — cherche-le sur place.' : '<b>À ' + esc(e3.distTxt) + '</b> · arrive vers ' + esc(e3.heure) + ' (' + e3.min + ' min)') : '')
          + '<a href="' + esc(urlRencontre(enc2.id)) + '" class="tap" style="display:block;margin-top:8px;font-weight:800;color:var(--color-primary-dark)">Voir ma rencontre — la carte et l\'heure d\'arrivée →</a>';
        $('agt-liste').innerHTML = '';
        var zp0 = $('agt-pt'); if (zp0) zp0.hidden = true;
        agtCarte(enc2);
        return;
      }
      /* (19/09, nuit) LA CARTE VIT AVANT LA DEMANDE : le point pressenti s'affiche dès qu'on sait où. */
      var prdv = agtPointRdv();
      agtCarte(prdv);
      /* (20/09, fondatrice : « trop redondant ») LA LÉGENDE NE PARLE QUE QUAND ELLE A QUELQUE CHOSE À DIRE.
         Elle recopiait l'adresse du formulaire, à deux centimètres de lui, sous une épingle qui la montrait
         déjà. Le point PRÉCIS se voit : l'épingle suffit. Le point APPROCHÉ, lui, ne se voit pas — c'est un
         centre de commune qui ressemble à une adresse — et il faut le DIRE, avec ce qui le corrige. */
      var zpt = $('agt-pt');
      if (zpt) {
        var flou = !!prdv && prdv.geoApprox;
        zpt.hidden = !flou;
        if (flou) zpt.innerHTML = 'Point <b>approché</b> — centre de ' + esc(prdv.ville) + '. « Utiliser ma position » ou une suggestion d’adresse le pose au mètre.';
      }
      /* ══ (19/09, soir — décision fondatrice « l'agent est noté ») ON NOTE CE QU'ON A VÉCU ═════════════════
         Une rencontre SERVIE et pas encore notée ouvre les étoiles. Le data-layer refuse tout le reste (une
         rencontre qu'on n'a pas vécue, une seconde note sur la même) : la note ne se fabrique pas. */
      var aNoter = cid2 && D.rencontresClient ? D.rencontresClient(cid2).filter(function (r) {
        return r.statut === 'servie' && !(D.notesDistributeurGet() || []).some(function (n) { return n.rencontreId === r.id; });
      })[0] : null;
      /* ══ (20/09 — décision fondatrice « … jusqu'à payer ») LA RENCONTRE NE S'ARRÊTE PAS À LA REMISE ═══════
         Le distributeur est venu, il a vendu, il est reparti — et l'écran passait directement aux étoiles. Mais la
         commande, elle, n'est toujours pas réglée : la cliente tient un bon dans la main et personne ne lui dit
         quoi en faire. On lui redonne donc SES codes (ils sont sur la rencontre, `codes`, posés par
         `rencontreServir`) et un bouton qui les porte directement dans le champ de saisie. La note vient APRÈS :
         on ne demande pas à quelqu'un de noter un service avant de lui avoir laissé finir ce qu'il était venu faire. */
      var servie = cid2 && D.rencontresClient ? D.rencontresClient(cid2).filter(function (r) {
        return r.statut === 'servie' && (r.codes || []).length && !bonDejaPose(r);
      })[0] : null;
      if (servie) {
        $('agt-encours').hidden = false;
        $('agt-encours').innerHTML = '<b>' + esc(servie.distributeur || 'Ton distributeur') + ' t\'a remis '
            + (servie.codes.length > 1 ? esc(String(servie.codes.length)) + ' bons d’achat' : 'ton bon d’achat') + '.</b>'
          + '<div style="margin-top:7px;font-family:var(--font-mono,monospace);font-size:14px;font-weight:800;letter-spacing:.08em;color:var(--color-ink)">'
            + servie.codes.map(function (x) { return esc(x); }).join('<br>') + '</div>'
          + '<p style="margin:6px 0 0;font-size:11.5px;line-height:1.5;color:var(--color-muted)">Il ne reste qu\'à régler ta commande avec : ' + (servie.codes.length > 1 ? 'saisis-les l\'un après l\'autre' : 'saisis-le') + ' dans « J\'ai un bon d’achat ».</p>'
          + '<button type="button" id="agt-payer" class="pec-cta tap" style="display:block;width:100%;text-align:center;margin-top:10px">Régler maintenant avec ce bon</button>';
        var bp = $('agt-payer');
        if (bp) bp.addEventListener('click', function () { poserCode(servie.codes[0]); });
        $('agt-liste').innerHTML = '';
        var zp1 = $('agt-pt'); if (zp1) zp1.hidden = true;
        return;
      }
      if (aNoter) {
        /* (20/09) LES ÉTOILES SONT SUR L'ÉCRAN DE LA RENCONTRE, avec le reste de son histoire : les avoir
           aussi ici, c'était deux endroits pour écrire la même note. On la RAPPELLE, et on y mène. */
        $('agt-encours').hidden = false;
        $('agt-encours').innerHTML = '<b>Comment s\'est passée ta rencontre avec ' + esc(aNoter.distributeur || 'ton distributeur') + ' ?</b>'
          + '<a href="' + esc(urlRencontre(aNoter.id)) + '" class="tap" style="display:block;margin-top:8px;font-weight:800;color:var(--color-primary-dark)">Laisser ma note — ça aide les prochains clients →</a>';
        $('agt-form').style.display = 'none';
        $('agt-liste').innerHTML = '';
        var zp1 = $('agt-pt'); if (zp1) zp1.hidden = true;
        return;
      }
      var ap = D.bonsVenteApercu ? D.bonsVenteApercu(m) : { ok: false, motif: '' };
      $('agt-titre').textContent = ap.ok && ap.n > 1 ? ap.n + ' bons d’achat à te remettre' : 'Un bon d’achat à te remettre';
      /* (23/09) LE DÉPLACEMENT NE SE CHIFFRE PLUS ICI : chaque commissionnaire propose son tarif après la
         demande, et la cliente choisit. On ne lui annonce donc que ce qui est certain — la valeur du bon —
         et on lui dit ce qui va se passer ensuite, plutôt que d'inventer un prix moyen. */
      $('agt-montant').innerHTML = ap.ok
        ? 'Bon d’achat <b>' + esc(D.eur(ap.montant)) + '</b>' + (ap.n > 1 ? ' en ' + esc(String(ap.n)) + ' titres (' + esc(ap.parts.map(function (x) { return D.eur(x); }).join(' + ')) + ')' : '')
          + '<br><span style="color:var(--color-muted)">Les commissionnaires disponibles te proposeront leur tarif de déplacement : tu choisis celui que tu veux.</span>'
        : esc(ap.motif);
      /* LA CARTE DU RÉCAP NE S'AFFICHE QUE SI ELLE A QUELQUE CHOSE À DIRE — un refus d'aperçu (montant hors
         bornes) se lit dans la première ligne, et les deux autres restent vraies. */
      var zr = $('agt-recap'); if (zr) zr.hidden = false;
      rendreLieux();
      var ville = agtVille();
      var ags = (D.agentsMobiles && ville) ? D.agentsMobiles({ ville: ville }) : [];
      /* (20/09, soir — « le choix d'horaire est illogique car les commandes sont bloquées ») LA FENÊTRE
         REMPLACE L'HEURE, et elle se dit DANS LES DEUX CAS. Elle n'apparaissait que faute de distributeur,
         comme une consolation ; c'est pourtant la seule durée du rendez-vous — celle de la commande. */
      var fen = ' Ta demande reste ouverte ' + D.rencontreFenetreMin() + ' min : le temps que ta commande tient.';
      $('agt-dispo').textContent = !ville ? 'Saisis l\'adresse où il vient te rejoindre — c\'est sa commune qui dit à quels distributeurs proposer la course.' : (ags.length
        ? ags.length + ' distributeur' + (ags.length > 1 ? 's' : '') + ' se déplace' + (ags.length > 1 ? 'nt' : '') + ' à ' + ville + '.' + fen
        : 'Personne ne se déplace encore à ' + ville + ' — tu peux quand même demander.' + fen);
      $('agt-liste').innerHTML = ags.map(function (a) {
        return '<div class="agtc"><span style="flex:1;min-width:0"><span class="nm">' + esc(a.enseigne) + '</span>'
          + '<span class="zn">' + esc(a.zoneLbl) + '</span></span>'
          + '<span class="nt">' + (a.note == null ? 'pas encore noté' : '★ ' + a.note + ' · ' + a.avis + ' avis') + '</span></div>';
      }).join('');
      $('agt-demander').disabled = !ap.ok;
    }
    /* (20/09, fondatrice : « la navigation n'est pas fluide ») CHOISIR UN CHEMIN Y AMÈNE. Le trio ouvrait sa
       section SOUS la ligne de flottaison : on cliquait, rien ne semblait bouger, et il fallait descendre
       chercher soi-même ce qu'on venait de demander. Le volet ouvert vient maintenant se placer sous le trio,
       qui reste visible — on voit à la fois ce qu'on a choisi et ce qu'on doit y faire. */
    /* CE QUI DÉFILE ICI N'EST PAS LA PAGE. `.pec-device` a une hauteur fixe et `overflow:hidden` : c'est une
       zone INTÉRIEURE qui défile (socle v2). `window.scrollBy` n'y peut rien, et un `scrollIntoView` y perd
       l'offset qu'on veut garder. On remonte donc jusqu'au vrai défileur et on le pose nous-mêmes. */
    function defileur(el) {
      for (var p = el.parentElement; p; p = p.parentElement) {
        var o = getComputedStyle(p).overflowY;
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
      }
      return null;
    }
    function amenerAuVolet(chemin) {
      var z = $(chemin === 'partenaire' ? 'ach-carte-commerce' : chemin === 'agent' ? 'ach-carte-agent' : 'pane-bon');
      if (!z || z.hidden) return;
      var d = defileur(z);
      var hauteur = d ? d.clientHeight : window.innerHeight;
      var haut = d ? (z.getBoundingClientRect().top - d.getBoundingClientRect().top) : z.getBoundingClientRect().top;
      /* on ne bouge que s'il y a de quoi : un volet déjà installé dans la moitié haute ne se déplace pas sous
         les doigts. Le seuil est une PROPORTION de la zone visible, pas un nombre de pixels — sur un téléphone
         de 812 px et sur un cadre de 900, ce n'est pas la même chose d'être « en bas ». */
      if (haut < hauteur * 0.55) return;
      /* LE TRIO RESTE À L'ÉCRAN : on s'arrête 90 px au-dessus du volet, pour qu'on voie à la fois ce qu'on a
         choisi et ce qu'il y a à y faire. */
      if (d) d.scrollTo({ top: Math.max(0, d.scrollTop + haut - 90), behavior: 'smooth' });
      else if (z.scrollIntoView) z.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    [['op-ou-enligne', 'enligne'], ['op-ou-partenaire', 'partenaire'], ['op-ou-agent', 'agent']].forEach(function (x) {
      var b = $(x[0]); if (!b) return;
      b.addEventListener('click', function () {
        ouChemin = x[1]; if (ouChemin !== 'partenaire') achArreter();
        peindreOu();
        amenerAuVolet(ouChemin);
      });
    });
    if ($('agt-encours')) $('agt-encours').addEventListener('click', function (e) {
      if (!R.rencontre) return;
      var an = e.target.closest ? e.target.closest('#agt-annuler') : null;
      if (an) { var enc = R.rencontre.enCours(); if (enc) R.rencontre.annuler(enc.id); peindreAgent(); return; }
      var py = e.target.closest ? e.target.closest('#agt-payer') : null;
      if (py) { var sv = R.rencontre.servie(); if (sv) poserCode(sv.codes[0]); }
    });
    /* (20/09) LE BORD ROUGE S'EFFACE DÈS QU'ON CORRIGE : garder la faute affichée pendant qu'on la répare, c'est
       accuser quelqu'un qui est déjà en train de faire ce qu'on lui demande. */
    ['df-numero', 'df-voie', 'df-cp', 'df-ville', 'agt-note'].forEach(function (id) {
      var el = $(id); if (!el) return;
      var net = function () {
        el.classList.remove('ko');
        var e1 = $('agt-erreur'); if (e1) e1.hidden = true;
        var e2 = $('df-err'); if (e2) e2.hidden = true;
      };
      el.addEventListener('input', net); el.addEventListener('change', net);
    });
    /* RETAPER LA VOIE DÉTACHE LA POSITION : elle était celle de l'adresse d'AVANT. Mieux vaut un point
       approché — et la légende qui le dit — qu'une épingle plantée sur la rue précédente. */
    ['df-numero', 'df-voie', 'df-cp', 'df-ville'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('input', function () {
        if (dfGeo) { dfGeo = null; dfAide(DF_AIDE_NEUVE); $('df-geoloc-txt').textContent = 'Utiliser ma position'; }
      });
      // la commune change les distributeurs joignables et le point de la carte : on repeint à la sortie du champ
      el.addEventListener('change', peindreAgent);
    });
    /* ══ (19/09, nuit ; refondu le 20/09) LES GESTES DU CARNET — aucun `onclick` dans le balisage ════════ */
    if ($('lieux')) $('lieux').addEventListener('click', function (e) {
      var aj = e.target.closest ? e.target.closest('#adr-ajouter') : null;
      if (aj) { adrCharger(null); agtLieuMemo(); peindreAgent(); ($('df-q') || $('df-numero')).focus(); return; }
      var b = e.target.closest ? e.target.closest('[data-adr-id]') : null; if (!b) return;
      adrCharger(D.adresse(b.getAttribute('data-adr-id')));
      agtLieuMemo();
      peindreAgent();
    });

    /* ══ (19/09, nuit — « tu n'as rien récupéré la recherche d'adresse ») LA RECHERCHE ══════════════════
       Base Adresse Nationale, via `PEC_GEO.autocompleteAdresse` : suggestions sous le champ, la suggestion
       choisie remplit les QUATRE champs et pose la géoposition. Elle était branchée sur « Voie », où personne
       ne la trouvait ; elle a son propre champ, en tête du formulaire, et « Voie » la garde en secours pour
       qui commence à taper là. ══ */
    function dfRemplir(sug) {
      adrDetacherSiAutre({ numero: sug.numero || '', voie: sug.voie || sug.label || '', cp: sug.cp || '', ville: sug.ville || '' });
      $('df-numero').value = sug.numero || '';
      $('df-voie').value = sug.voie || sug.label || '';
      $('df-cp').value = sug.cp || '';
      $('df-ville').value = sug.ville || '';
      if (sug.geo) {
        dfGeo = sug.geo;
        dfAide('Adresse trouvée et géolocalisée.');
      } else {
        dfGeo = null;
        dfAide('Adresse reprise, sans position : touche « Utiliser ma position » si tu es sur place.');
      }
      $('df-geoloc-txt').textContent = 'Utiliser ma position';
      $('df-err').hidden = true;
      [].forEach.call(document.querySelectorAll('#dom-form .pec-input.ko'), function (x) { x.classList.remove('ko'); });
      peindreAgent();
    }
    if (window.PEC_GEO && PEC_GEO.autocompleteAdresse) {
      if ($('df-q')) PEC_GEO.autocompleteAdresse($('df-q'), dfRemplir);
      if ($('df-voie')) PEC_GEO.autocompleteAdresse($('df-voie'), dfRemplir);
    }
    /* ══ (20/09, fondatrice : « il peut changer par SA POSITION … ATTENTION RÉCUPÈRE LE NOM DES RUES ») ═══
       LA POSITION REMPLIT L'ADRESSE. Elle attachait une paire de coordonnées à une adresse qu'il fallait
       quand même taper : se localiser ne faisait donc gagner aucun champ. Elle passe maintenant par le
       reverse de la Base Adresse Nationale (`adresseDepuisPosition`) — numéro, voie, code postal, commune —
       et la géoposition gardée est celle de l'APPAREIL, plus fine que le centre de la voie. Si la base ne
       reconnaît rien, on le DIT et on garde la position : la cliente complète à la main. */
    function dfPositionFix(f) {
      var t = $('df-geoloc-txt');
      achPos = achPos || f;
      dfGeo = { lat: f.lat, lng: f.lng, precision: f.precision };
      t.textContent = 'Lecture de l’adresse…';
      /* LE POINT EST DÉJÀ JUSTE : la carte s'y pose TOUT DE SUITE, sans attendre la lecture de la rue. Si le
         réseau tarde ou ne répond pas, la cliente a quand même son rendez-vous au bon endroit. */
      peindreAgent();
      if (!PEC_GEO.adresseDepuisPosition) { t.textContent = '✓ Position attachée'; return; }
      PEC_GEO.adresseDepuisPosition(f, function (a) {
        if (!a) {
          t.textContent = '✓ Position attachée (~' + (f.precision || 0) + ' m) — la rue n’a pas été reconnue, complète-la ci-dessous.';
          peindreAgent(); return;
        }
        adrDetacherSiAutre(a);
        $('df-numero').value = a.numero || '';
        $('df-voie').value = a.voie || '';
        $('df-cp').value = a.cp || '';
        $('df-ville').value = a.ville || '';
        dfGeo = a.geo;
        t.textContent = '✓ ' + (a.label || 'Adresse relevée') + (f.precision ? ' (~' + f.precision + ' m)' : '');
        dfAide('Adresse relevée de ta position — vérifie le numéro.');
        $('df-err').hidden = true;
        [].forEach.call(document.querySelectorAll('#dom-form .pec-input.ko'), function (x) { x.classList.remove('ko'); });
        peindreAgent();
      });
    }
    /* (20/09, fondatrice : « pourquoi lorsque je recherche ma position ça ne la détecte pas ? ») UN ÉCHEC DE
       POSITION SE LIT EN ENTIER, ET EN ROUGE. Il s'écrivait DANS LE LIBELLÉ DU BOUTON : une phrase de deux
       lignes qui dit où cliquer n'y tient pas, et rien n'y a l'air d'une erreur. Elle va donc dans la ligne de
       refus du formulaire (`df-err`), et le bouton reprend son nom — prêt à être retouché. */
    function dfEchecPosition(msg) {
      var t = $('df-geoloc-txt'), e = $('df-err');
      if (t) t.textContent = 'Utiliser ma position';
      if (e) { e.hidden = false; e.textContent = msg; if (e.scrollIntoView) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      var q = $('df-q'); if (q && q.focus) q.focus();   // la porte de sortie est juste au-dessus : la recherche
    }
    function dfPosition() {
      var t = $('df-geoloc-txt');
      if (!window.PEC_GEO) { dfEchecPosition('Géolocalisation indisponible sur cet appareil — cherche ton adresse ci-dessus.'); return; }
      t.textContent = 'Recherche de ta position…';
      PEC_GEO.localiser(function (f) {
        PEC_GEO.noterAccord();
        if (PEC_GEO.appliquerRetention) PEC_GEO.appliquerRetention();
        dfPositionFix(f);
      }, dfEchecPosition);
    }
    if ($('df-geoloc')) $('df-geoloc').addEventListener('click', function () {
      /* ON DIT À QUOI ELLE SERT AVANT QUE LE NAVIGATEUR NE LE DEMANDE — c'est le rôle de la modale d'accord.
         Accord déjà donné, déjà répondu, ou site BLOQUÉ : on ne repose pas la question. Dans le dernier cas
         `dfPosition` échoue tout de suite, et son refus nomme le geste — c'est plus utile qu'une modale. */
      if (!window.PEC_GEO || !$('geopop') || PEC_GEO.accordConnu() || geopopRepondu || !PEC_GEO.permissionEtat) { dfPosition(); return; }
      PEC_GEO.permissionEtat(function (etat) {
        if (etat !== 'prompt') { dfPosition(); return; }
        geopopApres = dfPositionFix;
        geopopPeindre();
      });
    });
    /* LE CHAMP QUE LE DATA-LAYER NOMME → CELUI QU'ON MARQUE À L'ÉCRAN. La correspondance vit ici, en un seul
       endroit : ailleurs, un `$('agt-' + champ)` silencieux ne marquait plus rien dès qu'un champ changeait de nom. */
    var AGT_CHAMPS = { ville: 'df-ville', adresse: 'df-numero', cp: 'df-cp' };
    if ($('agt-demander')) $('agt-demander').addEventListener('click', function () {
      var e0 = $('agt-erreur'); e0.hidden = true;
      /* (20/09) LE CHAMP EN FAUTE SE MARQUE, ET LUI SEUL : un bord rouge sur le champ nommé, retiré dès la
         frappe suivante. « Formulaire invalide » ne dit à personne où regarder. */
      [].forEach.call(document.querySelectorAll('#agt-form .pec-input.ko'), function (x) { x.classList.remove('ko'); });
      /* (21/09) SUR LE RÉSEAU D'UNE BOUTIQUE, L'ADRESSE N'ENTRE DANS AUCUN CARNET : elle part avec la demande, et le
         contrôle à blanc du réseau dit ce qui manque — avec le champ à marquer. */
      if (R.rencontre) {
        var n0 = adrSaisie();
        rdvBrouillon = { adresse: { numero: n0.numero, voie: n0.voie, cp: n0.cp, ville: n0.ville, etage: n0.etage,
          porte: n0.porte, instructions: n0.instructions, geo: dfGeo || null }, note: $('agt-note') ? $('agt-note').value : '' };
        var v0 = R.rencontre.verifier(rdvBrouillon);
        if (!v0.ok) {
          e0.hidden = false; e0.textContent = v0.motif;
          var c0 = v0.champ && AGT_CHAMPS[v0.champ] ? $(AGT_CHAMPS[v0.champ]) : null;
          if (c0) { c0.classList.add('ko'); if (c0.focus) c0.focus(); if (c0.scrollIntoView) c0.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
          return;
        }
        rdvPopOuvrir(v0);
        return;
      }
      /* ① L'ADRESSE D'ABORD, ET ELLE S'ENREGISTRE : c'est le carnet du compte qui la porte, avec ses précisions
         d'accès — la prochaine rencontre les retrouvera sans les retaper. Refus : le motif est déjà affiché et
         le champ marqué par `adrEnregistrer`, on s'arrête là. */
      var aC = adrEnregistrer();
      if (!aC) return;
      /* (19/09, nuit) ON NE PART PLUS D'UN SEUL CLIC. La demande est PRÉPARÉE, contrôlée par le data-layer,
         puis la modale de mise en relation s'ouvre : ce qui va se passer, le numéro qu'on appellera, le canal,
         et l'accord. Elle ne part qu'à la confirmation — c'est ce que faisait l'écran d'avant, et c'était plus
         clair que de voir une demande s'envoyer toute seule. */
      rdvBrouillon = { montant: agtMontant(), adresseId: aC.id, note: $('agt-note') ? $('agt-note').value : '' };
      /* LE CONTRÔLE D'ABORD, LA MODALE ENSUITE : on ne fait pas lire trois écrans à quelqu'un pour lui dire
         ensuite qu'il manque l'heure. `rencontreVerifier` rend les mêmes refus que la demande, sans rien écrire. */
      var v = D.rencontreVerifier(rdvBrouillon);
      if (!v.ok) {
        e0.hidden = false; e0.textContent = v.motif;
        var ch = v.champ && AGT_CHAMPS[v.champ] ? $(AGT_CHAMPS[v.champ]) : null;
        if (ch) { ch.classList.add('ko'); if (ch.focus) ch.focus(); if (ch.scrollIntoView) ch.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return;
      }
      rdvPopOuvrir(v);
    });

    /* ══ (19/09, nuit — « ça doit mettre en relation et un appel pour confirmer ») LA MODALE ═══════════════
       Elle dit ce qui va se passer, montre le numéro du COMPTE (jamais un numéro écrit ici), laisse choisir le
       canal, et exige un accord avant de lancer quoi que ce soit. Le distributeur ne bouge qu'après l'appel. */
    var rdvBrouillon = null;
    /* (20/09, soir — passe de code mort) `agtAppel` est partie avec le bandeau qui la lisait : cet écran ne
       rejoue plus l'état d'une rencontre, il y mène. L'appel de l'hôte se lit là où il se passe, sur
       25-rencontre. */
    function rdvPopFermer() { var z = $('rdvpop'); if (z) z.hidden = true; }
    function rdvPopOuvrir(v) {
      var z = $('rdvpop'); if (!z) return;
      var tc = $('rdvpop-tel-compte'), ts = $('rdvpop-tel-saisie');
      if (tc) tc.hidden = !!R.rencontre;
      if (ts) ts.hidden = !R.rencontre;
      if (R.rencontre) {
        $('rdvpop-p').innerHTML = R.rencontre.popupHTML;
        $('rdvpop-recap').innerHTML = '<b>' + esc(v.lieu) + '</b><br>' + R.rencontre.recapHTML(v.montant);
        $('rdvpop-rgpd-txt').textContent = rdvConsentementTxt();
        $('rdvpop-rgpd').checked = false;
        $('rdvpop-err').hidden = true;
        $('rdvpop-ok').textContent = 'J’ai compris — qu’il m’appelle';
        rdvPopCta();
        z.hidden = false;
        var ti = $('rdvpop-tel-in'); if (ti && ti.focus) ti.focus();
        return;
      }
      /* (21/09) Un `var R` (le référentiel des bons, jamais lu ici) vivait sur cette ligne : il MASQUAIT le réseau
         `R` dans toute la fonction — la modale d'une boutique restait fermée sur « Cannot read … rencontre ». */
      var hote = D.hoteEnPoste ? D.hoteEnPoste() : null;
      $('rdvpop-p').innerHTML = (hote && hote.nom ? '<b style="color:var(--color-ink)">' + esc(hote.nom) + '</b>, hôte PayEnCash,' : 'Un hôte PayEnCash')
        + ' t’appelle pour <b style="color:var(--color-ink)">confirmer le rendez-vous</b> et t’expliquer comment ça se passe. '
        + '<b style="color:var(--color-ink)">Le distributeur ne part qu’après cet appel</b> — c’est la règle, pour toi comme pour lui.';
      var ap = v.apercu || {};
      $('rdvpop-recap').innerHTML = '<b>' + esc(v.lieu) + '</b>' + (v.ville ? ' · ' + esc(v.ville) : '')
        + '<br>' + (ap.n > 1 ? esc(String(ap.n)) + ' bons d’achat' : 'Un bon d’achat') + ' de <b>' + esc(D.eur(ap.montant)) + '</b>'
        + '<br><span style="color:var(--color-muted)">Le tarif du déplacement te sera proposé par les commissionnaires disponibles.</span>';
      var cl = D.clientCourant ? D.clientCourant() : null;
      var tel = (cl && (cl.tel || cl.telephone)) || (D.profil || {}).tel || null;
      $('rdvpop-tel').textContent = tel || 'aucun numéro au compte';
      /* LA PHRASE DE CONSENTEMENT EST CELLE QU'ON ENREGISTRE — pas un résumé poli d'une autre phrase. */
      $('rdvpop-rgpd-txt').textContent = rdvConsentementTxt();
      $('rdvpop-rgpd').checked = false;
      $('rdvpop-err').hidden = true;
      rdvPopCta();
      z.hidden = false;
    }
    function rdvCanal() {
      var b = document.querySelector('#rdvpop-canaux [aria-pressed="true"]');
      return (b && b.getAttribute('data-canal')) || 'appel';
    }
    /* LE LIBELLÉ D'UN CANAL SE LIT SUR SON BOUTON — il n'est écrit qu'une fois, dans le balisage, et
       « whatsapp » ne s'affiche jamais en minuscules au milieu d'une phrase. */
    function rdvCanalLbl(k) {
      var b = document.querySelector('#rdvpop-canaux [data-canal="' + k + '"] span');
      return b ? b.textContent : k;
    }
    function rdvConsentementTxt() {
      return 'J’accepte d’être contacté·e par ' + rdvCanalLbl(rdvCanal()) + ' pour confirmer ce rendez-vous. '
        + (R.rencontre ? R.rencontre.accordSuffixe : 'Mon numéro n’est utilisé que pour cet appel.');
    }
    function rdvPopCta() {
      var ok = $('rdvpop-rgpd').checked, b = $('rdvpop-ok');
      b.setAttribute('aria-disabled', String(!ok));
      b.style.opacity = ok ? '' : '.45';
    }
    if ($('rdvpop-canaux')) $('rdvpop-canaux').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-canal]') : null; if (!b) return;
      [].forEach.call(this.querySelectorAll('[data-canal]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $('rdvpop-rgpd-txt').textContent = rdvConsentementTxt();   // la phrase suit le canal : c'est elle qu'on enregistre
    });
    if ($('rdvpop-rgpd')) $('rdvpop-rgpd').addEventListener('change', rdvPopCta);
    if ($('rdvpop-non')) $('rdvpop-non').addEventListener('click', function () { rdvPopFermer(); });
    if ($('rdvpop-ok')) $('rdvpop-ok').addEventListener('click', function () {
      var e1 = $('rdvpop-err'); e1.hidden = true;
      if (!$('rdvpop-rgpd').checked) { e1.hidden = false; e1.textContent = 'Coche l\'accord : on ne t\'appelle pas sans ton autorisation.'; return; }
      if (!rdvBrouillon) { rdvPopFermer(); return; }
      if (R.rencontre) {
        var ti = $('rdvpop-tel-in'); if (ti) ti.classList.remove('ko');
        var rr = R.rencontre.demander(Object.assign({}, rdvBrouillon, { tel: ti ? ti.value : '', canal: rdvCanal(), consentement: rdvConsentementTxt() }));
        if (!rr.ok) {
          e1.hidden = false; e1.textContent = rr.motif;
          if (rr.champ === 'tel' && ti) { ti.classList.add('ko'); ti.focus(); }
          return;
        }
        rdvBrouillon = null;
        rdvPopFermer();
        peindreAgent();
        amenerAuVolet('agent');
        return;
      }
      var r = D.rencontreDemander(rdvBrouillon);
      if (!r.ok) { e1.hidden = false; e1.textContent = r.motif; return; }
      var canal = rdvCanal();
      /* LE CONSENTEMENT EST ENREGISTRÉ AVANT L'APPEL, avec la phrase exacte qu'elle a lue. */
      try { if (D.consentir) D.consentir('mise-en-relation-rencontre', rdvConsentementTxt()); } catch (e) {}
      /* L'APPEL PART EN HOTLINE, avec la réf de la rencontre : c'est lui qui la confirme, et l'écran de l'hôte
         le voit arriver. Sans bus, on ne fait pas semblant : la rencontre existe, l'appel est dit « à rappeler ». */
      var appel = null;
      try {
        if (window.PEC_BUS && PEC_BUS.demanderAppel) appel = PEC_BUS.demanderAppel({ type: 'securisation', canal: canal,
          ref: r.rencontre.ref, client: (D.clientCourant && D.clientCourant() || {}).nomComplet,
          clientId: D.clientActifGet ? D.clientActifGet() : undefined });
      } catch (e) {}
      rdvBrouillon = null;
      rdvPopFermer();
      peindreAgent();
      /* ══ (20/09, décision fondatrice : « reprends le design, la hiérarchie, la navigation intuitive — il y
         avait une version CARTE ultra complète ») LA RENCONTRE A SON ÉCRAN ════════════════════════════════
         L'état vivant tenait dans un bandeau au milieu de cet écran de CHOIX : il fallait faire défiler trois
         cartes pour savoir où en était quelqu'un qui roulait vers soi. La demande partie, on passe donc à
         l'écran de la rencontre — carte plein écran, radar sur le point, et la feuille du bas. C'est la
         hiérarchie de l'ancien écran d'agent (17/09), et elle était juste. */
      location.href = urlRencontre(r.rencontre.id);
    });
    /* (19/09, soir) les deux boutons du duo n'existent plus : le trio les remplace. */

      /* CE QUE LA PAGE PEUT DEMANDER AU CHOIX — et rien d'autre : le reste est sa mécanique interne. */
      return {
        choisir: function (c) { ouChemin = c; peindreOu(); },
        peindre: peindreOu,
        rafraichirListe: function () { if (achPeint) achListe(); },
        poserCode: poserCode,
        chemin: function () { return ouChemin; }
      };
    }
  };
})();
