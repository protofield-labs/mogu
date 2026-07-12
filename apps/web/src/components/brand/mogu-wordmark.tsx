import { cn } from "@/lib/utils";

type MoguWordmarkProps = {
  className?: string;
  as?: "h1" | "span";
};

/** App wordmark typography paired with the shared mogu symbol. */
export function MoguWordmark({ className, as: Component = "span" }: MoguWordmarkProps) {
  return (
    <Component
      className={cn(
        "inline-flex items-center text-mogu-wordmark",
        className,
      )}
    >
      <svg
        viewBox="0 0 242 84"
        className="h-6 w-[4.3rem]"
        fill="none"
        aria-hidden
      >
        <path
          d="M12 62V31c0-9 5-15 13-15s14 6 14 15v31M39 31c0-9 6-15 14-15s14 6 14 15v31"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="99"
          cy="40"
          r="24"
          stroke="currentColor"
          strokeWidth="12"
        />
        <circle
          cx="156"
          cy="40"
          r="24"
          stroke="currentColor"
          strokeWidth="12"
        />
        <path
          d="M180 18v40c0 13-10 20-23 20-8 0-14-2-18-6"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M202 18v26c0 10 6 17 14 17s14-7 14-17V18M230 18v44"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">mogu</span>
    </Component>
  );
}
