/**
 * ClinVar search via NCBI Entrez (db=clinvar).
 *
 * One esearch per variant string as an exact phrase, then a batched
 * esummary for metadata (title, clinical significance, conditions).
 */

import { EntrezConfig, esummaryBatch, searchPhrasesInDb } from "@/lib/entrez/base";

export interface ClinvarRecord {
  uid: string;
  accession?: string;        // e.g. VCV000013961
  title?: string;            // "NM_004333.6(BRAF):c.1799T>A (p.Val600Glu)"
  gene?: string;
  clinicalSignificance?: string; // "Pathogenic", "Likely benign", etc.
  reviewStatus?: string;     // "criteria provided, multiple submitters"
  lastEvaluated?: string;
  conditions: string[];      // traits from ClinVar
  matchedBy: string[];
}

// ClinVar's esummary schema has shifted over time. We accept both the newer
// (germline_classification) and older (clinical_significance) shapes.
interface ClinvarDocsum {
  uid: string;
  accession?: string;
  title?: string;
  genes?: { symbol?: string }[];
  germline_classification?: {
    description?: string;
    review_status?: string;
    last_evaluated?: string;
  };
  clinical_significance?: {
    description?: string;
    review_status?: string;
    last_evaluated?: string;
  };
  trait_set?: { trait_name?: string }[];
  traits?: { trait_name?: string }[];
}

export async function searchClinvarForVariants(
  variants: string[],
  cfg: EntrezConfig,
): Promise<ClinvarRecord[]> {
  const matched = await searchPhrasesInDb("clinvar", variants, cfg);
  const allIds = Array.from(matched.keys());
  if (allIds.length === 0) return [];
  const summaries = await esummaryBatch<ClinvarDocsum>("clinvar", allIds, cfg);

  const records: ClinvarRecord[] = [];
  for (const [uid, matchedSet] of matched) {
    const s = summaries.get(uid);
    const clin = s?.germline_classification ?? s?.clinical_significance;
    const conditions = (s?.trait_set ?? s?.traits ?? [])
      .map((t) => t.trait_name)
      .filter((t): t is string => !!t);
    records.push({
      uid,
      accession: s?.accession,
      title: s?.title,
      gene: s?.genes?.[0]?.symbol,
      clinicalSignificance: clin?.description,
      reviewStatus: clin?.review_status,
      lastEvaluated: clin?.last_evaluated,
      conditions,
      matchedBy: Array.from(matchedSet),
    });
  }

  // Sort: pathogenic > likely path > VUS > likely benign > benign > others
  const sigRank = (s?: string): number => {
    const x = (s ?? "").toLowerCase();
    if (x.includes("pathogenic") && !x.includes("likely") && !x.includes("benign")) return 0;
    if (x.includes("likely pathogenic")) return 1;
    if (x.includes("uncertain") || x.includes("conflicting")) return 2;
    if (x.includes("likely benign")) return 3;
    if (x.includes("benign")) return 4;
    return 5;
  };
  records.sort((a, b) => sigRank(a.clinicalSignificance) - sigRank(b.clinicalSignificance));
  return records;
}
