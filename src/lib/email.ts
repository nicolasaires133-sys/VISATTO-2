// Envio de e-mail pelo Resend (https://resend.com), sem biblioteca extra.
// Sem domínio próprio, use EMAIL_FROM="Visatto <onboarding@resend.dev>": nesse modo o Resend só entrega
// para o e-mail dono da conta do Resend (bom para testar). Com domínio verificado, troque EMAIL_FROM.
export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.log(`[e-mail para ${to}] ${subject}\n${text}`);
    return { ok: false, reason: "sem-chave" as const };
  }
  const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Visatto <onboarding@resend.dev>", to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as any);
  if (!res.ok) {
    console.error("Resend recusou o e-mail:", res.status, (await res.text()).slice(0, 300));
    return { ok: false, reason: "falhou" as const };
  }
  return { ok: true as const };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** E-mail simples, que abre bem em qualquer programa (sem imagens). */
export function simpleEmail(title: string, paragraphs: string[], button?: { label: string; url: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#efefeb;font-family:Arial,Helvetica,sans-serif;color:#1d1a16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<p style="margin:0 0 18px;font-size:18px;font-weight:bold">Visatto</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3d3933">${esc(p)}</p>`).join("")}
${button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#e4572e;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:12px">${esc(button.label)}</a></p>
<p style="margin:0;font-size:12px;color:#8a857d">Se o botão não abrir, copie este endereço: ${esc(button.url)}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : [])].join("\n");
  return { html, text };
}
