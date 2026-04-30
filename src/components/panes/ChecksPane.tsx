// Placeholder shell for slice 005.
export function ChecksPane() {
  return (
    <section
      className="flex h-full flex-col border-r border-neutral-200 bg-white p-3"
      aria-labelledby="checks-pane-heading"
    >
      <h2
        id="checks-pane-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        Checks
      </h2>
      <p className="text-sm text-neutral-400">
        Required questions the document must answer. Wired up in slice 005.
      </p>
    </section>
  );
}
