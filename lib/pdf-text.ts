// Browser only. Pulls the text out of a PDF bank statement with pdf.js, line by line, so it can be
// checked like pasted text. The PDF itself never leaves the browser; only its text is sent.

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 40;

export class PdfPasswordError extends Error {
  constructor(public readonly wrong: boolean) {
    super(wrong ? "That password did not open the PDF." : "This PDF is password-protected.");
  }
}

type TextItem = { str: string; transform: number[]; width: number };

export async function pdfToText(file: File, password?: string): Promise<{ text: string; pages: number }> {
  if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is larger than 10 MB.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password, isEvalSupported: false }).promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") throw new PdfPasswordError(err.code === 2);
    throw new Error("Could not open that file as a PDF.");
  }
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`That PDF has ${doc.numPages} pages; this demo reads up to ${MAX_PDF_PAGES}.`);

  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group text runs into visual rows by their y position, then order each row left to right.
    const rows = new Map<number, TextItem[]>();
    for (const raw of content.items) {
      const it = raw as TextItem;
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      const row = rows.get(y) ?? [];
      row.push(it);
      rows.set(y, row);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const items = rows.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = "";
      let end = -Infinity;
      for (const it of items) {
        const gap = it.transform[4] - end;
        line += line ? (gap > 12 ? "  " : gap > 0.5 ? " " : "") + it.str : it.str;
        end = it.transform[4] + it.width;
      }
      if (line.trim()) lines.push(line.trim());
    }
  }
  await doc.destroy();
  return { text: lines.join("\n"), pages: doc.numPages };
}
