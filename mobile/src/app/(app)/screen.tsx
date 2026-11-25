import { useLocalSearchParams } from 'expo-router'
import ScreenEditor from '../../features/screen/ScreenEditor'

export default function ScreenVideoPage() {
  const { fileId } = useLocalSearchParams<{ fileId?: string }>()
  return <ScreenEditor key={fileId ?? 'local'} fileId={fileId} />
}
