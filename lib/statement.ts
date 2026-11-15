import { parseNairaToKobo } from "./money";

export type Row = {
  id: string;
  date: string;
  narration: string;
  creditKobo: number; // money in, >= 0
  debitKobo: number; // money out, >= 0
};

export type ParseResult = {
  rows: Row[];
  /** Lines we could not read. Never silently dropped: the UI lists them. */
  skipped: { line: number; text: string; why: string }[];
  columns: Record<string, string>;
};

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delim && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(header: string): string {
  const counts = [",", "\t", ";", "|"].map((d) => [d, header.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

const COL = {
  date: /^(trans(action)?\.?\s*)?date|^value\s*date|^date/i,
  narration: /narration|description|remarks?|details|particulars|memo|reference/i,
  credit: /credit|money\s*in|deposit|inflow|^cr$|lodgement/i,
  debit: /debit|money\s*out|withdrawal|outflow|^dr$/i,
  amount: /^amount|^amt/i,
  type: /^(type|dr\/cr|cr\/dr|direction)$/i,
};

function findCol(headers: string[], re: RegExp, skip: number[] = []): number {
  return headers.findIndex((h, i) => !skip.includes(i) && re.test(h));
}

/** Parse a CSV/TSV bank statement export with a header row. Fails closed: a row with an unreadable amount is skipped and reported. */
export function parseStatement(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const skipped: ParseResult["skipped"] = [];
  const headerIdx = lines.findIndex((l) => COL.date.test(splitLine(l, detectDelimiter(l))[0] ?? "") || /date/i.test(l));
  if (headerIdx < 0) {
    return { rows: [], skipped: [{ line: 1, text: lines[0] ?? "", why: "No header row with a Date column found" }], columns: {} };
  }
  const delim = detectDelimiter(lines[headerIdx]);
  const headers = splitLine(lines[headerIdx], delim);
  const iDate = findCol(headers, COL.date);
  const iNarr = findCol(headers, COL.narration, [iDate]);
  const iCredit = findCol(headers, COL.credit, [iDate, iNarr]);
  const iDebit = findCol(headers, COL.debit, [iDate, iNarr, iCredit]);
  const iAmount = iCredit < 0 ? findCol(headers, COL.amount, [iDate, iNarr]) : -1;
  const iType = findCol(headers, COL.type, [iDate, iNarr, iAmount]);

  const columns: Record<string, string> = {};
  if (iDate >= 0) columns.date = headers[iDate];
  if (iNarr >= 0) columns.narration = headers[iNarr];
  if (iCredit >= 0) columns.credit = headers[iCredit];
  if (iDebit >= 0) columns.debit = headers[iDebit];
  if (iAmount >= 0) columns.amount = headers[iAmount];

  if (iNarr < 0 || (iCredit < 0 && iAmount < 0)) {
    return {
      rows: [],
      skipped: [{ line: headerIdx + 1, text: lines[headerIdx], why: "Need a Narration/Description column and a Credit or Amount column" }],
      columns,
    };
  }

  const rows: Row[] = [];
  for (let n = headerIdx + 1; n < lines.length; n++) {
    const raw = lines[n];
    if (!raw.trim()) continue;
    const cells = splitLine(raw, delim);
    const narration = (cells[iNarr] ?? "").trim();
    const date = (cells[iDate] ?? "").trim();
    let credit = 0;
    let debit = 0;

    if (iCredit >= 0) {
      const c = (cells[iCredit] ?? "").trim();
      const d = iDebit >= 0 ? (cells[iDebit] ?? "").trim() : "";
      const ck = c ? parseNairaToKobo(c) : 0;
      const dk = d ? parseNairaToKobo(d) : 0;
      if (ck === null || dk === null) {
        skipped.push({ line: n + 1, text: raw, why: "Amount is not a number" });
        continue;
      }
      credit = Math.abs(ck);
      debit = Math.abs(dk);
    } else {
      const a = parseNairaToKobo(cells[iAmount] ?? "");
      if (a === null) {
        skipped.push({ line: n + 1, text: raw, why: "Amount is not a number" });
        continue;
      }
      const t = iType >= 0 ? (cells[iType] ?? "").trim().toUpperCase() : "";
      if (t.startsWith("C")) credit = Math.abs(a);
      else if (t.startsWith("D")) debit = Math.abs(a);
      else if (a >= 0) credit = a;
      else debit = -a;
    }

    if (credit === 0 && debit === 0) {
      skipped.push({ line: n + 1, text: raw, why: "No amount in or out" });
      continue;
    }
    if (credit > 0 && debit > 0) {
      skipped.push({ line: n + 1, text: raw, why: "Both credit and debit on one row" });
      continue;
    }
    rows.push({ id: `L${n + 1}`, date, narration, creditKobo: credit, debitKobo: debit });
  }
  return { rows, skipped, columns };
}
