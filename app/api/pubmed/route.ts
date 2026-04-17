import { NextRequest, NextResponse } from "next/server";
import { searchPubmedForVariantsDetailed } from "@/lib/pubmed/entrez";
import { searchEuropePmcForVariantsDetailed } from "@/lib/pubmed/europepmc";
import { cacheGet, cacheSet, hash } from "@/lib/cache";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  variants: string[];
}

interface Article {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  matchedBy: string[];
  sources?: string[];
}

interface SourceStatus {
  complete: boolean;
  likelyRateLimited: boolean;
  likelyPartial: boolean;
  message?: string;
}

function buildStatusFromDiagnostics(diag: {
  likelyPartial: boolean;
  likelyRateLimited: boolean;
}): SourceStatus {
  if (diag.likelyRateLimited) {
    return {
      complete: false,
      likelyRateLimited: true,
      likelyPartial: true,
      message: "PubMed may be incomplete due to NCBI rate limiting. Please retry shortly.",
    };
  }
  if (diag.likelyPartial) {
    return {
      complete: false,
      likelyRateLimited: false,
      likelyPartial: true,
    };
  }
  return {
    complete: true,
    likelyRateLimited: false,
    likelyPartial: false,
  };
}

function mergeArticles(pubmed: Article[], europePmc: Article[]): Article[] {
  const byPmid = new Map<string, Article>();

  for (const a of pubmed) {
    byPmid.set(a.pmid, {
      ...a,
      sources: Array.from(new Set([...(a.sources ?? []), "PubMed"])),
    });
  }

  for (const ep of europePmc) {
    const existing = byPmid.get(ep.pmid);
    if (!existing) {
      byPmid.set(ep.pmid, {
        ...ep,
        sources: Array.from(new Set([...(ep.sources ?? []), "Europe PMC"])),
      });
      continue;
    }

    const matchedBy = Array.from(new Set([...(existing.matchedBy ?? []), ...(ep.matchedBy ?? [])]));
    const sources = Array.from(new Set([...(existing.sources ?? []), ...(ep.sources ?? []), "Europe PMC"]));
    byPmid.set(ep.pmid, {
      ...existing,
      title: existing.title || ep.title,
      authors: existing.authors.length > 0 ? existing.authors : ep.authors,
      journal: existing.journal || ep.journal,
      pubDate: existing.pubDate || ep.pubDate,
      doi: existing.doi || ep.doi,
      matchedBy,
      sources,
    });
  }

  const merged = Array.from(byPmid.values());
  merged.sort((a, b) => {
    const byMatchCount = b.matchedBy.length - a.matchedBy.length;
    if (byMatchCount !== 0) return byMatchCount;
    return pubDateRank(b.pubDate) - pubDateRank(a.pubDate);
  });
  return merged;
}

function pubDateRank(pubDate?: string): number {
  if (!pubDate) return 0;
  const s = pubDate.trim();
  if (!s) return 0;

  // PubMed style: "YYYY Mon DD" (or with missing day)
  const pubmed = s.match(/^(\d{4})(?:\s+([A-Za-z]{3,9})(?:\s+(\d{1,2}))?)?/);
  if (pubmed) {
    const year = Number(pubmed[1]);
    const month = monthFromName(pubmed[2]);
    const day = pubmed[3] ? Number(pubmed[3]) : 1;
    return Date.UTC(year, month, day);
  }

  // Europe PMC often provides ISO dates.
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function monthFromName(mon?: string): number {
  if (!mon) return 0;
  const m = mon.slice(0, 3).toLowerCase();
  switch (m) {
    case "jan": return 0;
    case "feb": return 1;
    case "mar": return 2;
    case "apr": return 3;
    case "may": return 4;
    case "jun": return 5;
    case "jul": return 6;
    case "aug": return 7;
    case "sep": return 8;
    case "oct": return 9;
    case "nov": return 10;
    case "dec": return 11;
    default: return 0;
  }
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req);
  if (rl && !rl.success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        status: {
          complete: false,
          likelyRateLimited: true,
          likelyPartial: true,
          message: "PubMed may be incomplete due to NCBI rate limiting. Please retry shortly.",
        },
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    return NextResponse.json({ error: "'variants' must be a non-empty string array" }, { status: 400 });
  }

  // Keep it sane — refuse to blast PubMed with >50 variants in one request.
  const variants = body.variants
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 50);

  const cacheKey = `pubmed:${hash(variants)}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const cfg = {
    apiKey: process.env.NCBI_API_KEY,
    email: process.env.NCBI_EMAIL,
    tool: "varcrawl",
  };

  const [pubmedRes, europePmcRes] = await Promise.all([
    searchPubmedForVariantsDetailed(variants, cfg),
    searchEuropePmcForVariantsDetailed(variants),
  ]);

  const diagnostics = {
    likelyPartial: pubmedRes.diagnostics.likelyPartial || europePmcRes.diagnostics.likelyPartial,
    likelyRateLimited: pubmedRes.diagnostics.likelyRateLimited || europePmcRes.diagnostics.likelyRateLimited,
  };

  const articles = mergeArticles(pubmedRes.articles, europePmcRes.articles as Article[]);
  const resp = {
    count: articles.length,
    articles,
    status: buildStatusFromDiagnostics(diagnostics),
  };
  await cacheSet(cacheKey, resp, 3600 * 6); // 6h TTL — new pubs land often enough
  return NextResponse.json(resp);
}
