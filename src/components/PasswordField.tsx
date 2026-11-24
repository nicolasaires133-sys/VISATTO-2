"use client";
// Campo de senha com botão de mostrar/esconder e, para senha nova, um medidor simples de força.
import { useState } from "react";
import Icon from "@/components/Icon";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return pw.length < 8 ? 0 : Math.min(3, Math.max(1, s - 1));
}
const LABEL = ["Mínimo de 8 caracteres", "Senha fraca: junte mais palavras ou números", "Senha boa", "Senha forte"];

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  isNew = false,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  isNew?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const s = strength(value);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          className="input h-12 pr-12"
          type={show ? "text" : "password"}
          autoComplete={autoComplete ?? (isNew ? "new-password" : "current-password")}
          required
          minLength={isNew ? 8 : undefined}
          maxLength={200}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((x) => !x)}
          aria-label={show ? "Esconder a senha" : "Mostrar a senha"}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-black/50 transition-colors hover:bg-black/5 hover:text-ink"
        >
          <Icon name={show ? "eyeOff" : "eye"} size={19} />
        </button>
      </div>
      {isNew && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${s >= n ? (s === 1 ? "bg-amber-500" : "bg-leaf") : "bg-black/10"}`} />
            ))}
          </div>
          <p className={`mt-1 text-[12.5px] ${value && s === 0 ? "text-red-700" : "text-black/50"}`}>{LABEL[s]}</p>
        </div>
      )}
    </div>
  );
}
