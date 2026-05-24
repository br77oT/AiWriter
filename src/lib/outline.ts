// Pure model functions for outline editing.
//
// The Outline panel UI is a thin shell over these functions; the freeze
// invariant ("frozen outline blocks add/remove/rename/reorder") is enforced
// here so the rule cannot drift between the UI, future API endpoints, and
// the eventual server-side enforcement in the Generation Engine (slice 006).

import type { OutlineSection } from "./types";

export interface FreezeOptions {
  frozen?: boolean;
}

export interface NewSection {
  id: string;
  heading?: string;
  description?: string;
  required?: boolean;
  parentId?: string;
  format?: OutlineSection["format"];
}

export function addSection(
  outline: OutlineSection[],
  partial: NewSection,
  options: FreezeOptions = {}
): OutlineSection[] {
  if (options.frozen) return outline;
  const next: OutlineSection = {
    id: partial.id,
    heading: partial.heading ?? "",
    description: partial.description ?? "",
    required: partial.required ?? true,
    ...(partial.parentId !== undefined ? { parentId: partial.parentId } : {}),
    ...(partial.format !== undefined ? { format: partial.format } : {}),
  };
  return [...outline, next];
}

export function removeSection(
  outline: OutlineSection[],
  id: string,
  options: FreezeOptions = {}
): OutlineSection[] {
  if (options.frozen) return outline;
  const idx = outline.findIndex((s) => s.id === id);
  if (idx === -1) return outline;
  return [...outline.slice(0, idx), ...outline.slice(idx + 1)];
}

// Patch is intentionally narrow — id/parentId are not user-editable from
// this surface. When frozen, `heading` is dropped from the patch (renaming
// is part of the freeze invariant); description, required-flag and format
// remain editable since they don't change the section list itself.
export type SectionPatch = Partial<
  Pick<OutlineSection, "heading" | "description" | "required" | "format">
>;

export function updateSection(
  outline: OutlineSection[],
  id: string,
  patch: SectionPatch,
  options: FreezeOptions = {}
): OutlineSection[] {
  const idx = outline.findIndex((s) => s.id === id);
  if (idx === -1) return outline;
  const effective: SectionPatch = options.frozen
    ? {
        description: patch.description,
        required: patch.required,
        format: patch.format,
      }
    : patch;
  // Strip undefined keys so {} merges cleanly without overwriting fields.
  const cleaned: SectionPatch = {};
  if (effective.heading !== undefined) cleaned.heading = effective.heading;
  if (effective.description !== undefined)
    cleaned.description = effective.description;
  if (effective.required !== undefined) cleaned.required = effective.required;
  if (effective.format !== undefined) cleaned.format = effective.format;
  if (Object.keys(cleaned).length === 0) return outline;
  const updated: OutlineSection = { ...outline[idx], ...cleaned };
  return [...outline.slice(0, idx), updated, ...outline.slice(idx + 1)];
}

export function moveSection(
  outline: OutlineSection[],
  fromIndex: number,
  toIndex: number,
  options: FreezeOptions = {}
): OutlineSection[] {
  if (options.frozen) return outline;
  if (outline.length === 0) return outline;
  const last = outline.length - 1;
  const from = clamp(fromIndex, 0, last);
  const to = clamp(toIndex, 0, last);
  if (from === to) return outline;
  const next = outline.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
