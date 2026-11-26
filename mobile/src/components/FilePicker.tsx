import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../auth/session'
import { api, errorMessage } from '../lib/api'
import type { StoredFile } from '../lib/file'
import { colors, type } from '../lib/theme'
import Button from './Button'

function bytes(value: number) { return value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }

export default function FilePicker({ onChoose, disabled, actionLabel, selectedIds = [] }: {
  onChoose: (file: StoredFile) => void
  disabled: boolean
  actionLabel: string
  selectedIds?: readonly string[]
}) {
  const [offset, setOffset] = useState(0)
  const revision = useSession((state) => state.revision)
  const query = useQuery({ queryKey: ['files', revision, offset], queryFn: ({ signal }) => api.files(offset, signal) })
  return <View style={styles.section}>
    <Text style={styles.heading} accessibilityRole="header">Fișiere</Text>
    <Text style={styles.muted}>Sunt afișate fișierele la care contul tău are acces. Alege un fișier MP4.</Text>
    {query.isPending ? <ActivityIndicator accessibilityLabel="Se încarcă fișierele" /> : null}
    {query.isError ? <><Text style={styles.error} accessibilityRole="alert">{errorMessage(query.error)}</Text><Button label="Reîncearcă" onPress={() => void query.refetch()} /></> : null}
    {query.data?.files.map((file) => <View key={file.id} style={styles.file}>
      <Text style={styles.label} selectable>{file.originalName}{selectedIds.includes(file.id) ? ' · Selectat' : ''}</Text>
      <Text style={styles.muted}>{bytes(file.size)} · {file.mimeType}</Text>
      <Button label={actionLabel} disabled={disabled || file.mimeType !== 'video/mp4'} onPress={() => onChoose(file)} />
    </View>)}
    {query.data?.files.length === 0 ? <Text style={styles.muted}>Nu există fișiere pe această pagină.</Text> : null}
    <Text style={styles.muted}>{query.data ? `${query.data.total} fișiere · Pagina ${offset / 50 + 1}` : ''}</Text>
    <View style={styles.row}>
      <Button label="Înapoi" disabled={disabled || !offset || query.isFetching} onPress={() => setOffset(offset - 50)} />
      <Button label="Înainte" disabled={disabled || !query.data || offset + 50 >= query.data.total || query.isFetching} onPress={() => setOffset(offset + 50)} />
    </View>
  </View>
}


const styles = StyleSheet.create({
  section: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  heading: { ...type.section, color: colors.text }, label: { ...type.label, color: colors.text },
  muted: { ...type.meta, color: colors.muted }, error: { ...type.body, color: colors.danger },
  file: { gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
})
