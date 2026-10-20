# Audits du 24/09/2026 (nuit) — ce qui reste à corriger

Deux audits statiques, chacun contre-vérifié par un second agent (les constats réfutés sont retirés) :

| Fichier | Audit | Constats confirmés |
|---|---|---|
| `audit-par-bouton-519-constats.md` (+ `.json`) | toutes les apps, page par page, bouton par bouton (logique, code en dur, redondance, hors sujet, bâclage) | 519 — gravité 1 : 33 · 2 : 221 · 3 : 265 |
| `notions-bout-en-bout-420-constats.md` (+ `.json`) | chaque notion suivie de sa naissance à sa fin, à travers toutes les apps (marque, articles, vente en ligne et API, bon, porteur, commerce, nomade, manager, hotline et fils) | 420 — gravité 1 : 59 · 2 : 211 · 3 : 150 |

Gravité 1 = flux cassé, perte d'argent, règle légale ou promesse fausse ; 2 = manque fonctionnel ou incohérence visible ; 3 = finition.

## Ce qui a été fait la même nuit
- La correction par lots (9 agents à propriété de fichiers disjointe) a commencé par le data-layer, puis s'est arrêtée à la **limite hebdomadaire d'usage** (reprise possible le 30/09) : les éditions appliquées ont été relues, les appels devenus orphelins raccordés (restitution de garantie → `avanceCloturer`, garantie constatée au manager 45, article retiré et non effacé, purge du journal des connexions retirée), le banc mis à jour.
- La famille « juridique, documents, vocabulaire » du second audit n'a pas pu être tracée (limite atteinte) : à relancer.

## Comment s'en servir
Chaque constat porte sa page, l'élément, la preuve (fichier:ligne + extrait) et la correction proposée. **Vérifier dans le code actuel avant de corriger** : une partie est déjà corrigée (voir les commits du 24/09 au soir), et les numéros de ligne ont bougé.
