package com.roadassist.navnotification

import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NavNotificationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NavNotification")
    AsyncFunction("update") { title: String, body: String, progress: Double ->
      try {
        val context = appContext.reactContext ?: return@AsyncFunction
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = NotificationCompat.Builder(context, "hazard")
          .setContentTitle(title)
          .setContentText(body)
          .setSmallIcon(context.applicationInfo.icon)
          .setOngoing(true)
          .setOnlyAlertOnce(true)
          .setProgress(100, (progress * 100).toInt().coerceIn(0, 100), false)
          .build()
        manager.notify(NAV_NOTIFICATION_ID, notification)
      } catch (_: Exception) {
      }
    }
    AsyncFunction("clear") {
      try {
        val context = appContext.reactContext ?: return@AsyncFunction
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NAV_NOTIFICATION_ID)
      } catch (_: Exception) {
      }
    }
  }

  companion object {
    const val NAV_NOTIFICATION_ID = 8001
  }
}
