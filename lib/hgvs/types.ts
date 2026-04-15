export type Assembly = "GRCh38" | "GRCh37" | "T2T-CHM13v2.0";

export type HgvsKind =
  | "hgvsp" // protein, e.g. NP_004324.2:p.Val600Glu or BRAF:p.V600E or just V600E
  | "hgvsc" // coding, e.g. NM_004333.6:c.1799T>A
  | "hgvsg" // genomic, e.g. chr7:g.140753336A>T or NC_000007.14:g.140753336A>T
  | "hgvsn" // non-coding
  | "rsid"  // dbSNP rsID
  | "short" // free form short protein notation, e.g. "V600E"
  | "unknown";

// One-letter vs three-letter AA codes
export const AA1 = [
  "A", "R", "N", "D", "C", "Q", "E", "G", "H", "I",
  "L", "K", "M", "F", "P", "S", "T", "W", "Y", "V", "*",
] as const;

export const AA3_TO_1: Record<string, string> = {
  Ala: "A", Arg: "R", Asn: "N", Asp: "D", Cys: "C",
  Gln: "Q", Glu: "E", Gly: "G", His: "H", Ile: "I",
  Leu: "L", Lys: "K", Met: "M", Phe: "F", Pro: "P",
  Ser: "S", Thr: "T", Trp: "W", Tyr: "Y", Val: "V",
  Ter: "*", Stop: "*",
};

export const AA1_TO_3: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [three, one] of Object.entries(AA3_TO_1)) {
    if (three === "Stop") continue; // prefer "Ter" for the * mapping
    if (!out[one]) out[one] = three;
  }
  out["*"] = "Ter";
  return out;
})();

export interface ClassifiedInput {
  raw: string;
  kind: HgvsKind;
  // For transcript-prefixed HGVS (NM_xxx:c.123A>T, NP_xxx:p.Val600Glu, NC_xxx:g.1234A>T)
  accession?: string;
  // Gene symbol if user wrote "BRAF p.V600E" or "BRAF:p.V600E"
  gene?: string;
  // The HGVS body after the colon (or the whole thing if no prefix): "c.1799T>A"
  body: string;
  // For short/protein: one-letter and three-letter normalized forms when derivable
  proteinShort?: string; // V600E
  proteinLong?: string;  // p.Val600Glu
  // For hgvsg: chromosome ("7" or "chr7" accepted)
  chrom?: string;
}

export interface CanonicalVariant {
  input: ClassifiedInput;
  assembly: Assembly;
  gene?: string;
  rsid?: string;
  // One canonical HGVSg per assembly, when resolvable
  hgvsg?: string;          // NC_000007.14:g.140753336A>T
  chrom?: string;          // "7"
  genomicPos?: number;     // 140753336
  refAllele?: string;
  altAllele?: string;
  // Coding / protein consequences across transcripts
  consequences: Consequence[];
  // Free-form notes (e.g., "T2T lift-over unavailable")
  notes: string[];
}

export interface Consequence {
  transcript?: string;     // NM_004333.6
  proteinAccession?: string; // NP_004324.2
  gene?: string;
  hgvsc?: string;          // NM_004333.6:c.1799T>A
  hgvsp?: string;          // NP_004324.2:p.Val600Glu
  proteinShort?: string;   // V600E (1-letter)
  proteinLong?: string;    // p.Val600Glu (3-letter)
  consequenceTerms?: string[]; // e.g. ["missense_variant"]
  // MANE / canonical flags from Ensembl VEP
  maneSelect?: string;        // RefSeq transcript name if this is MANE Select
  manePlusClinical?: string;  // RefSeq transcript name if this is MANE Plus Clinical
  canonical?: boolean;        // Ensembl canonical transcript flag
}
