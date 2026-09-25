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
            getContext().stopService(intent);
            if (call.getBoolean("completed",false) && NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
                android.app.NotificationManager manager=(android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
                if(Build.VERSION.SDK_INT>=26) manager.createNotificationChannel(new android.app.NotificationChannel("tgym_workout_live","TGym · Workout",android.app.NotificationManager.IMPORTANCE_LOW));
                Intent open=new Intent(getContext(),MainActivity.class).setData(android.net.Uri.parse("tgym://workout")).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                android.app.PendingIntent tap=android.app.PendingIntent.getActivity(getContext(),3101,open,android.app.PendingIntent.FLAG_UPDATE_CURRENT|android.app.PendingIntent.FLAG_IMMUTABLE);
                long seconds=Math.max(0,call.getLong("elapsedMs",0L)/1000);
                String detail=String.format(java.util.Locale.ROOT,"%02d:%02d:%02d",seconds/3600,(seconds%3600)/60,seconds%60)+" · "+call.getString("progressLabel","");
                androidx.core.app.NotificationCompat.Builder notice=new androidx.core.app.NotificationCompat.Builder(getContext(),"tgym_workout_live")
                    .setSmallIcon(R.drawable.ic_workout_notification).setContentTitle(call.getString("workoutLabel","Workout complete!"))
                    .setContentText(call.getString("name","Workout")+" · "+detail).setStyle(new androidx.core.app.NotificationCompat.BigTextStyle().bigText(call.getString("name","Workout")+"\n"+detail))
                    .setContentIntent(tap).setAutoCancel(true).setSilent(true);
                try { notice.setColor(android.graphics.Color.parseColor(call.getString("accentColor",""))); } catch(IllegalArgumentException ignored) {}
                manager.notify(3101,notice.build());
            }
            call.resolve(); return;
        }
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            getContext().stopService(intent);
            JSObject result=new JSObject(); result.put("enabled",false); call.resolve(result); return;
        }
        intent.putExtra("state",call.getData().toString());
        NotificationManagerCompat.from(getContext()).cancel(3101);
        try {
            if(Build.VERSION.SDK_INT>=26) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            JSObject result=new JSObject(); result.put("enabled",true); call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Workout notification unavailable",error);
        }
    }
}
