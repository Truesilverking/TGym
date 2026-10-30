package app.framegym.mobile;

import android.app.*;
import android.content.Context;
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
    private int notificationColor() {
        try { return android.graphics.Color.parseColor(state.optString("accentColor")); }
        catch (IllegalArgumentException e) { return NotificationCompat.COLOR_DEFAULT; }
    }
    private static final String CHANNEL="tgym_workout_live";
    private static final int ID=3100;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private JSONObject state=new JSONObject();
    private final Runnable refresh=()->render();
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        try {
            String raw=intent==null?null:intent.getStringExtra("state");
            if(raw==null)raw=getSharedPreferences(CHANNEL,0).getString("state",null);
            if(raw==null){stopSelf();return START_NOT_STICKY;}
            // Keep a just-finished deadline when JS clears its visible timer. Playback
            // waits until startForeground below, as audio focus requires it on API 35.
            JSONObject previousSignals=state;
            state=new JSONObject(raw);
            // apply() updates SharedPreferences memory synchronously: the alarm receiver
            // sees this state before disk flush, without fsync on the Android UI thread.
            // Sound deadline claims still commit once before playback for deduplication.
            getSharedPreferences(CHANNEL,0).edit().putString("state",raw).apply();
            WorkoutTimerAlarms.sync(this,state);
            render(previousSignals);
            return START_STICKY;
        } catch(Exception error){android.util.Log.e("TGymWorkoutNotification","Unable to render workout notification",error);stopSelf();return START_NOT_STICKY;}
    }
    private String duration(long millis){
        long seconds=Math.max(0,millis/1000);
        return seconds>=3600?String.format(Locale.ROOT,"%02d:%02d:%02d",seconds/3600,(seconds%3600)/60,seconds%60):String.format(Locale.ROOT,"%02d:%02d",seconds/60,seconds%60);
    }
    private String workoutLabel() {
        if(state.optBoolean("paused") && "inactivity".equals(state.optString("pauseReason"))) {
            String paused=state.optString("pauseLabel","");
            return paused.trim().isEmpty()?"Workout paused":paused;
        }
        return state.optString("workoutLabel","Workout");
    }
    static Intent workoutIntent(Context context) {
        // Capacitor emits appUrlOpen for warm starts only for ACTION_VIEW.
        return new Intent(context,MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("tgym://workout")).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }
    private RemoteViews timerView(int layout, long elapsed, long rest) {
        RemoteViews content=new RemoteViews(getPackageName(),layout);
        content.setInt(R.id.accent_rail,"setBackgroundColor",notificationColor());
        content.setTextViewText(R.id.workout_label,workoutLabel());
        content.setTextViewText(R.id.set_label,state.optString("setLabel",""));
        boolean resting=rest>0;
        int size=layout==R.layout.workout_notification_expanded ? 30 : 22;
        content.setTextViewTextSize(R.id.workout_clock,android.util.TypedValue.COMPLEX_UNIT_SP,resting?14:size);
        content.setTextViewTextSize(R.id.workout_duration,android.util.TypedValue.COMPLEX_UNIT_SP,resting?14:size);
        boolean live=!state.optBoolean("paused");
        content.setViewVisibility(R.id.workout_clock,live?View.VISIBLE:View.GONE);
        content.setViewVisibility(R.id.workout_duration,live?View.GONE:View.VISIBLE);
        content.setTextViewText(R.id.workout_duration,duration(elapsed));
        content.setChronometer(R.id.workout_clock,SystemClock.elapsedRealtime()-elapsed,null,live);
        content.setViewVisibility(R.id.rest_row,rest>0?View.VISIBLE:View.GONE);
        content.setTextViewText(R.id.rest_label,state.optString("restLabel","REST"));
        content.setViewVisibility(R.id.rest_clock,rest>0?View.VISIBLE:View.GONE);
        if(rest>0){
            if(Build.VERSION.SDK_INT>=24){content.setChronometerCountDown(R.id.rest_clock,true);content.setChronometer(R.id.rest_clock,SystemClock.elapsedRealtime()+rest,null,true);}
            else {content.setChronometer(R.id.rest_clock,SystemClock.elapsedRealtime(),duration(rest),false);}
        }
        return content;
    }
    private void render(){render(null);}
    private void render(JSONObject previousSignals){
        handler.removeCallbacks(refresh);
        long now=System.currentTimeMillis(), autoAt=state.optLong("autoPauseAt",0);
        if(!state.optBoolean("paused") && autoAt>0 && now>=autoAt){
            // Freeze at the original input deadline even after process suspension. The
            // WebView reconciles that same timestamp on return; no history is created here.
            try {
                long frozen=Math.max(0,state.optLong("elapsedMs")+Math.max(0,autoAt-state.optLong("observedAt",autoAt)));
                state.put("elapsedMs",frozen).put("observedAt",autoAt).put("paused",true).put("pauseReason","inactivity");
                getSharedPreferences(CHANNEL,0).edit().putString("state",state.toString()).apply();
            } catch(Exception error){android.util.Log.e("TGymWorkoutNotification","Unable to persist timer pause",error);}
        }
        long elapsed=Math.max(0,state.optLong("elapsedMs")+(state.optBoolean("paused")?0:Math.max(0,now-state.optLong("observedAt",now))));
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(CHANNEL,"TGym · Workout",NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);
        }
        Intent open=workoutIntent(this);
        PendingIntent tap=PendingIntent.getActivity(this,3100,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        long rest=state.optLong("restEndsAt")-now;
        RemoteViews content=timerView(R.layout.workout_notification,elapsed,rest);
        Notification notice=new NotificationCompat.Builder(this,CHANNEL)
            .setSmallIcon(R.drawable.ic_workout_notification).setContentTitle(rest>0?state.optString("restLabel","REST"):workoutLabel())
            .setContentText((rest>0?duration(rest)+" · ":"")+workoutLabel()+" "+duration(elapsed)+" · "+state.optString("setLabel",""))
            .setCustomContentView(content)
            .setCustomBigContentView(timerView(R.layout.workout_notification_expanded,elapsed,rest))
            .setColor(notificationColor()).setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(tap).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW).build();
        try {
            if(Build.VERSION.SDK_INT>=34)startForeground(ID,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(ID,notice);
        }catch(RuntimeException error){android.util.Log.e("TGymWorkoutNotification","Unable to start workout notification",error);stopSelf();return;}
        // Foreground status must precede playback, including an alarm that recreated
        // the process while the WebView was closed. The shared ledger deduplicates
        // the old/new payload, alarm and subsequent JS signal.
        if(previousSignals!=null)WorkoutTimerAlarms.completeDue(this,previousSignals,now);
        WorkoutTimerAlarms.completeDue(this,state,now);
        long delay=Long.MAX_VALUE; // Native chronometers tick; refresh only at a phase boundary.
        if(rest>0)delay=Math.min(delay,Build.VERSION.SDK_INT>=24?rest:1000);
        long work=WorkoutTimerAlarms.deadline(state,"work")-now;
        if(work>0)delay=Math.min(delay,work);
        if(autoAt>now)delay=Math.min(delay,autoAt-now);
        if(delay!=Long.MAX_VALUE)handler.postDelayed(refresh,Math.max(100,delay));
    }
    @Override public void onDestroy(){handler.removeCallbacks(refresh);WorkoutTimerAlarms.cancel(this);getSharedPreferences(CHANNEL,0).edit().remove("state").apply();stopForeground(true);super.onDestroy();}
}
