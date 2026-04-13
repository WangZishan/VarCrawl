"use client";

interface Props {
  data: {
    input: string;
    assembly: string;
    classified: { kind: string; gene?: string; accession?: string; body: string };
    canonical: {
      gene?: string;
      rsid?: string;
      hgvsg?: string;
      notes: string[];
      consequences: { gene?: string; hgvsc?: string; hgvsp?: string }[];
    };
    variants: { text: string; label: string }[];
  };
}

export function VariantPanel({ data }: Props) {
  return (
    <div className="panel">
      <h2>Mutation representations ({data.variants.length})</h2>
      <div className="variant-list">
        {data.variants.map((v) => (
          <span key={v.text} className="variant-chip" title={v.label}>
            <span className="label">{v.label}</span>
            {v.text}
          </span>
        ))}
      </div>
      {data.canonical.notes.length > 0 && (
        <div className="notes">
          {data.canonical.notes.map((n, i) => (
            <div key={i}>• {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}
