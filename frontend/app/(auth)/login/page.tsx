import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Sign In — ForgeFlow Enterprise CPQ",
  description: "Secure B2B quotation operations and industrial CRM platform",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)]">
      <LoginForm />
    </main>
  );
}
