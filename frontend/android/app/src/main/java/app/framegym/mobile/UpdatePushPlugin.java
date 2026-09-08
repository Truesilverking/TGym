package app.framegym.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "UpdatePush")
public class UpdatePushPlugin extends Plugin {
    @com.getcapacitor.PluginMethod
    public void subscribe(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().subscribeToTopic("tgym_updates")
                .addOnSuccessListener(unused -> call.resolve())
                .addOnFailureListener(error -> call.reject("Update notifications unavailable", error));
        } catch (Exception error) {
            call.reject("Update notifications unavailable", error);
        }
    }
}
