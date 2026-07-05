import { ProtectedAppShell } from "@/components/protected-app-shell";
import { AuthGate } from "@/components/auth-gate";
import { OnboardingGate } from "@/components/onboarding-gate";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <OnboardingGate>
        <ProtectedAppShell>{children}</ProtectedAppShell>
      </OnboardingGate>
    </AuthGate>
  );
}
