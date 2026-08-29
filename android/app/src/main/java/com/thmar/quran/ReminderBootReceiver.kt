package com.thmar.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_TIMEZONE_CHANGED || intent.action == Intent.ACTION_TIME_CHANGED) {
            // Capacitor Local Notifications persists scheduled alarms; this receiver is the explicit
            // native restart hook for future reminder rescheduling. No hidden background loop is used.
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }
}
