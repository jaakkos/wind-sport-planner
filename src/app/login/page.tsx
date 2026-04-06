"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await signIn("nodemailer", {
      email,
      redirect: false,
      callbackUrl: "/map",
    });
    if (r?.error) setErr(r.error);
    else setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Fjell Lift</h1>
      <p className="mt-1 text-xs font-medium text-teal-800">
        Mountain-country kite planning — Fjell Lift, serious wind.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Sign in with a magic link sent to your email. Local dev: open{" "}
        <a className="text-blue-600 underline" href="http://localhost:8025" target="_blank">
          Mailpit
        </a>
        .
      </p>
      {sent ? (
        <p className="mt-6 rounded border border-green-200 bg-green-50 p-4 text-green-900">
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
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-zinc-900"
              placeholder="you@example.com"
            />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            className="w-full rounded bg-zinc-900 py-2 text-white hover:bg-zinc-800"
          >
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}
