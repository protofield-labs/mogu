"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    <Label>
      <span>{label}</span>
      <Input type={type} className={className} {...props} />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </Label>
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
    <Label>
      <span>{label}</span>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-11"
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
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </Label>
  );
}

type AuthFormShellProps = {
  title: string;
  description?: ReactNode;
  submitting?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFormShell({
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
            "transition-opacity sm:rounded-mogu-card sm:border sm:border-border sm:bg-mogu-surface-elevated sm:p-8 sm:shadow-sm",
            submitting && "pointer-events-none opacity-60",
          )}
        >
          <div className="space-y-4">
            <MoguBrandIcon className="mx-auto size-16" />
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {description ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-6">{children}</div>

          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" aria-hidden />
      <span>または</span>
      <div className="h-px flex-1 bg-border" aria-hidden />
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
