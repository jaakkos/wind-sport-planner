import type { WeatherProvider } from "@/lib/weather/types";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const openMeteoProvider: WeatherProvider = {
  id: "open_meteo",
  priority: 100,
  supports() {
    return true;
  },
  async fetchHistoricalSnapshot(lat, lng, at) {
    const day = isoDate(at);
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("start_date", day);
    url.searchParams.set("end_date", day);
    url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m");
    url.searchParams.set("timezone", "UTC");

    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch {
      return null;
    }
    if (!res.ok) return null;
    let j: {
      hourly?: {
        time?: string[];
        wind_speed_10m?: number[];
        wind_direction_10m?: number[];
        wind_gusts_10m?: number[];
        temperature_2m?: number[];
      };
    };
    try {
      j = (await res.json()) as typeof j;
    } catch {
      return null;
    }
    const times: string[] = j.hourly?.time ?? [];
    const ws: number[] = j.hourly?.wind_speed_10m ?? [];
    const wd: number[] = j.hourly?.wind_direction_10m ?? [];
    const wg: number[] = j.hourly?.wind_gusts_10m ?? [];
    const tt: number[] = j.hourly?.temperature_2m ?? [];
    if (!times.length) return null;

    const target = at.getTime();
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i] + "Z").getTime();
      const diff = Math.abs(t - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }

    const observedAt = new Date(times[best] + "Z");
    return {
      data: {
        windSpeedMs: ws[best] != null ? ws[best] / 3.6 : null,
        windDirDeg: wd[best] ?? null,
        gustMs: wg[best] != null ? wg[best] / 3.6 : null,
        temperatureC: tt[best] ?? null,
        visibilityM: null,
        observedAt,
      },
      raw: j,
    };
  },
  async fetchForecastSeries(lat, lng, from, to, _options) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "hourly",
      "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,visibility",
    );
    url.searchParams.set(
      "current",
      "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,visibility",
    );
    const days = Math.min(
      16,
      Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1),
    );
    url.searchParams.set("forecast_days", String(days));
    url.searchParams.set("timezone", "UTC");

    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch {
      return null;
    }
    if (!res.ok) return null;
    let j: {
      current?: {
        time?: string;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
        wind_gusts_10m?: number;
        temperature_2m?: number;
        visibility?: number;
      };
      hourly?: {
        time?: string[];
        wind_speed_10m?: number[];
        wind_direction_10m?: number[];
        wind_gusts_10m?: number[];
        temperature_2m?: number[];
        visibility?: number[];
      };
    };
    try {
      j = (await res.json()) as typeof j;
    } catch {
      return null;
    }
    const times: string[] = j.hourly?.time ?? [];
    const ws: number[] = j.hourly?.wind_speed_10m ?? [];
    const wd: number[] = j.hourly?.wind_direction_10m ?? [];
    const wg: number[] = j.hourly?.wind_gusts_10m ?? [];
    const tt: number[] = j.hourly?.temperature_2m ?? [];
    const vis: number[] = j.hourly?.visibility ?? [];
    const hourly: import("@/lib/weather/types").NormalizedWind[] = [];
    const fromT = from.getTime();
    const toT = to.getTime();

    const cur = j.current;
    let currentInserted = false;
    const curTime = cur?.time ? new Date(cur.time + "Z") : null;
    const curMs = curTime?.getTime() ?? 0;

    for (let i = 0; i < times.length; i++) {
      const observedAt = new Date(times[i] + "Z");
      const t = observedAt.getTime();
      if (t < fromT || t > toT) continue;

      if (!currentInserted && cur && curTime && curMs >= fromT && curMs <= toT && curMs <= t) {
        const curVm = cur.visibility;
        hourly.push({
          observedAt: curTime,
          windSpeedMs: cur.wind_speed_10m != null ? cur.wind_speed_10m / 3.6 : null,
          windDirDeg: cur.wind_direction_10m ?? null,
          gustMs: cur.wind_gusts_10m != null ? cur.wind_gusts_10m / 3.6 : null,
          temperatureC: cur.temperature_2m ?? null,
          visibilityM: curVm != null && Number.isFinite(curVm) && curVm >= 0 ? curVm : null,
          isObservation: true,
        });
        currentInserted = true;
      }

      const vm = vis[i];
      hourly.push({
        observedAt,
        windSpeedMs: ws[i] != null ? ws[i] / 3.6 : null,
        windDirDeg: wd[i] ?? null,
        gustMs: wg[i] != null ? wg[i] / 3.6 : null,
        temperatureC: tt[i] ?? null,
        visibilityM:
          vm != null && Number.isFinite(vm) && vm >= 0 ? vm : null,
      });
    }

    if (!currentInserted && cur && curTime && curMs >= fromT && curMs <= toT) {
      const curVm = cur.visibility;
      hourly.push({
        observedAt: curTime,
        windSpeedMs: cur.wind_speed_10m != null ? cur.wind_speed_10m / 3.6 : null,
        windDirDeg: cur.wind_direction_10m ?? null,
        gustMs: cur.wind_gusts_10m != null ? cur.wind_gusts_10m / 3.6 : null,
        temperatureC: cur.temperature_2m ?? null,
        visibilityM: curVm != null && Number.isFinite(curVm) && curVm >= 0 ? curVm : null,
        isObservation: true,
      });
    }

    return { hourly, raw: j };
  },
};
