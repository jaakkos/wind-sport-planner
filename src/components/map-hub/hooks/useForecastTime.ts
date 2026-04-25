"use client";

import { useMemo, useState } from "react";
import { floorToHourMs } from "@/lib/map/mapHubHelpers";

export function useForecastTime(): {
  anchorMs: number;
  setAnchorMs: (ms: number) => void;
  hoursAhead: number;
  setHoursAhead: (h: number) => void;
  atIso: string;
} {
  const [anchorMs, setAnchorMs] = useState<number>(() => floorToHourMs());
  const [hoursAhead, setHoursAhead] = useState(0);
  const atIso = useMemo(
    () => new Date(anchorMs + hoursAhead * 3600000).toISOString(),
    [anchorMs, hoursAhead],
  );
  return { anchorMs, setAnchorMs, hoursAhead, setHoursAhead, atIso };
}
