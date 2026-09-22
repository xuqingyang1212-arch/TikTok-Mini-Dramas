import { AppController } from "@/components/AppController"

interface PlayerPageProps {
  searchParams: Promise<{ dramaId?: string }>
}

export default async function PlayerPage({ searchParams }: PlayerPageProps) {
  const { dramaId } = await searchParams
  return <AppController initialDramaId={dramaId} />
}
