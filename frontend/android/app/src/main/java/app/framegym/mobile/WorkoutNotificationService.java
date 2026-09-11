package app.framegym.mobile;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.*;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.util.Locale;

/** Native chronometers render seconds; only phase boundaries/minute labels update here. */
public class WorkoutNotificationService extends Service {
    private static final String CHANNEL="tgym_workout_live";
    private static final int ID=3100;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private JSONObject state=new JSONObject();
    private final Runnable refresh=()->render();
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        try {
            String raw=intent==null?getSharedPreferences(CHANNEL,0).getString("state",null):intent.getStringExtra("state");
            if(raw==null){stopSelf();return START_NOT_STICKY;}
            state=new JSONObject(raw);
            getSharedPreferences(CHANNEL,0).edit().putString("state",raw).apply();
            render();
            return START_STICKY;
        } catch(Exception error){stopSelf();return START_NOT_STICKY;}
    }
    private String duration(long millis){
        long seconds=Math.max(0,millis/1000);
        return seconds>=3600?String.format(Locale.ROOT,"%dh %dm",seconds/3600,(seconds%3600)/60):String.format(Locale.ROOT,"%02d:%02d",seconds/60,seconds%60);
    }
    private void render(){
        handler.removeCallbacks(refresh);
        long now=System.currentTimeMillis(), elapsed=Math.max(0,state.optLong("elapsedMs")+(state.optBoolean("paused")?0:now-state.optLong("observedAt",now)));
        long autoAt=state.optLong("autoFinishAt",0);
        if(autoAt>0 && now>=autoAt){stopForeground(true);stopSelf();return;}
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(CHANNEL,"TGym · Workout",NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);
        }
        Intent open=new Intent(this,MainActivity.class).setData(Uri.parse("tgym://workout")).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap=PendingIntent.getActivity(this,3100,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        RemoteViews content=new RemoteViews(getPackageName(),R.layout.workout_notification);
        content.setTextViewText(R.id.workout_label,state.optString("workoutLabel","Workout"));
        boolean live=!state.optBoolean("paused") && elapsed<3600000;
        content.setViewVisibility(R.id.workout_clock,live?View.VISIBLE:View.GONE);
        content.setViewVisibility(R.id.workout_duration,live?View.GONE:View.VISIBLE);
        content.setTextViewText(R.id.workout_duration,duration(elapsed));
        content.setChronometer(R.id.workout_clock,SystemClock.elapsedRealtime()-elapsed,null,live);
        long rest=state.optLong("restEndsAt")-now;
        content.setViewVisibility(R.id.rest_row,rest>0?View.VISIBLE:View.GONE);
        content.setTextViewText(R.id.rest_label,state.optString("restLabel","Rest"));
        if(rest>0){
            if(Build.VERSION.SDK_INT>=24){content.setChronometerCountDown(R.id.rest_clock,true);content.setChronometer(R.id.rest_clock,SystemClock.elapsedRealtime()+rest,null,true);}
            else {content.setChronometer(R.id.rest_clock,SystemClock.elapsedRealtime(),duration(rest),false);}
        }
        Notification notice=new NotificationCompat.Builder(this,CHANNEL)
            .setSmallIcon(R.drawable.ic_workout_notification).setContentTitle("TGym · "+state.optString("name","Workout"))
            .setContentText(state.optString("workoutLabel","Workout")+" "+duration(elapsed))
            .setCustomContentView(content).setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(tap).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW).build();
        try {
            if(Build.VERSION.SDK_INT>=34)startForeground(ID,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(ID,notice);
        }catch(RuntimeException error){stopSelf();return;}
        long delay=state.optBoolean("paused")?Long.MAX_VALUE:60000-elapsed%60000;
        if(rest>0)delay=Math.min(delay,Build.VERSION.SDK_INT>=24?rest:1000);
        if(autoAt>now)delay=Math.min(delay,autoAt-now);
        if(delay!=Long.MAX_VALUE)handler.postDelayed(refresh,Math.max(100,delay));
    }
    @Override public void onDestroy(){handler.removeCallbacks(refresh);getSharedPreferences(CHANNEL,0).edit().remove("state").apply();stopForeground(true);super.onDestroy();}
}
