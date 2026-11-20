package app.framegym.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

/** User-started timer deadlines stay native while the WebView is suspended. */
final class WorkoutTimerAlarms {
    static final String PREFS="tgym_workout_live";
    private static final Map<String,Long> scheduled=new HashMap<>();
    private WorkoutTimerAlarms(){}
    static long deadline(JSONObject state,String event){
        return state.optLong(event.equals("rest")?"restSignalAt":"workSignalAt",state.optLong(event.equals("rest")?"restEndsAt":"workEndsAt",0));
    }
    private static PendingIntent pending(Context context,String event,long at,int flags){
        Intent intent=new Intent(context,WorkoutTimerReceiver.class).setAction(context.getPackageName()+".TIMER."+event).putExtra("event",event).putExtra("deadline",at);
        return PendingIntent.getBroadcast(context,event.equals("rest")?3102:3103,intent,flags|PendingIntent.FLAG_IMMUTABLE);
    }
    static synchronized void sync(Context context,JSONObject state){
        AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        for(String event:new String[]{"rest","work"}){
            long at=deadline(state,event);
            if(at<=System.currentTimeMillis())at=0;
            if(scheduled.containsKey(event)&&scheduled.get(event)==at)continue;
            PendingIntent previous=pending(context,event,0,PendingIntent.FLAG_NO_CREATE);
            if(previous!=null){alarms.cancel(previous);previous.cancel();}
            scheduled.put(event,at);
            if(at<=0)continue;
            PendingIntent next=pending(context,event,at,PendingIntent.FLAG_UPDATE_CURRENT);
            try{
                if(Build.VERSION.SDK_INT>=31&&!alarms.canScheduleExactAlarms())alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,next);
                else alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,next);
            }catch(SecurityException error){
                // Revoking exact access must not remove the visible timer or sound intent.
                try{alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,next);}
                catch(RuntimeException unavailable){scheduled.remove(event);android.util.Log.w("TGymWorkoutTimer","Native deadline unavailable; foreground timer retained",unavailable);}
            }catch(RuntimeException error){
                scheduled.remove(event);android.util.Log.w("TGymWorkoutTimer","Native deadline unavailable; foreground timer retained",error);
            }
        }
    }
    static synchronized void cancel(Context context){sync(context,new JSONObject());}
    static void completeDue(Context context,JSONObject state,long now){
        for(String event:new String[]{"rest","work"}){
            long at=deadline(state,event);
            // Do not replay abandoned, hours-old timers when an old profile is opened.
            if(at>0&&now>=at&&now-at<=60000)SoundPreferences.play(context,event,false,at);
        }
    }
}
