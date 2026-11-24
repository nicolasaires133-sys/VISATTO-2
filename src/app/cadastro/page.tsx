"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import Logo from "@/components/Logo";

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
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-[420px] space-y-4 rounded-[28px] bg-white p-7 ring-1 ring-black/[0.08]">
        <Link href="/" className="inline-block"><Logo size={30} /></Link>
        <div>
          <h1 className="pt-2 text-[28px] font-extrabold leading-tight">Crie o cardápio do seu restaurante</h1>
          <p className="mt-1.5 text-[15px] text-black/60">14 dias grátis, sem cartão. Leva um minuto.</p>
        </div>
        <div>
          <label className="label" htmlFor="nome">Nome do restaurante</label>
          <input id="nome" className="input" autoComplete="organization" maxLength={80} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Cantina da Nonna" />
        </div>
        <div>
          <label className="label" htmlFor="email">Seu e-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="zap">WhatsApp do restaurante</label>
          <input id="zap" className="input" inputMode="tel" autoComplete="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
        </div>
        <div>
          <label className="label" htmlFor="senha">Crie uma senha (mínimo de 6 caracteres)</label>
          <input id="senha" className="input" type="password" autoComplete="new-password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        {err && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">{err}</p>}
        <button className="btn-primary h-[52px] w-full text-[16px]" disabled={busy}>{busy ? "Criando..." : "Criar conta grátis"}</button>
        <p className="text-center text-[14.5px] text-black/60">
          Já tem conta? <Link href="/entrar" className="font-semibold text-ink underline">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
