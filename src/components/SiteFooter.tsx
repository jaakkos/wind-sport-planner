import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-teal-900/10 bg-white/80 px-4 py-6 text-center text-xs text-zinc-600 backdrop-blur-sm">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-label="Legal">
        <Link
          href="/terms"
          className="font-medium text-teal-800 hover:text-teal-950 hover:underline"
        >
          Terms of use (EULA)
        </Link>
        <span className="text-zinc-300" aria-hidden>
          |
        </span>
        <Link
          href="/privacy"
          className="font-medium text-teal-800 hover:text-teal-950 hover:underline"
        >
          Privacy &amp; GDPR
        </Link>
      </nav>
      <p className="mx-auto mt-3 max-w-lg text-[11px] leading-relaxed text-zinc-500">
        Using Fjell Lift means you accept the terms and acknowledge how we process personal data
        as described in the privacy notice.
      </p>
    </footer>
  );
}
