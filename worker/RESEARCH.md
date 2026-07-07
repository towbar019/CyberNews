# SecurityNews — Research Module Documentation

> **Audience : le modèle d'IA qui génère les briefings** (actuellement `claude-haiku-4-5`,
> un modèle léger). Ce document est la référence d'alignement : les instructions
> par profil sont stockées en DB (`profiles.config.promptInstructions`, seedées
> depuis `src/db/seeds.ts`) et injectées telles quelles dans chaque prompt.
> Toute modification de comportement de recherche passe par CE fichier + `seeds.ts`.

---

## 1. Vue d'ensemble du pipeline

```
Sources (RSS / API) ──► rss-fetcher.ts ──► PostgreSQL (articles)
                                             │  scoring par profil
                                             ▼  (profile_relevance JSONB)
                              ai-summary.ts ──► Claude API ──► summaries (FR + EN)
```

1. **Fetch** (toutes les 2h, pg-boss cron) : chaque source active de `rss_sources`
   est récupérée. Cache Redis 2h (RSS) / 1h (NVD).
2. **Scoring** : chaque article reçoit un score par profil
   (`scoreArticleRelevance`) : apps surveillées (+10), keywords (+5),
   CISA KEV (+20), CVSS ≥9 (+15), GitHub release (+8).
   **Le scoping de sources** (`config.sourceScope`) force à 0 les articles de
   sources hors périmètre du profil.
3. **Génération** (daily 06h00, weekly lundi 07h00, monthly 1er 07h00 UTC) :
   les 100 meilleurs articles de la période sont donnés au modèle avec les
   instructions du profil. FR puis EN.

## 2. Règle d'or pour le modèle : PRENDRE LE TEMPS

Le modèle de génération est petit (Haiku). Pour compenser :

1. **Lire TOUS les articles fournis** avant de rédiger.
2. **Suivre les instructions du profil À LA LETTRE** — périmètre, format, structure
   Markdown. Ne jamais improviser une structure différente.
3. **Ne JAMAIS inventer** : chaque CVE, score, événement cité doit exister dans
   les articles sources. En cas de doute → omettre.
4. **Sections vides explicites** : si rien ne correspond, l'écrire
   ("Aucune vulnérabilité critique sur le périmètre pour cette période.").

## 3. Affectation sources → profils

| Source | Nemea | Axel | Notes |
|---|---|---|---|
| GitHub — * (releases apps) | ✅ | ❌ | Bruit technique inutile en vision macro |
| Exploit-DB, NVD CVEs | ✅ | ❌ | CVE individuelles = rôle de Nemea |
| CISA KEV, CISA Advisories | ✅ | ✅ | KEV pertinent pour les deux niveaux |
| CERT-FR, ANSSI | ✅ | ✅ | |
| Médias (THN, Bleeping, Krebs…) | ✅ | ✅ | Scoring keywords fait le tri |
| Google News — * (veille générale) | ❌ | ✅ | Acteurs/entreprises, événements CERT, IA, ransomware |

Mécanisme : `profiles.config.sourceScope = { mode: "include"|"exclude", sources: [préfixes] }`
appliqué dans `rss-fetcher.ts::isSourceInScope()`. Les préfixes matchent le début
du nom de la source.

## 4. Profils

### 4.1 Nemea (Opérations SOC/CERT)

**Objectif :** suivi strict des vulnérabilités exploitables, 0-days et CVE sur un
périmètre d'applications défini.

- **Périmètre strict** : Proxmox, Teleport, Wazuh, Elasticsearch, Kibana, Keycloak,
  CISO Assistant, Grafana, Iris, Mailcow, OpenProject, Portainer, Shuffle SOAR,
  Velociraptor, Hermes, Unifi, Windows, Linux (Debian / Arch Linux). **Tout le reste
  est ignoré**, y compris les vulnérabilités majeures grand public (→ autres profils).
- **Critères d'alerte** : Critique = CISA KEV OU CVSS ≥ 9.0 ; Haute = CVSS 7.0–8.9.
- **Format** : structure Markdown stricte — 🚨 Alertes Critiques / 🔴 Sévérité Haute /
  📊 Points Clés / 🛡️ Actions Recommandées / 📝 Résumé (3 lignes).

### 4.2 Axel (Vision Macro CISO/RSSI)

**Objectif :** synthèse exécutive des risques émergents, tendances cyber haut niveau,
veille stratégique sur IA / SecOps / Cloud.

- **Partie 1 — Menace & Gouvernance** : PAS de CVE individuelles. Ransomwares majeurs,
  fuites critiques, réglementations (NIS2, DORA…), tactiques APT. Top 1–5 max
  (plus large autorisé en monthly). 🌐 Climat Cyber / 🔥 Top Menaces /
  💡 Priorité Gouvernance / 📝 Éclairage Complémentaire (optionnel).
- **Partie 2 — Veille Écosystème** : trois sous-sections fixes :
  🤖 IA (features, LLM, risques IA) / 🛡️ SecOps (Splunk, SentinelOne, ELK, bypass EDR…) /
  ☁️ Cloud & Souveraineté (AWS/Azure, lois, archi). Sous-section vide →
  "Pas d'évolution majeure signalée sur cette période."
- **Ton** : gouvernance & risque, termes techniques autorisés.

Les instructions complètes (verbatim injecté dans le prompt) sont dans
`src/db/seeds.ts` (`NEMEA_CONFIG.promptInstructions`, `AXEL_CONFIG.promptInstructions`).

## 5. Sources spéciales (non-RSS)

- **CISA KEV** (`fetchCisaKev`) : JSON officiel
  `known_exploited_vulnerabilities.json`, fenêtre 90 jours, retry x3.
  ⚠️ Chaque entrée a une URL unique `?cve=CVE-XXXX-YYYY` — NE PAS revenir à une
  URL partagée (la contrainte `UNIQUE(url)` droppait toutes les entrées, bug
  historique qui a fait manquer les KEV Unifi).
- **NVD API v2** (`fetchNvdApiV2`) : 7 derniers jours, 200 résultats, retry x3
  avec backoff (le service renvoie souvent des 503). Clé API optionnelle via
  `NVD_API_KEY` dans `.env` (recommandé : https://nvd.nist.gov/developers/request-an-api-key).
- **Feeds capricieux** : fallback automatique axios + sanitisation XML
  (`&` nus → `&amp;`) pour Dark Reading (403) et Mandiant/Google Cloud (XML invalide).

## 6. Boucle de feedback (amélioration continue)

Après chaque analyse quotidienne, Hermes (l'agent) pose des questions de feedback
à Axel via Slack (cron job Hermes "securitynews-feedback") :
- Le Top des menaces correspondait-il aux attentes ?
- Un sujet découvert ailleurs manquait-il ?
- Une section était-elle du bruit ?

Les réponses sont archivées dans `/opt/securitynews/feedback/[NomProfil]Accurate.md`
(fichiers de feedback UNIQUEMENT — jamais d'instructions). Si une réponse implique
un changement d'instructions → modifier `seeds.ts` (promptInstructions) + ce
document, puis rebuild le worker. Les fichiers `*Accurate.md` restent le journal
brut des feedbacks.

## 7. Maintenance

- **Ajouter une source** : `seeds.ts` → rebuild worker (`ON CONFLICT DO NOTHING`).
- **Changer les instructions d'un profil** : `seeds.ts` (upsert au démarrage → rebuild worker suffit).
- **Changer le modèle** : `ai-summary.ts` (`const model = "claude-haiku-4-5"`).
- **Vérifier la santé des fetches** : `sg docker -c "docker compose logs worker --tail 100"` ;
  page `/reporting` du site (last fetch par source).

## 8. Modes d'affichage (2026-07-03)

Chaque période génère 4 variantes : FR/EN × concise/detailed (colonne `mode`).
- **concise** : synthétique, concret (acteurs/chiffres nommés, pas d'abstrait).
- **detailed** : MÊME structure, paragraphes réécrits et développés (contexte
  acteur/entreprise, plus-value, impact sécurité) + `*Sources : [..](url)*` à la
  fin de chaque paragraphe. Ce n'est PAS une liste d'articles (feedback Axel).
Le site propose 3 vues : Résumé (concise) / Détaillé (detailed) / Articles (bruts).

## 9. Backfill CVE historique

`src/backfill-nvd.ts` : import NVD 2024+ par keywordSearch (apps Nemea),
fenêtres 118 jours (limite API 120j), retry, idempotent.
Lancer : `docker compose exec -d worker node dist/backfill-nvd.js`
