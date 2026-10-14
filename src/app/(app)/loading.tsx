/**
 * Shown the instant you click a section, while the server prepares the real page. The sidebar
 * stays put (it lives in the layout), so navigation feels immediate instead of frozen.
 */
export default function Loading() {
  return (
    <div className="max-w-5xl animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-48 rounded-lg bg-brand-100" />
        <div className="h-4 w-72 max-w-full rounded bg-brand-100/70" />
      </div>
      <div className="mb-5 flex gap-2">
        <div className="h-9 w-24 rounded-full bg-brand-100" />
        <div className="h-9 w-24 rounded-full bg-brand-100" />
        <div className="h-9 w-24 rounded-full bg-brand-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-brand-200 bg-white p-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-brand-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-brand-100" />
              <div className="h-3 w-3/5 rounded bg-brand-100/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
