import { NTA_PDF } from "@/lib/rules";

const REPO = "https://github.com/Nuel-osas/na-income";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-3">
          <Mark />
          <span className="text-[19px] font-semibold tracking-tight">na income?</span>
        </a>
        <nav className="hidden items-center gap-1 rounded-full border border-line px-2 py-1 md:flex">
          {[
            ["Check", "#check"],
            ["How it works", "#how"],
            ["The law", "#law"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="rounded-full px-4 py-1.5 text-sm text-muted transition hover:text-paper">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="mono-label hidden lg:inline">SERV Hackathon 02 · Open Track</span>
          <a href={REPO} target="_blank" rel="noreferrer" className="btn-paper">
            GitHub <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect x="4" y="18" width="7" height="7" fill="#7b88ff" />
      <rect x="11" y="11" width="7" height="7" fill="#b9c2ff" />
      <rect x="18" y="4" width="10" height="21" fill="#2338ff" />
      <rect x="4" y="25" width="24" height="3" fill="#f2efe8" />
    </svg>
  );
}

export function Hero() {
  return (
    <section id="top" className="grid items-end gap-10 pt-16 pb-10 lg:grid-cols-[1.25fr_1fr] lg:pt-24">
      <div>
        <span className="eyebrow">Nigeria Tax Act 2025 · tax year 2026</span>
        <h1 className="display mt-6 text-[clamp(42px,6.2vw,88px)]">
          Is it income?
          <br />
          <span className="accent">Know your tax.</span>
        </h1>
        <span className="pixel-bar mt-7" />
        <p className="mt-7 max-w-[560px] text-[17px] leading-relaxed text-paper/80">
          Paste a bank statement. SERV Reasoning reads every transfer and says what it was: a client paying you, family support, a loan,
          a refund, your own money moving. Code does the maths with the Act&apos;s bands. You answer only what nobody else can know.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-3 lg:items-end">
        <span className="mono-label inline-flex w-fit items-center gap-2 rounded-[4px] border border-line px-3 py-2">
          <span className="h-[7px] w-[7px] bg-blue-l" /> Live · SERV Reasoning
        </span>
        <div className="grid w-full max-w-[440px] grid-cols-2">
          <div className="panel-blue rounded-r-none p-5">
            <div className="mono-label !text-ice/90">First ₦800k · rate</div>
            <div className="pixel mt-3 text-[56px] leading-none">0%</div>
          </div>
          <div className="panel rounded-l-none border-l-0 p-5">
            <div className="mono-label">Above ₦50m · rate</div>
            <div className="pixel mt-3 text-[56px] leading-none">25%</div>
          </div>
        </div>
        <span className="mono-label">NTA s.58, Fourth Schedule</span>
      </div>
    </section>
  );
}

export function SplitBar() {
  return (
    <div className="split mb-20">
      <p className="text-[15px] leading-relaxed text-paper/80">
        Writing &ldquo;gift&rdquo; on a monthly payment doesn&apos;t make it a gift. Payoneer money is income even in your own name. When the
        narration can&apos;t say, it asks you.
      </p>
      <a href="#how">
        How it works <span className="mini-arrow">↗</span>
      </a>
      <a href="#check" className="blue">
        Check a statement <span className="mini-arrow">↓</span>
      </a>
    </div>
  );
}

export function SectionHead({ n, kicker, title, children }: { n: string; kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="eyebrow">
          {n} · {kicker}
        </span>
        <h2 className="display mt-4 text-[clamp(32px,4.2vw,56px)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "SERV reads",
    body: "Each inflow goes to SERV Reasoning on gpt-5.4-mini with the rulebook as its system prompt and strict json_schema output: a category, whether it is sure, the narration words it relied on, and a question when it is not. In Careful mode serv_shadow_agent checks the draft and has it revised first.",
  },
  {
    n: "02",
    title: "Code decides",
    body: "Amounts are parsed into kobo by code, never taken from the model. Code decides which categories are income, applies the s.58 bands and the s.20 and s.30 deductions, and runs four rules that can only make SERV stricter: NO-ANSWER, INSTRUCTION, OWN-NAME, PLATFORM.",
  },
  {
    n: "03",
    title: "You answer",
    body: "An open question counts as income until you answer, so the figure is never an underestimate. Every answer button previews the new tax, and the maths reruns in your browser. If SERV fails, every inflow is counted and asked.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 py-20">
      <SectionHead n="05" kicker="How it works" title="Judgment, then arithmetic" />
      <div className="grid gap-px overflow-hidden rounded-[4px] border border-line bg-line md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.n} className={`relative p-6 ${i === 0 ? "bg-blue" : "bg-ink-2"}`}>
            <div className={`mono-label ${i === 0 ? "!text-ice/90" : ""}`}>{s.n} / step</div>
            <div className="display mt-8 text-[34px]">{s.title}</div>
            <p className={`mt-4 text-[14.5px] leading-relaxed ${i === 0 ? "text-paper/90" : "text-paper/75"}`}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const LAW: [string, string, string][] = [
  ["Bands: first ₦800,000 at 0%, then 15, 18, 21, 23 and 25%", "NTA s.58, Fourth Schedule", NTA_PDF],
  ["Rent relief: 20% of annual rent, at most ₦500,000", "NTA s.30(2)(a)(vi)", NTA_PDF],
  ["NHF, NHIS, pension, owner-occupied mortgage interest, life cover", "NTA s.30(2)(a)(i)–(v)", NTA_PDF],
  ["Business expenses: wholly and exclusively for the income", "NTA s.20(1)", NTA_PDF],
  ["Freelance and trade income is income", "NTA s.4(1)(a)", NTA_PDF],
  ["A resident's income counts wherever it arises (Upwork, Payoneer)", "NTA s.12", NTA_PDF],
  ["Gifts and refunds are not taxed", "Official guidance; the Act is silent", "https://businessday.ng/?p=1061286"],
  [
    "Loans and own transfers are not income",
    "General principle; the Act is silent",
    "https://hallmarknews.com/stamp-duty-on-bank-transactions-not-a-tax-ogirs-clarifies-at-tax-reform-lecture/",
  ],
  ["File with your State IRS; 2026 income is filed in 2027", "NTAA s.3(2), s.13", "https://nannews.ng/fct-irs-sets-march-31-deadline-for-individual-tax-returns/"],
];

export function LawTable() {
  return (
    <section id="law" className="scroll-mt-24 pb-20">
      <SectionHead n="06" kicker="The law it applies" title="Every rule, cited">
        <a href={NTA_PDF} target="_blank" rel="noreferrer" className="mono-label !text-blue-l hover:!text-ice">
          Read the certified Act ↗
        </a>
      </SectionHead>
      <div className="panel overflow-hidden">
        {LAW.map(([rule, cite, url]) => (
          <a
            key={rule}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="grid gap-1 border-b border-line px-5 py-4 transition last:border-b-0 hover:bg-white/[0.03] md:grid-cols-[1fr_300px] md:gap-6"
          >
            <span className="text-[15px]">{rule}</span>
            <span className="mono-label md:text-right">{cite}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-10 text-[13px] leading-relaxed text-muted sm:px-6 md:grid-cols-[1fr_auto]">
        <p className="max-w-[760px]">
          An estimate, not tax advice. Only money in is classified; expenses and reliefs are typed in. Where the Act is silent, the basis column
          says so. Statement text goes to SERV Reasoning for classification and is not stored by this app. Sample statements are synthetic.
        </p>
        <div className="flex flex-col gap-2 md:items-end">
          <span className="mono-label">Built for SERV Hackathon 02 · Open Track</span>
          <a href={REPO} target="_blank" rel="noreferrer" className="mono-label !text-blue-l hover:!text-ice">
            Source on GitHub ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
