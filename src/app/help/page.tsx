import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "How scoring works",
  description:
    "How Fjell Lift ranks practice areas from forecast wind speed, gusts, direction, and your preferences.",
};

export default function HelpPage() {
  return (
    <div className="flex min-h-full flex-col bg-[var(--background)]">
      <header className="border-b border-teal-900/10 bg-white/90 px-4 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="text-sm font-medium text-teal-800 hover:text-teal-950 hover:underline"
        >
          ← Home
        </Link>
        <span className="mx-2 text-zinc-300">·</span>
        <Link
          href="/map"
          className="text-sm font-medium text-teal-800 hover:text-teal-950 hover:underline"
        >
          Map
        </Link>
      </header>

      <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-sm leading-relaxed text-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">How scoring works</h1>
        <p className="mt-2 text-xs text-zinc-500">
          Forecast ranking is a heuristic — not a safety guarantee. Always verify conditions on site.
        </p>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">What the number means</h2>
            <p>
              Each ranked area gets a <strong>score from 0–100</strong> for the selected forecast hour. Higher
              is better. The list is sorted by that score. Scores combine wind speed fit, gustiness, how well
              direction matches the area, and (when you are signed in) a small boost from your past sessions
              at that spot.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Wind speed</h2>
            <p>
              Speed is compared to <strong>bands</strong> for the active sport: minimum / maximum rideable
              wind, and an <strong>ideal</strong> band in the middle. Inside the ideal band the speed
              component is strongest; toward the edges of the allowed window it falls off. You can customize
              bands and how strongly speed matters in{" "}
              <Link href="/map" className="font-medium text-teal-800 underline hover:text-teal-950">
                Plan → Your forecast scoring
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Gust penalty</h2>
            <p>
              Large <strong>gust factor</strong> (gust speed vs steady wind) reduces the score. The penalty
              scales with your <strong>gust penalty</strong> weight in scoring preferences.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Direction</h2>
            <p>
              If the area has <strong>wind sectors</strong>, forecast direction must fall in a good sector;
              when you set an <strong>optimal</strong> wind direction, the score gets a bonus that fades as
              the forecast moves away from that bearing. The width of that match is controlled by{" "}
              <strong>± degrees around optimal</strong> (global and per-area). Your{" "}
              <strong>direction emphasis</strong> slider controls how much this multiplier moves the final
              score.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Multi-point areas</h2>
            <p>
              For large polygons the app may sample several spots inside the area. How those samples are
              combined (e.g. representative vs conservative) affects the wind used for ranking; the in-app{" "}
              <strong>How ranking &amp; map work</strong> disclosure on the Plan tab has more detail on map
              symbols and forecast sources.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">What is not in the score</h2>
            <p>
              For example <strong>visibility</strong> may appear on labels for context but is{" "}
              <strong>not</strong> part of the numeric score. Terrain elevation affects which weather provider
              and elevation are used for the forecast, not a separate visibility term.
            </p>
          </section>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
