"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import AuthShell from "@/components/AuthShell";
import Icon from "@/components/Icon";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const e = new URLSearchParams(location.search).get("email");
    if (e) setEmail(e);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/api/auth/forgot", { body: { email } });
      setSent(true);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <AuthShell title={sent ? "Confira seu e-mail" : "Esqueci minha senha"} sub={sent ? undefined : "Mandamos um link para você criar uma senha nova."} side="Sua conta volta em um minuto.">
      {sent ? (
        <div className="animate-enter space-y-4">
          <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-[14.5px] text-emerald-950">
            <Icon name="check" size={20} stroke={2.4} className="mt-0.5 shrink-0" />
            <p>Se <b>{email}</b> tiver conta no Visatto, o link chega em alguns instantes. Ele vale por 1 hora. Olhe também a caixa de spam.</p>
          </div>
          <button className="btn-ghost h-12 w-full" onClick={() => setSent(false)}>Mandar de novo</button>
          <p className="text-center text-[14.5px] text-black/60"><Link href="/entrar" className="font-semibold text-ink underline">Voltar para entrar</Link></p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail da conta</label>
            <input id="email" className="input h-12" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">{err}</p>}
          <button className="btn-primary !mt-6 h-[54px] w-full text-[16px]" disabled={busy}>{busy ? "Enviando..." : "Enviar link"}</button>
          <p className="text-center text-[14.5px] text-black/60">Lembrou? <Link href="/entrar" className="font-semibold text-ink underline">Entrar</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
