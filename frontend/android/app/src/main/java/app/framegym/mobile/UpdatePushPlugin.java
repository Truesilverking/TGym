package app.framegym.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "UpdatePush")
public class UpdatePushPlugin extends Plugin {
    @PluginMethod
    public void subscribe(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().subscribeToTopic("tgym_updates")
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) { call.reject("Could not subscribe to TGym updates", task.getException()); return; }
                    JSObject result = new JSObject(); result.put("subscribed", true); call.resolve(result);
                });
        } catch (RuntimeException error) {
            // Firebase is optional. A missing configuration must never stop TGym.
            call.reject("Update notifications are not configured", "not_configured", error);
        }
    }
}
