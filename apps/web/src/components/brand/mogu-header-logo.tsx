import Image from "next/image";

type MoguHeaderLogoProps = {
  priority?: boolean;
};

/** Shared horizontal mogu logo for screen headers. */
export function MoguHeaderLogo({ priority = false }: MoguHeaderLogoProps) {
  return (
    <Image
      src="/mogu-logo.png"
      alt="mogu"
      width={784}
      height={264}
      priority={priority}
      className="h-8 w-auto"
    />
  );
}
