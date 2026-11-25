package expo.modules.screenvideo

import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

@UnstableApi
private object ScreenPlayers { val players = mutableMapOf<String, ExoPlayer>() }

@UnstableApi
class ScreenPreviewView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var sessionId: String? = null
  private val playerView = PlayerView(context).apply {
    useController = false
    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    setBackgroundColor(Color.BLACK)
    setShutterBackgroundColor(Color.BLACK)
  }
  init { addView(playerView, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)) }
  fun bind(id: String) { sessionId = id; playerView.player = ScreenPlayers.players[id] }
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    playerView.layout(0, 0, right - left, bottom - top)
  }
  override fun onDetachedFromWindow() { playerView.player = null; super.onDetachedFromWindow() }
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    playerView.player = sessionId?.let { ScreenPlayers.players[it] }
  }
}

@UnstableApi
class ScreenVideoModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private val owned = mutableSetOf<String>()
  private val openings = mutableMapOf<String, Promise>()
  private val exports = mutableMapOf<String, Pair<Transformer, Promise>>()
  private val ticker = object : Runnable {
    override fun run() {
      for (id in owned) {
        val player = ScreenPlayers.players[id] ?: continue
        sendEvent("onPlayback", mapOf("id" to id, "time" to player.currentPosition / 1000.0, "playing" to player.isPlaying))
      }
      for ((id, entry) in exports) {
        val progress = ProgressHolder()
        if (entry.first.getProgress(progress) == Transformer.PROGRESS_STATE_AVAILABLE) {
          sendEvent("onProgress", mapOf("id" to id, "progress" to progress.progress / 100.0))
        }
      }
      if (owned.isNotEmpty() || exports.isNotEmpty()) main.postDelayed(this, 200)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ScreenVideo")
    Events("onPlayback", "onProgress")
    View(ScreenPreviewView::class) { Prop("sessionId") { view: ScreenPreviewView, id: String -> view.bind(id) } }

    AsyncFunction("open") { id: String, uri: String, promise: Promise ->
      try {
        require(Uri.parse(uri).scheme == "file") { "Alege un MP4 local." }
        release(id)
        val context = requireNotNull(appContext.reactContext)
        val player = ExoPlayer.Builder(context).build()
        ScreenPlayers.players[id] = player
        owned.add(id)
        openings[id] = promise
        player.addListener(object : Player.Listener {
          override fun onPlaybackStateChanged(state: Int) {
            if (state != Player.STATE_READY || ScreenPlayers.players[id] !== player) return
            val pending = openings.remove(id) ?: return
            val size = player.videoSize
            if (size.width <= 0 || size.height <= 0 || player.duration <= 0 || player.duration == C.TIME_UNSET) {
              pending.reject("ERR_SCREEN_OPEN", "Videoclipul nu are dimensiuni sau durată valide.", null)
            } else pending.resolve(mapOf("width" to size.width * size.pixelWidthHeightRatio.toDouble(), "height" to size.height,
              "duration" to player.duration / 1000.0))
          }
          override fun onPlayerError(error: PlaybackException) {
            openings.remove(id)?.reject("ERR_SCREEN_OPEN", "Acest MP4 nu poate fi redat pe telefon.", error)
            sendEvent("onPlayback", mapOf("id" to id, "time" to 0, "playing" to false, "error" to "Acest MP4 nu poate fi redat pe telefon."))
          }
        })
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        main.postDelayed({
          openings.remove(id)?.let { pending ->
            pending.reject("ERR_SCREEN_OPEN", "Pregătirea videoclipului a durat prea mult.", null)
            release(id)
          }
        }, 30_000)
        tick()
      } catch (error: Exception) {
        release(id)
        promise.reject("ERR_SCREEN_OPEN", error.message, error)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("layout") { id: String, json: String ->
      ScreenPlayers.players[id]?.let { player ->
        val time = player.currentPosition
        val playing = player.playWhenReady
        player.setVideoEffects(listOf(ScreenEffect(json)))
        // Flushing preparation makes changes visible on a paused frame as well.
        player.seekTo(time)
        player.playWhenReady = playing
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("play") { id: String ->
      ScreenPlayers.players[id]?.let { player -> if (player.playbackState == Player.STATE_ENDED) player.seekTo(0); player.play() }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("pause") { id: String -> ScreenPlayers.players[id]?.pause(); Unit }.runOnQueue(Queues.MAIN)
    AsyncFunction("seek") { id: String, seconds: Double ->
      ScreenPlayers.players[id]?.let { player -> if (seconds.isFinite()) player.seekTo((seconds * 1000).toLong().coerceIn(0, player.duration.coerceAtLeast(0))) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("release") { id: String -> release(id) }.runOnQueue(Queues.MAIN)

    AsyncFunction("render") { id: String, uri: String, output: String, json: String, promise: Promise ->
      try {
        require(Uri.parse(uri).scheme == "file" && Uri.parse(output).scheme == "file")
        val context = requireNotNull(appContext.reactContext)
        val effect = ScreenEffect(json)
        val transformer = Transformer.Builder(context)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setAudioMimeType(MimeTypes.AUDIO_AAC)
          .setEncoderFactory(DefaultEncoderFactory.Builder(context).setEnableFallback(false).build())
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              val entry = exports.remove(id) ?: return
              if (exportResult.width != 2304 || exportResult.height != 512) {
                entry.second.reject("ERR_SCREEN_SIZE", "Telefonul nu poate produce exact 2304 × 512.", null)
              } else {
                sendEvent("onProgress", mapOf("id" to id, "progress" to 1))
                entry.second.resolve(null)
              }
            }
            override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
              exports.remove(id)?.second?.reject("ERR_SCREEN_CONVERSION", "Conversia H.264 la 2304 × 512 a eșuat. Verifică formatul sursei și spațiul disponibil.", exportException)
            }
          }).build()
        exports[id] = Pair(transformer, promise)
        val item = EditedMediaItem.Builder(MediaItem.fromUri(uri)).setEffects(Effects(emptyList(), listOf(effect))).build()
        transformer.start(item, requireNotNull(Uri.parse(output).path))
        tick()
      } catch (error: Exception) {
        exports.remove(id)?.first?.cancel()
        promise.reject("ERR_SCREEN_CONVERSION", error.message, error)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancel") { id: String -> cancel(id) }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground {
      main.post {
        owned.forEach { ScreenPlayers.players[it]?.pause() }
        exports.keys.toList().forEach { cancel(it) }
      }
    }
    OnDestroy {
      main.post {
        main.removeCallbacks(ticker)
        owned.toList().forEach { release(it) }
        exports.keys.toList().forEach { cancel(it) }
      }
    }
  }

  private fun tick() { main.removeCallbacks(ticker); main.post(ticker) }
  private fun release(id: String) {
    ScreenPlayers.players.remove(id)?.release()
    openings.remove(id)?.reject("ERR_SCREEN_CANCELLED", "Previzualizarea a fost închisă.", null)
    owned.remove(id)
  }
  private fun cancel(id: String) {
    val entry = exports.remove(id) ?: return
    entry.first.cancel()
    entry.second.reject("ERR_SCREEN_CANCELLED", "Conversia a fost anulată.", null)
  }
}
