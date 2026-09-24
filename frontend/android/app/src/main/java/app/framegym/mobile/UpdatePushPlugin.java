package app.framegym.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "UpdatePush")
public class UpdatePushPlugin extends Plugin {
    private static final String CHANNEL_ID = "tgym_updates";

    @com.getcapacitor.PluginMethod
    public void subscribe(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
                    manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "TGym updates", NotificationManager.IMPORTANCE_HIGH));
                }
            }
            FirebaseMessaging.getInstance().subscribeToTopic("tgym_updates_v2")
                .addOnSuccessListener(unused -> FirebaseMessaging.getInstance().unsubscribeFromTopic("tgym_updates")
                    .addOnSuccessListener(removed -> call.resolve())
                    .addOnFailureListener(error -> call.reject("Update subscription migration incomplete", error)))
                .addOnFailureListener(error -> call.reject("Update notifications unavailable", error));
        } catch (Exception error) {
            call.reject("Update notifications unavailable", error);
        }
    }
}
