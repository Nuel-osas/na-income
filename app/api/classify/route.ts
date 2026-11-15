import { z } from "zod";
import { applyGuards, type Inflow } from "@/lib/classify";
import { parseStatement } from "@/lib/statement";
import { classifyWithServ } from "@/lib/serv";

export const maxDuration = 90;

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

  const parsed = parseStatement(body.statement);
  const inflows: Inflow[] = parsed.rows
    .filter((r) => r.creditKobo > 0)
    .map((r) => ({ id: r.id, date: r.date, narration: r.narration, amountKobo: r.creditKobo }));

  if (inflows.length === 0) {
    return Response.json({ error: "No money-in rows found in that statement.", skipped: parsed.skipped, columns: parsed.columns }, { status: 422 });
  }
  if (inflows.length > MAX_INFLOWS) {
    return Response.json({ error: `This demo checks up to ${MAX_INFLOWS} money-in rows at a time; that statement has ${inflows.length}.` }, { status: 413 });
  }

  const { lines, audit } = await classifyWithServ(body.holderName, inflows, { careful: body.careful });
  const decided = applyGuards(inflows, lines, body.holderName);

  return Response.json({
    lines: decided,
    outflowCount: parsed.rows.length - inflows.length,
    skipped: parsed.skipped,
    columns: parsed.columns,
    audit: { ...audit, checkedAt: new Date().toISOString(), inflows: inflows.length },
  });
}
