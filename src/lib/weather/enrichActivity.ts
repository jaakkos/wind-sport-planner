import prisma from "@/lib/prisma";
import { fetchHistoricalWithRouter } from "@/lib/weather/router";

export async function enrichActivityWeather(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity) return;
  const lat = activity.startLat;
  const lng = activity.startLng;
  if (lat == null || lng == null) return;

  const existing = await prisma.weatherSnapshot.findFirst({
    where: { activityId },
  });
  if (existing) return;

  const r = await fetchHistoricalWithRouter(lat, lng, activity.startDate);
  if (!r) return;

  await prisma.weatherSnapshot.create({
    data: {
      activityId,
      providerId: r.providerId,
      lat,
      lng,
      observedAt: r.data.observedAt,
      windSpeedMs: r.data.windSpeedMs,
      windDirDeg: r.data.windDirDeg,
      gustMs: r.data.gustMs,
      temperatureC: r.data.temperatureC,
      rawPayload: r.raw as object,
    },
  });
}
