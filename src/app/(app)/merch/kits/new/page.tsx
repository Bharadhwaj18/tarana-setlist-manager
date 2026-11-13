import { PackKitPage } from '@/lib/merch-pack'

export default async function NewMerchKitPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams
  return <PackKitPage kitId={null} showId={show} />
}
