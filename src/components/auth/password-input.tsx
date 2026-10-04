"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <div className="relative mt-2">
    <input {...props} type={visible ? "text" : "password"} className={cn("field-input mt-0 pr-12", className)} />
    <button type="button" aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={visible} aria-controls={props.id} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700">
      {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
    </button>
  </div>;
}
