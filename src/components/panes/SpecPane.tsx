// Placeholder shell for slice 003.
export function SpecPane() {
  return (
    <section
      className="flex h-full flex-col border-r border-neutral-200 bg-white p-3"
      aria-labelledby="spec-pane-heading"
    >
      <h2
        id="spec-pane-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        Spec
      </h2>
      <p className="text-sm text-neutral-400">
        Goals, tone, audience, must-include, must-avoid. Wired up in slice
        003.
      </p>
    </section>
  );
}
