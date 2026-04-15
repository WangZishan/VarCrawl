"use client";

import { useState } from "react";
import type { Assembly } from "@/lib/hgvs/types";

interface Props {
  onSearch: (query: string, assembly: Assembly) => void;
  disabled: boolean;
}

const EXAMPLES = [
  "BRAF p.V600E",
  "NM_004333.6:c.1799T>A",
  "chr7:g.140753336A>T",
  "rs113488022",
  "KRAS G12D",
];

export function SearchForm({ onSearch, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [assembly, setAssembly] = useState<Assembly>("GRCh38");

  return (
    <>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSearch(query.trim(), assembly);
        }}
      >
        <input
          type="text"
          placeholder="e.g. BRAF p.V600E"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          disabled={disabled}
        />
        <select
          value={assembly}
          onChange={(e) => setAssembly(e.target.value as Assembly)}
          disabled={disabled}
          aria-label="Genome assembly"
        >
          <option value="GRCh38">GRCh38 / hg38</option>
          <option value="GRCh37">GRCh37 / hg19</option>
        </select>
        <button type="submit" disabled={disabled || !query.trim()}>
          Search PubMed
        </button>
      </form>
      <p className="examples">
        Try:{" "}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            {i > 0 && " "}
            <code onClick={() => setQuery(ex)}>{ex}</code>
          </span>
        ))}
      </p>
    </>
  );
}
