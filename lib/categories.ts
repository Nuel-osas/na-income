export const CATEGORIES = [
  "client_payment",
  "salary",
  "other_income",
  "own_transfer",
  "gift",
  "loan",
  "refund",
  "unclear",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Code decides what counts as income. The model only classifies.
// "unclear" counts as income until the account holder answers, so nobody under-declares by accident.
export const COUNTS_AS_INCOME: Record<Category, boolean> = {
  client_payment: true,
  salary: true,
  other_income: true,
  own_transfer: false,
  gift: false,
  loan: false,
  refund: false,
  unclear: true,
};

export const LABEL: Record<Category, string> = {
  client_payment: "Client payment",
  salary: "Salary",
  other_income: "Other income",
  own_transfer: "Own transfer",
  gift: "Gift",
  loan: "Loan",
  refund: "Refund / reversal",
  unclear: "Unclear",
};

export const ANSWER_LABEL: Record<Category, string> = {
  client_payment: "Payment for my work",
  salary: "My salary",
  other_income: "Other earnings",
  own_transfer: "From my own account",
  gift: "A gift",
  loan: "A loan I'll repay",
  refund: "A refund to me",
  unclear: "Not sure",
};

/** Money platforms where freelance income usually first lands. A withdrawal from one is income arriving, not a gift or loan. */
export const PLATFORM_RE =
  /\b(payoneer|grey|upwork|fiverr|deel|wise|transferwise|raenest|geegpay|chipper|paypal|toptal|remote\.com|payday|leatherback|cleva)\b/i;

/** Anything in a narration that talks to the AI rather than describing a payment. */
export const INSTRUCTION_RE =
  /\b(ignore|disregard|override)\b.{0,40}\b(rules?|instructions?|previous|above)\b|\b(classify|mark|treat)\b.{0,30}\b(as|like)\b.{0,20}\b(gift|loan|refund|not income|non[- ]?taxable)\b|\b(system prompt|you are an ai|as an ai)\b/i;
