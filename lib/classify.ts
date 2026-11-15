import { z } from "zod";
import { CATEGORIES, COUNTS_AS_INCOME, INSTRUCTION_RE, PLATFORM_RE, type Category } from "./categories";
import { computeTax, type TaxResult } from "./tax";

export const ModelLineSchema = z.object({
  id: z.string(),
  category: z.enum(CATEGORIES),
  sure: z.boolean(),
  reason: z.string(),
  question: z.string().nullable(),
  options: z.array(z.enum(CATEGORIES)),
});
export const ModelOutputSchema = z.object({ lines: z.array(ModelLineSchema) });
export type ModelLine = z.infer<typeof ModelLineSchema>;

export type Inflow = { id: string; date: string; narration: string; amountKobo: number };

export type Decided = Inflow & {
  category: Category; // best classification
  sure: boolean; // false = waits for the account holder's answer, counted as income meanwhile
  reason: string;
  question: string | null;
  options: Category[];
  modelCategory: Category | null; // what SERV said, before code guards
  guards: string[]; // code rules that changed or overrode SERV's answer
};

const DEFAULT_OPTIONS: Category[] = ["client_payment", "gift", "loan"];
const SAVINGS_RE = /\b(ajo|esusu|adashe|thrift|piggyvest|cowrywise)\b/i;

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Code guards run after SERV. They can only make the result more careful: turn a "sure" answer
 * into a question, or a non-income answer into income. They never turn income into non-income.
 */
export function applyGuards(inflows: Inflow[], model: ModelLine[] | null, holderName: string): Decided[] {
  const byId = new Map<string, ModelLine>();
  for (const m of model ?? []) if (!byId.has(m.id)) byId.set(m.id, m);
  const holder = nameTokens(holderName);

  return inflows.map((inf) => {
    const m = byId.get(inf.id);
    const guards: string[] = [];
    let category: Category;
    let sure: boolean;
    let reason: string;
    let question: string | null;
    let options: Category[];

    if (!m) {
      guards.push("NO-ANSWER: SERV returned nothing for this line, so it counts as income until you answer");
      category = "unclear";
      sure = false;
      reason = "Not classified.";
      question = "What was this money?";
      options = DEFAULT_OPTIONS;
    } else {
      category = m.category;
      sure = m.sure && m.category !== "unclear";
      reason = m.reason.slice(0, 280);
      question = m.question;
      options = m.options.filter((o) => o !== "unclear");
    }

    const narr = inf.narration;

    if (INSTRUCTION_RE.test(narr)) {
      guards.push("INSTRUCTION: the narration talks to the reviewer instead of describing a payment; ignored and counted as income");
      category = "unclear";
      sure = false;
      question = "This narration tried to tell the checker what to do. What was this money really?";
      options = DEFAULT_OPTIONS;
    }

    if (category === "own_transfer" && holder.length > 0 && !SAVINGS_RE.test(narr)) {
      const lower = narr.toLowerCase();
      const matches = holder.filter((t) => lower.includes(t)).length;
      if (matches === 0) {
        guards.push("OWN-NAME: called a transfer from your own account, but your name is not in the narration");
        sure = false;
        question = question ?? "Did this come from another account in your own name?";
        options = ["own_transfer", "client_payment", "gift"];
      }
    }

    const platform = narr.match(PLATFORM_RE)?.[1];
    if (platform && !COUNTS_AS_INCOME[category]) {
      guards.push(`PLATFORM: money from ${platform} is usually freelance income arriving, not a ${category.replace("_", " ")}`);
      category = "client_payment";
      sure = false;
      question = `This came through ${platform}. Was it payment for your work?`;
      options = ["client_payment", "own_transfer", "refund"];
    }

    if (!sure) {
      if (!question) question = "What was this money?";
      // Always let the account holder answer with at least one income and one non-income option.
      const base = options.length ? options : [category === "unclear" ? "client_payment" : category];
      options = Array.from(new Set<Category>([...base, ...DEFAULT_OPTIONS])).slice(0, 4);
      if (!options.some((o) => !COUNTS_AS_INCOME[o])) options = [...options.slice(0, 3), "gift"];
      if (!options.some((o) => COUNTS_AS_INCOME[o])) options = ["client_payment", ...options.slice(0, 3)];
    } else {
      question = null;
    }

    return { ...inf, category, sure, reason, question, options, modelCategory: m?.category ?? null, guards };
  });
}

export type Summary = {
  now: TaxResult; // open questions counted as income
  best: TaxResult; // every open question answered in your favour
  open: number;
  answered: number;
};

export function effectiveCategory(d: Decided, answers: Record<string, Category>): { cat: Category; pending: boolean } {
  const a = answers[d.id];
  if (a) return { cat: a, pending: false };
  return { cat: d.category, pending: !d.sure };
}

export function summarize(
  lines: Decided[],
  answers: Record<string, Category>,
  expensesKobo: number,
  rentKobo: number,
  otherReliefsKobo = 0,
): Summary {
  let incomeNow = 0;
  let incomeBest = 0;
  let open = 0;
  let answered = 0;
  for (const d of lines) {
    const { cat, pending } = effectiveCategory(d, answers);
    if (answers[d.id]) answered++;
    if (pending) {
      open++;
      incomeNow += d.amountKobo; // fail closed: an open question counts as income
      const anyNonIncome = d.options.some((o) => !COUNTS_AS_INCOME[o]);
      if (!anyNonIncome) incomeBest += d.amountKobo;
    } else if (COUNTS_AS_INCOME[cat]) {
      incomeNow += d.amountKobo;
      incomeBest += d.amountKobo;
    }
  }
  return {
    now: computeTax(incomeNow, expensesKobo, rentKobo, otherReliefsKobo),
    best: computeTax(incomeBest, expensesKobo, rentKobo, otherReliefsKobo),
    open,
    answered,
  };
}
