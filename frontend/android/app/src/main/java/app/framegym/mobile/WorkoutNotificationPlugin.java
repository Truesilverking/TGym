package app.framegym.mobile;

import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="WorkoutNotification")
public class WorkoutNotificationPlugin extends Plugin {
    @PluginMethod public void sync(PluginCall call) {
        Intent intent = new Intent(getContext(), WorkoutNotificationService.class);
        if (!call.getBoolean("active", false)) {
            getContext().stopService(intent); call.resolve(); return;
        }
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            getContext().stopService(intent);
            JSObject result=new JSObject(); result.put("enabled",false); call.resolve(result); return;
        }
        intent.putExtra("state",call.getData().toString());
        try {
            if(Build.VERSION.SDK_INT>=26) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            JSObject result=new JSObject(); result.put("enabled",true); call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Workout notification unavailable",error);
        }
    }
}
