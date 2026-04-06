"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";

type Props = {
  /** Matches `src/auth.ts`: `resend` when `RESEND_API_KEY` is set, else `nodemailer`. */
  emailProviderId: "resend" | "nodemailer";
};

export function LoginForm({ emailProviderId }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await signIn(emailProviderId, {
      email,
      redirect: false,
      callbackUrl: "/map",
    });
    if (r?.error) setErr(r.error);
    else setSent(true);
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-teal-900/10 bg-white/90 p-6 shadow-xl shadow-teal-900/10 backdrop-blur-sm">
          <Link
            href="/"
            className="mb-4 inline-block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <Image
              src="/brand/fjell-lift-logo.png"
              alt="Fjell Lift"
              width={320}
              height={107}
              className="h-auto w-full max-w-xs"
              priority
            />
          </Link>
          <h1 className="sr-only">Fjell Lift</h1>
          <p className="text-xs font-medium text-teal-800">
            Mountain-country kite planning — Fjell Lift, serious wind.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Sign in with a magic link sent to your email.
          </p>
          {sent ? (
            <p className="mt-6 rounded-2xl border border-teal-200/80 bg-teal-50/80 px-4 py-3 text-sm text-teal-950">
              Check your email for the sign-in link.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-zinc-700">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-teal-900/10 bg-white px-3 py-2.5 text-zinc-900 shadow-inner shadow-teal-900/[0.03] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  placeholder="you@example.com"
                />
              </label>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button
                type="submit"
                className="w-full rounded-2xl bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/20 transition hover:bg-teal-800"
              >
                Send magic link
              </button>
              <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                By continuing you agree to our{" "}
                <Link href="/terms" className="font-medium text-teal-700 underline hover:text-teal-900">
                  Terms of use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-teal-700 underline hover:text-teal-900">
                  Privacy notice
                </Link>
                .
              </p>
            </form>
          )}
          <p className="mt-6 text-center text-xs text-zinc-500">
            <Link href="/map" className="font-medium text-teal-700 hover:text-teal-900">
              ← Back to map
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
