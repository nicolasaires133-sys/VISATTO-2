"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import Logo from "@/components/Logo";

export default function Entrar() {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/api/auth/login", { body: f });
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
        <h1 className="pt-2 text-[28px] font-extrabold leading-tight">Entrar no painel</h1>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="senha">Senha</label>
          <input id="senha" className="input" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        {err && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">{err}</p>}
        <button className="btn-primary h-[52px] w-full text-[16px]" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
        <p className="text-center text-[14.5px] text-black/60">
          Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-ink underline">Criar grátis</Link>
        </p>
      </form>
    </main>
  );
}
