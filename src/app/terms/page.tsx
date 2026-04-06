import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { dataControllerLabel } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of use (EULA)",
  description: "Fjell Lift end user licence and terms of use.",
};

const LAST_UPDATED = "6 April 2026";

export default function TermsPage() {
  const controller = dataControllerLabel();

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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Terms of use &amp; end user licence (EULA)
        </h1>
        <p className="mt-2 text-xs text-zinc-500">Last updated: {LAST_UPDATED}</p>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">1. Who operates the service</h2>
            <p>
              The service branded &quot;Fjell Lift&quot; (the <strong>Service</strong>) is operated by{" "}
              <strong>{controller}</strong>. These terms apply between you and that operator.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">2. Acceptance</h2>
            <p>
              By creating an account, signing in, or otherwise using the Service, you agree to these
              terms and to our{" "}
              <Link href="/privacy" className="font-medium text-teal-800 underline hover:text-teal-950">
                Privacy notice
              </Link>
              . If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">3. Licence to use the Service</h2>
            <p>
              Subject to these terms, the operator grants you a personal, non-exclusive,
              non-transferable, revocable licence to access and use the Service for your own
              non-commercial planning and recreation purposes, using a supported browser or client.
            </p>
            <p>
              You may not reverse engineer the Service except where mandatory law allows; scrape the
              Service in a way that impairs it; attempt to gain unauthorised access; or use the
              Service in violation of law or third-party rights.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">4. Account &amp; security</h2>
            <p>
              Sign-in may use email magic links or other methods the operator configures. You are
              responsible for activity under your account. Notify the operator if you suspect misuse.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">5. Your content</h2>
            <p>
              You may store practice areas, session notes, and related data. You retain ownership of
              your content. You grant the operator a licence to host, process, and display your
              content as needed to run the Service.
            </p>
            <p>
              If you mark an area <strong>public</strong>, you understand it may be visible to other
              signed-in users of this instance. Do not publish sensitive personal data of others
              without permission.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">6. Weather &amp; map data</h2>
            <p>
              Forecasts and map layers come from third parties (e.g. Norwegian Meteorological Institute /
              Met.no, Open-Meteo, OpenStreetMap, optional MapTiler). They are provided for information
              only. You are solely responsible
              for decisions made in the field; the operator does not guarantee accuracy, availability,
              or fitness for any purpose.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">7. Disclaimers</h2>
            <p>
              The Service is provided <strong>&quot;as is&quot;</strong> without warranties of any kind,
              to the fullest extent permitted by law. Outdoor sports involve risk; you use the Service
              at your own risk.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">8. Limitation of liability</h2>
            <p>
              To the extent permitted by applicable law, the operator is not liable for indirect,
              incidental, special, consequential, or punitive damages, or for loss of profits, data,
              or goodwill, arising from your use of the Service. Aggregate liability for direct damages
              is limited to the greater of (a) what you paid for the Service in the twelve months
              before the claim or (b) zero if the Service is free.
            </p>
            <p>
              Some jurisdictions do not allow certain limitations; in those cases the minimum
              required rights apply.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">9. Suspension &amp; termination</h2>
            <p>
              The operator may suspend or terminate access for breach of these terms, legal
              requirements, or operational needs. You may stop using the Service at any time. Provisions
              that by nature should survive will survive termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">10. Changes</h2>
            <p>
              The operator may update these terms. Material changes will be indicated by updating the
              &quot;Last updated&quot; date. Continued use after changes constitutes acceptance where
              permitted by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">11. Governing law</h2>
            <p>
              Unless mandatory local law requires otherwise, these terms are governed by the laws of
              the jurisdiction the operator designates, without regard to conflict-of-law rules. Courts
              in that jurisdiction have non-exclusive jurisdiction.
            </p>
            <p className="rounded-xl bg-amber-50/90 p-3 text-xs text-amber-950 ring-1 ring-amber-200/80">
              <strong>Note for deployers:</strong> Fill in governing law, venue, and company details
              in your deployment docs or a fork of this page. This text is a practical template, not
              legal advice.
            </p>
          </section>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
