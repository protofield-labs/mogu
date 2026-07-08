import { ProtectedAppShell } from "@/components/protected-app-shell";
import { AuthGate } from "@/components/auth-gate";
import { OnboardingGate } from "@/components/onboarding-gate";
import { MeProvider } from "@/lib/mypage/me-provider";
import { MeBadgesProvider } from "@/lib/mypage/use-me-badges";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MeBadgesProvider>
      <AuthGate>
        <MeProvider>
          <OnboardingGate>
            <ProtectedAppShell>{children}</ProtectedAppShell>
          </OnboardingGate>
        </MeProvider>
      </AuthGate>
    </MeBadgesProvider>
  );
}
