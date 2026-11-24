// Pix "copia e cola" com valor (BR Code estático do Banco Central). Funciona com qualquer chave Pix,
// sem conta em empresa de pagamento: o cliente cola no app do banco e o valor já vem preenchido.
// O restaurante confere o pagamento no próprio banco (não há confirmação automática).

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Tira acento e símbolos: o padrão só aceita letras sem acento nesses campos. */
const plain = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max) || "RESTAURANTE";

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Arruma a chave como o padrão pede: telefone com +55, CPF/CNPJ só números, e-mail e chave aleatória como estão. */
export function normalizePixKey(raw: string): string {
  const k = raw.trim();
  if (!k) return "";
  if (k.includes("@")) return k.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
  const digits = k.replace(/\D/g, "");
  if (k.startsWith("+")) return `+${digits}`;
  // 11 dígitos pode ser CPF ou celular com DDD: celular tem o 9 na terceira posição e "parece" telefone
  if (digits.length === 11 && /^\(?\d{2}\)?\s?9/.test(k) && /[()\s-]/.test(k)) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  return digits || k;
}

/** Cidade a partir do endereço ("Rua X, 120 · Bixiga, São Paulo" → "SAO PAULO"). */
export function cityFrom(address: string) {
  const parts = address.split(/[,·\-–]/).map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return plain(/^\w{2}$/.test(last) && parts.length > 1 ? parts[parts.length - 2] : last || "BRASIL", 15);
}

export function pixPayload(opts: { key: string; name: string; city: string; amountCents: number; txid?: string }) {
  const key = normalizePixKey(opts.key);
  const account = field("00", "br.gov.bcb.pix") + field("01", key);
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (opts.amountCents > 0 ? field("54", (opts.amountCents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", plain(opts.name, 25)) +
    field("60", plain(opts.city, 15)) +
    field("62", field("05", txid)) +
    "6304";
  return body + crc16(body);
}
