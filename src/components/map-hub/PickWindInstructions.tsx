"use client";

import { hubBtnSecondary } from "@/components/map-hub/hubUi";

/**
 * Single-source step-by-step copy for the "draw optimal wind" map flow.
 * Rendered inside the Plan-tab "How spots are ranked" section and inside
 * the Edit panel's Wind section so the user always sees the same wording
 * regardless of which surface they triggered the picker from.
 */
export function PickWindInstructions({
  step,
  onCancel,
}: {
  step: "tail" | "head";
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-app-border bg-gradient-to-b from-app-accent-soft to-app-surface p-3 shadow-inner shadow-app-fg/5">
      <p className="text-[11px] leading-snug text-app-fg">
        {step === "tail" ? (
          <>
            <strong>1.</strong> Click the <strong>tail</strong> of the arrow (upwind / where wind
            comes toward you).
          </>
        ) : (
          <>
            <strong>2.</strong> Click the <strong>head</strong> — arrow points where the wind{" "}
            <strong>blows</strong> (downwind). Saves automatically.
          </>
        )}
      </p>
      <button type="button" className={`w-full ${hubBtnSecondary}`} onClick={onCancel}>
        Cancel drawing
      </button>
      <p className="text-[10px] text-app-fg-muted">
        <kbd className="rounded-md bg-app-accent-muted px-1 py-0.5">Esc</kbd> cancel · right-click
        resets tail
      </p>
    </div>
  );
}
