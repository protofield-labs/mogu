import { AppHeader } from "@/components/app-header";
import { AuthGate } from "@/components/auth-gate";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <AppHeader />
      {children}
    </AuthGate>
  );
}
