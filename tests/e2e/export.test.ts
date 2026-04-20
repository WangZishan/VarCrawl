/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import { chromium } from "playwright";
import { spawn } from "child_process";
import fs from "fs/promises";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function waitForServer(url: string, timeout = 30000) {
  const start = Date.now();
  // use global fetch (Node 18+)
  // eslint-disable-next-line no-undef
  // @ts-ignore
  const fetchFn = globalThis.fetch ?? ((u: string) => Promise.reject(new Error("fetch not available")));
  while (Date.now() - start < timeout) {
    try {
      const r = await fetchFn(url);
      if (r && r.ok) return;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for server");
}

describe("End-to-end export flow", async () => {
  it("loads UI, runs search, and downloads exported JSON", async () => {
    const dev = spawn("pnpm", ["dev"], { shell: true, stdio: "pipe" });

    try {
      await waitForServer(BASE_URL);

      const browser = await chromium.launch();
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();

      // Mock the upstream API responses so test is deterministic
      await page.route("**/api/expand", (route) => {
        const resp = {
          input: "BRAF p.V600E",
          assembly: "GRCh38",
          classified: { kind: "hgvsp", gene: "BRAF", accession: "", body: "", proteinShort: "V600E", proteinLong: "p.Val600Glu" },
          canonical: { gene: "BRAF", rsid: null, hgvsg: null, notes: [], consequences: [] },
          groups: { universal: [{ text: "p.V600E", label: "p.V600E" }], perTranscript: [], fallback: [] },
          variants: [{ text: "p.V600E", label: "p.V600E" }],
        };
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
      });

      await page.route("**/api/pubmed", (route) => {
        const resp = { count: 1, status: { complete: true, likelyRateLimited: false, likelyPartial: false }, articles: [{ pmid: "12345", title: "Test article", authors: ["A"], journal: "J", pubDate: "2020", doi: null, matchedBy: ["p.V600E"] }] };
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
      });

      await page.route("**/api/clinvar", (route) => {
        const resp = { count: 1, unfilteredCount: 1, gene: "BRAF", proteinForms: ["V600E"], status: { complete: true, likelyRateLimited: false, likelyPartial: false }, records: [{ uid: "1", accession: "VCV1", title: "ClinVar test", gene: "BRAF", clinicalSignificance: "Pathogenic", reviewStatus: "criteria", lastEvaluated: "2020", conditions: [], matchedBy: ["p.V600E"] }] };
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
      });

      await page.goto(BASE_URL, { waitUntil: "networkidle" });

      // Fill search form
      await page.fill('input[placeholder="e.g. BRAF p.V600E"]', "BRAF p.V600E");
      await page.click('button:has-text("Search PubMed")');

      // Wait for results to render
      await page.waitForSelector('text=Mutation representations');

      // Click Download and wait for a download
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click('button:has-text("Download")'),
      ]);

      const path = await download.path();
      expect(path).toBeTruthy();

      const content = await fs.readFile(path!, "utf8");
      expect(content).toContain("generatedAt");
      expect(content).toContain("BRAF");

      await browser.close();
    } finally {
      // Kill dev server if still running
      if (!dev.killed) dev.kill();
    }
  }, 120000);
});
