# Scan de sécurité applicative — OWASP ZAP baseline

**Bloquant « avant ouverture publique »** (Étape 9 · recette de sortie). S'exécute
sur le **vrai code déployé** (staging identique à la prod), jamais sur les maquettes.

## Lancer le scan

```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://staging.api.payencash.fr \
  -r zap-rapport.html -w zap-alertes.md
```

## Critère de sortie

- **Aucune alerte de niveau High** — sinon corriger avant ouverture.
- Alertes Medium : chacune examinée et soit corrigée, soit justifiée par écrit ici.
- Rapport daté archivé avec la recette du jour J (Étape 9 §4).

## Revue des secrets (même passe)

- `git grep` des motifs de clés (sk_, pk_, AKIA, token) sur tout le dépôt : **zéro occurrence**.
- Toutes les clés (Duffel, Stripe, Mondial Relay, régies pub TikTok/Meta/Snap)
  vivent en **variables d'environnement CapRover** (Étape 7 · 4d) — jamais dans le code ni la GED.
- Rotation notée au départ de tout détenteur d'accès.

## Historique des passes

| Date | Cible | High | Medium | Verdict |
|---|---|---|---|---|
| _(à remplir à la première passe sur staging)_ | | | | |
