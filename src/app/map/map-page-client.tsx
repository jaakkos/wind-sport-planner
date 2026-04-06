"use client";

import dynamic from "next/dynamic";

const MapHub = dynamic(() => import("@/components/MapHub").then((mod) => mod.MapHub), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-dvh min-h-dvh w-full items-center justify-center bg-background text-sm font-medium text-zinc-600"
      role="status"
      aria-live="polite"
    >
      Loading map…
    </div>
  ),
});

export function MapPageClient() {
  return <MapHub />;
}
