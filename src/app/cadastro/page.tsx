"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import AuthShell from "@/components/AuthShell";

export default function Cadastro() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/api/auth/signup", { body: f });
      router.push("/painel");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Crie o cardápio do seu restaurante" sub="14 dias grátis, sem cartão. Leva um minuto." side="Seu primeiro prato em 3D começa aqui.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="nome">Nome do restaurante</label>
          <input id="nome" className="input h-12" autoComplete="organization" maxLength={80} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Cantina da Nonna" />
        </div>
        <div>
          <label className="label" htmlFor="email">Seu e-mail</label>
          <input id="email" className="input h-12" type="email" autoComplete="email" inputMode="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="zap">WhatsApp do restaurante</label>
          <input id="zap" className="input h-12" inputMode="tel" autoComplete="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
        </div>
        <div>
          <label className="label" htmlFor="senha">Crie uma senha (mínimo de 6 caracteres)</label>
          <input id="senha" className="input h-12" type="password" autoComplete="new-password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        {err && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">{err}</p>}
        <button className="btn-primary !mt-6 h-[54px] w-full text-[16px]" disabled={busy}>{busy ? "Criando..." : "Criar conta grátis"}</button>
        <p className="text-center text-[14.5px] text-black/60">
          Já tem conta? <Link href="/entrar" className="font-semibold text-ink underline">Entrar</Link>
        </p>
      </form>
    </AuthShell>
  );
}
