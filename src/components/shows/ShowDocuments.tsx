'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Upload, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { createClient } from '@/lib/supabase/client'
import { createShowDocument, deleteShowDocument } from '@/actions/show-documents'
import {
  DOCUMENT_ACCEPT, DOCUMENT_BUCKET, DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, DOCUMENT_MAX_BYTES,
  type DocumentKind, type ShowDocument,
} from '@/types/show-document'

interface Props {
  showId: string
  userId: string
  documents: ShowDocument[]
}

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
}

const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, '_').slice(-80)

export function ShowDocuments({ showId, userId, documents }: Props) {
  const router = useRouter()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<DocumentKind>('quotation')
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    if (file.size > DOCUMENT_MAX_BYTES) {
      toast('That file is over 10 MB. Try a smaller PDF or image.', 'error')
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const filePath = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`
      const mimeType = file.type || 'application/octet-stream'
      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(filePath, file, { contentType: mimeType })
      if (uploadError) {
        toast('Couldn’t upload that file. Use a PDF, Word document or image.', 'error')
        return
      }
      const res = await createShowDocument({ showId, kind, fileName: file.name, filePath, mimeType, sizeBytes: file.size })
      if (res.error) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([filePath])
        toast(res.error, 'error')
      } else {
        toast(`${DOCUMENT_KIND_LABELS[kind]} saved`, 'success')
        router.refresh()
      }
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const open = async (doc: ShowDocument) => {
    const { data, error } = await createClient().storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.file_path, 300)
    if (error || !data) {
      toast('Couldn’t open that file', 'error')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const remove = async (doc: ShowDocument) => {
    if (!window.confirm(`Delete ${doc.file_name}?`)) return
    const res = await deleteShowDocument(doc.id)
    if (res.error) toast(res.error, 'error')
    else router.refresh()
  }

  return (
    <section className="mb-5 rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Quotation &amp; Invoice</h2>

      {documents.length === 0 ? (
        <p className="mb-4 text-sm text-gray-400">Nothing saved yet. Add the quotation or invoice you shared.</p>
      ) : (
        <ul className="mb-4 divide-y divide-brand-100">
          {documents.map(d => (
            <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <FileText className="h-5 w-5 shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{d.file_name}</p>
                <p className="text-xs text-gray-500">
                  {DOCUMENT_KIND_LABELS[d.kind as DocumentKind] ?? 'Other'} · {sizeLabel(d.size_bytes)} · {dateLabel(d.created_at)}
                </p>
              </div>
              <button type="button" onClick={() => open(d)} aria-label={`Open ${d.file_name}`} className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100">
                <Download className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(d)} aria-label={`Delete ${d.file_name}`} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as DocumentKind)}
          aria-label="Document type"
          className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        >
          {DOCUMENT_KINDS.map(k => <option key={k} value={k}>{DOCUMENT_KIND_LABELS[k]}</option>)}
        </select>
        <Button type="button" variant="secondary" loading={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Add file
        </Button>
        <input
          ref={fileRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
        />
        <span className="text-xs text-gray-400">PDF, Word or image, up to 10 MB</span>
      </div>
    </section>
  )
}
