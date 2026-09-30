import type { Database } from './database'

export type ShowDocument = Database['public']['Tables']['show_documents']['Row']

export const DOCUMENT_KINDS = ['quotation', 'invoice', 'other'] as const
export type DocumentKind = typeof DOCUMENT_KINDS[number]
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  other: 'Other',
}

export const DOCUMENT_BUCKET = 'show-documents'
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*'
