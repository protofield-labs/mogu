import { ProtectedAppShell } from "@/components/protected-app-shell";
import { AuthGate } from "@/components/auth-gate";
import { OnboardingGate } from "@/components/onboarding-gate";
import { MeBadgesProvider } from "@/lib/mypage/use-me-badges";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MeBadgesProvider>
      <AuthGate>
        <OnboardingGate>
          <ProtectedAppShell>{children}</ProtectedAppShell>
        </OnboardingGate>
      </AuthGate>
    </MeBadgesProvider>
  );
}
