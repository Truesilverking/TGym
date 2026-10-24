package app.framegym.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONObject;

/** Receives app-owned deadlines only; canceled/replaced timers cannot alert. */
public class WorkoutTimerReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        try{
            String event=intent.getStringExtra("event");
            if(!"rest".equals(event)&&!"work".equals(event))return;
            long at=intent.getLongExtra("deadline",0);
            String raw=context.getSharedPreferences(WorkoutTimerAlarms.PREFS,0).getString("state",null);
            if(raw==null)return;
            JSONObject state=new JSONObject(raw);
            if(!state.optBoolean("active")||WorkoutTimerAlarms.deadline(state,event)!=at||System.currentTimeMillis()<at)return;
            WorkoutTimerAlarms.completeDue(context,state,System.currentTimeMillis());
            Intent refresh=new Intent(context,WorkoutNotificationService.class).setAction(context.getPackageName()+".TIMER_REFRESH");
            if(Build.VERSION.SDK_INT>=26)context.startForegroundService(refresh);else context.startService(refresh);
        }catch(Exception error){android.util.Log.w("TGymWorkoutTimer","Timer refresh unavailable",error);}
    }
}
