package com.thmar.quran

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.getcapacitor.JSObject

@OptIn(UnstableApi::class)
@CapacitorPlugin(name = "BackgroundOperation", permissions = [Permission(alias = "notifications", strings = ["android.permission.POST_NOTIFICATIONS"])])
class BackgroundOperationPlugin : Plugin() {
    private var controllerFuture: ListenableFuture<MediaController>? = null

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val pm = context.getSystemService(PowerManager::class.java)
        val notifications = if (android.os.Build.VERSION.SDK_INT >= 33) context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == android.content.pm.PackageManager.PERMISSION_GRANTED else true
        val battery = pm?.isIgnoringBatteryOptimizations(context.packageName) == true
        val ret = JSObject().apply {
            put("native", true)
            put("notificationsGranted", notifications)
            put("batteryOptimizationDisabled", battery)
            put("mediaPlaybackPermission", true)
            put("backgroundEnabled", notifications && battery)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun requestNotifications(call: PluginCall) {
        if (android.os.Build.VERSION.SDK_INT >= 33) requestPermissionForAlias("notifications", call, "notifications") else call.resolve()
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val type = call.getString("type") ?: "app"
        val intent = when (type) {
            "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
        }
        try { context.startActivity(intent); call.resolve() } catch (_: Exception) { call.reject("Unable to open Android settings") }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val uri = call.getString("uri") ?: return call.reject("Audio uri is required")
        val intent = Intent(context, QuranPlaybackService::class.java)
        androidx.core.content.ContextCompat.startForegroundService(context, intent)
        val token = SessionToken(context, ComponentName(context, QuranPlaybackService::class.java))
        controllerFuture = MediaController.Builder(context, token).buildAsync()
        controllerFuture!!.addListener({
            controllerFuture!!.get().setMediaItem(MediaItem.fromUri(uri))
            controllerFuture!!.get().prepare()
            controllerFuture!!.get().play()
            call.resolve()
        }, MoreExecutors.directExecutor())
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        controllerFuture?.get()?.stop()
        controllerFuture?.get()?.release()
        controllerFuture = null
        call.resolve()
    }
}
