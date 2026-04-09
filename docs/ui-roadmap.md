# UI/UX roadmap — clear, fast, intuitive Fjell Lift

This document is the **execution plan** to move the map hub and related surfaces toward a coherent experience: **clear** hierarchy, **fast** common tasks, **intuitive** map ↔ sidebar relationship. It builds on Tailwind CSS v4 and existing patterns in `src/components/map-hub/` and `MapHub.tsx`.

---

## 1. Goals and success criteria

### 1.1 Product goals

| Goal | Definition |
|------|------------|
| **Clear** | A new user understands *what the ranked list is*, *what time it refers to*, and *how to change it* without reading long prose. |
| **Fast** | Primary flows use **≤ 2 clicks** from default: change forecast hour, open an area, edit basics, set optimal wind direction. |
| **Intuitive** | Map = spatial truth; sidebars = decisions and parameters; deep technical detail is **available but not blocking**. |

### 1.2 Measurable checks (do before/after user tests)

- **Time on task** (3 scenarios): (a) change forecast to a specific day/hour; (b) compare two areas; (c) edit area name + sport + draw optimal wind.
- **First-time comprehension** (5 users): can they state *in one sentence* what the score represents?
- **Visual scan**: default Plan tab shows **≤ 1 short** contextual line + controls + list; **no** mandatory multi-paragraph instruction block above the fold.
- **Accessibility**: keyboard focus order through sport, time, ranked list items, primary buttons; contrast **≥ WCAG AA** for text on surfaces.

---

## 2. Design foundations (world-class practices, adapted)

You do **not** need to adopt Material or Radix wholesale. Use industry practice as **checklists**:

- **Design tokens**: semantic colors (surface, border, accent, danger), spacing scale, type scale, radii, elevation. Single source in CSS variables / Tailwind theme — **no one-off hex** in components.
- **Progressive disclosure**: defaults are minimal; “Advanced / How this works” is one click away.
- **Consistency**: same component primitives for buttons, inputs, cards, collapsibles across Plan / Map / You / Edit.
- **Accessibility (WCAG 2.2)**: focus visible, labels for inputs, sufficient contrast, don’t rely on color alone for state.
- **Performance perception**: skeletons, optimistic UI where safe, avoid layout shift.

**References to steal patterns from** (not copy visuals): Radix (a11y primitives), shadcn/ui (composition), Linear (information density + hierarchy), Apple HIG (typography and spacing).

---

## 3. Current problem statement (from product review)

- **Plan tab**: Long instructional copy competes with **ranked list** and **forecast controls** — same visual weight.
- **Edit area**: Technical blocks (sample spots, AMSL, Yr links) sit at the **same level** as name/sport/public — high cognitive load.
- **Map**: Multiple encodings (polygons, dots, arrows, labels) without a compact **legend** or optional **layer** toggles.
- **Terrain popover**: Useful; must stay **secondary** to sidebars (size, z-index, dismiss behavior).

---

## 4. Information architecture

### 4.1 Plan tab — target structure (top → bottom)

1. **Header**: Sport selector (if not global elsewhere).
2. **Forecast strip** (primary): anchor time + slider + “Now” + short **one-line** summary: *“Ranking for &lt;formatted time&gt; (Met.no where available, …).”*
3. **Ranked areas** (primary outcome): scannable list with score, wind summary, tap-to-fly.
4. **Your scoring** (logged-in): collapsed by default **or** abbreviated with “Customize…” link.
5. **Help**: Long Met.no / arrows / multi-point / visibility text → **single collapsible** “How ranking & map work” (default **collapsed**; remember state in `localStorage` after first expand).

### 4.2 Edit area panel — target structure

- **Section A — Basics**: name, sports, label preset, public.
- **Section B — Wind**: optimal direction (draw CTA), sectors if present — **one primary action** visually dominant.
- **Section C — Forecast samples** (advanced): sample spots, elevations, Yr links — **collapsed by default**; expand for power users.
- **Section D — Danger / meta** (if any): delete, IDs — bottom, de-emphasized.

### 4.3 Map tab / You tab

- Align **terminology** and **control styling** with Plan (same button/input primitives).
- Avoid duplicating the same long help text; **link** to one help collapsible or `/help` if you add it later.

---

## 5. Visual system (tokens + components)

### 5.1 Tokens (Phase E — implement in `src/app/globals.css` + Tailwind)

Define and use consistently:

- **Color roles**: `--surface`, `--surface-elevated`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--danger`.
- **Spacing**: 4 / 8 / 12 / 16 / 24 px scale for padding and gaps.
- **Typography**: 3–4 levels only — e.g. `text-sm` title semibold, `text-sm` body, `text-xs` meta, `text-xs` uppercase section label.
- **Radius**: one card radius, one button radius.
- **Shadows**: 0–1 levels for floating panels only.

### 5.2 Components to extract (reuse, not 20 one-offs)

Priority order:

1. `SidebarSection` — title + optional chevron + children.
2. `HelpDisclosure` — title + collapsed body (used in Plan).
3. `ForecastTimeControl` — label + slider + Now (single component).
4. `RankedAreaRow` — button row with score + wind line + optional subline.
5. `PrimaryButton` / `SecondaryButton` — map “Draw direction” and form submits to same system.

---

## 6. Map-specific UX

1. **Legend** (compact, dismissible): what polygon color means; dots = sample points; arrows = wind at samples; link “Learn more” → help disclosure.
2. **Layer toggles** (optional later): wind arrows / sample dots / area labels — reduces clutter when debugging vs planning.
3. **Focus**: selected area already emphasized; ensure **non-selected** areas are slightly muted for contrast.
4. **Mobile** (if in scope): sidebars become **drawers** or **bottom sheets**; same token system.

---

## 7. Performance and resilience (perceived speed)

1. **Skeletons** for ranked list and edit panel while APIs load (not only spinners).
2. **Stale-while-revalidate** (optional): show last rank with subtle “Updating…” when time changes.
3. **Single source of help copy** — one block maintained once; link from Plan, Edit, legend.

---

## 8. Phased delivery plan

### Phase 0 — Prep (0.5–1 day)

- [ ] Snapshot current screens (Plan, Edit, map) for regression comparison.
- [ ] List all user-visible strings in Plan + Edit (audit duplication).

### Phase A — Information architecture (high ROI, ~2–4 days)

- [ ] Move long Plan instructions into **HelpDisclosure**; default collapsed; `localStorage` key `mapHub.helpRankingExpanded`.
- [ ] Add **one-line** forecast context above ranked list (time + short source hint).
- [ ] Restructure **Edit panel** into Basics / Wind / Forecast samples (accordion or tabs); samples **collapsed** by default.

### Phase B — Visual hierarchy (~2–3 days)

- [ ] Apply token-based spacing and type scale to Plan + Edit only.
- [ ] Unify primary CTA color (draw optimal wind, save) with accent token.
- [ ] Reduce competing borders/rings; one card style for sidebar panels.

### Phase C — Map legend + focus (~1–2 days)

- [ ] Add dismissible legend component; store dismissed state if desired.
- [ ] Review z-index stack: terrain popover vs edit vs modals.

### Phase D — Loading & polish (~1–2 days)

- [ ] Skeletons for rank list + edit loading states.
- [ ] Audit focus rings and keyboard order on main controls.

### Phase E — Design system in code (~2–3 days, can overlap)

- [ ] Add CSS variables / Tailwind semantic colors in `globals.css`.
- [ ] Extract primitives listed in §5.2; migrate Plan + Edit first.

### Phase F — Optional follow-ups

- [ ] Layer toggles for map overlays.
- [ ] Dedicated `/help` or tooltips for scoring math.
- [ ] Storybook or visual regression (Chromatic) if team grows.

---

## 9. Ownership and maintenance

- **Copy owner**: one person approves changes to “How ranking works” to avoid drift.
- **Tokens**: changes go through `globals.css` / theme — no ad-hoc colors in new features.
- **PR size**: prefer one phase per PR (e.g. Phase A only) for reviewability.

---

## 10. Out of scope (unless product asks)

- Full rebrand or new illustration set.
- Replacing MapLibre or map interaction model.
- Full mobile redesign without explicit product priority.

---

## 11. Quick reference — checklist before shipping a UI PR

- [ ] Primary task still achievable in ≤ 2 clicks?
- [ ] New copy duplicated elsewhere? If yes, consolidate or link.
- [ ] Focus visible and contrast OK on new elements?
- [ ] Loading/error states covered?
- [ ] Tokens used instead of raw palette classes where applicable?

---

*Last updated: roadmap creation for execution tracking. Adjust dates and owners as the team picks up phases.*
