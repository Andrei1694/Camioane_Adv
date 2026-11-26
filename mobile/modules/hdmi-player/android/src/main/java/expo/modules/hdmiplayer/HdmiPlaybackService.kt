package expo.modules.hdmiplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/** Keeps the module's player eligible while the activity is in the background. */
class HdmiPlaybackService : Service() {
  override fun onCreate() {
    super.onCreate()
    val channel = "hdmi-playback"
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel(channel, "HDMI playback", NotificationManager.IMPORTANCE_LOW))
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channel) else Notification.Builder(this)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("Playing on HDMI")
      .setContentText("Open Camioane Driver to pause or stop playback.")
      .setCategory(Notification.CATEGORY_TRANSPORT)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .apply {
        if (launch != null) setContentIntent(PendingIntent.getActivity(
          this@HdmiPlaybackService, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        ))
      }.build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else startForeground(1, notification)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
