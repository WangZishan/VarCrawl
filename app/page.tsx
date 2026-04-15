"use client";

import { useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { VariantPanel } from "@/components/VariantPanel";
import { ResultsList } from "@/components/ResultsList";
import { ClinvarResults } from "@/components/ClinvarResults";
import type { Assembly } from "@/lib/hgvs/types";

interface VariantString { text: string; label: string }

interface TranscriptGroup {
  gene?: string;
  transcript?: string;
  proteinAccession?: string;
  hgvsc?: string;
  hgvsp?: string;
  consequenceTerms?: string[];
  isManeSelect?: boolean;
  isManePlusClinical?: boolean;
  isCanonical?: boolean;
  maneSelectName?: string;
  variants: VariantString[];
}

interface ExpandResponse {
  input: string;
  assembly: Assembly;
  classified: { kind: string; gene?: string; accession?: string; body: string };
  canonical: {
    gene?: string;
    rsid?: string;
    hgvsg?: string;
    notes: string[];
    consequences: { gene?: string; hgvsc?: string; hgvsp?: string; proteinShort?: string; proteinLong?: string }[];
  };
  groups: {
    universal: VariantString[];
    perTranscript: TranscriptGroup[];
    fallback: VariantString[];
  };
  variants: VariantString[];
}

interface PubmedResponse {
  count: number;
  articles: {
    pmid: string;
    title: string;
    authors: string[];
    journal: string;
    pubDate: string;
    doi?: string;
    matchedBy: string[];
  }[];
}

interface ClinvarResponse {
  count: number;
  records: {
    uid: string;
    accession?: string;
    title?: string;
    gene?: string;
    clinicalSignificance?: string;
    reviewStatus?: string;
    lastEvaluated?: string;
    conditions: string[];
    matchedBy: string[];
  }[];
}

export default function Page() {
  const [expand, setExpand] = useState<ExpandResponse | null>(null);
  const [pubmed, setPubmed] = useState<PubmedResponse | null>(null);
  const [clinvar, setClinvar] = useState<ClinvarResponse | null>(null);
  const [loading, setLoading] = useState<"idle" | "expanding" | "searching">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(query: string, assembly: Assembly) {
    setError(null);
    setExpand(null);
    setPubmed(null);
    setClinvar(null);
    setLoading("expanding");

    try {
      const r1 = await fetch("/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, assembly }),
      });
      const d1 = await r1.json();
      if (!r1.ok) {
        setError(d1.error ?? "Failed to expand mutation.");
        setLoading("idle");
        return;
      }
      setExpand(d1);

      setLoading("searching");
      const variants = d1.variants.map((v: VariantString) => v.text);

      // Fan out to PubMed and ClinVar in parallel — they are independent.
      const [pubmedRes, clinvarRes] = await Promise.allSettled([
        fetch("/api/pubmed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variants }),
        }).then((r) => r.json()),
        fetch("/api/clinvar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variants }),
        }).then((r) => r.json()),
      ]);

      if (pubmedRes.status === "fulfilled" && !pubmedRes.value.error) {
        setPubmed(pubmedRes.value);
      } else if (pubmedRes.status === "fulfilled") {
        setError((e) => e ?? `PubMed: ${pubmedRes.value.error}`);
      }

      if (clinvarRes.status === "fulfilled" && !clinvarRes.value.error) {
        setClinvar(clinvarRes.value);
      } else if (clinvarRes.status === "fulfilled") {
        setError((e) => e ?? `ClinVar: ${clinvarRes.value.error}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading("idle");
    }
  }

  return (
    <main>
      <h1>AskMutation</h1>
      <p className="subtitle">
        Paste a mutation in any HGVS-like notation. We expand it into every way it might
        appear in the literature and search PubMed and ClinVar for each.
      </p>

      <SearchForm onSearch={handleSearch} disabled={loading !== "idle"} />

      {error && <div className="error">{error}</div>}

      {loading === "expanding" && <p className="spinner">Expanding mutation representations…</p>}
      {expand && <VariantPanel data={expand} />}

      {loading === "searching" && <p className="spinner">Searching PubMed and ClinVar…</p>}
      {clinvar && <ClinvarResults data={clinvar} />}
      {pubmed && <ResultsList data={pubmed} />}
    </main>
  );
}
