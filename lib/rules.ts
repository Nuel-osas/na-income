import type { Category } from "./categories";

// The legal basis shown next to each category. Checked against the certified Nigeria Tax Act 2025 (NTA)
// and Nigeria Tax Administration Act 2025 (NTAA) on 2026-11-15; see README "Sources".
export const NTA_PDF =
  "https://media.premiumtimesng.com/wp-content/files/2026/01/Final-Approved-Copy-for-Print-NIGERIA-TAX-ACT-2025.pdf";

export type Basis = { cite: string; text: string; url: string; firm: "act" | "guidance" | "unconfirmed" };

export const BASIS: Record<Category, Basis> = {
  client_payment: {
    cite: "NTA s.4(1)(a), s.12",
    text: "Profits from a trade, business, profession or vocation are income. A resident's income counts wherever it arises, so Upwork or Payoneer money counts too.",
    url: NTA_PDF,
    firm: "act",
  },
  salary: {
    cite: "NTA s.4(1)",
    text: "Employment income is income.",
    url: NTA_PDF,
    firm: "act",
  },
  other_income: {
    cite: "NTA s.4(1)(k)",
    text: "Any other income, profit or gain is income.",
    url: NTA_PDF,
    firm: "act",
  },
  gift: {
    cite: "Official guidance",
    text: "\"Personal transfers such as family remittances, gifts, refunds are not [taxed], only income earned.\" Taiwo Oyedele, tax reform committee chair. The Act itself is silent.",
    url: "https://businessday.ng/?p=1061286",
    firm: "guidance",
  },
  refund: {
    cite: "Official guidance; NTA s.192(1)",
    text: "Refunds are not income, except a refund of an expense you already deducted, which becomes income on the day it is refunded.",
    url: "https://businessday.ng/?p=1061286",
    firm: "guidance",
  },
  loan: {
    cite: "General principle (Act silent)",
    text: "Borrowed money you must repay is not earned. The Act does not say this outright; a State IRS has said loans and transfers are not taxable.",
    url: "https://hallmarknews.com/stamp-duty-on-bank-transactions-not-a-tax-ogirs-clarifies-at-tax-reform-lecture/",
    firm: "unconfirmed",
  },
  own_transfer: {
    cite: "General principle (Act silent)",
    text: "Moving your own money between your own accounts earns nothing. The Act does not say this outright.",
    url: "https://hallmarknews.com/stamp-duty-on-bank-transactions-not-a-tax-ogirs-clarifies-at-tax-reform-lecture/",
    firm: "unconfirmed",
  },
  unclear: {
    cite: "Counted as income until you answer",
    text: "Nobody should under-declare by accident, so an unanswered line is counted.",
    url: NTA_PDF,
    firm: "act",
  },
};

export const GIFT_LABEL_QUOTE = {
  text: "It doesn't matter how you describe it… You know the amount that is your income.",
  who: "Taiwo Oyedele, on people writing \"gift\" on transfers",
  url: "https://www.icirnigeria.org/nigerians-are-writing-gift-on-bank-transfers-to-evade-tax-why-it-wont-work/",
};
