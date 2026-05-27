# AiWriter Design System

Extracted from the Shippit dashboard reference (light, airy slate workspace
with white cards, vibrant blue accents, generous rounding). Use this doc as
the source of truth for tokens and component patterns; everything below maps
to CSS custom properties in `src/app/globals.css` so Tailwind utilities and
inline styles can both consume the same values.

## Foundations

### Color palette

| Token                  | Hex       | Where it shows up                            |
| ---------------------- | --------- | -------------------------------------------- |
| `--surface-app`        | `#E9ECF3` | Page background behind the white card stack. |
| `--surface-elevated`   | `#FFFFFF` | All cards, panes, TopBar, popovers.          |
| `--surface-sunken`     | `#F8FAFC` | Soft input/disabled fields, hover rows.      |
| `--surface-soft-blue` | `#EFF6FF` | Secondary button background, soft callouts. |
| `--border-subtle`      | `#E2E8F0` | All card borders and dividers.               |
| `--border-strong`      | `#CBD5E1` | Focused/active borders.                      |
| `--text-primary`       | `#0F172A` | Body copy and headings.                      |
| `--text-secondary`     | `#475569` | Descriptions, secondary labels.              |
| `--text-tertiary`      | `#94A3B8` | Captions, placeholder, meta info.            |
| `--text-on-primary`    | `#FFFFFF` | Text/icons on filled primary surfaces.       |
| `--primary`            | `#2563EB` | Primary action fill, focus ring, links.      |
| `--primary-hover`      | `#1D4ED8` | Primary button hover.                        |
| `--primary-soft`       | `#DBEAFE` | Filled "secondary primary" (Save as Draft).  |
| `--success-bg`         | `#DCFCE7` | Pill background — Delivery / success state.  |
| `--success-fg`         | `#15803D` | Pill text — Delivery / success state.        |
| `--warning-bg`         | `#FEF3C7` | Pill background — Pick-Up / in-progress.     |
| `--warning-fg`         | `#B45309` | Pill text — Pick-Up / in-progress.           |
| `--danger-bg`          | `#FEE2E2` | Pill background — Transfer / danger.         |
| `--danger-fg`          | `#B91C1C` | Pill text — Transfer / danger.               |

Default Tailwind `neutral-*` and `blue-*` palettes are still available, but
prefer the tokens above so a future re-skin only needs to touch
`globals.css`.

### Typography

- **Family** — `Inter` (already the platform default sans-serif stack).
- **Sizes** — keep to Tailwind's scale: `text-xs` (11–12px meta), `text-sm`
  (14px body), `text-base` (16px input/value), `text-lg` (18px section
  headers). Avoid arbitrary sizes.
- **Section labels** — uppercase, `text-xs`, `font-semibold`,
  `tracking-wide`, `text-[color:var(--text-secondary)]`. Pattern used for
  `MAP OVERVIEW`, `ROUTE DETAILS`, `TRUCK`, etc. in the reference.
- **Headings** — `text-base font-semibold text-[color:var(--text-primary)]`
  for in-card titles; the bigger page title (`New shipment`) is
  `text-lg font-semibold`.
- **Body** — `text-sm text-[color:var(--text-primary)]`.
- **Meta / caption** — `text-xs text-[color:var(--text-tertiary)]`.

### Spacing

- **Card padding** — `p-5` (20px) for compact cards, `p-6` (24px) for the
  hero map/route cards.
- **Card gap** — `gap-4` between cards in a row, `gap-6` for major sections
  vertically.
- **Inline gap** — `gap-2` between a label and its icon, `gap-3` for
  button rows.

### Radius

- `--radius-card: 16px` (rounded-2xl) — every white card and pane.
- `--radius-control: 10px` — buttons, inputs, dropdowns.
- `--radius-pill: 9999px` — pills, search bars, avatar chips.

### Shadow

- `--shadow-card: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);`
- `--shadow-elevated: 0 4px 12px rgba(15, 23, 42, 0.08);` — popovers,
  dropdowns, modals.

## Components

### Cards / panes

```
class="rounded-2xl border border-[color:var(--border-subtle)]
       bg-[color:var(--surface-elevated)] shadow-[var(--shadow-card)] p-5"
```

Cards stack on the slate `--surface-app` page background with `gap-4` /
`gap-6`. Headers inside a card use the **section label** style above.

### Buttons

| Variant         | Background           | Text                  | Border                     |
| --------------- | -------------------- | --------------------- | -------------------------- |
| **Primary**     | `--primary`          | white                 | none                       |
| **Soft primary** | `--primary-soft`    | `--primary`           | none                       |
| **Secondary**   | `--surface-elevated` | `--text-primary`      | `--border-subtle`          |
| **Ghost**       | transparent          | `--text-secondary`    | none — show on hover only  |
| **Danger**      | `--surface-elevated` | `--danger-fg`         | `--danger-bg` (1px)        |

All buttons: `rounded-[var(--radius-control)]`, `text-sm font-medium`,
`px-3 py-1.5` for compact rows, `px-5 py-2.5` for hero CTAs (Submit/Save).

### Pills / status badges

```
class="inline-flex items-center rounded-full px-2.5 py-0.5
       text-xs font-medium"
```

Pair with one of the bg/fg color pairs (`success`, `warning`, `danger`).
Pills never carry a border.

### Inputs

```
class="rounded-[var(--radius-control)] border border-[color:var(--border-subtle)]
       bg-[color:var(--surface-elevated)] px-3 py-2 text-sm
       placeholder:text-[color:var(--text-tertiary)]
       focus:border-[color:var(--primary)] focus:outline-none
       focus:ring-2 focus:ring-[color:var(--primary)]/20"
```

Search inputs use `rounded-full` instead of the control radius and add a
leading icon (`ml-3` from the left edge).

### Timeline (Cargo list / Route details)

A vertical list of items connected by a dashed line. Each item: a numbered
or dotted marker on the left (`w-6 h-6 rounded-full bg-[color:var(--primary)]
text-white text-xs font-medium`), then a two-line stack (primary label +
muted meta).

### Side navigation

Thin (`w-14`) column with icon-only buttons. Active icon: filled blue
chip (`bg-[color:var(--primary-soft)]` background, `text-[color:var(--primary)]`).
Inactive: `text-[color:var(--text-tertiary)]`, hover lifts to
`text-[color:var(--text-secondary)]`.

## Mapping to AiWriter surfaces

| AiWriter surface       | Design system slot                                |
| ---------------------- | ------------------------------------------------- |
| Body / workspace shell | `--surface-app` background.                       |
| TopBar                 | Card surface, soft shadow, no rounding on bottom. |
| Side panes             | Card surface, `rounded-2xl`, soft shadow.         |
| Generated draft        | Card surface, sunken inner block for the preview. |
| Pane heading           | Section label (uppercase, secondary text).        |
| Generate / Validate    | Primary button.                                   |
| Edit prompts / Check validations | Secondary button.                       |
| Doc options / Validations toggles (on)  | Soft primary.                    |
| Delete                 | Danger button.                                    |
| Reviewer-mode badge    | Warning pill.                                     |

When adding new components, reach for the tokens and patterns above before
introducing one-off colors or radii.
