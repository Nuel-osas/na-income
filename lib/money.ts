// Money stays in integer kobo (1 naira = 100 kobo) end to end. Format only for display.

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** Parse a naira string like "₦1,240,000.50", "NGN 300000" or "(23,500)" into kobo. Null when it is not a clean amount. */
export function parseNairaToKobo(raw: string): number | null {
  let s = raw.trim();
  if (s === "" || s === "-") return null;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/₦|NGN|N(?=\d)|\s|,/gi, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (!AMOUNT.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const kobo = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(kobo)) return null;
  return negative ? -kobo : kobo;
}

export function formatNaira(kobo: number, opts: { kobo?: boolean } = {}): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(kobo);
  const whole = Math.floor(abs / 100).toLocaleString("en-NG");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}₦${whole}${opts.kobo || abs % 100 !== 0 ? "." + frac : ""}`;
}

export const naira = (n: number) => Math.round(n * 100);
