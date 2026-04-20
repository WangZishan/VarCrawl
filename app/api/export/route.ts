import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const format = req.nextUrl?.searchParams.get("format") ?? "json";
  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    query: body?.query ?? null,
    expand: body?.expand ?? null,
    pubmed: body?.pubmed ?? null,
    clinvar: body?.clinvar ?? null,
  };

  const safeQuery = (summary.query ?? "varcrawl").toString().replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  const timestamp = generatedAt.replace(/[:.]/g, "-");

  if (format.toLowerCase() === "csv") {
    const rows: string[] = [];
    rows.push(["source", "type", "id", "title", "gene", "matchedBy", "extra"].join(","));

    if (Array.isArray(summary.pubmed?.articles)) {
      for (const a of summary.pubmed.articles) {
        const title = (a.title ?? "").replace(/"/g, '""');
        const matchedBy = (Array.isArray(a.matchedBy) ? a.matchedBy.join('; ') : '').replace(/"/g, '""');
        const authors = (Array.isArray(a.authors) ? a.authors.join('; ') : '').replace(/"/g, '""');
        const extra = `${authors}${a.journal ? ' | ' + (a.journal ?? '') : ''}${a.pubDate ? ' | ' + (a.pubDate ?? '') : ''}`.replace(/"/g, '""');
        rows.push(['pubmed', 'article', String(a.pmid ?? ''), `"${title}"`, '', `"${matchedBy}"`, `"${extra}"`].join(','));
      }
    }

    if (Array.isArray(summary.clinvar?.records)) {
      for (const r of summary.clinvar.records) {
        const title = (r.title ?? r.accession ?? '').replace(/"/g, '""');
        const matchedBy = (Array.isArray(r.matchedBy) ? r.matchedBy.join('; ') : '').replace(/"/g, '""');
        const extra = `${r.clinicalSignificance ?? ''}${r.reviewStatus ? ' | ' + (r.reviewStatus ?? '') : ''}`.replace(/"/g, '""');
        rows.push(['clinvar', 'record', String(r.uid ?? ''), `"${title}"`, r.gene ?? '', `"${matchedBy}"`, `"${extra}"`].join(','));
      }
    }

    const csv = rows.join('\n');
    const filename = `varcrawl-summary-${safeQuery}-${timestamp}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const filename = `varcrawl-summary-${safeQuery}-${timestamp}.json`;
  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
