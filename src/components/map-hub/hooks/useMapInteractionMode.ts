"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  SidebarTab,
  ToolSectionKey,
} from "@/components/map-hub/constants";
import {
  closePolygonCoordinates,
  outerRingOpenCoords,
} from "@/lib/map/polygons";
import {
  createPracticeArea,
  patchPracticeArea,
} from "@/lib/practiceArea/client";

type MapMode = "browse" | "draw" | "pickWind";

type Args = {
  isAuthed: boolean;
  sessionPending: boolean;
  activeSport: "kiteski" | "kitesurf";
  setMessage: (msg: string | null) => void;
  setLoading: (busy: boolean) => void;
  loadBundle: () => Promise<void> | void;
  loadRank: () => Promise<void> | void;
  clearTerrain: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  openToolSection: (id: ToolSectionKey) => void;
  setSelectedPracticeAreaId: (id: string | null) => void;
};

/**
 * Owns the mode state machine that toggles between browsing the map,
 * drawing a polygon, and picking a downwind arrow for a practice area.
 *
 * Keeping the mode-specific state, side effects (Esc shortcut, signed
 * out cleanup, sidebar focus when drawing) and the create/finish/cancel
 * callbacks together makes the transitions auditable in one place and
 * keeps MapHub focused on composition.
 */
export function useMapInteractionMode({
  isAuthed,
  sessionPending,
  activeSport,
  setMessage,
  setLoading,
  loadBundle,
  loadRank,
  clearTerrain,
  setSidebarTab,
  openToolSection,
  setSelectedPracticeAreaId,
}: Args) {
  const [mapMode, setMapMode] = useState<MapMode>("browse");
  const [drawRing, setDrawRing] = useState<[number, number][]>([]);
  const [drawAreaName, setDrawAreaName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [windPickStart, setWindPickStart] = useState<[number, number] | null>(null);
  const [windPickHover, setWindPickHover] = useState<[number, number] | null>(null);
  /** When set, user is drawing optimal wind for this practice area on the map. */
  const [windPickAreaId, setWindPickAreaId] = useState<string | null>(null);

  // Reset everything when the user signs out so a stale mode does not
  // outlive the session.
  useEffect(() => {
    if (sessionPending || isAuthed) return;
    setMapMode("browse");
    setDrawRing([]);
    setEditingAreaId(null);
    setWindPickAreaId(null);
    setWindPickStart(null);
    setWindPickHover(null);
  }, [sessionPending, isAuthed]);

  // Drawing pulls the user's attention to the You tab so the draw
  // toolbar is on screen.
  useEffect(() => {
    if (mapMode === "draw") {
      setSidebarTab("you");
      openToolSection("draw");
    }
  }, [mapMode, setSidebarTab, openToolSection]);

  // Esc cancels whatever modal-ish mode is active.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mapMode === "pickWind") {
        setWindPickStart(null);
        setWindPickHover(null);
        setWindPickAreaId(null);
        setMapMode("browse");
        return;
      }
      if (mapMode === "draw") {
        setDrawRing([]);
        setMapMode("browse");
        setEditingAreaId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapMode]);

  const startDrawing = useCallback(() => {
    setWindPickStart(null);
    setWindPickHover(null);
    setWindPickAreaId(null);
    setDrawRing([]);
    setEditingAreaId(null);
    setMapMode("draw");
    clearTerrain();
  }, [clearTerrain]);

  const undoDrawPoint = useCallback(() => {
    setDrawRing((r) => r.slice(0, -1));
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawRing([]);
    setMapMode("browse");
    setEditingAreaId(null);
  }, []);

  const beginPickWindForArea = useCallback(
    (id: string) => {
      if (mapMode === "draw") {
        setMessage("Finish or cancel area drawing first.");
        setSidebarTab("you");
        openToolSection("draw");
        return;
      }
      setWindPickAreaId(id);
      setWindPickStart(null);
      setWindPickHover(null);
      clearTerrain();
      setMapMode("pickWind");
      setSidebarTab("plan");
      openToolSection("windRank");
      setMessage(
        "Area optimal: click arrow tail, then head (downwind). Esc = cancel.",
      );
    },
    [mapMode, setSidebarTab, openToolSection, clearTerrain, setMessage],
  );

  const cancelPickWind = useCallback(() => {
    setWindPickAreaId(null);
    setWindPickStart(null);
    setWindPickHover(null);
    setMapMode("browse");
  }, []);

  const finishDrawing = useCallback(() => {
    const poly = closePolygonCoordinates(drawRing);
    if (!poly) {
      setMessage(
        "Need at least 3 points. Click the map to add corners, then Finish.",
      );
      return;
    }
    const editTarget = editingAreaId;
    setDrawRing([]);
    setMapMode("browse");
    setEditingAreaId(null);
    if (editTarget) {
      void (async () => {
        setLoading(true);
        setMessage(null);
        try {
          await patchPracticeArea(editTarget, { geojson: poly });
          await loadBundle();
          await loadRank();
          setMessage("Boundary updated.");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Update failed");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        const nameRaw = drawAreaName.trim() || "Untitled area";
        await createPracticeArea({
          geojson: poly,
          sports: [activeSport],
          labelPreset: "other",
          name: nameRaw.slice(0, 120),
        });
        await loadBundle();
        await loadRank();
        setDrawAreaName("");
        setMessage("Area saved.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Save failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [
    drawRing,
    editingAreaId,
    drawAreaName,
    activeSport,
    loadBundle,
    loadRank,
    setLoading,
    setMessage,
  ]);

  const startBoundaryEdit = useCallback(
    (poly: GeoJSON.Polygon, areaId: string) => {
      setEditingAreaId(areaId);
      setDrawRing(outerRingOpenCoords(poly));
      setMapMode("draw");
      setSelectedPracticeAreaId(null);
      clearTerrain();
      setMessage("Adjust corners, then Finish & save.");
    },
    [clearTerrain, setSelectedPracticeAreaId, setMessage],
  );

  return {
    mapMode,
    setMapMode,
    drawRing,
    setDrawRing,
    drawAreaName,
    setDrawAreaName,
    editingAreaId,
    windPickStart,
    setWindPickStart,
    windPickHover,
    setWindPickHover,
    windPickAreaId,
    setWindPickAreaId,
    startDrawing,
    undoDrawPoint,
    cancelDrawing,
    finishDrawing,
    beginPickWindForArea,
    cancelPickWind,
    startBoundaryEdit,
  };
}
