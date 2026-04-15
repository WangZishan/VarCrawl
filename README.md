# AskMutation

A serverless web app for searching PubMed and ClinVar by mutation. Paste a
mutation in any common notation (HGVSp, HGVSc, HGVSg, short forms like `V600E`,
`BRAF p.V600E`, dbSNP rsIDs) and the app expands it into every string
representation the mutation might appear under in the literature, groups them
by transcript/isoform (with MANE Select / MANE Plus Clinical badges), and
searches both PubMed (Entrez) and ClinVar for each as an exact phrase.

## Stack

- **Next.js 14 (app router)** — deploys to Vercel as static UI + route handlers.
- **Ensembl VEP REST** (`rest.ensembl.org`, `grch37.rest.ensembl.org`) for
  HGVSp ↔ HGVSc ↔ HGVSg cross-conversion across transcripts.
- **Mutalyzer** (`mutalyzer.nl/api`) as an HGVS normalizer (best-effort).
- **NCBI Variation Services** as a RefSeq-aware fallback (best-effort).
- **NCBI Entrez E-utilities** (`eutils.ncbi.nlm.nih.gov`) for PubMed search.
- **Upstash Redis** (optional) for caching.

The original request referenced [TransVar](https://github.com/zwdzwd/transvar)
for coordinate conversion. TransVar needs ~3 GB of reference genome FASTA plus
a transcript annotation database, which exceeds Vercel's function size limits.
Ensembl VEP implements the same HGVS ↔ coordinate logic over a public REST API,
so we compose it in place of self-hosting TransVar.

## Genome assemblies

GRCh38 and GRCh37 are fully supported via the two Ensembl REST endpoints.
T2T-CHM13v2.0 is accepted in the UI but Ensembl VEP REST does not currently
serve CHM13; queries fall back to GRCh38 coordinates and the UI shows a
"T2T lift-over unavailable" note.

## Getting started

```bash
pnpm install      # or npm install / yarn
cp .env.example .env.local
# add NCBI_API_KEY + NCBI_EMAIL for 10 req/s PubMed throughput
pnpm dev
```

Open <http://localhost:3000>.

## API

### `POST /api/expand`

```json
{ "query": "BRAF p.V600E", "assembly": "GRCh38" }
```

Returns the classified input, canonical variant, and an array of every string
representation to search on.

### `POST /api/pubmed`

```json
{ "variants": ["V600E", "p.Val600Glu", "c.1799T>A", "chr7:g.140753336A>T"] }
```

Runs one `esearch` per variant as `"<variant>"[All Fields]`, unions PMIDs,
batches `esummary` for metadata, returns articles sorted newest-first with
per-article `matchedBy` attribution.

### `POST /api/clinvar`

Same shape as `/api/pubmed` but queries NCBI `db=clinvar`. Returns ClinVar
records with germline classification, review status, and conditions, sorted
by clinical significance (Pathogenic → Likely Pathogenic → VUS → …).

## Testing

```bash
pnpm test
```

Vitest unit tests cover the input classifier and variant enumerator. The
upstream-dependent parts (`lib/hgvs/convert.ts`, `lib/pubmed/entrez.ts`) are
integration-tested end-to-end via the verification flow in the plan file.

## Deployment (Vercel)

1. Import the repo on Vercel.
2. Set env vars: `NCBI_API_KEY`, `NCBI_EMAIL` (and optionally Upstash vars).
3. Deploy — no other config needed.
