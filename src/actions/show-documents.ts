'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { DOCUMENT_BUCKET, DOCUMENT_KINDS, type DocumentKind } from '@/types/show-document'

interface CreateShowDocumentInput {
  showId: string
  kind: DocumentKind
  fileName: string
  filePath: string
  mimeType: string
  sizeBytes: number
}

// The file is already in Storage (uploaded straight from the browser, like recordings);
// this only records the row once that succeeded.
export async function createShowDocument(input: CreateShowDocumentInput): Promise<{ error?: string }> {
  if (!DOCUMENT_KINDS.includes(input.kind)) return { error: 'Invalid document type' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('show_documents').insert({
    show_id: input.showId,
    kind: input.kind,
    file_name: input.fileName,
    file_path: input.filePath,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    created_by: user.id,
    workspace_id: await requireWorkspaceId(),
  })
  if (error) return { error: error.message }

  revalidatePath(`/shows/${input.showId}`)
  return {}
}

export async function deleteShowDocument(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: doc, error: fetchError } = await supabase
    .from('show_documents').select('file_path, show_id').eq('id', id).maybeSingle()
  if (fetchError) return { error: fetchError.message }

  const { error } = await supabase.from('show_documents').delete().eq('id', id)
  if (error) return { error: error.message }

  // Best-effort: the row is gone either way.
  if (doc?.file_path) await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.file_path])

  if (doc) revalidatePath(`/shows/${doc.show_id}`)
  return {}
}
