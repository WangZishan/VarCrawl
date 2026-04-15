"use client";

interface ClinvarRecord {
  uid: string;
  accession?: string;
  title?: string;
  gene?: string;
  clinicalSignificance?: string;
  reviewStatus?: string;
  lastEvaluated?: string;
  conditions: string[];
  matchedBy: string[];
}

interface Props {
  data: { count: number; records: ClinvarRecord[] };
}

function sigClass(sig?: string): string {
  const x = (sig ?? "").toLowerCase();
  if (x.includes("pathogenic") && !x.includes("likely") && !x.includes("benign")) return "sig-path";
  if (x.includes("likely pathogenic")) return "sig-lpath";
  if (x.includes("uncertain") || x.includes("conflicting")) return "sig-vus";
  if (x.includes("likely benign")) return "sig-lbenign";
  if (x.includes("benign")) return "sig-benign";
  return "sig-other";
}

export function ClinvarResults({ data }: Props) {
  if (data.count === 0) {
    return (
      <div className="panel">
        <h2>ClinVar records</h2>
        <p style={{ color: "var(--muted)" }}>No ClinVar records matched any representation.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>ClinVar records ({data.count})</h2>
      {data.records.map((r) => (
        <div className="clinvar-row" key={r.uid}>
          <div className="title">
            <a
              href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${r.uid}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.title || r.accession || `ClinVar UID ${r.uid}`}
            </a>
            {r.clinicalSignificance && (
              <span className={`sig-badge ${sigClass(r.clinicalSignificance)}`}>
                {r.clinicalSignificance}
              </span>
            )}
          </div>
          <div className="meta">
            {r.accession && <span>{r.accession}</span>}
            {r.gene && <span> · {r.gene}</span>}
            {r.reviewStatus && <span> · {r.reviewStatus}</span>}
            {r.lastEvaluated && <span> · evaluated {r.lastEvaluated}</span>}
          </div>
          {r.conditions.length > 0 && (
            <div className="meta">Conditions: {r.conditions.slice(0, 6).join("; ")}
              {r.conditions.length > 6 ? `; +${r.conditions.length - 6} more` : ""}
            </div>
          )}
          <div className="matched">matched on: {r.matchedBy.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}
