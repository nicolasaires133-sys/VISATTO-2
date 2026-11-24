"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";

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
    <AuthShell title="Entrar no painel" side="Os pedidos das mesas chegam aqui, na hora.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input h-12" type="email" autoComplete="email" inputMode="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <PasswordField id="senha" label="Senha" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
        <p className="-mt-1 text-right text-[14px]">
          <Link href={`/esqueci-senha${f.email ? `?email=${encodeURIComponent(f.email)}` : ""}`} className="font-semibold text-black/60 underline-offset-2 hover:text-ink hover:underline">Esqueci minha senha</Link>
        </p>
        {err && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">{err}</p>}
        <button className="btn-primary !mt-6 h-[54px] w-full text-[16px]" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
        <p className="text-center text-[14.5px] text-black/60">
          Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-ink underline">Criar grátis</Link>
        </p>
      </form>
    </AuthShell>
  );
}
