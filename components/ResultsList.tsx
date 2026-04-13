"use client";

interface Article {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  matchedBy: string[];
}

interface Props {
  data: { count: number; articles: Article[] };
}

export function ResultsList({ data }: Props) {
  if (data.count === 0) {
    return (
      <div className="panel">
        <h2>PubMed results</h2>
        <p style={{ color: "var(--muted)" }}>No articles found for any representation.</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <h2>PubMed results ({data.count})</h2>
      {data.articles.map((a) => (
        <div className="article" key={a.pmid}>
          <div className="title">
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.title || `(no title, PMID ${a.pmid})`}
            </a>
          </div>
          <div className="meta">
            {a.authors.slice(0, 3).join(", ")}
            {a.authors.length > 3 ? ", et al." : ""}
            {a.journal ? ` — ${a.journal}` : ""}
            {a.pubDate ? ` (${a.pubDate})` : ""}
            {a.doi ? (
              <>
                {" "}·{" "}
                <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer">
                  doi:{a.doi}
                </a>
              </>
            ) : null}
          </div>
          <div className="matched">matched on: {a.matchedBy.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}
