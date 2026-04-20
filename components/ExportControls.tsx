"use client";

import React from "react";
import { useState } from "react";

interface Props {
  expand?: unknown | null;
  pubmed?: unknown | null;
  clinvar?: unknown | null;
  onDownload: (format: "json" | "csv") => void | Promise<void>;
  defaultFormat?: "json" | "csv";
}

export function ExportControls({ expand, pubmed, clinvar, onDownload, defaultFormat = "json" }: Props) {
  const [format, setFormat] = useState<"json" | "csv">(defaultFormat);

  if (!expand && !pubmed && !clinvar) return null;

  return (
    <div className="panel" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="muted-small">Format:</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "csv") }>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>
        <button onClick={() => onDownload(format)} className="btn">Download</button>
      </div>
      <div className="muted-small">Download combined results ({format.toUpperCase()})</div>
    </div>
  );
}

export default ExportControls;
