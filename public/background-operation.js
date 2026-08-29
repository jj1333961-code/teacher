(function () {
  const plugin = window.Capacitor?.Plugins?.BackgroundOperation;
  const isNative = Boolean(plugin);
  const $ = (id) => document.getElementById(id);
  function setText(id, text, state) { const el = $(id); if (el) { el.textContent = text; el.className = `background-status ${state || ''}`; } }
  async function refreshBackgroundStatus() {
    if (!isNative) {
      setText('backgroundOperationStatus', 'يتطلب التشغيل الخلفي المضمون تطبيق Android الأصلي.', 'warning');
      setText('batteryStatus', 'غير متاح في المتصفح', 'warning');
      setText('notificationStatus', 'غير متاح في المتصفح', 'warning');
      return;
    }
    try {
      const status = await plugin.getStatus();
      setText('backgroundOperationStatus', status.backgroundEnabled ? 'Background operation is enabled.' : 'Background operation requires your permission.', status.backgroundEnabled ? 'ok' : 'warning');
      setText('batteryStatus', status.batteryOptimizationDisabled ? 'تم السماح بالتشغيل دون قيود البطارية.' : 'تحسين البطارية مفعّل وقد يوقف الخدمة.', status.batteryOptimizationDisabled ? 'ok' : 'warning');
      setText('notificationStatus', status.notificationsGranted ? 'إشعارات الخدمة مسموحة.' : 'إذن الإشعارات مرفوض.', status.notificationsGranted ? 'ok' : 'warning');
    } catch (_) { setText('backgroundOperationStatus', 'Background operation requires your permission.', 'warning'); }
  }
  window.openBackgroundOperationSettings = function () { $('backgroundOperationScreen')?.classList.remove('hidden'); refreshBackgroundStatus(); };
  window.closeBackgroundOperationSettings = function () { $('backgroundOperationScreen')?.classList.add('hidden'); };
  window.requestBackgroundNotifications = async function () { if (plugin) { await plugin.requestNotifications(); await refreshBackgroundStatus(); } };
  window.openBackgroundAndroidSettings = async function (type) { if (plugin) { await plugin.openSettings({ type }); setTimeout(refreshBackgroundStatus, 900); } };
  window.enableQuranBackgroundAudio = async function (uri) { if (plugin) return plugin.play({ uri }); return false; };
  window.stopQuranBackgroundAudio = async function () { if (plugin) return plugin.stop(); return false; };
  window.scheduleBackgroundReminder = async function (id, title, body, atMillis) {
    const notifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!notifications) return { native: false, message: 'Scheduled reminders require the Android app.' };
    await notifications.requestPermissions();
    await notifications.schedule({ notifications: [{ id: Number(id), title: title || 'THMAR Quran', body: body || 'لديك تذكير في THMAR Quran', schedule: { at: new Date(atMillis), allowWhileIdle: false }, smallIcon: 'ic_stat_icon_config_sample' }] });
    return { native: true };
  };
  window.cancelBackgroundReminder = async function (id) { const notifications = window.Capacitor?.Plugins?.LocalNotifications; if (notifications) await notifications.cancel({ notifications: [{ id: Number(id) }] }); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBackgroundStatus(); });
  window.addEventListener('load', refreshBackgroundStatus);
})();
