/**
 * Minimal NCBI Entrez E-utilities client for PubMed phrase search.
 *
 * Design:
 *   - One esearch per input variant string (as an exact phrase with [All Fields])
 *     so we can attribute which string(s) matched each PMID.
 *   - Then one batched esummary for all unique PMIDs (chunks of 200 IDs).
 *   - Rate-limit-aware: 10 req/s with API key, 3 req/s without.
 */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export interface EntrezConfig {
  apiKey?: string;
  email?: string;
  tool?: string;
}

export interface PubmedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  matchedBy: string[]; // variant strings that matched this PMID
}

function baseParams(cfg: EntrezConfig): URLSearchParams {
  const params = new URLSearchParams();
  params.set("tool", cfg.tool ?? "askmutation");
  if (cfg.email) params.set("email", cfg.email);
  if (cfg.apiKey) params.set("api_key", cfg.apiKey);
  return params;
}

async function limitedFetch(url: string, delayMs: number): Promise<Response> {
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  return fetch(url, { headers: { Accept: "application/json" } });
}

export async function esearchPhrase(
  phrase: string,
  cfg: EntrezConfig,
  retmax = 200,
): Promise<string[]> {
  const params = baseParams(cfg);
  params.set("db", "pubmed");
  // Exact phrase in [All Fields] — quote the phrase so operators inside are literal
  params.set("term", `"${phrase.replace(/"/g, "")}"[All Fields]`);
  params.set("retmode", "json");
  params.set("retmax", String(retmax));
  const url = `${EUTILS}/esearch.fcgi?${params.toString()}`;
  const res = await limitedFetch(url, 0);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  return data.esearchresult?.idlist ?? [];
}

interface EsummaryDocsum {
  uid: string;
  title?: string;
  authors?: { name: string }[];
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  elocationid?: string;
  articleids?: { idtype: string; value: string }[];
}

export async function esummaryBatch(
  pmids: string[],
  cfg: EntrezConfig,
): Promise<Map<string, EsummaryDocsum>> {
  const out = new Map<string, EsummaryDocsum>();
  const chunkSize = 200;
  for (let i = 0; i < pmids.length; i += chunkSize) {
    const chunk = pmids.slice(i, i + chunkSize);
    const params = baseParams(cfg);
    params.set("db", "pubmed");
    params.set("id", chunk.join(","));
    params.set("retmode", "json");
    const url = `${EUTILS}/esummary.fcgi?${params.toString()}`;
    const res = await limitedFetch(url, i === 0 ? 0 : cfg.apiKey ? 110 : 350);
    if (!res.ok) continue;
    const data = (await res.json()) as { result?: Record<string, EsummaryDocsum | string[]> };
    if (!data.result) continue;
    for (const [k, v] of Object.entries(data.result)) {
      if (k === "uids") continue;
      if (Array.isArray(v)) continue;
      out.set(k, v);
    }
  }
  return out;
}

export async function searchPubmedForVariants(
  variants: string[],
  cfg: EntrezConfig,
): Promise<PubmedArticle[]> {
  // Per-variant esearch, serialized with a small delay to respect rate limits.
  const matched: Map<string, Set<string>> = new Map();
  const delay = cfg.apiKey ? 110 : 350; // ms
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (i > 0) await new Promise((r) => setTimeout(r, delay));
    const ids = await esearchPhrase(v, cfg);
    for (const id of ids) {
      if (!matched.has(id)) matched.set(id, new Set());
      matched.get(id)!.add(v);
    }
  }

  const allIds = Array.from(matched.keys());
  if (allIds.length === 0) return [];
  const summaries = await esummaryBatch(allIds, cfg);

  const articles: PubmedArticle[] = [];
  for (const [pmid, matchedSet] of matched) {
    const s = summaries.get(pmid);
    if (!s) {
      // Still return the PMID with minimal metadata so the user sees it
      articles.push({
        pmid,
        title: "(metadata unavailable)",
        authors: [],
        journal: "",
        pubDate: "",
        matchedBy: Array.from(matchedSet),
      });
      continue;
    }
    const doi = s.articleids?.find((a) => a.idtype === "doi")?.value;
    articles.push({
      pmid,
      title: s.title ?? "",
      authors: (s.authors ?? []).map((a) => a.name).slice(0, 10),
      journal: s.fulljournalname || s.source || "",
      pubDate: s.pubdate ?? "",
      doi,
      matchedBy: Array.from(matchedSet),
    });
  }
  // Sort newest first (pubdate is "YYYY Mon DD" or "YYYY")
  articles.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
  return articles;
}
