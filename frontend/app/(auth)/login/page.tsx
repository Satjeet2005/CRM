import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Sign In — ForgeFlow",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--background)]">
      <LoginForm />
    </main>
  );
}
