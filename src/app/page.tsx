import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold text-zinc-900">Fjell Lift</h1>
      <p className="text-sm font-medium text-teal-800">
        Fjell (fell) + lift — Nordic high ground, kite power. Forecasts and spots for anywhere on the map.
      </p>
      <p className="text-zinc-600">
        Draw practice areas, log session experiences (when and where you went), pull weather
        (Open-Meteo + FMI stub), and rank spots on a forecast timeline.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/map"
          className="inline-flex w-fit rounded border border-zinc-300 bg-white px-4 py-2 text-zinc-900 hover:bg-zinc-50"
        >
          Open map
        </Link>
        <Link
          href="/login"
          className="inline-flex w-fit rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800"
        >
          Sign in
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        The map shows <strong>public</strong> spots without an account; sign in to draw areas, save
        yours as private or public, and log sessions. Use Docker Compose for Postgres + Mailpit (see
        README).
      </p>
    </main>
  );
}
