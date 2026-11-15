import { z } from "zod";
import { applyGuards, type Inflow } from "@/lib/classify";
import { verifyExtracted, type CheckedRow, type VerifyResult } from "@/lib/extract";
import { parseStatement, type Row } from "@/lib/statement";
import { classifyWithServ, extractWithServ, type ServAudit } from "@/lib/serv";

export const maxDuration = 120;

const Body = z.object({
  holderName: z.string().trim().min(2).max(100),
  statement: z.string().min(10).max(200_000),
  careful: z.boolean().default(true),
});

const MAX_INFLOWS = 120;

// Best-effort per-instance limit so a public demo can't drain the SERV balance in a loop.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Too many checks from this address. Try again in a few minutes." }, { status: 429 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Send holderName (2-100 chars) and statement text." }, { status: 400 });
  }

  // CSV with a header row is parsed by code alone. Anything else (text copied from a PDF, or pulled
  // out of an uploaded PDF in the browser) is read by SERV and then verified by code.
  const csv = parseStatement(body.statement);
  let mode: "csv" | "text" = "csv";
  let rows: (Row | CheckedRow)[] = csv.rows;
  let skipped = csv.skipped;
  let extraction: { audit: ServAudit; stats: VerifyResult["stats"] } | null = null;

  if (csv.rows.length === 0) {
    mode = "text";
    const { extracted, audit: exAudit } = await extractWithServ(body.statement);
    if (!extracted) {
      return Response.json(
        { error: `SERV could not read rows from that text, so nothing was counted. (${exAudit.error ?? "no rows"})`, extraction: { audit: exAudit } },
        { status: 502 },
      );
    }
    const v = verifyExtracted(body.statement, extracted);
    rows = v.rows;
    skipped = v.skipped;
    extraction = { audit: exAudit, stats: v.stats };
  }

  const inflows: Inflow[] = rows
    .filter((r) => r.creditKobo > 0)
    .map((r) => ({ id: r.id, date: r.date, narration: r.narration, amountKobo: r.creditKobo, check: "check" in r ? r.check : undefined }));

  if (inflows.length === 0) {
    return Response.json({ error: "No money-in rows found in that statement.", skipped, columns: csv.columns, extraction }, { status: 422 });
  }
  if (inflows.length > MAX_INFLOWS) {
    return Response.json({ error: `This demo checks up to ${MAX_INFLOWS} money-in rows at a time; that statement has ${inflows.length}.` }, { status: 413 });
  }

  const { lines, audit } = await classifyWithServ(body.holderName, inflows, { careful: body.careful });
  const decided = applyGuards(inflows, lines, body.holderName);

  return Response.json({
    mode,
    lines: decided,
    outflowCount: rows.length - inflows.length,
    skipped,
    columns: csv.columns,
    extraction,
    audit: { ...audit, checkedAt: new Date().toISOString(), inflows: inflows.length },
  });
}
