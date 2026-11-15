"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ANSWER_LABEL, COUNTS_AS_INCOME, LABEL, type Category } from "@/lib/categories";
import { effectiveCategory, summarize, type Decided } from "@/lib/classify";
import { parseNairaToKobo } from "@/lib/money";
import { BASIS, GIFT_LABEL_QUOTE, NTA_PDF } from "@/lib/rules";
import { SAMPLES } from "@/lib/samples";
import { Money } from "./Money";
import { SectionHead } from "./Sections";

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
  if (pending) return "chip chip-open";
  return COUNTS_AS_INCOME[cat] ? "chip chip-income" : "chip chip-free";
}

const SAMPLE_TAGS: Record<string, string> = { designer: "Freelancer", trader: "Trader", tricky: "Adversarial" };

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
      writeLog([
        {
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
        },
        ...parseLog(rawLog()),
      ]);
      requestAnimationFrame(() => document.getElementById("estimate")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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

  // Lines SERV (or a code rule) was unsure about stay in statement order, answered or not, so cards don't jump.
  const asked = result?.lines.filter((d) => !d.sure) ?? [];
  const showGiftQuote = result?.lines.some((d) => /\bgift\b/i.test(d.narration) && d.category !== "gift");
  const moneyIn = result?.lines.reduce((a, d) => a + d.amountKobo, 0) ?? 0;
  const rulesFired = result?.lines.reduce((a, d) => a + d.guards.length, 0) ?? 0;
  const split = { inc: 0, open: 0, free: 0 };
  for (const d of result?.lines ?? []) {
    const { cat, pending } = effectiveCategory(d, answers);
    if (pending) split.open += d.amountKobo;
    else if (COUNTS_AS_INCOME[cat]) split.inc += d.amountKobo;
    else split.free += d.amountKobo;
  }

  return (
    <>
      {/* 01 · samples */}
      <section className="pb-14">
        <SectionHead n="01" kicker="Pick a statement" title="Try a statement" />
        <div className="grid gap-3 md:grid-cols-3">
          {SAMPLES.map((s, i) => {
            const active = sampleKey === s.key;
            return (
              <button
                key={s.key}
                onClick={() => loadSample(s.key)}
                aria-pressed={active}
                className={`relative min-h-[190px] overflow-hidden p-6 text-left transition ${active ? "panel-blue" : "panel hover:border-white/25"}`}
              >
                <span
                  className="pix-deco"
                  style={
                    active
                      ? undefined
                      : ({ "--sq-a": "rgba(35,56,255,0.55)", "--sq-b": "rgba(123,136,255,0.35)", "--sq-c": "rgba(185,194,255,0.18)" } as React.CSSProperties)
                  }
                />
                <div className={`mono-label ${active ? "!text-ice" : ""}`}>
                  0{i + 1} / {SAMPLE_TAGS[s.key] ?? "Sample"}
                </div>
                <div className="mt-14 text-[19px] font-medium tracking-tight">{s.title}</div>
                <div className={`mt-2 max-w-[34ch] text-[14px] leading-relaxed ${active ? "text-paper/85" : "text-muted"}`}>{s.blurb}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 02 · statement */}
      <section id="check" className="scroll-mt-24 pb-14">
        <SectionHead n="02" kicker="Your statement" title="Paste and check" />
        <div className="panel grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-2">
            <label className="mono-label" htmlFor="stmt">
              Bank statement · CSV with a header row
            </label>
            <textarea
              id="stmt"
              value={statement}
              onChange={(e) => {
                setStatement(e.target.value);
                setSampleKey(null);
              }}
              spellCheck={false}
              className="field h-[340px] resize-y font-mono text-[12px] leading-[1.7]"
            />
            <span className="text-[12.5px] text-muted">Columns found by name: Date, Narration or Description, Credit/Debit, Money In/Out, or Amount with CR/DR.</span>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Account holder" value={holder} onChange={setHolder} hint="Spots transfers between your own accounts" />
            <Field label="Rent paid in 2026" value={rent} onChange={setRent} invalid={rentK === null} hint="20% relief, at most ₦500,000 · s.30" money />
            <Field label="Business expenses" value={expenses} onChange={setExpenses} invalid={expK === null} hint="Wholly and exclusively for the work · s.20" money />
            <Field label="Pension, NHF, NHIS, life cover" value={reliefs} onChange={setReliefs} invalid={relK === null} hint="Other reliefs · s.30" money />
            <div className="flex flex-col gap-2">
              <span className="mono-label">SERV mode</span>
              <div className="tabs">
                <button className="tab" aria-pressed={careful} onClick={() => setCareful(true)} title="serv_shadow_agent validates the draft and has it revised">
                  Careful · Shadow agent
                </button>
                <button className="tab" aria-pressed={!careful} onClick={() => setCareful(false)} title="One SERV pass, no validation loop">
                  Fast · one pass
                </button>
              </div>
            </div>
            <button className="cta mt-1" onClick={check} disabled={loading || !inputsValid || holder.trim().length < 2}>
              <span>{loading ? `Reading · ${elapsed.toFixed(0)}s` : "Check my statement"}</span>
              <span className="arrow-tile">{loading ? "…" : "→"}</span>
            </button>
            {loading && (
              <div className="flex flex-col gap-2">
                <div className="scan" />
                <span className="text-[12.5px] leading-relaxed text-muted">
                  {elapsed < 4
                    ? "Sending the inflows to SERV Reasoning with the rulebook…"
                    : elapsed < 12
                      ? "SERV is walking each line through the rulebook…"
                      : careful
                        ? "Shadow agent is checking the draft: every line once, every reason quoted, every doubt a question…"
                        : "Almost there…"}
                </span>
              </div>
            )}
          </div>
        </div>
        {error && <div className="mt-4 rounded-[4px] border border-danger/50 bg-danger/10 p-4 text-[14px] text-danger">{error}</div>}
      </section>

      {result && summary && (
        <>
          {/* 03 · estimate */}
          <section id="estimate" className="scroll-mt-24 pb-14 rise">
            <SectionHead n="03" kicker="Your estimate" title="Tax year 2026" />
            {!result.audit.ok && (
              <div className="mb-4 rounded-[4px] border border-danger/50 bg-danger/10 p-4 text-[14px]">
                <span className="font-medium text-danger">SERV could not classify this statement.</span>{" "}
                <span className="text-paper/70">
                  Every inflow is counted as income until you answer, so this is the most you could owe, not a guess. ({result.audit.error})
                </span>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
              <div className="panel-blue relative flex flex-col overflow-hidden p-6 sm:p-8">
                <span className="pix-deco bottom" />
                <div className="mono-label !text-ice">Estimated personal income tax</div>
                <div key={summary.now.taxKobo} className="pixel flash mt-6 text-[clamp(52px,8vw,112px)] leading-[0.95]">
                  <Money kobo={summary.now.taxKobo} whole />
                </div>
                <div className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-paper/90">
                  {summary.open > 0 ? (
                    <>
                      {summary.open} open question{summary.open === 1 ? "" : "s"} counted as income for now. If they all go your way:{" "}
                      <Money kobo={summary.best.taxKobo} whole className="font-semibold" />
                    </>
                  ) : (
                    "Every inflow is settled."
                  )}
                </div>
                <div className="relative mt-auto pt-8 pr-0 sm:pr-32">
                  <div className="flex h-3 w-full overflow-hidden rounded-[2px] bg-ink/40">
                    {split.inc > 0 && <div className="bg-paper" style={{ width: `${(split.inc / moneyIn) * 100}%` }} />}
                    {split.open > 0 && (
                      <div
                        style={{
                          width: `${(split.open / moneyIn) * 100}%`,
                          background: "repeating-linear-gradient(135deg, var(--ice) 0 3px, transparent 3px 6px)",
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] tracking-[0.08em] text-ice uppercase">
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 bg-paper" />
                      Income <Money kobo={split.inc} whole />
                    </span>
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 bg-ice/70" />
                      Open <Money kobo={split.open} whole />
                    </span>
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 bg-ink/50" />
                      Not income <Money kobo={split.free} whole />
                    </span>
                  </div>
                </div>
              </div>
              <div className="panel p-6">
                <div className="mono-label mb-3">How the number is made · code, not the model</div>
                <KV k="Income" v={<Money kobo={summary.now.incomeKobo} />} />
                <KV k="− Business expenses · s.20" v={<Money kobo={summary.now.expensesKobo} />} />
                <KV k="− Rent relief · s.30" v={<Money kobo={summary.now.rentReliefKobo} />} />
                <KV k="− Other reliefs · s.30" v={<Money kobo={summary.now.otherReliefsKobo} />} />
                <KV k="Chargeable income" v={<Money kobo={summary.now.chargeableKobo} />} strong />
                <div className="my-3 h-px bg-line" />
                {summary.now.bands.map((b) => (
                  <KV key={b.label} k={`${b.label} at ${Math.round(b.rate * 100)}%`} v={<Money kobo={b.taxKobo} />} dim={b.taxedKobo === 0} />
                ))}
                <a href={NTA_PDF} target="_blank" rel="noreferrer" className="mono-label mt-3 inline-block !text-blue-l hover:!text-ice">
                  Rates · NTA s.58, Fourth Schedule ↗
                </a>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line md:grid-cols-4">
              <Stat label="Money in" value={<Money kobo={moneyIn} />} />
              <Stat label="Counted as income" value={<Money kobo={summary.now.incomeKobo} />} tone="text-ice" />
              <Stat label="Not income" value={<Money kobo={moneyIn - summary.now.incomeKobo} />} />
              <Stat label="Lines read" value={`${result.lines.length} in · ${result.outflowCount} out`} />
            </div>
          </section>

          {/* 04 · questions */}
          {asked.length > 0 && (
            <section className="pb-14 rise">
              <SectionHead n="04" kicker="Only you know" title="Answer, watch it move" />
              {showGiftQuote && (
                <blockquote className="mb-4 border-l-2 border-blue-l pl-4 text-[15px] leading-relaxed">
                  &ldquo;{GIFT_LABEL_QUOTE.text}&rdquo;{" "}
                  <a href={GIFT_LABEL_QUOTE.url} target="_blank" rel="noreferrer" className="mono-label !text-blue-l hover:!text-ice">
                    {GIFT_LABEL_QUOTE.who} ↗
                  </a>
                </blockquote>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {asked.map((d, i) => (
                  <div key={d.id} className="panel flex flex-col p-5">
                    <div className="flex items-start justify-between gap-4">
                      <span className="pixel text-[28px] leading-none text-blue-l">Q{i + 1}</span>
                      <Money kobo={d.amountKobo} className="pixel text-[28px] leading-none" />
                    </div>
                    <div className="mt-4 font-mono text-[12px] break-all text-muted">
                      {d.date} · {d.narration}
                    </div>
                    <div className="mt-3 text-[16px] leading-snug">{d.question ?? "What was this money?"}</div>
                    {d.reason && <div className="mt-2 text-[13px] leading-relaxed text-paper/60">SERV · {d.reason}</div>}
                    {d.guards.map((g) => (
                      <div key={g} className="tag-rule mt-1.5">
                        CODE · {g}
                      </div>
                    ))}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {d.options.map((o) => {
                        const p = preview(d.id, o);
                        return (
                          <button key={o} className="option" aria-pressed={answers[d.id] === o} onClick={() => setAnswers((a) => ({ ...a, [d.id]: o }))}>
                            {ANSWER_LABEL[o]}
                            {p !== null && (
                              <span className="preview">
                                → <Money kobo={p} whole />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {answers[d.id] && (
                        <button
                          className="mono-label px-2 underline hover:!text-paper"
                          onClick={() =>
                            setAnswers((a) => {
                              const n = { ...a };
                              delete n[d.id];
                              return n;
                            })
                          }
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

          {/* ledger */}
          <section className="pb-14 rise">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="eyebrow solid">Ledger</span>
                <h3 className="display mt-3 text-[30px]">Every inflow, with its basis</h3>
              </div>
              <span className="mono-label">
                {rulesFired} code rule{rulesFired === 1 ? "" : "s"} fired
              </span>
            </div>
            <div className="panel overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Narration</th>
                    <th className="!text-right">Amount</th>
                    <th>Class</th>
                    <th>Why</th>
                    <th>Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((d) => {
                    const { cat, pending } = effectiveCategory(d, answers);
                    const basis = BASIS[pending ? "unclear" : cat];
                    return (
                      <tr key={d.id}>
                        <td className="num font-mono text-[12px] whitespace-nowrap text-muted">{d.date}</td>
                        <td className="max-w-[260px] font-mono text-[12px] break-words">{d.narration}</td>
                        <td className="text-right whitespace-nowrap">
                          <Money kobo={d.amountKobo} />
                        </td>
                        <td>
                          <span className={chipClass(cat, pending)}>{pending ? `Ask · ${LABEL[cat]}?` : LABEL[cat]}</span>
                          {answers[d.id] && <div className="mono-label mt-1.5 !text-[10px]">your answer</div>}
                        </td>
                        <td className="max-w-[300px] text-[13px] leading-relaxed text-paper/65">
                          {d.reason}
                          {d.guards.length > 0 && (
                            <div className="tag-rule mt-1">
                              {d.guards.length} code rule{d.guards.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </td>
                        <td className="text-[12.5px]">
                          <a href={basis.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-4 hover:decoration-ice" title={basis.text}>
                            {basis.cite}
                          </a>
                          {basis.firm !== "act" && <div className="mono-label mt-1 !text-[10px]">{basis.firm === "guidance" ? "official guidance" : "not in the Act"}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {result.skipped.length > 0 && (
                <div className="border-t border-line p-4 text-[13px] text-danger">
                  {result.skipped.length} line{result.skipped.length > 1 ? "s" : ""} could not be read and were not counted:{" "}
                  {result.skipped.map((s) => `line ${s.line} (${s.why})`).join("; ")}
                </div>
              )}
            </div>
          </section>

          {/* audit */}
          <section className="pb-6 rise">
            <div className="mb-4">
              <span className="eyebrow solid">Audit</span>
              <h3 className="display mt-3 text-[30px]">This check</h3>
            </div>
            <div className="panel grid gap-x-10 p-6 font-mono text-[12.5px] md:grid-cols-2">
              <AuditRow k="serv.status" v={result.audit.ok ? "classified" : `failed closed · ${result.audit.error}`} tone={result.audit.ok ? "text-ice" : "text-danger"} />
              <AuditRow k="model" v={result.audit.model} />
              <AuditRow k="reasoning_effort" v={result.audit.reasoning_effort} />
              <AuditRow k="features" v={result.audit.features.join(" · ")} />
              <AuditRow k="response.id" v={result.audit.responseId ?? "none returned"} />
              <AuditRow k="request.id" v={result.audit.requestId ?? "none returned"} />
              <AuditRow k="latency" v={`${(result.audit.latencyMs / 1000).toFixed(1)} s`} />
              <AuditRow k="tokens" v={result.audit.usage ? `${result.audit.usage.total} · ${result.audit.usage.cached} cached` : "not reported"} />
              <AuditRow k="checked_at" v={new Date(result.audit.checkedAt).toLocaleString()} />
              <AuditRow k="code_rules_fired" v={String(rulesFired)} />
            </div>
          </section>
        </>
      )}

      {log.length > 0 && (
        <section className="pt-8 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="eyebrow">Your recent checks · this browser only</span>
            <button onClick={() => writeLog([])} className="mono-label underline hover:!text-paper">
              clear
            </button>
          </div>
          <div className="panel overflow-x-auto">
            <table className="ledger !min-w-[680px] font-mono !text-[12px]">
              <tbody>
                {log.map((e, i) => (
                  <tr key={i}>
                    <td className="text-muted">{new Date(e.at).toLocaleTimeString()}</td>
                    <td>{e.holder}</td>
                    <td>{e.inflows} inflows</td>
                    <td>{e.model}</td>
                    <td className={e.ok ? "text-ice" : "text-danger"}>{e.ok ? "serv ok" : "failed closed"}</td>
                    <td>{(e.latencyMs / 1000).toFixed(1)} s</td>
                    <td>
                      <Money kobo={e.taxKobo} whole />
                    </td>
                    <td className="text-muted">{e.open} open</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; hint?: string; invalid?: boolean; money?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mono-label">{props.label}</span>
      <div className="relative">
        {props.money && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted">₦</span>}
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          inputMode={props.money ? "numeric" : undefined}
          className={`field num text-[15px] ${props.money ? "pl-7" : ""} ${props.invalid ? "invalid" : ""}`}
        />
      </div>
      {props.invalid ? <span className="text-[12px] text-danger">Enter a whole naira amount</span> : props.hint && <span className="text-[12px] text-muted">{props.hint}</span>}
    </label>
  );
}

function KV({ k, v, strong, dim }: { k: string; v: React.ReactNode; strong?: boolean; dim?: boolean }) {
  return (
    <div className={`kv ${strong ? "strong" : ""} ${dim ? "dim" : ""}`}>
      <span>{k}</span>
      <span className="num text-right">{v}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="bg-ink-2 p-5">
      <div className="mono-label">{label}</div>
      <div className={`pixel mt-3 text-[clamp(20px,2.2vw,28px)] leading-none ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function AuditRow({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-dashed border-line py-2">
      <span className="text-muted">{k}</span>
      <span className={`text-right break-all ${tone ?? ""}`}>{v}</span>
    </div>
  );
}
