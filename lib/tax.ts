import { naira } from "./money";

// Nigeria Tax Act 2025, s.58 and Fourth Schedule: rates on an individual's chargeable income (from 1 January 2026).
// Checked against the certified Act text and PwC tax summaries on 2026-11-15; see README "Sources".
// Rent relief: s.30(2)(a)(vi), 20% of annual rent paid, at most ₦500,000. Expenses: s.20(1), "wholly and exclusively".
// Other reliefs: s.30(2)(a)(i)-(v): NHF, NHIS, pension, owner-occupied mortgage interest, life insurance.
export const BANDS: { upToKobo: number; rate: number; label: string }[] = [
  { upToKobo: naira(800_000), rate: 0, label: "First ₦800,000" },
  { upToKobo: naira(3_000_000), rate: 0.15, label: "Next ₦2,200,000" },
  { upToKobo: naira(12_000_000), rate: 0.18, label: "Next ₦9,000,000" },
  { upToKobo: naira(25_000_000), rate: 0.21, label: "Next ₦13,000,000" },
  { upToKobo: naira(50_000_000), rate: 0.23, label: "Next ₦25,000,000" },
  { upToKobo: Number.MAX_SAFE_INTEGER, rate: 0.25, label: "Above ₦50,000,000" },
];

export const RENT_RELIEF_RATE = 0.2;
export const RENT_RELIEF_CAP_KOBO = naira(500_000);

export type BandLine = { label: string; rate: number; taxedKobo: number; taxKobo: number };

export type TaxResult = {
  incomeKobo: number;
  expensesKobo: number;
  rentReliefKobo: number;
  otherReliefsKobo: number;
  chargeableKobo: number;
  taxKobo: number;
  bands: BandLine[];
};

export function rentRelief(annualRentKobo: number): number {
  return Math.min(Math.floor(annualRentKobo * RENT_RELIEF_RATE), RENT_RELIEF_CAP_KOBO);
}

export function computeTax(incomeKobo: number, expensesKobo: number, annualRentKobo: number, otherReliefsKobo = 0): TaxResult {
  const relief = rentRelief(Math.max(0, annualRentKobo));
  const other = Math.max(0, otherReliefsKobo);
  const chargeable = Math.max(0, incomeKobo - Math.max(0, expensesKobo) - relief - other);
  let prev = 0;
  let tax = 0;
  const bands: BandLine[] = [];
  for (const b of BANDS) {
    const taxed = Math.max(0, Math.min(chargeable, b.upToKobo) - prev);
    const t = Math.floor(taxed * b.rate);
    bands.push({ label: b.label, rate: b.rate, taxedKobo: taxed, taxKobo: t });
    tax += t;
    prev = b.upToKobo;
    if (chargeable <= b.upToKobo) break;
  }
  return { incomeKobo, expensesKobo, rentReliefKobo: relief, otherReliefsKobo: other, chargeableKobo: chargeable, taxKobo: tax, bands };
}
