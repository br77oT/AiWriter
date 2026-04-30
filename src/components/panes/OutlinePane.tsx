// Placeholder shell for slice 004.
export function OutlinePane() {
  return (
    <section
      className="flex h-full flex-col border-r border-neutral-200 bg-white p-3"
      aria-labelledby="outline-pane-heading"
    >
      <h2
        id="outline-pane-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        Outline
      </h2>
      <p className="text-sm text-neutral-400">
        Structured headings, required/optional flags, freeze toggle. Wired up
        in slice 004.
      </p>
    </section>
  );
}
