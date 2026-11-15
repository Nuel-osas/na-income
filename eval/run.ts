// Runs the labelled eval: Fast vs Careful SERV mode, raw SERV answers vs answers after the code rules.
// Usage: npx tsx eval/run.ts   (reads SERV_API_KEY from .env.local; never prints it)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Expect = "income" | "not_income" | "ask";
type Treatment = Expect | "missing";
type Case = { id: string; holder: string; date: string; narration: string; amount_naira: number; expect: Expect; note: string };

function loadEnv() {
  if (process.env.SERV_API_KEY || !existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function correct(expect: Expect, t: Treatment): boolean {
  if (expect === "income") return t === "income" || t === "ask";
  return t === expect;
}
const dangerous = (expect: Expect, t: Treatment) => (expect === "income" || expect === "ask") && t === "not_income";

async function main() {
  loadEnv();
  const { classifyWithServ, SERV_MODEL } = await import("../lib/serv");
  const { applyGuards } = await import("../lib/classify");
  const { COUNTS_AS_INCOME } = await import("../lib/categories");

  const cases: Case[] = JSON.parse(readFileSync("eval/cases.json", "utf8")).cases;
  const holders = [...new Set(cases.map((c) => c.holder))];
  const modes = [
    { name: "Fast", careful: false },
    { name: "Careful", careful: true },
  ];
  const runs: unknown[] = [];
  const table: string[] = [];

  for (const mode of modes) {
    for (const runNo of [1, 2]) {
      const perCase: { id: string; expect: Expect; raw: Treatment; guarded: Treatment; model: string | null; guards: string[] }[] = [];
      let latency = 0;
      let tokens = 0;
      const responseIds: (string | null)[] = [];
      const failures: string[] = [];

      for (const holder of holders) {
        const group = cases.filter((c) => c.holder === holder);
        const inflows = group.map((c) => ({ id: c.id, date: c.date, narration: c.narration, amountKobo: Math.round(c.amount_naira * 100) }));
        const { lines, audit } = await classifyWithServ(holder, inflows, { careful: mode.careful });
        latency += audit.latencyMs;
        tokens += audit.usage?.total ?? 0;
        responseIds.push(audit.responseId);
        if (!audit.ok) failures.push(`${holder}: ${audit.error}`);
        const decided = applyGuards(inflows, lines, holder);
        for (const c of group) {
          const m = lines?.find((l) => l.id === c.id);
          const raw: Treatment = !m ? "missing" : !m.sure || m.category === "unclear" ? "ask" : COUNTS_AS_INCOME[m.category] ? "income" : "not_income";
          const d = decided.find((x) => x.id === c.id)!;
          const guarded: Treatment = !d.sure ? "ask" : COUNTS_AS_INCOME[d.category] ? "income" : "not_income";
          perCase.push({ id: c.id, expect: c.expect, raw, guarded, model: m ? `${m.category}${m.sure ? "" : "?"}` : null, guards: d.guards.map((g) => g.split(":")[0]) });
        }
      }

      const score = (k: "raw" | "guarded") => ({
        correct: perCase.filter((p) => correct(p.expect, p[k])).length,
        dangerous: perCase.filter((p) => dangerous(p.expect, p[k])).length,
        questions: perCase.filter((p) => p[k] === "ask").length,
        wrong: perCase.filter((p) => !correct(p.expect, p[k])).map((p) => `${p.id}:${p.expect}->${p[k]}`),
      });
      const raw = score("raw");
      const guarded = score("guarded");
      runs.push({ mode: mode.name, run: runNo, latencyMs: latency, tokens, responseIds, failures, raw, guarded, perCase });
      table.push(
        `| ${mode.name} | ${runNo} | ${raw.correct}/30 | ${raw.dangerous} | ${raw.questions} | ${guarded.correct}/30 | ${guarded.dangerous} | ${guarded.questions} | ${(latency / 1000).toFixed(1)} s | ${tokens} |`,
      );
      console.log(
        `${mode.name} run ${runNo}: raw ${raw.correct}/30 (dangerous ${raw.dangerous}, q ${raw.questions}) | guarded ${guarded.correct}/30 (dangerous ${guarded.dangerous}, q ${guarded.questions}) | ${(latency / 1000).toFixed(1)}s | ${tokens} tok${failures.length ? " | FAIL " + failures.join("; ") : ""}`,
      );
      console.log(`   raw wrong: ${raw.wrong.join(" ") || "none"}`);
      console.log(`   guarded wrong: ${guarded.wrong.join(" ") || "none"}`);
    }
  }

  const header =
    "| Mode | Run | Raw correct | Raw dangerous | Raw questions | Guarded correct | Guarded dangerous | Guarded questions | Latency (2 calls) | Tokens |\n|---|---|---|---|---|---|---|---|---|---|";
  writeFileSync(
    "eval/results.json",
    JSON.stringify({ model: SERV_MODEL, reasoning_effort: "low", ranAt: new Date().toISOString(), cases: cases.length, runs }, null, 2) + "\n",
  );
  writeFileSync("eval/table.md", header + "\n" + table.join("\n") + "\n");
  console.log("\n" + header + "\n" + table.join("\n"));
}

main().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
