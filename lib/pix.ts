/**
 * "Pix copia e cola" estático (padrão BR Code / EMV do Banco Central), com valor fixo.
 * Não é integração: o código só preenche chave, valor e identificador no app do banco de quem paga.
 * A confirmação continua sendo feita pela recepção, que registra o pagamento no sistema.
 */

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Sem acentos e só caracteres aceitos pelo padrão (A-Z, 0-9 e espaço), com limite de tamanho. */
const plain = (text: string, max: number) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase().slice(0, max);

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixInput {
  key: string;          // chave já normalizada (normalizePixKey)
  name: string;         // nome de quem recebe (a academia)
  city?: string | null; // cidade da academia
  amountCents: number;
  txid?: string;        // identificador que aparece no extrato (até 25 letras e números)
  description?: string; // mensagem curta para quem paga
}

export function pixPayload({ key, name, city, amountCents, txid, description }: PixInput): string {
  const info = field("00", "br.gov.bcb.pix") + field("01", key) + (description ? field("02", plain(description, 40)) : "");
  const id = (txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body =
    field("00", "01") +
    field("01", "11") + // estático: o mesmo código pode ser usado de novo (ex.: pagamento em duas vezes)
    field("26", info) +
    field("52", "0000") +
    field("53", "986") + // real
    (amountCents > 0 ? field("54", (amountCents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", plain(name, 25) || "ACADEMIA") +
    field("60", plain(city ?? "", 15) || "BRASIL") +
    field("62", field("05", id)) +
    "6304";
  return body + crc16(body);
}
