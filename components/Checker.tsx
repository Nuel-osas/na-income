"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ANSWER_LABEL, COUNTS_AS_INCOME, LABEL, type Category } from "@/lib/categories";
import { effectiveCategory, summarize, type Decided } from "@/lib/classify";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { BASIS, GIFT_LABEL_QUOTE, NTA_PDF } from "@/lib/rules";
import { SAMPLES } from "@/lib/samples";

type Audit = {
  ok: boolean;
  model: string;
  reasoning_effort: string;
  features: string[];
  responseId: string | null;
  requestId: string | null;
  latencyMs: number;
  usage: { prompt: number; completion: number; total: number; cached: number } | null;
  finishReason: string | null;
  error: string | null;
  checkedAt: string;
  inflows: number;
};

type Result = {
  lines: Decided[];
  outflowCount: number;
  skipped: { line: number; text: string; why: string }[];
  audit: Audit;
};

type LogEntry = {
  at: string;
  holder: string;
  inflows: number;
  model: string;
  ok: boolean;
  latencyMs: number;
  taxKobo: number;
  open: number;
  responseId: string | null;
  error: string | null;
};

const LOG_KEY = "na-income-log-v1";

const LOG_EVENT = "na-income-log";

function rawLog(): string {
  try {
    return localStorage.getItem(LOG_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function parseLog(raw: string): LogEntry[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as LogEntry[]) : [];
  } catch {
    return [];
  }
}
function writeLog(entries: LogEntry[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    /* storage blocked: the log is a convenience */
  }
  window.dispatchEvent(new Event(LOG_EVENT));
}
function subscribeLog(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(LOG_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(LOG_EVENT, cb);
  };
}

function koboFromInput(v: string): number | null {
  if (v.trim() === "") return 0;
  const k = parseNairaToKobo(v);
  return k === null || k < 0 ? null : k;
}

function chipClass(cat: Category, pending: boolean) {
  if (pending) return "border border-dashed border-open text-open";
  return COUNTS_AS_INCOME[cat] ? "bg-income/15 text-income" : "bg-free/15 text-free";
}

export default function Checker() {
  const first = SAMPLES[0];
  const [sampleKey, setSampleKey] = useState<string | null>(first.key);
  const [holder, setHolder] = useState(first.holderName);
  const [statement, setStatement] = useState(first.statement);
  const [rent, setRent] = useState(String(first.annualRent));
  const [expenses, setExpenses] = useState(String(first.expenses));
  const [reliefs, setReliefs] = useState("0");
  const [careful, setCareful] = useState(true);
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [answers, setAnswers] = useState<Record<string, Category>>({});
  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);
  const elapsed = startedAt === null ? 0 : Math.max(0, (now - startedAt) / 1000);

  const logRaw = useSyncExternalStore(subscribeLog, rawLog, () => "[]");
  const log = useMemo(() => parseLog(logRaw), [logRaw]);

  const rentK = koboFromInput(rent);
  const expK = koboFromInput(expenses);
  const relK = koboFromInput(reliefs);
  const inputsValid = rentK !== null && expK !== null && relK !== null;

  const summary = useMemo(() => {
    if (!result || !inputsValid) return null;
    return summarize(result.lines, answers, expK!, rentK!, relK!);
  }, [result, answers, expK, rentK, relK, inputsValid]);

  function loadSample(key: string) {
    const s = SAMPLES.find((x) => x.key === key)!;
    setSampleKey(key);
    setHolder(s.holderName);
    setStatement(s.statement);
    setRent(String(s.annualRent));
    setExpenses(String(s.expenses));
    setReliefs("0");
    setResult(null);
    setAnswers({});
    setError(null);
  }

  async function check() {
    setLoading(true);
    setStartedAt(Date.now());
    setNow(Date.now());
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ holderName: holder, statement, careful }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const r = data as Result;
      setResult(r);
      const s = summarize(r.lines, {}, expK ?? 0, rentK ?? 0, relK ?? 0);
      const entry: LogEntry = {
        at: r.audit.checkedAt,
        holder,
        inflows: r.audit.inflows,
        model: r.audit.model,
        ok: r.audit.ok,
        latencyMs: r.audit.latencyMs,
        taxKobo: s.now.taxKobo,
        open: s.open,
        responseId: r.audit.responseId,
        error: r.audit.error,
      };
      writeLog([entry, ...parseLog(rawLog())]);
    } catch {
      setError("Could not reach the checker. Nothing was classified.");
    } finally {
      setLoading(false);
      setStartedAt(null);
    }
  }

  function preview(id: string, cat: Category): number | null {
    if (!result || !inputsValid) return null;
    return summarize(result.lines, { ...answers, [id]: cat }, expK!, rentK!, relK!).now.taxKobo;
  }

  const pending = result?.lines.filter((d) => effectiveCategory(d, answers).pending) ?? [];
  const answeredLines = result?.lines.filter((d) => answers[d.id]) ?? [];
  const showGiftQuote = result?.lines.some((d) => /\bgift\b/i.test(d.narration) && d.category !== "gift");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Na Income?</h1>
          <span className="rounded border border-line px-2 py-0.5 text-xs text-muted">Nigeria Tax Act 2025 · tax year 2026</span>
        </div>
        <p className="max-w-3xl text-muted">
          Paste a bank statement. <span className="text-text">SERV Reasoning</span> reads every inflow and says whether it is a client payment,
          a gift, a loan, a refund or your own money moving. <span className="text-text">Code</span> does the maths with the Act&apos;s bands. When SERV
          is not sure, it asks you one question, and your answer moves the number.
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        {SAMPLES.map((s) => (
          <button
            key={s.key}
            onClick={() => loadSample(s.key)}
            className={`rounded-lg border p-4 text-left transition ${
              sampleKey === s.key ? "border-open bg-panel-2" : "border-line bg-panel hover:border-muted"
            }`}
          >
            <div className="font-medium">{s.title}</div>
            <div className="mt-1 text-sm text-muted">{s.blurb}</div>
          </button>
        ))}
      </section>

      <section className="mb-8 grid gap-4 rounded-xl border border-line bg-panel p-4 sm:p-5 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted" htmlFor="stmt">
            Bank statement (CSV export, with a header row: Date, Narration, Credit/Debit or Amount)
          </label>
          <textarea
            id="stmt"
            value={statement}
            onChange={(e) => {
              setStatement(e.target.value);
              setSampleKey(null);
            }}
            spellCheck={false}
            className="h-64 w-full resize-y rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed outline-none focus:border-open"
          />
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Account holder's name" value={holder} onChange={setHolder} hint="Used to spot transfers between your own accounts" />
          <Field label="Rent paid in 2026 (₦)" value={rent} onChange={setRent} invalid={rentK === null} hint="20% relief, at most ₦500,000 (s.30)" />
          <Field label="Business expenses (₦)" value={expenses} onChange={setExpenses} invalid={expK === null} hint="Wholly and exclusively for the work (s.20)" />
          <Field label="Pension, NHF, NHIS, life cover (₦)" value={reliefs} onChange={setReliefs} invalid={relK === null} hint="Other reliefs (s.30)" />
          <div className="flex rounded-lg border border-line p-1 text-xs">
            <button
              onClick={() => setCareful(true)}
              className={`flex-1 rounded-md px-2 py-1.5 ${careful ? "bg-panel-2 text-text" : "text-muted"}`}
              title="SERV Shadow Agent validates the draft and has it revised before you see it"
            >
              Careful · Shadow Agent
            </button>
            <button
              onClick={() => setCareful(false)}
              className={`flex-1 rounded-md px-2 py-1.5 ${!careful ? "bg-panel-2 text-text" : "text-muted"}`}
              title="One SERV pass, no validation loop"
            >
              Fast · one pass
            </button>
          </div>
          <button
            onClick={check}
            disabled={loading || !inputsValid || holder.trim().length < 2}
            className="mt-1 rounded-lg bg-text px-4 py-3 font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? `SERV is reading every line… ${elapsed.toFixed(0)}s` : "Check my statement"}
          </button>
          {loading && (
            <div className="text-xs leading-relaxed text-muted">
              {elapsed < 4
                ? "Sending the inflows to SERV Reasoning with the rulebook…"
                : elapsed < 12
                  ? "SERV is walking each line through the rulebook…"
                  : careful
                    ? "Shadow Agent is checking the draft: every line once, every reason quoted, every doubt turned into a question…"
                    : "Almost there…"}
            </div>
          )}
        </div>
      </section>

      {error && <div className="mb-6 rounded-lg border border-danger/50 bg-danger/10 p-4 text-danger">{error}</div>}

      {result && summary && (
        <>
          {!result.audit.ok && (
            <div className="mb-6 rounded-lg border border-danger/50 bg-danger/10 p-4 text-sm">
              <span className="font-medium text-danger">SERV could not classify this statement.</span>{" "}
              <span className="text-muted">
                Every inflow is counted as income until you answer, so the figure below is the most you could owe, not a guess. ({result.audit.error})
              </span>
            </div>
          )}

          <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-line bg-panel p-5">
              <div className="text-sm text-muted">Estimated 2026 personal income tax</div>
              <div className="num mt-1 text-5xl font-semibold tracking-tight">{formatNaira(summary.now.taxKobo)}</div>
              {summary.open > 0 ? (
                <div className="mt-2 text-sm text-muted">
                  <span className="text-open">{summary.open} open question{summary.open === 1 ? "" : "s"}</span> counted as income for now. If they
                  all go your way: <span className="num text-text">{formatNaira(summary.best.taxKobo)}</span>
                </div>
              ) : (
                <div className="mt-2 text-sm text-free">Every inflow is settled.</div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Money in" value={formatNaira(result.lines.reduce((a, d) => a + d.amountKobo, 0))} />
                <Stat label="Counted as income" value={formatNaira(summary.now.incomeKobo)} tone="income" />
                <Stat label="Not income" value={formatNaira(result.lines.reduce((a, d) => a + d.amountKobo, 0) - summary.now.incomeKobo)} tone="free" />
                <Stat label="Lines read" value={`${result.lines.length} in · ${result.outflowCount} out`} />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-5 text-sm">
              <div className="mb-3 text-muted">How the number is made (code, not the model)</div>
              <Row k="Income" v={formatNaira(summary.now.incomeKobo)} />
              <Row k="− Business expenses (s.20)" v={formatNaira(summary.now.expensesKobo)} />
              <Row k="− Rent relief (s.30)" v={formatNaira(summary.now.rentReliefKobo)} />
              <Row k="− Other reliefs (s.30)" v={formatNaira(summary.now.otherReliefsKobo)} />
              <Row k="Chargeable income" v={formatNaira(summary.now.chargeableKobo)} strong />
              <div className="my-2 border-t border-line" />
              {summary.now.bands.map((b) => (
                <Row key={b.label} k={`${b.label} at ${Math.round(b.rate * 100)}%`} v={formatNaira(b.taxKobo)} muted={b.taxedKobo === 0} />
              ))}
              <div className="mt-2 text-xs text-muted">
                Rates: NTA s.58 and Fourth Schedule.{" "}
                <a className="underline" href={NTA_PDF} target="_blank" rel="noreferrer">
                  Read the Act
                </a>
              </div>
            </div>
          </section>

          {(pending.length > 0 || answeredLines.length > 0) && (
            <section className="mb-6 rounded-xl border border-open/40 bg-panel p-5">
              <div className="mb-1 font-medium">Questions only you can answer</div>
              <p className="mb-4 text-sm text-muted">Each answer changes the number above. Nothing is sent anywhere; the maths runs in your browser.</p>
              {showGiftQuote && (
                <blockquote className="mb-4 border-l-2 border-income pl-3 text-sm">
                  <span className="text-text">&ldquo;{GIFT_LABEL_QUOTE.text}&rdquo;</span>{" "}
                  <a href={GIFT_LABEL_QUOTE.url} target="_blank" rel="noreferrer" className="text-muted underline">
                    {GIFT_LABEL_QUOTE.who}
                  </a>
                </blockquote>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {[...pending, ...answeredLines.filter((d) => !pending.includes(d))].map((d) => (
                  <div key={d.id} className="rounded-lg border border-line bg-panel-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-mono text-xs break-all text-muted">{d.narration}</div>
                      <div className="num shrink-0 font-medium">{formatNaira(d.amountKobo)}</div>
                    </div>
                    <div className="mt-2 text-sm">{d.question ?? "What was this money?"}</div>
                    {d.reason && <div className="mt-1 text-xs text-muted">SERV: {d.reason}</div>}
                    {d.guards.map((g) => (
                      <div key={g} className="mt-1 text-xs text-income">
                        Code: {g}
                      </div>
                    ))}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.options.map((o) => {
                        const p = preview(d.id, o);
                        const active = answers[d.id] === o;
                        return (
                          <button
                            key={o}
                            onClick={() => setAnswers((a) => ({ ...a, [d.id]: o }))}
                            className={`rounded-md border px-3 py-1.5 text-sm transition ${
                              active ? "border-open bg-open/15 text-text" : "border-line hover:border-muted"
                            }`}
                          >
                            {ANSWER_LABEL[o]}
                            {p !== null && <span className="num ml-2 text-xs text-muted">→ {formatNaira(p)}</span>}
                          </button>
                        );
                      })}
                      {answers[d.id] && (
                        <button
                          onClick={() =>
                            setAnswers((a) => {
                              const n = { ...a };
                              delete n[d.id];
                              return n;
                            })
                          }
                          className="px-2 text-xs text-muted underline"
                        >
                          undo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-6 overflow-hidden rounded-xl border border-line bg-panel">
            <div className="border-b border-line p-4 font-medium">Every inflow, with its reason and its legal basis</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="p-3 font-normal">Date</th>
                    <th className="p-3 font-normal">Narration</th>
                    <th className="p-3 text-right font-normal">Amount</th>
                    <th className="p-3 font-normal">Class</th>
                    <th className="p-3 font-normal">Why</th>
                    <th className="p-3 font-normal">Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((d) => {
                    const { cat, pending: isPending } = effectiveCategory(d, answers);
                    const basis = BASIS[isPending ? "unclear" : cat];
                    return (
                      <tr key={d.id} className="border-b border-line/60 align-top">
                        <td className="num p-3 whitespace-nowrap text-muted">{d.date}</td>
                        <td className="max-w-[260px] p-3 font-mono text-xs break-words">{d.narration}</td>
                        <td className="num p-3 text-right whitespace-nowrap">{formatNaira(d.amountKobo)}</td>
                        <td className="p-3">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs whitespace-nowrap ${chipClass(cat, isPending)}`}>
                            {isPending ? `Ask · ${LABEL[cat]}?` : LABEL[cat]}
                          </span>
                          {answers[d.id] && <div className="mt-1 text-[11px] text-muted">your answer</div>}
                        </td>
                        <td className="max-w-[300px] p-3 text-xs text-muted">
                          {d.reason}
                          {d.guards.length > 0 && <div className="mt-1 text-income">{d.guards.length} code rule{d.guards.length > 1 ? "s" : ""} applied</div>}
                        </td>
                        <td className="p-3 text-xs">
                          <a href={basis.url} target="_blank" rel="noreferrer" className="underline decoration-line" title={basis.text}>
                            {basis.cite}
                          </a>
                          {basis.firm !== "act" && <div className="text-[11px] text-muted">{basis.firm === "guidance" ? "official guidance" : "not in the Act"}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {result.skipped.length > 0 && (
              <div className="border-t border-line p-4 text-xs text-danger">
                {result.skipped.length} line{result.skipped.length > 1 ? "s" : ""} could not be read and were not counted:{" "}
                {result.skipped.map((s) => `line ${s.line} (${s.why})`).join("; ")}
              </div>
            )}
          </section>

          <section className="mb-6 rounded-xl border border-line bg-panel p-5 text-sm">
            <div className="mb-3 font-medium">Audit: this check</div>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <Row k="SERV status" v={result.audit.ok ? "classified" : `failed closed: ${result.audit.error}`} />
              <Row k="Model" v={result.audit.model} mono />
              <Row k="reasoning_effort" v={result.audit.reasoning_effort} mono />
              <Row k="SERV features" v={result.audit.features.join(", ")} />
              <Row k="Response id" v={result.audit.responseId ?? "none returned"} mono />
              <Row k="Request id" v={result.audit.requestId ?? "none returned"} mono />
              <Row k="Latency" v={`${(result.audit.latencyMs / 1000).toFixed(1)} s`} />
              <Row
                k="Tokens"
                v={result.audit.usage ? `${result.audit.usage.total} (${result.audit.usage.cached} cached prompt)` : "not reported"}
              />
              <Row k="Checked at" v={new Date(result.audit.checkedAt).toLocaleString()} />
              <Row k="Code rules fired" v={String(result.lines.reduce((a, d) => a + d.guards.length, 0))} />
            </div>
          </section>
        </>
      )}

      {log.length > 0 && (
        <section className="mb-6 rounded-xl border border-line bg-panel p-5 text-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-medium">Your recent checks (this browser only)</div>
            <button
              onClick={() => writeLog([])}
              className="text-xs text-muted underline"
            >
              clear
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <tbody>
                {log.map((e, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="num py-1.5 pr-3 text-muted">{new Date(e.at).toLocaleTimeString()}</td>
                    <td className="py-1.5 pr-3">{e.holder}</td>
                    <td className="py-1.5 pr-3">{e.inflows} inflows</td>
                    <td className="py-1.5 pr-3 font-mono">{e.model}</td>
                    <td className={`py-1.5 pr-3 ${e.ok ? "text-free" : "text-danger"}`}>{e.ok ? "SERV ok" : "failed closed"}</td>
                    <td className="num py-1.5 pr-3">{(e.latencyMs / 1000).toFixed(1)} s</td>
                    <td className="num py-1.5 pr-3">{formatNaira(e.taxKobo)}</td>
                    <td className="py-1.5 text-muted">{e.open} open</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="mt-auto border-t border-line pt-5 text-xs leading-relaxed text-muted">
        An estimate, not tax advice. Personal income tax for residents is filed with your State Internal Revenue Service; 2026 income is filed in 2027
        (most states ask by 31 March). Only money in is classified; outflows are not deducted automatically. Gifts, refunds, loans and own transfers are
        treated as not income on official guidance and general principle; where the Act itself is silent, the basis column says so. Statement text goes to
        SERV Reasoning for classification and is not stored by this app.
      </footer>
    </main>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; hint?: string; invalid?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`num rounded-lg border bg-bg px-3 py-2 outline-none focus:border-open ${props.invalid ? "border-danger" : "border-line"}`}
      />
      {props.invalid ? <span className="text-xs text-danger">Enter a whole naira amount</span> : props.hint && <span className="text-xs text-muted">{props.hint}</span>}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "free" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 font-medium ${tone === "income" ? "text-income" : tone === "free" ? "text-free" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ k, v, strong, muted, mono }: { k: string; v: string; strong?: boolean; muted?: boolean; mono?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-0.5 ${muted ? "opacity-40" : ""}`}>
      <span className="text-muted">{k}</span>
      <span className={`num text-right break-all ${strong ? "font-semibold" : ""} ${mono ? "font-mono text-xs" : ""}`}>{v}</span>
    </div>
  );
}
