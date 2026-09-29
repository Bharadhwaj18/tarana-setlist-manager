import { CreateWorkspaceForm } from '@/components/workspace/CreateWorkspaceForm'

export default function NewWorkspacePage() {
  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Create a workspace</h1>
      <p className="mb-6 text-sm text-gray-500">
        A workspace is its own space with its own songs, setlists, shows and finances, for a band, a venue or anything else you run. You’ll be its owner and can invite people with a link.
      </p>
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <CreateWorkspaceForm />
      </section>
    </div>
  )
}
