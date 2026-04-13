import { CanonicalVariant } from "./types";

/**
 * Produce every string representation a mutation is likely to appear as in
 * literature. We want high-recall for PubMed phrase matching — each returned
 * string will be run as `"string"[All Fields]`.
 *
 * We deduplicate, keep the list tight (no wildly-low-specificity strings like
 * bare positions), and mark each with a short label for UI display.
 */
export interface VariantString {
  text: string;
  label: string; // short description used in the UI, e.g. "HGVSp short"
}

export function enumerateVariantStrings(v: CanonicalVariant): VariantString[] {
  const out: VariantString[] = [];
  const seen = new Set<string>();

  const push = (text: string | undefined | null, label: string) => {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push({ text: trimmed, label });
  };

  // rsID — high specificity
  if (v.rsid) push(v.rsid, "dbSNP rsID");

  // Genomic
  if (v.chrom && v.genomicPos && v.refAllele && v.altAllele) {
    const g = `g.${v.genomicPos}${v.refAllele}>${v.altAllele}`;
    push(`chr${v.chrom}:${g}`, `HGVSg (${v.assembly}, chr-prefix)`);
    push(`${v.chrom}:${g}`, `HGVSg (${v.assembly}, no prefix)`);
  }
  if (v.hgvsg) push(v.hgvsg, `HGVSg (${v.assembly})`);

  // Per-transcript consequences
  for (const c of v.consequences) {
    // HGVSc — with and without transcript prefix
    if (c.hgvsc) {
      push(c.hgvsc, "HGVSc (with transcript)");
      const bare = stripAccession(c.hgvsc);
      if (bare) push(bare, "HGVSc (bare)");
      if (c.gene && bare) push(`${c.gene}:${bare}`, "HGVSc (gene-prefixed)");
      if (c.gene && bare) push(`${c.gene} ${bare}`, "HGVSc (gene space)");
    }

    // HGVSp — with and without transcript prefix, 1-letter and 3-letter
    if (c.hgvsp) {
      push(c.hgvsp, "HGVSp (with transcript)");
      const bare = stripAccession(c.hgvsp);
      if (bare) push(bare, "HGVSp (bare 3-letter)");
      if (c.gene && bare) push(`${c.gene}:${bare}`, "HGVSp (gene-prefixed)");
      if (c.gene && bare) push(`${c.gene} ${bare}`, "HGVSp (gene space)");
    }
    if (c.proteinLong) {
      push(c.proteinLong, "p.3-letter");
      push(c.proteinLong.replace(/^p\./, ""), "3-letter bare");
      push(`(${c.proteinLong.replace(/^p\./, "")})`, "p. paren 3-letter");
      if (c.gene) push(`${c.gene} ${c.proteinLong}`, "gene + p.3-letter");
      if (c.gene) push(`${c.gene}:${c.proteinLong}`, "gene:p.3-letter");
    }
    if (c.proteinShort) {
      push(`p.${c.proteinShort}`, "p.1-letter");
      push(c.proteinShort, "1-letter bare");
      if (c.gene) push(`${c.gene} ${c.proteinShort}`, "gene + 1-letter");
      if (c.gene) push(`${c.gene} p.${c.proteinShort}`, "gene + p.1-letter");
      if (c.gene) push(`${c.gene}:p.${c.proteinShort}`, "gene:p.1-letter");
    }
  }

  // If nothing else worked but the user gave us a raw string that's specific
  // enough, keep it so the user still gets *some* search.
  if (out.length === 0) {
    push(v.input.raw, "raw input");
    if (v.input.proteinShort) push(v.input.proteinShort, "short (parsed)");
    if (v.input.proteinLong) push(v.input.proteinLong, "p.3-letter (parsed)");
  }

  return out;
}

function stripAccession(hgvs: string): string | null {
  const idx = hgvs.indexOf(":");
  if (idx < 0) return null;
  return hgvs.slice(idx + 1);
}
