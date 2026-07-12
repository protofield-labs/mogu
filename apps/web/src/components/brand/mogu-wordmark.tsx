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
        "text-xl font-bold tracking-[-0.055em] text-mogu-wordmark",
        className,
      )}
    >
      mogu
    </Component>
  );
}
