import { cn } from "@/lib/utils";

type MoguWordmarkProps = {
  className?: string;
  as?: "h1" | "span";
};

/** App wordmark typography shared by home and search headers. */
export function MoguWordmark({ className, as: Component = "span" }: MoguWordmarkProps) {
  return (
    <Component className={cn("text-lg font-semibold text-foreground", className)}>
      mogu
    </Component>
  );
}
