import Link from 'next/link'

/** Shown instead of a section the signed-in member isn't allowed to open in this workspace. */
export function NoAccess({ section, workspaceName }: { section: string; workspaceName: string }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-8">
      <div className="w-full max-w-md rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-sm">
        <svg viewBox="0 0 240 180" className="mx-auto mb-6 h-40 w-full max-w-[16rem]" role="img" aria-label="A closed door with a padlock">
          <ellipse cx="120" cy="164" rx="92" ry="8" className="fill-brand-100" />
          <rect x="62" y="28" width="116" height="134" rx="10" className="fill-brand-100" />
          <rect x="74" y="40" width="92" height="122" rx="6" className="fill-brand-200" />
          <circle cx="150" cy="104" r="5" className="fill-brand-700" />
          <rect x="106" y="72" width="28" height="28" rx="6" className="fill-brand-400" />
          <path d="M112 72 V64 a8 8 0 0 1 16 0 V72" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-brand-600" />
          <rect x="112" y="80" width="16" height="12" rx="2" className="fill-white" />
          <circle cx="40" cy="58" r="5" className="fill-brand-300" />
          <circle cx="202" cy="44" r="7" className="fill-brand-200" />
          <circle cx="196" cy="128" r="4" className="fill-brand-300" />
        </svg>

        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-gray-500">No access</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-gray-900">This area is locked for you</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
          Your access to {section} in {workspaceName} is turned off. An admin can switch it on for you.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-500">
            Back to Today
          </Link>
          <Link href="/choose-workspace" className="rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-brand-50">
            Switch workspace
          </Link>
        </div>
      </div>
    </div>
  )
}
