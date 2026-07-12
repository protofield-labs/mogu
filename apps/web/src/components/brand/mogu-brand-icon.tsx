import { cn } from "@/lib/utils";

type MoguBrandIconProps = {
  className?: string;
};

type MoguSymbolProps = MoguBrandIconProps & {
  innerColor: string;
};

function MoguSymbol({ className, innerColor }: MoguSymbolProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      fill="none"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M32 11.6C25.5 4.6 16.6 4.2 10.3 9.6 2 16.8 2.6 36.8 7.5 47.5c4.4 9.7 14.3 11.9 24.5 11.9s20.1-2.2 24.5-11.9c4.9-10.7 5.5-30.7-2.8-37.9-6.3-5.4-15.2-5-21.7 2Z"
      />
      <path
        fill={innerColor}
        d="M32 28.3c-4.6-6.2-11.7-7.4-16.2-3.1-4.7 4.5-2.9 12.8.7 17.7 3.6 4.8 9.1 7.2 15.5 8 6.4-.8 11.9-3.2 15.5-8 3.6-4.9 5.4-13.2.7-17.7-4.5-4.3-11.6-3.1-16.2 3.1Z"
      />
      <path
        fill="currentColor"
        d="M39.8 48.7c4.2-1.3 7.4-4.7 8.3-9.3.8-4.1-.3-7.2-3.2-7.8-3.2-.7-5.3 1.6-5.8 5.8-.5 4.6-1.3 8.2-5.1 12.4 2.1.1 4-.3 5.8-1.1Z"
      />
      <path
        d="M44.1 35.1c.8 2.9-.2 6.7-2.6 9.1"
        stroke={innerColor}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Full-color mogu symbol for headers, auth screens, and agent avatars. */
export function MoguBrandIcon({ className }: MoguBrandIconProps) {
  return (
    <MoguSymbol
      className={cn("text-mogu-brand", className)}
      innerColor="var(--primary-foreground)"
    />
  );
}

/** Monochrome-friendly symbol whose inner shape cuts through to the tab surface. */
export function MoguTabIcon({ className }: MoguBrandIconProps) {
  return (
    <MoguSymbol
      className={className}
      innerColor="var(--mogu-surface-elevated)"
    />
  );
}
