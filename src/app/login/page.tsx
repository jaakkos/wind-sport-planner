import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const emailProviderId = process.env.RESEND_API_KEY?.trim() ? "resend" : "nodemailer";
  return <LoginForm emailProviderId={emailProviderId} />;
}
