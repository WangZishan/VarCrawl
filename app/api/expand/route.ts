import { NextRequest, NextResponse } from "next/server";
import { classify } from "@/lib/hgvs/classify";
import { canonicalize } from "@/lib/hgvs/convert";
import { enumerateVariantStrings } from "@/lib/hgvs/enumerate";
import { Assembly } from "@/lib/hgvs/types";
import { cacheGet, cacheSet, hash } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Body {
  query: string;
  assembly?: Assembly;
}

const VALID_ASSEMBLIES: Assembly[] = ["GRCh38", "GRCh37", "T2T-CHM13v2.0"];

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "Missing 'query'" }, { status: 400 });
  }
  const assembly = body.assembly ?? "GRCh38";
  if (!VALID_ASSEMBLIES.includes(assembly)) {
    return NextResponse.json({ error: "Invalid 'assembly'" }, { status: 400 });
  }

  const classified = classify(body.query);
  if (classified.kind === "unknown") {
    return NextResponse.json(
      {
        error:
          "Could not recognize the mutation format. Examples: BRAF p.V600E, NM_004333.6:c.1799T>A, chr7:g.140753336A>T, rs113488022.",
        classified,
      },
      { status: 400 },
    );
  }

  const cacheKey = `expand:${hash({ q: body.query, a: assembly })}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const canonical = await canonicalize(classified, assembly);
  const variants = enumerateVariantStrings(canonical);

  const resp = {
    input: body.query,
    assembly,
    classified,
    canonical,
    variants,
  };
  await cacheSet(cacheKey, resp);
  return NextResponse.json(resp);
}
