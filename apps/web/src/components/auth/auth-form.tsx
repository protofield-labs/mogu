"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

type AuthFormFieldProps = {
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthFormField({
  label,
  hint,
  className,
  type = "text",
  ...props
}: AuthFormFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        className={cn(inputClassName, className)}
        {...props}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

type AuthPasswordFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  disabled?: boolean;
  minLength?: number;
};

export function AuthPasswordField({
  label,
  hint,
  value,
  onChange,
  autoComplete,
  disabled,
  minLength,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClassName, "pr-11")}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

type AuthFormShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  submitting?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFormShell({
  eyebrow,
  title,
  description,
  submitting = false,
  children,
  footer,
}: AuthFormShellProps) {
  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div className="flex min-h-dvh w-full max-w-mogu-shell flex-col justify-center px-mogu-screen-x py-10">
        <div
          className={cn(
            "rounded-3xl border border-border bg-mogu-surface-elevated p-6 shadow-sm transition-opacity sm:p-8",
            submitting && "pointer-events-none opacity-60",
          )}
        >
          <div className="space-y-2 text-center sm:text-left">
            {eyebrow ? (
              <p className="text-sm font-medium text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-6">{children}</div>

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}

export function AuthDivider() {
  return (
    <div className="relative text-center text-xs text-muted-foreground">
      <span className="bg-mogu-surface-elevated px-2">または</span>
      <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" />
    </div>
  );
}

export function AuthErrorMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
