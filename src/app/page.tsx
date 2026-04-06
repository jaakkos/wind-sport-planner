import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-5">
        <Image
          src="/brand/fjell-lift-logo.png"
          alt="Fjell Lift"
          width={360}
          height={120}
          className="h-auto w-full max-w-sm"
          priority
        />
        <h1 className="sr-only">Fjell Lift</h1>
      </div>
      <p className="text-sm font-medium text-teal-800">
        Fjell (fell) + lift — Nordic high ground, kite power. Forecasts and spots for anywhere on the map.
      </p>
      <p className="text-zinc-600">
        Draw practice areas, log session experiences (when and where you went), pull weather
        (Open-Meteo + FMI stub), and rank spots on a forecast timeline.
      </p>
      <p className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm leading-snug text-amber-950">
        <strong className="font-semibold">Alpha release.</strong> Things will change — including data,
        features, and how the app behaves between updates. Always double-check conditions yourself
        before heading out.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/map"
          className="inline-flex w-fit items-center justify-center rounded-2xl border-2 border-teal-700 bg-white px-5 py-2.5 text-sm font-semibold text-teal-900 shadow-sm shadow-teal-900/10 transition hover:bg-teal-50"
        >
          Open map
        </Link>
        <Link
          href="/login"
          className="inline-flex w-fit items-center justify-center rounded-2xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/20 transition hover:bg-teal-800"
        >
          Sign in
        </Link>
      </div>
      <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-zinc-600 ring-1 ring-teal-900/10 shadow-sm shadow-teal-900/5">
        The map shows <strong>public</strong> spots without an account; sign in to draw areas, save
        yours as private or public, and log sessions.
      </p>
    </main>
    <SiteFooter />
    </div>
  );
}
