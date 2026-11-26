import { useState } from 'react'
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { usePreventRemove, useRouter } from 'expo-router'
import Button from '../../components/Button'
import Screen from '../../components/Screen'
import FilePicker from '../../components/FilePicker'
import { useSession } from '../../auth/session'
import { colors, type } from '../../lib/theme'
import { hdmiPlayer } from '../../../modules/hdmi-player'
import Preview from './Preview'
import ResolutionPicker from './ResolutionPicker'
import SeekBar from './SeekBar'
import { formatResolution } from './screenLayout'
import { useScreenEditor } from './useScreenEditor'
import { prepareHdmiResult } from './hdmiResults'
import { mediaError } from './types'

function bytes(value: number) { return value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }
function timecode(value: number) { const seconds = Math.max(0, Math.floor(value)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }

export default function ScreenEditor({ fileId }: { fileId?: string }) {
  const editor = useScreenEditor(fileId)
  const router = useRouter()
  const session = useSession((state) => state.session)
  const preview = useSession((state) => state.preview)
  const [library, setLibrary] = useState(false)
  const [handoff, setHandoff] = useState(false)
  const [handoffError, setHandoffError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const busy = !!editor.phase || handoff
  const uploading = editor.phase === 'Se încarcă…' || editor.phase === 'Se salvează…'
  usePreventRemove(busy && !leaving && (!!session || preview), ({ repeat }) => {
    const leave = () => { editor.cancel(); setLeaving(true); repeat() }
    if (Platform.OS === 'web') {
      if (window.confirm('Conversia sau transferul este în curs. Părăsești pagina și îl anulezi?')) leave()
    } else Alert.alert('Anulezi operația?', 'Conversia sau transferul se va opri dacă părăsești pagina.', [
      { text: 'Rămâi', style: 'cancel' }, { text: 'Anulează și ieși', style: 'destructive', onPress: leave },
    ])
  })

  async function playHdmi() {
    if (!editor.result || handoff || (editor.phase && !uploading)) return
    setHandoff(true)
    setHandoffError('')
    try {
      await editor.preparePlayback()
      const resultId = await prepareHdmiResult(editor.result)
      router.push({ pathname: '/hdmi-test', params: { resultId } })
    } catch (error) { setHandoffError(mediaError(error)) } finally { setHandoff(false) }
  }

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">Ecrane camioane</Text>
      <Text style={styles.body}>Un MP4 cu trei copii ale aceluiași videoclip, la rezoluția aleasă. Sunetul este păstrat; originalul rămâne neschimbat.</Text>
      <Button label="Înapoi" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      {!editor.available ? <Text style={styles.error} accessibilityRole="alert">Previzualizarea și conversia necesită o versiune nouă a aplicației instalate. Nu sunt disponibile în Expo Go.</Text> : null}
      {editor.preview ? <Text style={styles.muted}>Previzualizare locală: poți converti și reda pe HDMI. Conectează-te cu un cont pentru a accesa și salva Fișiere.</Text> : null}
      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">Videoclip sursă</Text>
        <Button label="Alege un MP4 din telefon" disabled={busy || !editor.available} onPress={editor.choose} />
        <Button label={library ? 'Închide Fișiere' : 'Alege din Fișiere'} disabled={busy || editor.preview || !editor.available} onPress={() => setLibrary(!library)} />
        {editor.source ? <View><Text style={styles.label} selectable>{editor.source.name}</Text><Text style={styles.muted}>MP4 · {bytes(editor.source.size)}</Text></View> : null}
      </View>

      <ResolutionPicker selected={editor.resolution} custom={editor.customResolutions} disabled={busy || !editor.resolutionsReady}
        error={editor.resolutionError} onSelect={editor.resize} onAdd={editor.addResolution} onRemove={editor.removeResolution} />

      <View style={styles.section}>
        <View style={styles.row}><Text style={styles.heading} accessibilityRole="header">Previzualizare</Text><Text style={styles.muted}>{formatResolution(editor.resolution)} px</Text></View>
        <View style={styles.canvas}>
          <Preview sessionId={editor.previewId} resolution={editor.resolution} />
          {editor.regions.map((region) => <View key={region.id} pointerEvents="none" style={[styles.outline, {
            left: `${region.x / editor.resolution.width * 100}%`, width: `${region.width / editor.resolution.width * 100}%`,
          }]} />)}
        </View>
        {!editor.info ? <Text style={styles.muted}>Alege un MP4 pentru a vedea încadrarea în cele trei regiuni.</Text> : null}
        <SeekBar value={Math.min(editor.time, editor.info?.duration ?? 0)} duration={editor.info?.duration ?? 0}
          disabled={busy || !editor.info} onSeek={(seconds) => editor.control('seek', seconds)} />
        <View style={styles.row}>
          <Button label={editor.playing ? 'Pauză' : 'Redă'} disabled={busy || !editor.info}
            onPress={() => editor.control(editor.playing ? 'pause' : 'play')} />
          <Text style={styles.muted}>{timecode(editor.time)} din {timecode(editor.info?.duration ?? 0)}</Text>
        </View>
      </View>

      {editor.regions.map((region) => <View key={region.id} style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">{region.label}</Text>
        <Text style={styles.muted}>{region.width} × {region.height} px · x {region.x}, y {region.y}</Text>
        {(['cover', 'contain'] as const).map((fit) => <Pressable key={fit} disabled={busy}
          accessibilityRole="radio" aria-checked={editor.fits[region.id] === fit} aria-disabled={busy}
          accessibilityLabel={`${region.label}: ${fit === 'cover' ? 'Decupează pentru umplere' : 'Încadrează cu bandă neagră'}`}
          accessibilityState={{ checked: editor.fits[region.id] === fit, disabled: busy }}
          onPress={() => editor.fit(region.id, fit)} style={[styles.option, busy && styles.disabled]}>
          <View style={[styles.radio, editor.fits[region.id] === fit && styles.radioChecked]} />
          <Text style={[styles.body, styles.optionText]}>{fit === 'cover' ? 'Decupează pentru umplere' : 'Încadrează cu bandă neagră'}</Text>
        </Pressable>)}
      </View>)}

      <Button label={editor.preview ? 'Convertește videoclipul' : 'Convertește și salvează în Fișiere'} variant="primary"
        disabled={busy || !editor.info || !editor.available || !editor.resolutionsReady} onPress={editor.convert} />
      {editor.phase ? <View style={styles.section} accessibilityLiveRegion="polite">
        <View style={styles.row}><ActivityIndicator color={colors.data} /><Text style={styles.label}>{editor.phase}</Text></View>
        <View accessibilityRole="progressbar" aria-label="Progresul operației" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(editor.progress * 100)}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(editor.progress * 100) }}
          style={styles.track}><View style={[styles.fill, { width: `${editor.progress * 100}%` }]} /></View>
        <Text style={styles.muted}>{Math.round(editor.progress * 100)}%</Text>
        <Button label="Anulează" onPress={editor.cancel} />
      </View> : null}
      {editor.error ? <Text style={styles.error} accessibilityRole="alert">{editor.error}</Text> : null}
      {editor.retry && !busy ? <Button label="Reîncearcă" onPress={editor.retry} /> : null}
      {editor.notice ? <Text style={styles.body} accessibilityLiveRegion="polite">{editor.notice}</Text> : null}
      {editor.result ? <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">Videoclip convertit</Text>
        <Text style={styles.body} selectable>{editor.result.name}</Text>
        <Text style={styles.muted}>{formatResolution(editor.resolution)} · {bytes(editor.result.size)}</Text>
        {!editor.saved && !editor.preview ? <Button label="Salvează rezultatul în Fișiere" disabled={busy} onPress={() => editor.save()} /> : null}
        {editor.saved ? <Button label="Vezi în Fișiere" disabled={busy} onPress={() => setLibrary(true)} /> : null}
        <Button label={handoff ? 'Se pregătește HDMI…' : 'Redă pe HDMI'} disabled={handoff || (!!editor.phase && !uploading) || !hdmiPlayer} onPress={() => void playHdmi()} />
        {uploading && hdmiPlayer ? <Text style={styles.muted}>Deschiderea HDMI oprește încărcarea. Poți salva rezultatul la întoarcere.</Text> : null}
        {!hdmiPlayer ? <Text style={styles.muted}>HDMI este disponibil în aplicația instalată pe un telefon compatibil.</Text> : null}
      </View> : null}
      {handoffError ? <Text style={styles.error} accessibilityRole="alert">{handoffError}</Text> : null}
      <Text style={styles.muted}>Configurația provine din fotografiile ViPlex și trebuie confirmată pe camion, inclusiv corespondența dintre regiuni și laturile fizice. Dimensiunile videoclipului nu stabilesc rezoluția ieșirii HDMI.</Text>
      {library ? <Modal visible animationType="slide" onRequestClose={() => setLibrary(false)}>
        <Screen>
          <Button label="Închide Fișiere" onPress={() => setLibrary(false)} />
          <FilePicker disabled={busy} onChoose={(file) => { setLibrary(false); editor.chooseStored(file) }} actionLabel="Ecran camion" selectedIds={editor.saved ? [editor.saved.id] : []} />
        </Screen>
      </Modal> : null}
    </Screen>
  )
}


const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text }, heading: { ...type.section, color: colors.text },
  body: { ...type.body, color: colors.text }, label: { ...type.label, color: colors.text },
  muted: { ...type.meta, color: colors.muted }, error: { ...type.body, color: colors.danger },
  section: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  canvas: { backgroundColor: '#000', overflow: 'hidden' },
  outline: { position: 'absolute', top: 0, height: '100%', borderWidth: 1, borderColor: '#ffffff66' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }, disabled: { opacity: 0.5 },
  optionText: { flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.controlBorder },
  radioChecked: { borderWidth: 6, borderColor: colors.primary },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, width: '100%', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.data },
})
