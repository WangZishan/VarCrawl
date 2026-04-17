export interface EuropePmcDiagnostics {
  phraseCount: number;
  failedPhraseCount: number;
  rateLimitedPhraseCount: number;
  likelyPartial: boolean;
  likelyRateLimited: boolean;
}

export interface EuropePmcArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  matchedBy: string[];
  sources: string[];
}

export interface EuropePmcSearchResult {
  articles: EuropePmcArticle[];
  diagnostics: EuropePmcDiagnostics;
}

interface EuropePmcHit {
  source?: string;
  id?: string;
  pmid?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  firstPublicationDate?: string;
  pubYear?: string;
  doi?: string;
}

interface EuropePmcResponse {
  resultList?: { result?: EuropePmcHit[] };
}

const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

async function delayed(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchEuropePmc(phrase: string): Promise<{ ok: boolean; status: number; hits: EuropePmcHit[] }> {
  const maxAttempts = 3;
  const query = `"${phrase.replace(/"/g, "")}" AND SRC:MED`;
  const params = new URLSearchParams({
    query,
    format: "json",
    pageSize: "100",
    resultType: "core",
  });
  const url = `${EUROPE_PMC}?${params.toString()}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as EuropePmcResponse;
      return {
        ok: true,
        status: res.status,
        hits: data.resultList?.result ?? [],
      };
    }
    const retriable = res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504;
    if (!retriable || attempt === maxAttempts) {
      return { ok: false, status: res.status, hits: [] };
    }
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 300 * Math.pow(2, attempt - 1);
    await delayed(waitMs);
  }

  return { ok: false, status: 500, hits: [] };
}

export async function searchEuropePmcForVariantsDetailed(
  variants: string[],
): Promise<EuropePmcSearchResult> {
  const byPmid = new Map<string, { article: EuropePmcArticle; matched: Set<string> }>();
  const diagnostics: EuropePmcDiagnostics = {
    phraseCount: variants.length,
    failedPhraseCount: 0,
    rateLimitedPhraseCount: 0,
    likelyPartial: false,
    likelyRateLimited: false,
  };

  for (let i = 0; i < variants.length; i++) {
    if (i > 0) await delayed(120);
    const phrase = variants[i];
    const res = await fetchEuropePmc(phrase);
    if (!res.ok) {
      diagnostics.failedPhraseCount += 1;
      if (res.status === 429) diagnostics.rateLimitedPhraseCount += 1;
      continue;
    }
    for (const hit of res.hits) {
      const pmid = (hit.pmid ?? (hit.source === "MED" ? hit.id : undefined))?.trim();
      if (!pmid) continue;
      const existing = byPmid.get(pmid);
      if (!existing) {
        byPmid.set(pmid, {
          article: {
            pmid,
            title: hit.title?.trim() ?? "",
            authors: (hit.authorString ?? "")
              .split(/,\s*/)
              .map((a) => a.trim())
              .filter(Boolean)
              .slice(0, 10),
            journal: hit.journalTitle?.trim() ?? "",
            pubDate: hit.firstPublicationDate?.trim() ?? hit.pubYear?.trim() ?? "",
            doi: hit.doi?.trim() || undefined,
            matchedBy: [phrase],
            sources: ["Europe PMC"],
          },
          matched: new Set([phrase]),
        });
      } else {
        existing.matched.add(phrase);
      }
    }
  }

  diagnostics.likelyPartial = diagnostics.failedPhraseCount > 0;
  diagnostics.likelyRateLimited = diagnostics.rateLimitedPhraseCount > 0;

  const articles = Array.from(byPmid.values()).map(({ article, matched }) => ({
    ...article,
    matchedBy: Array.from(matched),
  }));

  return {
    articles,
    diagnostics,
  };
}
