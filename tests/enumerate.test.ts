import { describe, it, expect } from "vitest";
import { enumerateVariantStrings } from "@/lib/hgvs/enumerate";
import type { CanonicalVariant } from "@/lib/hgvs/types";

function brafV600E(): CanonicalVariant {
  return {
    input: {
      raw: "BRAF p.V600E",
      kind: "hgvsp",
      gene: "BRAF",
      body: "p.V600E",
      proteinShort: "V600E",
      proteinLong: "p.Val600Glu",
    },
    assembly: "GRCh38",
    gene: "BRAF",
    rsid: "rs113488022",
    hgvsg: "chr7:g.140753336A>T",
    chrom: "7",
    genomicPos: 140753336,
    refAllele: "A",
    altAllele: "T",
    consequences: [
      {
        gene: "BRAF",
        transcript: "NM_004333.6",
        proteinAccession: "NP_004324.2",
        hgvsc: "NM_004333.6:c.1799T>A",
        hgvsp: "NP_004324.2:p.Val600Glu",
        proteinShort: "V600E",
        proteinLong: "p.Val600Glu",
      },
    ],
    notes: [],
  };
}

describe("enumerateVariantStrings", () => {
  it("covers the major representations for BRAF V600E", () => {
    const strings = enumerateVariantStrings(brafV600E()).map((v) => v.text);
    // rsID
    expect(strings).toContain("rs113488022");
    // HGVSg with and without chr
    expect(strings).toContain("chr7:g.140753336A>T");
    expect(strings).toContain("7:g.140753336A>T");
    // HGVSc with/without transcript, gene-prefixed
    expect(strings).toContain("NM_004333.6:c.1799T>A");
    expect(strings).toContain("c.1799T>A");
    expect(strings).toContain("BRAF:c.1799T>A");
    // HGVSp variations
    expect(strings).toContain("NP_004324.2:p.Val600Glu");
    expect(strings).toContain("p.Val600Glu");
    expect(strings).toContain("Val600Glu");
    // Short protein
    expect(strings).toContain("V600E");
    expect(strings).toContain("p.V600E");
    expect(strings).toContain("BRAF V600E");
    expect(strings).toContain("BRAF p.V600E");
  });

  it("deduplicates repeated strings", () => {
    const strings = enumerateVariantStrings(brafV600E()).map((v) => v.text);
    expect(new Set(strings).size).toBe(strings.length);
  });

  it("falls back to raw input when no canonical data is available", () => {
    const cv: CanonicalVariant = {
      input: { raw: "weird input", kind: "unknown", body: "weird input" },
      assembly: "GRCh38",
      consequences: [],
      notes: [],
    };
    const strings = enumerateVariantStrings(cv).map((v) => v.text);
    expect(strings).toContain("weird input");
  });
});
