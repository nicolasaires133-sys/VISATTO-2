"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";

export default function RedefinirSenha() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(location.search).get("token") || "");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw !== pw2) return setErr("As duas senhas não são iguais.");
    setBusy(true);
    try {
      await api("/api/auth/reset", { body: { token, password: pw } });
      router.push("/painel");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Crie uma senha nova" sub="Os outros aparelhos conectados vão sair da conta." side="Sua conta volta em um minuto.">
      <form onSubmit={submit} className="space-y-4">
        <PasswordField id="nova" label="Senha nova" isNew value={pw} onChange={setPw} />
        <PasswordField id="nova2" label="Repita a senha nova" value={pw2} onChange={setPw2} autoComplete="new-password" />
        {err && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">
            {err} {/venceu|usado/.test(err) && <Link href="/esqueci-senha" className="font-semibold underline">Pedir outro link</Link>}
          </p>
        )}
        <button className="btn-primary !mt-6 h-[54px] w-full text-[16px]" disabled={busy || !token}>{busy ? "Salvando..." : "Salvar senha e entrar"}</button>
        {!token && <p className="text-center text-[14px] text-black/55">Abra esta página pelo link do e-mail.</p>}
      </form>
    </AuthShell>
  );
}
