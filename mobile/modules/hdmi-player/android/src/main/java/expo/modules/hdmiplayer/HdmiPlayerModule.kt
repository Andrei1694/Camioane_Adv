package expo.modules.hdmiplayer

import android.app.Presentation
import android.content.Context
import android.content.Intent
import android.os.Build
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.Gravity
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
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.math.roundToInt

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
  private var index: Int? = null
  private var count = 0
  private var placement = HdmiPlacement()
  private var videoWidth = 0.0
  private var videoHeight = 0.0
  private var patternEnabled = false
  private var sessionExpiresAt: Double? = null
  private var sessionExpired = false
  private var expiryTask: Runnable? = null
  private val expiryMessage = "Your session expired. Please sign in again."
  private var foreground = false
  private var preparationPromise: Promise? = null
  private var generation = 0
  private var releasing = false
  private var mediaCleanupFailed = false
  private val cleanupMessage = "The video could not be released. Leave this screen and try again."

  override fun definition() = ModuleDefinition {
    Name("HdmiPlayer")
    Events("onStatus")

    AsyncFunction("start") { id: String, expiresAt: Double? ->
      releasePlayer()
      sessionId = id
      sessionExpiresAt = expiresAt
      scheduleExpiry()
      // Startup may reach the main queue after the activity has backgrounded.
      foreground = (appContext.currentActivity as? LifecycleOwner)?.lifecycle?.currentState
        ?.isAtLeast(Lifecycle.State.RESUMED) == true
      val context = requireNotNull(appContext.reactContext) { "The app is not ready." }
      manager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
      manager?.registerDisplayListener(this@HdmiPlayerModule, main)
      refreshDisplay()
      status()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("prepare") { id: String, uris: List<String>, startIndex: Int?, promise: Promise ->
      if (sessionId == id && !releasing) {
        if (expireSessionIfNeeded()) {
          promise.reject(if (mediaCleanupFailed) "ERR_HDMI_CLEANUP_FAILED" else "ERR_HDMI_PREPARE_FAILED", expiryMessage, null)
        } else prepareVideo(uris, startIndex ?: 0, promise)
      } else {
        promise.reject("ERR_HDMI_SESSION_ENDED", "The HDMI session has ended.", null)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setPlacement") { id: String, x: Double, y: Double, scale: Double, promise: Promise ->
      if (validateSession(id, promise)) {
        if (!x.isFinite() || !y.isFinite() || x % 1.0 != 0.0 || y % 1.0 != 0.0 ||
          x !in -4096.0..4096.0 || y !in -4096.0..4096.0 || !scale.isFinite() || scale !in 0.1..4.0) {
          promise.reject("ERR_HDMI_PLACEMENT", "X/Y must be integers from -4096 to 4096; scale must be from 0.1 to 4.", null)
        } else {
          placement = HdmiPlacement(x.toInt(), y.toInt(), scale)
          applyPlacement()
          emitStatus()
          promise.resolve()
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setPattern") { id: String, enabled: Boolean, promise: Promise ->
      if (validateSession(id, promise)) {
        patternEnabled = enabled
        presentation?.showPattern(enabled)
        emitStatus()
        promise.resolve()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("skip") { id: String, target: Int ->
      if (sessionId == id && !expireSessionIfNeeded()) {
        check(!releasing && !mediaCleanupFailed) { cleanupMessage }
        if (target in 0 until count && playback in listOf("ready", "playing", "buffering", "paused", "stopped")) {
          player?.seekTo(target, 0)
          index = target
          emitStatus()
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { id: String ->
      if (sessionId == id && !expireSessionIfNeeded()) {
        check(!releasing && !mediaCleanupFailed) { cleanupMessage }
        check(foreground && presentation?.isShowing == true) { "Connect an HDMI display and return to the app to press Play." }
        check(playback in listOf("ready", "paused", "stopped")) { "Choose a playable video first." }
        startService()
        error = null
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
        patternEnabled = false
        presentation?.showPattern(false)
        player?.pause()
        if (count > 0) {
          player?.seekTo(0, 0)
          index = 0
        }
        stopService()
        emitStatus()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("release") { id: String ->
      if (sessionId == id) releasePlayer()
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground {
      main.post {
        foreground = false
        if (Build.VERSION.SDK_INT < 30) {
          pauseVideo()
          presentation?.showVideo(false)
        }
      }
    }
    OnActivityEntersForeground {
      main.post {
        foreground = true
        if (!expireSessionIfNeeded()) refreshDisplay()
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
      "error" to error,
      "index" to index,
      "count" to count,
      "video" to if (videoWidth > 0 && videoHeight > 0) mapOf("width" to videoWidth, "height" to videoHeight) else null,
      "placement" to mapOf("x" to placement.x, "y" to placement.y, "scale" to placement.scale),
      "modes" to (display?.supportedModes?.map { mapOf("width" to it.physicalWidth, "height" to it.physicalHeight) }?.distinct() ?: emptyList()),
      "pattern" to patternEnabled
    )
  }

  private fun validateSession(id: String, promise: Promise): Boolean {
    if (sessionId != id || releasing || expireSessionIfNeeded()) {
      promise.reject("ERR_HDMI_SESSION_ENDED", "The HDMI session has ended.", null)
      return false
    }
    return true
  }

  private fun applyPlacement() {
    presentation?.applyPlacement(placement, videoWidth, videoHeight)
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
      applyPlacement()
      emitStatus()
      return
    }
    val display = eligible.minByOrNull { it.displayId }
    pauseVideo()
    dismissPresentation()
    if (display != null && !activity.isFinishing && !activity.isDestroyed) {
      try {
        val context = if (Build.VERSION.SDK_INT >= 30) {
          val displayContext = requireNotNull(appContext.reactContext).applicationContext.createDisplayContext(display)
          // TYPE_PRESENTATION is hidden in the public SDK. Ask an unshown
          // Presentation for its type (also handles private displays), without
          // borrowing the activity's window token or showing an extra window.
          val windowType = requireNotNull(Presentation(displayContext, display).window).attributes.type
          displayContext.createWindowContext(windowType, null)
        } else activity
        val next = VideoPresentation(context, display)
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
        applyPlacement()
        next.showPattern(patternEnabled)
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

  private fun prepareVideo(uris: List<String>, startIndex: Int, promise: Promise) {
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
    count = uris.size
    index = if (uris.isEmpty()) null else startIndex.coerceIn(0, uris.lastIndex)
    playback = if (uris.isEmpty()) "idle" else "loading"
    emitStatus()
    if (uris.isEmpty()) {
      takePreparation()?.resolve()
      return
    }
    val expectedGeneration = generation
    try {
      val items = uris.mapIndexed { itemIndex, uri ->
        val parsed = Uri.parse(uri)
        if (parsed.scheme != "file" || parsed.path == null ||
          !File(requireNotNull(parsed.path)).let { it.isFile && it.canRead() && it.length() > 0 }) {
          index = itemIndex
          fail("The selected video could not be read. Choose the file again.")
          return
        }
        MediaItem.fromUri(parsed)
      }
      val context = requireNotNull(appContext.reactContext)
      val next = ExoPlayer.Builder(context).build()
      player = next
      next.volume = 0f
      next.repeatMode = Player.REPEAT_MODE_ALL
      next.setWakeMode(C.WAKE_MODE_LOCAL)
      next.trackSelectionParameters = next.trackSelectionParameters.buildUpon()
        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        .build()
      next.addListener(object : Player.Listener {
        override fun onVideoSizeChanged(videoSize: VideoSize) {
          if (player !== next || generation != expectedGeneration) return
          val width = videoSize.width * videoSize.pixelWidthHeightRatio.toDouble()
          videoWidth = if (width.isFinite() && width > 0 && videoSize.height > 0) width else 0.0
          videoHeight = if (videoWidth > 0) videoSize.height.toDouble() else 0.0
          applyPlacement()
          emitStatus()
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
          if (player !== next || generation != expectedGeneration) return
          index = next.currentMediaItemIndex.takeIf { mediaItem != null }
          emitStatus()
        }

        override fun onTracksChanged(tracks: Tracks) {
          if (player !== next || generation != expectedGeneration) return
          if (!tracks.isEmpty && !tracks.groups.any { it.type == C.TRACK_TYPE_VIDEO && it.isSupported }) {
            index = next.currentMediaItemIndex
            fail("This file has no supported video track. Try an H.264 MP4 video.")
          }
        }

        override fun onPlaybackStateChanged(state: Int) {
          if (player !== next || generation != expectedGeneration) return
          if (state == Player.STATE_READY) {
            if (!next.currentTracks.groups.any { it.type == C.TRACK_TYPE_VIDEO && it.isSupported }) {
              fail("This file has no supported video track. Try an H.264 MP4 video.")
              return
            }
            if (playback == "loading") {
              playback = "ready"
              emitStatus()
              takePreparation()?.resolve()
            }
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
            index = next.currentMediaItemIndex
            fail("This video could not be played. Try a local H.264 MP4 video.")
          }
        }
      })
      presentation?.attach(next)
      next.setMediaItems(items, index ?: 0, 0)
      next.prepare()
    } catch (_: Exception) {
      fail("The selected video could not be opened. Choose a readable local video file.")
    }
  }

  private fun reconcilePlayback(next: ExoPlayer) {
    if (sessionId == null || releasing || mediaCleanupFailed || expireSessionIfNeeded()) return
    if (!wantsPlayback) {
      // Keep explicit Stop/Pause and terminal states when late events arrive.
      if (next.playWhenReady) next.pause()
      return
    }
    if ((!foreground && Build.VERSION.SDK_INT < 30) || presentation?.isShowing != true || presentation?.display?.isValid != true ||
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
    patternEnabled = false
    presentation?.showPattern(false)
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
    videoWidth = 0.0
    videoHeight = 0.0
    applyPlacement()
    cleanup(
      { stopService() },
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
    stopService()
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
    expiryTask?.let(main::removeCallbacks)
    expiryTask = null
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
    index = null
    count = 0
    placement = HdmiPlacement()
    patternEnabled = false
    sessionExpiresAt = null
    sessionExpired = false
  }

  private fun startService() {
    val context = requireNotNull(appContext.reactContext).applicationContext
    val intent = Intent(context, HdmiPlaybackService::class.java)
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
    else context.startService(intent)
  }

  private fun stopService() {
    val context = appContext.reactContext?.applicationContext ?: return
    context.stopService(Intent(context, HdmiPlaybackService::class.java))
  }

  private fun scheduleExpiry() {
    expiryTask?.let(main::removeCallbacks)
    val deadline = sessionExpiresAt ?: return
    if (expireSessionIfNeeded()) return
    val expected = sessionId
    val task = Runnable {
      if (sessionId == expected && !expireSessionIfNeeded()) scheduleExpiry()
    }
    expiryTask = task
    main.postDelayed(task, (deadline - System.currentTimeMillis()).toLong().coerceAtLeast(1))
  }

  private fun expireSessionIfNeeded(): Boolean {
    if (sessionExpired) return true
    val deadline = sessionExpiresAt ?: return false
    if (deadline.isFinite() && deadline > System.currentTimeMillis()) return false
    sessionExpired = true
    expiryTask?.let(main::removeCallbacks)
    expiryTask = null
    fail(expiryMessage)
    return true
  }

  override fun onDisplayAdded(displayId: Int) = refreshDisplay()
  override fun onDisplayChanged(displayId: Int) {
    if (presentation?.display?.displayId == displayId) {
      applyPlacement()
      emitStatus()
    }
    refreshDisplay()
  }
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

private data class HdmiPlacement(val x: Int = 0, val y: Int = 0, val scale: Double = 1.0)

@UnstableApi
private class VideoPresentation(context: Context, display: Display) : Presentation(context, display) {
  private lateinit var video: PlayerView
  private lateinit var pattern: CalibrationView
  private var videoVisible = false
  private var patternEnabled = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val root = FrameLayout(context).apply {
      setBackgroundColor(Color.BLACK)
      layoutDirection = View.LAYOUT_DIRECTION_LTR
      clipChildren = true
    }
    video = PlayerView(context).apply {
      useController = false
      resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
      setShutterBackgroundColor(Color.BLACK)
      setKeepContentOnPlayerReset(false)
      subtitleView?.visibility = View.GONE
      visibility = View.INVISIBLE
    }
    root.addView(video, FrameLayout.LayoutParams(0, 0, Gravity.TOP or Gravity.START))
    pattern = CalibrationView(context).apply { visibility = View.INVISIBLE }
    root.addView(pattern, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    setContentView(root)
    window?.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_FULLSCREEN or
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    @Suppress("DEPRECATION")
    window?.decorView?.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
  }

  fun attach(player: Player?) {
    if (::video.isInitialized) video.player = player
  }

  fun showVideo(show: Boolean) {
    videoVisible = show
    if (::video.isInitialized) video.visibility = if (show && !patternEnabled) View.VISIBLE else View.INVISIBLE
  }

  fun showPattern(enabled: Boolean) {
    patternEnabled = enabled
    if (::pattern.isInitialized) pattern.visibility = if (enabled) View.VISIBLE else View.INVISIBLE
    showVideo(videoVisible)
  }

  fun applyPlacement(placement: HdmiPlacement, videoW: Double, videoH: Double) {
    if (!::video.isInitialized) return
    // LayoutParams and translations are physical pixels in a Presentation, not dp.
    video.layoutParams = FrameLayout.LayoutParams((videoW * placement.scale).roundToInt(),
      (videoH * placement.scale).roundToInt(), Gravity.TOP or Gravity.START)
    video.translationX = placement.x.toFloat()
    video.translationY = placement.y.toFloat()
    pattern.invalidate()
  }
}

private class CalibrationView(context: Context) : View(context) {
  private val paint = Paint()
  private val accents = intArrayOf(Color.CYAN, Color.YELLOW, Color.MAGENTA, Color.GREEN)

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    canvas.drawColor(Color.BLACK)
    paint.isAntiAlias = false
    paint.strokeWidth = 1f
    paint.style = Paint.Style.STROKE
    for (vertical in listOf(true, false)) {
      for (position in 0 until (if (vertical) width else height) step 64) {
        paint.color = when {
          position % 512 == 0 -> accents[(position / 512) % accents.size]
          position % 128 == 0 -> Color.rgb(179, 179, 179)
          else -> Color.rgb(77, 77, 77)
        }
        val offset = position + 0.5f
        if (vertical) canvas.drawLine(offset, 0f, offset, height.toFloat(), paint)
        else canvas.drawLine(0f, offset, width.toFloat(), offset, paint)
      }
    }
    paint.style = Paint.Style.FILL
    paint.isAntiAlias = true
    paint.textSize = 12f
    paint.typeface = Typeface.MONOSPACE
    val metrics = paint.fontMetrics
    for (y in 0 until height step 128) {
      for (x in 0 until width step 128) {
        val label = "$x,$y"
        val labelWidth = paint.measureText(label)
        val left = (x + 4f).coerceAtMost(width - labelWidth - 2).coerceAtLeast(2f)
        val top = (y + 4f).coerceAtMost(height - (metrics.descent - metrics.ascent) - 2).coerceAtLeast(2f)
        paint.color = Color.BLACK
        canvas.drawRect(left, top, left + labelWidth, top + metrics.descent - metrics.ascent, paint)
        paint.color = Color.WHITE
        canvas.drawText(label, left, top - metrics.ascent, paint)
      }
    }
    paint.isAntiAlias = false
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 2f
    paint.color = Color.WHITE
    canvas.drawRect(1f, 1f, width - 1f, height - 1f, paint)
  }
}
