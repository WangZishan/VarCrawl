import { NextRequest, NextResponse } from "next/server";
import { searchClinvarForVariants } from "@/lib/clinvar/entrez";
import { cacheGet, cacheSet, hash } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  variants: string[];
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    return NextResponse.json({ error: "'variants' must be a non-empty string array" }, { status: 400 });
  }

  const variants = body.variants
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, 50);

  const cacheKey = `clinvar:${hash(variants)}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const cfg = {
    apiKey: process.env.NCBI_API_KEY,
    email: process.env.NCBI_EMAIL,
    tool: "askmutation",
  };

  const records = await searchClinvarForVariants(variants, cfg);
  const resp = { count: records.length, records };
  await cacheSet(cacheKey, resp, 3600 * 6);
  return NextResponse.json(resp);
}
