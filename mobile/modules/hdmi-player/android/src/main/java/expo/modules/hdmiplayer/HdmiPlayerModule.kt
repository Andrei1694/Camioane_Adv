package expo.modules.hdmiplayer

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

@UnstableApi
class HdmiPlayerModule : Module(), DisplayManager.DisplayListener {
  private val main = Handler(Looper.getMainLooper())
  private var sessionId: String? = null
  private var manager: DisplayManager? = null
  private var presentation: VideoPresentation? = null
  private var player: ExoPlayer? = null
  private var wantsPlayback = false
  private var playback = "idle"
  private var error: String? = null
  private var foreground = false
  private var preparationPromise: Promise? = null
  private var generation = 0
  private var releasing = false
  private var mediaCleanupFailed = false
  private val cleanupMessage = "The video could not be released. Leave this screen and try again."

  override fun definition() = ModuleDefinition {
    Name("HdmiPlayer")
    Events("onStatus")

    AsyncFunction("start") { id: String ->
      releasePlayer()
      sessionId = id
      // Startup may reach the main queue after the activity has backgrounded.
      foreground = (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState
        ?.isAtLeast(Lifecycle.State.RESUMED) == true
      val context = requireNotNull(appContext.reactContext) { "The app is not ready." }
      manager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
      manager?.registerDisplayListener(this@HdmiPlayerModule, main)
      refreshDisplay()
      status()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("prepare") { id: String, uri: String, promise: Promise ->
      if (sessionId == id && !releasing) {
        prepareVideo(uri, promise)
      } else {
        promise.reject("ERR_HDMI_SESSION_ENDED", "The HDMI session has ended.", null)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { id: String ->
      if (sessionId == id) {
        check(!releasing && !mediaCleanupFailed) { cleanupMessage }
        check(foreground && presentation?.isShowing == true) { "Connect an HDMI display and keep the app open." }
        check(playback in listOf("ready", "paused", "stopped")) { "Choose a playable video first." }
        wantsPlayback = true
        playback = "buffering"
        presentation?.showVideo(true)
        emitStatus()
        player?.play()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { id: String ->
      if (sessionId == id) pauseVideo()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") { id: String ->
      if (sessionId == id) {
        check(!releasing && !mediaCleanupFailed) { cleanupMessage }
        wantsPlayback = false
        if (playback in listOf("ready", "playing", "buffering", "paused", "stopped")) playback = "stopped"
        presentation?.showVideo(false)
        player?.pause()
        player?.seekTo(0)
        emitStatus()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("release") { id: String ->
      if (sessionId == id) releasePlayer()
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground {
      main.post {
        foreground = false
        pauseVideo()
        presentation?.showVideo(false)
      }
    }
    OnActivityEntersForeground {
      main.post {
        foreground = true
        refreshDisplay()
      }
    }
    OnDestroy {
      main.post {
        runCatching { releasePlayer() }.recoverCatching { releasePlayer() }
      }
    }
  }

  private fun status(): Map<String, Any?> {
    val display = presentation?.display?.takeIf { it.isValid && presentation?.isShowing == true }
    return mapOf(
      "sessionId" to (sessionId ?: ""),
      "display" to display?.let {
        mapOf("name" to it.name, "width" to it.mode.physicalWidth, "height" to it.mode.physicalHeight)
      },
      "playback" to playback,
      "error" to error
    )
  }

  private fun emitStatus() {
    if (sessionId != null && !releasing) sendEvent("onStatus", status())
  }

  private fun refreshDisplay() {
    if (sessionId == null || releasing || !foreground) return
    val activity = appContext.currentActivity ?: return
    val displayManager = manager ?: return
    // New Android versions can offer built-in secondary screens as presentations.
    // Older versions return an empty list for this newer category.
    @Suppress("DEPRECATION")
    val phoneDisplayId = activity.windowManager.defaultDisplay.displayId
    val internalIds = (displayManager.getDisplays("android.hardware.display.category.BUILT_IN_DISPLAYS") +
      displayManager.getDisplays("android.hardware.display.category.REAR"))
      .map { it.displayId }.toSet() + Display.DEFAULT_DISPLAY + phoneDisplayId
    val eligible = displayManager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)
      .filter { it.isValid && it.displayId !in internalIds }
    val current = presentation
    // Display enumeration can change when another screen is added or updated.
    // Retain our valid output instead of interrupting it to pick the first entry.
    if (current?.isShowing == true && current.display.isValid &&
      eligible.any { it.displayId == current.display.displayId }) {
      emitStatus()
      return
    }
    val display = eligible.minByOrNull { it.displayId }
    pauseVideo()
    dismissPresentation()
    if (display != null && !activity.isFinishing && !activity.isDestroyed) {
      try {
        val next = VideoPresentation(activity, display)
        next.setOnDismissListener {
          if (presentation === next) {
            next.attach(null)
            presentation = null
            pauseVideo()
            emitStatus()
          }
        }
        next.show()
        presentation = next
        next.attach(player)
        next.showVideo(false)
        // A recovered display error must not mask a decoder error.
        if (playback != "error" && !mediaCleanupFailed) error = null
      } catch (_: WindowManager.InvalidDisplayException) {
        error = "The HDMI display disconnected. Reconnect the cable and try again."
      } catch (_: WindowManager.BadTokenException) {
        error = "The HDMI display is unavailable. Return to this screen and try again."
      }
    }
    emitStatus()
  }

  private fun prepareVideo(uri: String, promise: Promise) {
    val previousPreparation = takePreparation()
    try {
      clearVideo()
    } catch (failure: Exception) {
      reportCleanupFailure()
      previousPreparation?.reject("ERR_HDMI_CLEANUP_FAILED", cleanupMessage, failure)
      promise.reject("ERR_HDMI_CLEANUP_FAILED", cleanupMessage, failure)
      return
    }
    previousPreparation?.reject("ERR_HDMI_CANCELLED", "Video preparation was cancelled.", null)
    preparationPromise = promise
    mediaCleanupFailed = false
    error = null
    playback = "loading"
    emitStatus()
    val expectedGeneration = generation
    try {
      val parsed = Uri.parse(uri)
      check(parsed.scheme == "file" && File(requireNotNull(parsed.path)).let { it.isFile && it.canRead() && it.length() > 0 }) {
        "The selected video could not be read. Choose the file again."
      }
      val context = requireNotNull(appContext.reactContext)
      val next = ExoPlayer.Builder(context).build()
      player = next
      next.volume = 0f
      next.repeatMode = Player.REPEAT_MODE_ONE
      next.trackSelectionParameters = next.trackSelectionParameters.buildUpon()
        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        .build()
      next.addListener(object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
          if (player !== next || generation != expectedGeneration) return
          if (state == Player.STATE_READY && playback == "loading") {
            if (!next.currentTracks.groups.any { it.type == C.TRACK_TYPE_VIDEO && it.isSupported }) {
              fail("This file has no supported video track. Try an H.264 MP4 video.")
              return
            }
            playback = "ready"
            emitStatus()
            takePreparation()?.resolve()
          }
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
          if (player !== next || generation != expectedGeneration) return
          // A native pause clears intent even if its cause is only temporary.
          if (!playWhenReady && wantsPlayback) pauseVideo()
        }

        override fun onPlaybackSuppressionReasonChanged(reason: Int) {
          if (player !== next || generation != expectedGeneration) return
          if (reason != Player.PLAYBACK_SUPPRESSION_REASON_NONE && wantsPlayback) pauseVideo()
        }

        override fun onEvents(player: Player, events: Player.Events) {
          if (this@HdmiPlayerModule.player !== next || generation != expectedGeneration) return
          // Read a coherent snapshot after the individual native events settle.
          reconcilePlayback(next)
        }

        override fun onPlayerError(exception: PlaybackException) {
          if (player === next && generation == expectedGeneration) {
            fail("This video could not be played. Try a local H.264 MP4 video.")
          }
        }
      })
      presentation?.attach(next)
      next.setMediaItem(MediaItem.fromUri(parsed))
      next.prepare()
    } catch (_: Exception) {
      fail("The selected video could not be opened. Choose a readable local video file.")
    }
  }

  private fun reconcilePlayback(next: ExoPlayer) {
    if (sessionId == null || releasing || mediaCleanupFailed) return
    if (!wantsPlayback) {
      // Keep explicit Stop/Pause and terminal states when late events arrive.
      if (next.playWhenReady) next.pause()
      return
    }
    if (!foreground || presentation?.isShowing != true || presentation?.display?.isValid != true ||
      !next.playWhenReady || next.playbackSuppressionReason != Player.PLAYBACK_SUPPRESSION_REASON_NONE) {
      pauseVideo()
      return
    }
    val state = when (next.playbackState) {
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> "playing"
      else -> {
        pauseVideo()
        return
      }
    }
    if (playback != state) {
      playback = state
      emitStatus()
    }
  }

  private fun fail(message: String) {
    val pending = takePreparation()
    try {
      clearVideo()
    } catch (failure: Exception) {
      reportCleanupFailure()
      pending?.reject("ERR_HDMI_CLEANUP_FAILED", cleanupMessage, failure)
      return
    }
    playback = "error"
    error = message
    emitStatus()
    pending?.reject("ERR_HDMI_PREPARE_FAILED", message, null)
  }

  private fun takePreparation(): Promise? {
    val pending = preparationPromise
    preparationPromise = null
    return pending
  }

  private fun reportCleanupFailure() {
    mediaCleanupFailed = true
    // Only emit the terminal media-error state after the file has been detached.
    // Keep ownership when teardown failed so JavaScript cannot delete a live file.
    playback = "paused"
    error = cleanupMessage
    emitStatus()
  }

  private fun clearVideo() {
    wantsPlayback = false
    generation += 1
    cleanup(
      { presentation?.showVideo(false) },
      { presentation?.attach(null) },
      {
        player?.release()
        // Retain the reference if release throws, so a later attempt can retry.
        player = null
      }
    )
  }

  private fun cleanup(vararg actions: () -> Unit) {
    var failure: Exception? = null
    for (action in actions) {
      try {
        action()
      } catch (exception: Exception) {
        if (failure == null) failure = exception
      }
    }
    failure?.let { throw it }
  }

  private fun pauseVideo() {
    if (releasing || mediaCleanupFailed) return
    val wasPlaying = wantsPlayback || playback in listOf("playing", "buffering")
    wantsPlayback = false
    if (wasPlaying) playback = "paused"
    player?.pause()
    emitStatus()
  }

  private fun dismissPresentation() {
    val previous = presentation ?: return
    previous.setOnDismissListener(null)
    cleanup(
      { previous.attach(null) },
      { previous.dismiss() }
    )
    if (presentation === previous) presentation = null
  }

  private fun releasePlayer() {
    releasing = true
    val pending = takePreparation()
    try {
      cleanup(
        { clearVideo() },
        {
          manager?.unregisterDisplayListener(this)
          manager = null
        },
        { dismissPresentation() }
      )
    } catch (failure: Exception) {
      pending?.reject("ERR_HDMI_CLEANUP_FAILED", cleanupMessage, failure)
      // Preserve the session ID and failed resources: release(id) must retry
      // rather than acknowledge a no-op while a native reader still exists.
      throw failure
    }
    pending?.reject("ERR_HDMI_CANCELLED", "Video preparation was cancelled.", null)
    sessionId = null
    releasing = false
    mediaCleanupFailed = false
    playback = "idle"
    error = null
  }

  override fun onDisplayAdded(displayId: Int) = refreshDisplay()
  override fun onDisplayChanged(displayId: Int) = refreshDisplay()
  override fun onDisplayRemoved(displayId: Int) {
    if (sessionId == null || releasing) return
    if (presentation?.display?.displayId == displayId) {
      pauseVideo()
      dismissPresentation()
      emitStatus()
    }
    refreshDisplay()
  }
}

@UnstableApi
private class VideoPresentation(context: Context, display: Display) : Presentation(context, display) {
  private lateinit var video: PlayerView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val root = FrameLayout(context).apply { setBackgroundColor(Color.BLACK) }
    video = PlayerView(context).apply {
      useController = false
      resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
      setShutterBackgroundColor(Color.BLACK)
      setKeepContentOnPlayerReset(false)
      subtitleView?.visibility = View.GONE
      visibility = View.INVISIBLE
    }
    root.addView(video, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    setContentView(root)
    window?.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_FULLSCREEN)
    window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    @Suppress("DEPRECATION")
    window?.decorView?.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
  }

  fun attach(player: Player?) {
    if (::video.isInitialized) video.player = player
  }

  fun showVideo(show: Boolean) {
    if (::video.isInitialized) video.visibility = if (show) View.VISIBLE else View.INVISIBLE
  }
}
