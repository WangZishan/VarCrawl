/**
 * PubMed search via NCBI Entrez E-utilities.
 *
 * Strategy:
 *   - One esearch per variant string (as an exact phrase with [All Fields])
 *     so we can attribute which string(s) matched each PMID.
 *   - Then one batched esummary for all unique PMIDs (chunks of 200 IDs).
 */

import { EntrezConfig, esummaryBatch, searchPhrasesInDb } from "@/lib/entrez/base";

export type { EntrezConfig };

export interface PubmedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  matchedBy: string[];
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

export async function searchPubmedForVariants(
  variants: string[],
  cfg: EntrezConfig,
): Promise<PubmedArticle[]> {
  const matched = await searchPhrasesInDb("pubmed", variants, cfg);
  const allIds = Array.from(matched.keys());
  if (allIds.length === 0) return [];
  const summaries = await esummaryBatch<EsummaryDocsum>("pubmed", allIds, cfg);

  const articles: PubmedArticle[] = [];
  for (const [pmid, matchedSet] of matched) {
    const s = summaries.get(pmid);
    if (!s) {
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
  articles.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
  return articles;
}
