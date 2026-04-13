"use client";

import { useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { VariantPanel } from "@/components/VariantPanel";
import { ResultsList } from "@/components/ResultsList";
import type { Assembly } from "@/lib/hgvs/types";

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
  variants: { text: string; label: string }[];
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

export default function Page() {
  const [expand, setExpand] = useState<ExpandResponse | null>(null);
  const [pubmed, setPubmed] = useState<PubmedResponse | null>(null);
  const [loading, setLoading] = useState<"idle" | "expanding" | "searching">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(query: string, assembly: Assembly) {
    setError(null);
    setExpand(null);
    setPubmed(null);
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
      const r2 = await fetch("/api/pubmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variants: d1.variants.map((v: { text: string }) => v.text) }),
      });
      const d2 = await r2.json();
      if (!r2.ok) {
        setError(d2.error ?? "PubMed search failed.");
        setLoading("idle");
        return;
      }
      setPubmed(d2);
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
        appear in the literature and search PubMed for each.
      </p>

      <SearchForm onSearch={handleSearch} disabled={loading !== "idle"} />

      {error && <div className="error">{error}</div>}

      {loading === "expanding" && <p className="spinner">Expanding mutation representations…</p>}
      {expand && <VariantPanel data={expand} />}

      {loading === "searching" && <p className="spinner">Searching PubMed…</p>}
      {pubmed && <ResultsList data={pubmed} />}
    </main>
  );
}
