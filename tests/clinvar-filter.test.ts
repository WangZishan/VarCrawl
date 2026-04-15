import { describe, it, expect } from "vitest";
import { filterClinvarRecords, buildProteinForms } from "@/lib/clinvar/filter";
import type { ClinvarRecord } from "@/lib/clinvar/entrez";

function rec(partial: Partial<ClinvarRecord>): ClinvarRecord {
  return {
    uid: partial.uid ?? "0",
    conditions: [],
    matchedBy: [],
    ...partial,
  };
}

describe("filterClinvarRecords", () => {
  const krasG12dCtx = {
    gene: "KRAS",
    proteinForms: ["G12D", "p.G12D", "Gly12Asp", "p.Gly12Asp"],
  };

  it("keeps a correct KRAS G12D record", () => {
    const records = [
      rec({
        uid: "1",
        gene: "KRAS",
        title: "NM_033360.4(KRAS):c.35G>A (p.Gly12Asp)",
        matchedBy: ["rs121913529", "p.Gly12Asp", "G12D"],
      }),
    ];
    const { kept, dropped } = filterClinvarRecords(records, krasG12dCtx);
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("drops a KRAS G12V record matched only by the shared rsID", () => {
    const records = [
      rec({
        uid: "2",
        gene: "KRAS",
        title: "NM_033360.4(KRAS):c.35G>T (p.Gly12Val)",
        matchedBy: ["rs121913529"],
      }),
    ];
    const { kept, dropped } = filterClinvarRecords(records, krasG12dCtx);
    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("drops an NRAS p.Gly12Asp record (wrong gene)", () => {
    const records = [
      rec({
        uid: "3",
        gene: "NRAS",
        title: "NM_002524.5(NRAS):c.35G>A (p.Gly12Asp)",
        matchedBy: ["p.Gly12Asp"],
      }),
    ];
    const { kept, dropped } = filterClinvarRecords(records, krasG12dCtx);
    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("matches the gene via the title when the gene field is missing", () => {
    const records = [
      rec({
        uid: "4",
        gene: undefined,
        title: "NM_033360.4(KRAS):c.35G>A (p.Gly12Asp)",
        matchedBy: ["G12D"],
      }),
    ];
    const { kept } = filterClinvarRecords(records, krasG12dCtx);
    expect(kept).toHaveLength(1);
  });

  it("uses word-boundary gene matching (KRAS does not match KRASP1)", () => {
    const records = [
      rec({
        uid: "5",
        gene: "KRASP1",
        title: "KRASP1 pseudogene variant p.Gly12Asp",
        matchedBy: ["p.Gly12Asp"],
      }),
    ];
    const { kept, dropped } = filterClinvarRecords(records, krasG12dCtx);
    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("accepts 3-letter form in title when ctx includes both forms", () => {
    const records = [
      rec({
        uid: "6",
        gene: "KRAS",
        title: "KRAS p.Gly12Asp",
        matchedBy: ["rs121913529"],
      }),
    ];
    const { kept } = filterClinvarRecords(records, krasG12dCtx);
    expect(kept).toHaveLength(1);
  });

  it("accepts 1-letter form in title when ctx includes only 1-letter forms", () => {
    const records = [
      rec({
        uid: "7",
        gene: "KRAS",
        title: "KRAS G12D somatic",
        matchedBy: ["G12D"],
      }),
    ];
    const { kept } = filterClinvarRecords(records, {
      gene: "KRAS",
      proteinForms: ["G12D", "p.G12D"],
    });
    expect(kept).toHaveLength(1);
  });

  it("passes records through when context has no gene and no proteinForms", () => {
    const records = [
      rec({ uid: "a", title: "NRAS something" }),
      rec({ uid: "b", title: "HRAS something else" }),
    ];
    const { kept, dropped } = filterClinvarRecords(records, {
      gene: undefined,
      proteinForms: [],
    });
    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(0);
  });

  it("enforces the protein check even when ctx has no gene", () => {
    const records = [
      rec({ uid: "a", title: "BRAF p.Val600Glu" }),
      rec({ uid: "b", title: "BRAF p.Val600Lys" }),
    ];
    const { kept, dropped } = filterClinvarRecords(records, {
      proteinForms: ["V600E", "p.V600E", "Val600Glu", "p.Val600Glu"],
    });
    expect(kept.map((r) => r.uid)).toEqual(["a"]);
    expect(dropped.map((r) => r.uid)).toEqual(["b"]);
  });
});

describe("buildProteinForms", () => {
  it("expands a short form to bare + p.-prefixed", () => {
    const out = buildProteinForms(["G12D"], []);
    expect(out).toContain("G12D");
    expect(out).toContain("p.G12D");
  });

  it("expands a long form to bare + p.-prefixed", () => {
    const out = buildProteinForms([], ["p.Gly12Asp"]);
    expect(out).toContain("Gly12Asp");
    expect(out).toContain("p.Gly12Asp");
  });

  it("de-duplicates across inputs", () => {
    const out = buildProteinForms(["G12D", "G12D"], ["p.Gly12Asp"]);
    const seen = new Set(out);
    expect(seen.size).toBe(out.length);
  });

  it("drops undefined/empty entries silently", () => {
    const out = buildProteinForms([undefined, "G12D", ""], [undefined, "p.Gly12Asp"]);
    expect(out).toContain("G12D");
    expect(out).toContain("p.Gly12Asp");
  });
});
