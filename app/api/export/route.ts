import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

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

  if (format.toLowerCase() === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Summary");

    sheet.columns = [
      { header: "source", key: "source", width: 12 },
      { header: "type", key: "type", width: 12 },
      { header: "id", key: "id", width: 20 },
      { header: "title", key: "title", width: 60 },
      { header: "gene", key: "gene", width: 20 },
      { header: "matchedBy", key: "matchedBy", width: 40 },
      { header: "extra", key: "extra", width: 40 },
    ];

    if (Array.isArray(summary.pubmed?.articles)) {
      for (const a of summary.pubmed.articles) {
        const title = a.title ?? "";
        const matchedBy = Array.isArray(a.matchedBy) ? a.matchedBy.join("; ") : "";
        const authors = Array.isArray(a.authors) ? a.authors.join("; ") : "";
        const extra = `${authors}${a.journal ? " | " + (a.journal ?? "") : ""}${a.pubDate ? " | " + (a.pubDate ?? "") : ""}`;
        sheet.addRow({ source: "pubmed", type: "article", id: String(a.pmid ?? ""), title, gene: "", matchedBy, extra });
      }
    }

    if (Array.isArray(summary.clinvar?.records)) {
      for (const r of summary.clinvar.records) {
        const title = r.title ?? r.accession ?? "";
        const matchedBy = Array.isArray(r.matchedBy) ? r.matchedBy.join("; ") : "";
        const extra = `${r.clinicalSignificance ?? ""}${r.reviewStatus ? " | " + (r.reviewStatus ?? "") : ""}`;
        sheet.addRow({ source: "clinvar", type: "record", id: String(r.uid ?? ""), title, gene: r.gene ?? "", matchedBy, extra });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `varcrawl-summary-${safeQuery}-${timestamp}.xlsx`;
    return new Response(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
