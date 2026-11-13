import { PackKitPage } from '@/lib/merch-pack'

export default async function EditMerchKitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PackKitPage kitId={id} />
}
