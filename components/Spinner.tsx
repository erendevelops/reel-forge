/** A small brand-green spinner with an optional label; shown while a page or panel loads. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      {label && <span className="meta font-mono text-xs">{label}</span>}
    </div>
  );
}
