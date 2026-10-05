/**
 * CSV para abrir no Excel em português: separador ";" (o Excel brasileiro usa a vírgula
 * como decimal), BOM no início para os acentos aparecerem certos e aspas quando preciso.
 */
type Cell = string | number | null | undefined;

const escape = (value: Cell) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Centavos em "1234,56", sem "R$": o Excel reconhece como número e dá para somar. */
export const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function toCsv(header: string[], rows: Cell[][]): string {
  return "\uFEFF" + [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(fileName: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
