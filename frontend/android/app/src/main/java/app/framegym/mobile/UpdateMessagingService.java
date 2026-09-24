package app.framegym.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONObject;

/** Data-only updates let Android apply the saved TGym sound, including while closed. */
public class UpdateMessagingService extends MessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        if (!"app_update".equals(message.getData().get("type")) || message.getNotification() != null) return;
        String version = message.getData().get("version");
        if (version == null || !version.matches("\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?")) return;
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return;
        try {
            if (!newerVersion(version, getPackageManager().getPackageInfo(getPackageName(), 0).versionName)) return;
            JSONObject config = SoundPreferences.config(this);
            Intent intent = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("google.message_id", message.getMessageId() == null ? "tgym-update-" + version : message.getMessageId())
                .putExtra("type", "app_update").putExtra("version", version);
            PendingIntent tap = PendingIntent.getActivity(this, 3300, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder notice = new NotificationCompat.Builder(this, SoundPreferences.notificationChannel(this, System.currentTimeMillis()))
                .setSmallIcon(R.drawable.ic_workout_notification).setContentTitle("TGym " + version)
                .setContentText(config.optString("updateLabel", "Update available"))
                .setContentIntent(tap).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH);
            try { notice.setColor(android.graphics.Color.parseColor(config.optString("accentColor"))); } catch (IllegalArgumentException ignored) {}
            if (Build.VERSION.SDK_INT < 26) {
                boolean quiet = SoundPreferences.quiet(config, System.currentTimeMillis());
                notice.setSound(!quiet && config.optBoolean("enabled", true) ? SoundPreferences.soundUri(this, config, "notification") : null);
                notice.setVibrate(!quiet && config.optBoolean("vibration", true) ? new long[]{0,200,100,200} : new long[]{0});
            }
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(3300, notice.build());
        } catch (Exception error) { android.util.Log.w("TGymUpdate", "Unable to display update notification", error); }
    }

    static boolean newerVersion(String candidate, String current) {
        String[] left = candidate.split("[-.]"); String[] right = current.split("[-.]");
        for (int index = 0; index < 3; index++) {
            int comparison = new java.math.BigInteger(left[index]).compareTo(new java.math.BigInteger(right[index]));
            if (comparison != 0) return comparison > 0;
        }
        return false;
    }
}
