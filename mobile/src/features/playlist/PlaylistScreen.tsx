import { useState } from 'react'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { hdmiPlayer } from '../../../modules/hdmi-player'
import type { PlaybackState } from '../../../modules/hdmi-player'
import Button from '../../components/Button'
import Screen from '../../components/Screen'
import FilePicker from '../../components/FilePicker'
import DimOverlay from '../../components/DimOverlay'
import { colors, type } from '../../lib/theme'
import { dimScreen } from '../../lib/screenBrightness'
import { useScreenDim } from '../../lib/useScreenDim'
import { usePlaylist } from './usePlaylist'
import { formatScale } from '../hdmi-placement/placement'

const labels: Record<PlaybackState, string> = {
  idle: 'Adaugă videoclipuri pentru a începe.', loading: 'Se pregătește playlistul…', ready: 'Pregătit · Apasă Redă',
  playing: 'Redare pe HDMI · În buclă · Fără sunet', buffering: 'Se încarcă…', paused: 'Pauză · Apasă Redă',
  stopped: 'Oprit · Ieșirea HDMI este neagră', error: 'Un videoclip nu poate fi redat.',
}

export default function PlaylistScreen() {
  const router = useRouter()
  const playlist = usePlaylist()
  const { items, hdmi, busy } = playlist
  const { status } = hdmi
  const [library, setLibrary] = useState(false)
  const { dimmed, dim, wake, error: dimError } = useScreenDim(hdmi.active, status.playback === 'playing')
  const prepared = !!items?.length && ['ready', 'playing', 'buffering', 'paused', 'stopped'].includes(status.playback)
  const editable = hdmi.ready && !busy && items !== null
  return <Screen>
    <Text style={styles.title} accessibilityRole="header">Playlist HDMI</Text>
    <Text style={styles.body}>Videoclipurile se păstrează pe telefon și se redau în ordine, în buclă. Telefonul afișează doar comenzile.</Text>
    {!hdmiPlayer ? <Text style={styles.muted}>Playlistul HDMI este disponibil în versiunea de dezvoltare Camioane instalată pe un telefon compatibil. Nu este disponibil în browser sau Expo Go.</Text> : <>
      <View style={styles.section} accessibilityLiveRegion="polite">
        <Text style={styles.heading} accessibilityRole="header">Ecran extern</Text>
        <Text style={styles.body}>{status.display?.name ?? 'Niciun ecran extern conectat'}</Text>
        <Text style={styles.muted}>{status.display ? `${status.display.width} × ${status.display.height} pixeli` : 'Conectează telefonul printr-un adaptor HDMI compatibil.'}</Text>
        <Text style={styles.muted}>Poziționare: X {status.placement.x}, Y {status.placement.y} px · {formatScale(status.placement.scale)} · Setarea acestui telefon</Text>
        <Text style={styles.body}>{labels[status.playback]}</Text>
        {status.index !== null ? <Text style={styles.muted}>{status.index + 1} / {status.count} · {items?.[status.index]?.name}</Text> : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">Videoclipuri · {items?.length ?? 0}</Text>
        {!items && !playlist.error ? <ActivityIndicator accessibilityLabel="Se încarcă playlistul" /> : null}
        {items?.length === 0 ? <Text style={styles.muted}>Playlistul este gol. Adaugă fișiere MP4 din telefon sau din Fișiere.</Text> : null}
        {items?.map((item, index) => <View key={item.id} style={[styles.item, status.index === index && styles.current]}>
          <Text style={styles.label} selectable>{index + 1}. {item.name}{status.index === index ? ' · Curent' : ''}</Text>
          <Text style={styles.muted}>{(item.size / 1024 / 1024).toFixed(1)} MB · {item.source === 'device' ? 'Din telefon' : 'Din Fișiere'}</Text>
          <View style={styles.row}>
            <ItemAction label="↑ Sus" accessibilityLabel={`Mută ${item.name} mai sus`} disabled={!editable || index === 0} onPress={() => void playlist.move(index, index - 1)} />
            <ItemAction label="↓ Jos" accessibilityLabel={`Mută ${item.name} mai jos`} disabled={!editable || index === items.length - 1} onPress={() => void playlist.move(index, index + 1)} />
            <ItemAction label="Elimină" accessibilityLabel={`Elimină ${item.name} din playlist`} disabled={!editable} onPress={() => void playlist.remove(item.id)} />
          </View>
        </View>)}
        <Button label="Adaugă din telefon" disabled={!editable} onPress={() => void playlist.addDevice()} />
        <Button label="Adaugă din Fișiere" disabled={!editable || playlist.preview} onPress={() => {
          void hdmi.control('pause')
          setLibrary(true)
        }} />
        {playlist.preview ? <Text style={styles.muted}>Fișierele de pe server nu sunt disponibile în contul de previzualizare.</Text> : null}
        <Text style={styles.muted}>După orice modificare a listei, apasă Redă din nou.</Text>
      </View>
      {playlist.phase ? <View style={styles.section} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.data} />
        <Text style={styles.body}>{playlist.phase} {Math.round(playlist.progress * 100)}%</Text>
        <View accessibilityRole="progressbar" accessibilityLabel="Progresul operației"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(playlist.progress * 100) }} style={styles.track}>
          <View style={[styles.fill, { width: `${playlist.progress * 100}%` }]} />
        </View>
        <Button label="Anulează" onPress={playlist.cancel} />
      </View> : null}
      {playlist.error ? <Text style={styles.error} accessibilityRole="alert">{playlist.error}</Text> : null}
      {hdmi.error ? <Text style={styles.error} accessibilityRole="alert">{hdmi.failedName ? `„${hdmi.failedName}”: ` : ''}{hdmi.error}</Text> : null}
      {dimError ? <Text style={styles.error} accessibilityRole="alert">{dimError}</Text> : null}
      <View style={styles.section}>
        <Button label={hdmi.active ? 'Pauză' : 'Redă'} variant="primary" disabled={busy || !hdmi.ready || !prepared || (!hdmi.active && !status.display)} onPress={() => void hdmi.control(hdmi.active ? 'pause' : 'play')} />
        <Button label="Oprește" disabled={busy || !prepared} onPress={() => void hdmi.control('stop')} />
        <View style={styles.row}>
          <Button label="Anterior" disabled={busy || !prepared} onPress={() => void hdmi.control('previous')} />
          <Button label="Următor" disabled={busy || !prepared} onPress={() => void hdmi.control('next')} />
        </View>
        {dimScreen !== null ? <Button label="Întunecă ecranul telefonului" disabled={busy || status.playback !== 'playing'} onPress={() => void dim()} /> : null}
        {status.playback === 'error' && editable ? <Button label="Reîncearcă pregătirea" onPress={() => void hdmi.replace([...items!]).catch(() => {})} /> : null}
      </View>
      <Text style={styles.muted}>{Platform.OS === 'ios'
        ? 'Pe iPhone, redarea continuă când schimbi aplicația sau blochezi telefonul.'
        : 'Pe Android 11 și versiunile mai noi, redarea continuă pe ecranul principal sau în altă aplicație. Pe versiunile mai vechi, păstrează aplicația deschisă. Blocarea telefonului poate stinge HDMI; folosește întunecarea ecranului.'} Ține apăsat o secundă pentru a reveni la comenzi. Deconectarea HDMI pune redarea pe pauză; reconectează și apasă Redă. Ieșirea din playlist, deconectarea contului sau expirarea sesiunii oprește redarea.</Text>
    </>}
    <Button label="Înapoi" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    {library && !playlist.preview ? <Modal visible animationType="slide" onRequestClose={() => setLibrary(false)}>
      <Screen>
        <Button label="Închide Fișiere" onPress={() => setLibrary(false)} />
        <FilePicker disabled={busy} actionLabel="Adaugă în playlist" selectedIds={items?.flatMap((item) => item.fileId ? [item.fileId] : [])}
          onChoose={(file) => { setLibrary(false); void playlist.addServer(file) }} />
      </Screen>
    </Modal> : null}
    {dimmed ? <DimOverlay wake={wake} buffering={status.playback === 'buffering'} romanian /> : null}
  </Screen>
}

function ItemAction({ label, accessibilityLabel, disabled, onPress }: {
  label: string; accessibilityLabel: string; disabled: boolean; onPress: () => void
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.itemAction, disabled && styles.disabled]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>
}
const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text }, heading: { ...type.section, color: colors.text },
  body: { ...type.body, color: colors.text }, label: { ...type.label, color: colors.text },
  muted: { ...type.meta, color: colors.muted }, error: { ...type.body, color: colors.danger },
  section: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  item: { gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border },
  current: { borderColor: colors.data, backgroundColor: colors.frame },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemAction: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: colors.controlBorder },
  disabled: { opacity: 0.4 }, track: { height: 6, backgroundColor: colors.border },
  fill: { height: '100%', backgroundColor: colors.data },
})
