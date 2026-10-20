/* LE BON D’ACHAT PAYENCASH — le métier PUR (ni base, ni HTTP : testé par test/run-tests.js).
   (18/09 — décision fondatrice) Un bon d'achat PRÉPAYÉ à montant libre, vendu en espèces au comptoir d'un
   commerçant partenaire (ou émis par le manager : carte cadeau), utilisable sur Mode et Fly en une ou plusieurs
   fois. Titre accepté par le seul émetteur, AJEK — art. L521-3 I 1° CMF (hors agrément ; déclaration ACPR au-delà
   d'1 M€ / 12 mois) ; hors monnaie électronique (art. L315-1 CMF a contrario) ; bon d’achat à usages multiples, TVA due à
   l'utilisation (art. 256 ter CGI). Ce fichier reproduit EXACTEMENT les règles du data-layer client
   (ui/assets/payencash-data.js, blocs du BON D’ACHAT PAYENCASH, du PRÉLÈVEMENT À LA VENTE et du RELEVÉ MENSUEL) : mêmes bornes, mêmes
   arrondis, mêmes motifs — basculer sur l'API ne change aucun chiffre ni aucun refus affiché.
   Argent = CENTIMES (entiers), partout. Les réglages sont VIVANTS (settings bons d’achat.* / ref.bons) : CFG_DEFAUT n'est
   que le défaut du référentiel, l'appelant passe la configuration lue en base. */
const crypto = require('crypto');
const { eur } = require('./money');

/* Les défauts de ref.bons — les valeurs d'ouverture, jamais la vérité : le manager les ajuste (10-configuration). */
const CFG_DEFAUT = Object.freeze({
  minimumCents: 500,             // 5 € : un bon d’achat fait au moins ça
  plafondBonCents: 25000,        // 250 € par bon d’achat (LCB-FT) — pour plus, plusieurs bons d’achat
  plafondClientJourCents: 100000,// 1 000 € de bons d’achat UTILISÉS par client et par jour (à l'usage, compte vérifié)
  validiteMois: 12,              // validité d'un bon d’achat à compter de l'émission
  commissionPct: 1.1,            // 1,10 % HT de commission de distribution pour le partenaire
  tvaCommissionPct: 20,          // la commission est une prestation de services : TVA 20 %
  annulationMinutes: 30,         // un bon d’achat émis par erreur s'annule au comptoir dans ce délai, s'il n'a pas servi
  /* (21/09 — décision fondatrice « supprime Stancer de notre modèle ») LE PRESTATAIRE QUI PRÉLÈVE LE COMMERÇANT :
     Stripe — 1,5 % + 0,25 € par transaction carte de l'Espace économique européen (tarif standard relevé le 18/09 sur
     stripe.com/fr/pricing). = ref.bons.psp côté client. */
  pspVariablePct: 1.5,
  pspFixeCents: 25
});

/* L'alphabet du code : ni 0/O ni 1/I — un code se dicte au téléphone et se relit sur un ticket (= PEC_DATA.BON_ALPHABET). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR = 12;

/* Les libellés d'état (= PEC_DATA.BON_ETATS), par clé SQL. */
const ETATS = Object.freeze({
  active: 'Actif', used_up: 'Utilisé en totalité', expired: 'Expiré', blocked: 'Bloqué par PayEnCash', cancelled: 'Annulé'
});

/* La configuration effective : les défauts, recouverts par ce que l'appelant a lu en base. Une valeur absente,
   vide ou aberrante est IGNORÉE — un réglage vidé n'est pas un plafond à zéro (même règle que money.configurerGrilleMode). */
function configurer(o = {}) {
  const c = Object.assign({}, CFG_DEFAUT);
  Object.keys(CFG_DEFAUT).forEach((k) => {
    const v = o[k];
    if (v === null || v === undefined || v === '') return;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) c[k] = n;
  });
  return c;
}

/* ── LE CODE ───────────────────────────────────────────────────────────────────────────────────────────────── */
/* Un code neuf : 12 caractères de l'alphabet, lus en trois groupes de quatre (XXXX-XXXX-XXXX). Tirage
   cryptographique côté serveur ; `alea(n)` (un entier dans [0, n)) s'injecte pour les tests. */
function nouveauCode(alea = (n) => crypto.randomInt(n)) {
  let code = '';
  for (let i = 0; i < LONGUEUR; i++) {
    if (i && i % 4 === 0) code += '-';
    code += ALPHABET[alea(ALPHABET.length)];
  }
  return code;
}

/* Le code tel que le client le tape (minuscules, espaces, tirets oubliés) → sa forme canonique, ou null si ce
   n'est pas un code de bon d’achat (= PEC_DATA.bonNormaliserCode). */
function normaliserCode(s) {
  const n = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (n.length !== LONGUEUR) return null;
  return n.slice(0, 4) + '-' + n.slice(4, 8) + '-' + n.slice(8, 12);
}

/* Ce qui s'affiche partout ailleurs qu'au ticket : ••••-••••-XXXX (= PEC_DATA.bonMasque). */
function masquerCode(code) {
  const c = String(code || '');
  return c.length >= 4 ? '••••-••••-' + c.slice(-4) : c;
}

/* L'EMPREINTE du code — la seule chose que la base garde (gift_cards.code_hash). SHA-256 du code normalisé, salé
   par un poivre serveur (BONS_HASH_PEPPER) : sans lui, une fuite de la table ne rend pas les codes rejouables
   ailleurs ; avec lui, la recherche par code reste déterministe. Un code invalide n'a pas d'empreinte. */
function hacherCode(code, pepper = process.env.BONS_HASH_PEPPER || '') {
  const n = normaliserCode(code);
  if (!n) return null;
  return crypto.createHash('sha256').update(pepper + '|' + n).digest('hex');
}

/* ── LE MONTANT ────────────────────────────────────────────────────────────────────────────────────────────── */
/* Le montant d'un bon d’achat à l'émission : un entier de centimes, entre le minimum et le plafond par bon d’achat
   (= PEC_DATA.bonEmettre, mêmes refus, mêmes phrases). */
function controlerMontant(cents, cfg) {
  const c = configurer(cfg), m = Number(cents);
  if (!Number.isInteger(m) || m <= 0) return { ok: false, champ: 'montant', motif: 'Montant invalide — saisis un montant en euros.' };
  if (m < c.minimumCents) return { ok: false, champ: 'montant', motif: 'Un bon d’achat fait au moins ' + eur(c.minimumCents) + '.' };
  if (m > c.plafondBonCents) return { ok: false, champ: 'montant', motif: 'Un bon d’achat ne dépasse pas ' + eur(c.plafondBonCents) + ' (plafond par bon d’achat, LCB-FT). Pour plus, émets plusieurs bons d’achat.' };
  return { ok: true, montantCents: m };
}

/* ── L'ÉTAT ────────────────────────────────────────────────────────────────────────────────────────────────── */
/* L'état se DÉRIVE (= PEC_DATA.bonEtat) : seuls « bloqué » et « annulé » sont écrits (gift_cards.status) ;
   « expiré » se lit sur expires_at, « épuisé » sur balance_cents. L'ordre compte : un bon d’achat annulé reste annulé
   même expiré, un bon d’achat bloqué reste bloqué même à zéro. */
function etatBon(bon, now = Date.now()) {
  if (!bon) return 'inconnu';
  if (bon.status === 'cancelled') return 'cancelled';
  if (bon.status === 'blocked') return 'blocked';
  const exp = bon.expires_at ? new Date(bon.expires_at).getTime() : null;
  if (exp && now > exp) return 'expired';
  if (!(Number(bon.balance_cents) > 0)) return 'used_up';
  return 'active';
}
const etatLibelle = (etat) => ETATS[etat] || etat || '—';

const dateFr = (x) => new Date(x).toLocaleDateString('fr-FR');

/* Le motif qui refuse un bon d’achat selon son état — chaque refus a SA phrase, jamais un échec muet
   (= PEC_DATA.bonValider). `dernierDebit` ({at, order_ref}) enrichit « épuisé » ; null quand le bon d’achat est actif. */
function motifEtat(bon, etat, cfg, dernierDebit) {
  const c = configurer(cfg);
  switch (etat) {
    case 'cancelled': return 'Bon d’achat annulé' + (bon.cancelled_at ? ' le ' + dateFr(bon.cancelled_at) : '') + (bon.cancel_reason ? ' (' + bon.cancel_reason + ')' : '') + '.';
    case 'blocked': return 'Bon d’achat bloqué par PayEnCash' + (bon.block_reason ? ' — ' + bon.block_reason : '') + ' : contacte le service client.';
    case 'expired': return 'Bon d’achat expiré le ' + dateFr(bon.expires_at) + ' (valable ' + c.validiteMois + ' mois).';
    case 'used_up': return 'Bon d’achat entièrement utilisé' + (dernierDebit && dernierDebit.at ? ' le ' + dateFr(dernierDebit.at) : '') + (dernierDebit && dernierDebit.order_ref ? ' (commande ' + dernierDebit.order_ref + ')' : '') + '.';
    case 'inconnu': return 'Bon d’achat inconnu — vérifie le code du ticket (les bons d’achat sont émis par les commerçants partenaires et par PayEnCash).';
    default: return null;
  }
}

/* ── LE DÉBIT ──────────────────────────────────────────────────────────────────────────────────────────────── */
/* Ce qu'un bon d’achat peut régler MAINTENANT d'un montant demandé : au plus son solde, au plus ce que le plafond du jour
   laisse à ce compte (plafondClientJourCents − déjà utilisé aujourd'hui), au plus le demandé
   (= PEC_DATA.bonValider + bonDebiter). Le refus ferme tout (état, plafond atteint) ; un usage PARTIEL est un succès
   qui le DIT (`partiel`, `plafonne`, `motif` explicatif) — le reste dû se règle autrement. */
function debitPossible(bon, cents, dejaJourCents = 0, cfg, now = Date.now()) {
  const c = configurer(cfg), m = Number(cents);
  if (!Number.isInteger(m) || m <= 0) return { ok: false, motif: 'Montant à débiter invalide.', applicableCents: 0 };
  const etat = etatBon(bon, now);
  if (etat !== 'active') return { ok: false, etat, motif: motifEtat(bon, etat, c), applicableCents: 0 };
  const deja = Math.max(0, Number(dejaJourCents) || 0);
  const resteJour = c.plafondClientJourCents - deja;
  if (resteJour <= 0) {
    return { ok: false, etat, applicableCents: 0,
      motif: 'Plafond atteint : ' + eur(c.plafondClientJourCents) + ' de bons d’achat déjà utilisés aujourd\'hui sur ce compte (limite par client et par jour). Reviens demain, ou règle autrement.' };
  }
  const solde = Number(bon.balance_cents);
  const applicable = Math.min(solde, m, resteJour);
  const plafonne = resteJour < Math.min(solde, m);
  const partiel = applicable < m;
  let motif = null;
  if (partiel) {
    motif = plafonne
      ? 'Plafond journalier : seuls ' + eur(applicable) + ' de ce bon d’achat peuvent encore servir aujourd\'hui sur ce compte.'
      : 'Solde insuffisant : il reste ' + eur(solde) + ' sur ce bon d’achat.';
  }
  return { ok: true, etat, applicableCents: applicable, resteApresCents: solde - applicable, partiel, plafonne, motif };
}

/* Ce qu'un bon d’achat peut encore RE-CRÉDITER sur une commande : Σ débits − Σ re-crédits de cette commande — jamais plus
   que ce que le bon d’achat a réglé (= PEC_DATA.bonRecrediter). Sans commande : sur l'ensemble des mouvements. */
function recreditMax(mouvements = [], orderRef = null) {
  const som = (kind) => mouvements
    .filter((x) => x.kind === kind && (!orderRef || x.order_ref === orderRef))
    .reduce((s, x) => s + (Number(x.amount_cents) || 0), 0);
  return Math.max(0, som('debit') - som('recredit'));
}

/* L'annulation au comptoir : SON point, dans le délai, aucun débit (= PEC_DATA.bonAnnuler). Le manager annule sans
   délai ni point, mais jamais un bon d’achat qui a servi. */
function annulationPossible(bon, mouvements = [], o = {}, cfg, now = Date.now()) {
  const c = configurer(cfg);
  if (!bon) return { ok: false, motif: 'Bon d’achat inconnu.' };
  if (!String(o.motif || '').trim()) return { ok: false, motif: 'Une annulation se motive (erreur de montant, client reparti sans payer…).' };
  if (bon.status === 'cancelled') return { ok: false, motif: 'Bon d’achat déjà annulé.' };
  if (mouvements.some((x) => x.kind === 'debit')) return { ok: false, motif: 'Ce bon d’achat a déjà servi : il ne s\'annule plus (le client détient un solde). Demande un blocage à PayEnCash si besoin.' };
  if (o.partnerId) {
    if (bon.partner_id !== o.partnerId) return { ok: false, motif: 'Ce bon d’achat n\'a pas été vendu par ton point.' };
    if (now - new Date(bon.issued_at).getTime() > c.annulationMinutes * 60000) {
      return { ok: false, motif: 'Délai dépassé : un bon d’achat s\'annule au comptoir dans les ' + c.annulationMinutes + ' min qui suivent sa vente. Au-delà, demande-le à PayEnCash (service client).' };
    }
  }
  return { ok: true };
}

/* La date d'expiration d'un bon d’achat : l'émission + validiteMois (même calcul que le client : setMonth). */
function dateExpiration(issuedAt, cfg) {
  const c = configurer(cfg), d = new Date(issuedAt || Date.now());
  d.setMonth(d.getMonth() + c.validiteMois);
  return d;
}

/* ── LE PRÉLÈVEMENT À LA VENTE (18/09, au soir ; 21/09 : Stripe) ───────────────────────────
   « Le partenaire paye automatiquement notre service par carte lorsqu'il vend un bon d’achat, moins sa marge. »
   Le reversement MENSUEL (créance, échéance, reçus, relances) est ABANDONNÉ : `releveReversement`, `echeance` et
   `statutReversement` sont retirés d'ici avec lui. Ce qui les remplace tient en une fonction : ce qui est DÛ à la
   seconde où le bon d’achat est vendu. */

/* (19/09 — « paramétrer la commission du partenaire pour tous ou un précisément ») LE TAUX D'UN POINT
   (= PEC_DATA.commissionPoint). UN taux vaut pour tout le réseau (settings 'ref.bons.commissionPct') ; un point qui a
   négocié le sien le porte sur sa ligne (`partners.commission_pct`), et c'est celui-là qui s'applique à ses ventes.
   NULL n'est pas zéro : c'est « le taux du réseau » — la colonne est nullable pour cette seule raison. */
function tauxCommission(cfg, tauxPoint) {
  const c = configurer(cfg);
  if (tauxPoint === null || tauxPoint === undefined || tauxPoint === '') return c.commissionPct;
  const n = Number(tauxPoint);
  return (Number.isFinite(n) && n >= 0) ? n : c.commissionPct;
}
/* LE PLAFOND D'UN TAUX (= PEC_DATA.commissionMaxPct) : le dernier taux qui laisse encore quelque chose à prélever.
   Au-delà, la commission TTC atteint la valeur faciale et le point ne pourrait plus vendre. On part du plafond
   arithmétique (TVA comprise) et on REDESCEND tant que le plus petit bon d’achat admis ne laisse rien : les deux
   arrondis au centime coûtent jusqu'à un centime, et ce centime pèse d'autant plus que le montant est petit — le
   montant minimum est donc le pire cas. C'est `montantPreleve` lui-même qui répond : aucune arithmétique recopiée. */
function commissionMaxPct(cfg) {
  const c = configurer(cfg);
  let p = Math.floor((100 / (1 + c.tvaCommissionPct / 100)) * 100) / 100;
  for (let i = 0; i < 500 && p > 0 && !(montantPreleve(c.minimumCents, cfg, p).amountCents > 0); i++) {
    p = Math.round((p - 0.01) * 100) / 100;
  }
  return p;
}

/* CE QUI EST DÉBITÉ SUR LA CARTE DU COMMERCE pour un bon d’achat de `faceValueCents` (= PEC_DATA.partenaireDu, en
   centimes) : la valeur faciale MOINS sa commission TTC. Chaque étape ARRONDIT au centime — commission HT, puis
   TVA sur cette commission — et c'est ce qui garantit que le serveur et l'écran tombent au même centime.
   50 € vendus → 0,55 € HT · 0,11 € de TVA · 0,66 € gardés par le commerce · 49,34 € débités.
   Le commerçant ne nous doit JAMAIS rien : il a déjà payé quand le code s'imprime.
   (19/09) `tauxPoint` — `partners.commission_pct` — l'emporte sur le taux du réseau quand il est posé. */
function montantPreleve(faceValueCents, cfg, tauxPoint) {
  const c = configurer(cfg), v = Math.max(0, Math.round(Number(faceValueCents) || 0));
  const pct = tauxCommission(cfg, tauxPoint);
  const commissionHtCents = Math.round(v * pct / 100);
  const vatCents = Math.round(commissionHtCents * c.tvaCommissionPct / 100);
  const commissionTtcCents = commissionHtCents + vatCents;
  return { faceValueCents: v, commissionPct: pct, commissionHtCents, tvaPct: c.tvaCommissionPct,
    vatCents, commissionTtcCents, amountCents: v - commissionTtcCents };
}

/* CE QUE LE PRESTATAIRE NOUS COÛTE sur un prélèvement (= PEC_DATA.fraisPsp) : un pourcentage du montant débité,
   plus un fixe, arrondi au centime. C'est la marge RÉELLE du manager — jamais montrée au commerçant.
   49,34 € débités → 0,50 € ; 98,68 € → 0,84 €. */
function fraisPsp(amountCents, cfg) {
  const c = configurer(cfg), m = Math.max(0, Math.round(Number(amountCents) || 0));
  if (!(m > 0)) return 0;
  return Math.round(m * c.pspVariablePct / 100 + c.pspFixeCents);
}

/* LA RÉFÉRENCE D'UN PRÉLÈVEMENT (= PEC_DATA.prelevementPartenaire) : 'PAY-000012' quand la banque accepte,
   'ECH-000012' quand elle refuse — le commerçant la lit sur son relevé et l'oppose à son banquier. */
function referenceCharge(n, o = {}) {
  const i = Math.max(1, Math.round(Number(n) || 0));
  return (o.refuse ? 'ECH-' : 'PAY-') + String(i).padStart(6, '0');
}

/* Un mois : 'AAAA-MM' — accepté tel quel, depuis une date SQL ('AAAA-MM-01') ou une Date. */
function mois(x) {
  if (x instanceof Date) return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
  const m = /^(\d{4})-(\d{2})/.exec(String(x || ''));
  return m ? m[1] + '-' + m[2] : null;
}
const premierDuMois = (x) => { const m = mois(x); return m ? m + '-01' : null; };

/* Le numéro de l'autofacture de commission (art. 289 CGI) : AFB-<AAAAMM>-<code du point> — le code = les 8 premiers
   caractères alphanumériques de l'identifiant du point, en majuscules (= PEC_DATA.releveMensuel().autofacture).
   (18/09, soir) C'est tout ce qui survit du reversement mensuel supprimé : la TVA exige une autofacture pour la
   commission du distributeur, même
   quand plus rien n'est dû — et le numéro se DÉRIVE du mois et du point, il ne se stocke pas. */
function numeroAutofacture(periodMonth, partnerId) {
  const m = mois(periodMonth);
  if (!m) return null;
  return 'AFB-' + m.replace('-', '') + '-' + String(partnerId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

module.exports = {
  CFG_DEFAUT, ALPHABET, LONGUEUR, ETATS, configurer,
  nouveauCode, normaliserCode, masquerCode, hacherCode,
  controlerMontant, etatBon, etatLibelle, motifEtat, debitPossible, recreditMax, annulationPossible, dateExpiration,
  montantPreleve, tauxCommission, commissionMaxPct, fraisPsp, referenceCharge, mois, premierDuMois, numeroAutofacture
};
