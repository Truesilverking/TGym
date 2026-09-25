package app.framegym.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import android.view.View;
import android.widget.FrameLayout;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class WorkoutNotificationTest {
    private Context context;
    private void shell(String command) throws Exception {
        try(android.os.ParcelFileDescriptor.AutoCloseInputStream stream=new android.os.ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))) {
            byte[] buffer=new byte[1024]; while(stream.read(buffer)!=-1) {}
        }
    }
    private StatusBarNotification notification() {
        for (StatusBarNotification item : ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications())
            if(item.getId()==3100)return item;
        return null;
    }
    @Test public void workoutAndRestSurviveBackgroundAndStopOnFinish() throws Exception {
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        shell("pm grant app.framegym.mobile android.permission.POST_NOTIFICATIONS");
        assertTrue("Android notification permission must be granted",((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled());
        Intent service=new Intent(context,WorkoutNotificationService.class);
        try {
            shell("am start -W -n app.framegym.mobile/.WorkoutNotificationTestActivity");
            for(int wait=0;wait<100 && notification()==null;wait++) SystemClock.sleep(100);
            assertNotNull(notification());
            assertNotNull(notification().getNotification().contentView);
            assertNotNull(notification().getNotification().bigContentView);
            long restDeadline=new org.json.JSONObject(context.getSharedPreferences("tgym_workout_live",0).getString("state","{}")).getLong("restEndsAt");
            shell("input keyevent KEYCODE_HOME");
            SystemClock.sleep(6000);
            StatusBarNotification item=notification();
            assertNotNull("Workout remains visible in background",item);
            assertEquals("Rest signal is claimed once even with the WebView closed",restDeadline,context.getSharedPreferences(SoundPreferences.PREFS,0).getLong("lastRest",0));
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                View view=item.getNotification().contentView.apply(context,new FrameLayout(context));
                assertEquals("Finished rest is hidden",View.GONE,view.findViewById(R.id.rest_row).getVisibility());
                assertEquals(View.GONE,view.findViewById(R.id.rest_clock).getVisibility());
                assertEquals("Rest",((android.widget.TextView)view.findViewById(R.id.rest_label)).getText().toString());
                assertEquals(android.graphics.Color.parseColor("#BF5AF2"),item.getNotification().color);
                assertEquals(View.VISIBLE,view.findViewById(R.id.workout_clock).getVisibility());
                View expanded=item.getNotification().bigContentView.apply(context,new FrameLayout(context));
                assertEquals(View.VISIBLE,expanded.findViewById(R.id.workout_clock).getVisibility());
                assertEquals(View.GONE,expanded.findViewById(R.id.rest_row).getVisibility());
                assertEquals(View.GONE,expanded.findViewById(R.id.rest_clock).getVisibility());
                assertEquals("SET 2",((android.widget.TextView)expanded.findViewById(R.id.set_label)).getText().toString());
                assertEquals("SET 2",((android.widget.TextView)view.findViewById(R.id.set_label)).getText().toString());
                assertTrue(item.getNotification().actions==null || item.getNotification().actions.length==0);
            });

            org.json.JSONObject paused=new org.json.JSONObject(context.getSharedPreferences("tgym_workout_live",0).getString("state","{}"));
            paused.put("paused",true).put("elapsedMs",3723000).put("restEndsAt",0).put("autoFinishAt",0).put("workoutLabel","Workout paused").put("openLabel","Resume");
            context.startService(new Intent(context,WorkoutNotificationService.class).putExtra("state",paused.toString()));
            SystemClock.sleep(500);
            StatusBarNotification frozen=notification();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                View view=frozen.getNotification().bigContentView.apply(context,new FrameLayout(context));
                assertEquals(View.GONE,view.findViewById(R.id.workout_clock).getVisibility());
                assertEquals("01:02:03",((android.widget.TextView)view.findViewById(R.id.workout_duration)).getText().toString());
                assertEquals(View.GONE,view.findViewById(R.id.rest_row).getVisibility());
                assertTrue(frozen.getNotification().actions==null || frozen.getNotification().actions.length==0);
            });
            // Resume and change set together: preserve elapsed clock and rest deadline.
            long resumedAt=System.currentTimeMillis();
            paused.put("paused",false).put("observedAt",resumedAt).put("restEndsAt",resumedAt+30000).put("setLabel","SERIE 3").put("workoutLabel","ENTRENO").put("restLabel","DESCANSO");
            context.startService(new Intent(context,WorkoutNotificationService.class).putExtra("state",paused.toString()));
            SystemClock.sleep(500);
            StatusBarNotification resumed=notification();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                for(android.widget.RemoteViews remote:new android.widget.RemoteViews[]{resumed.getNotification().contentView,resumed.getNotification().bigContentView}) {
                    View view=remote.apply(context,new FrameLayout(context));
                    assertEquals(View.VISIBLE,view.findViewById(R.id.rest_row).getVisibility());
                    assertEquals("SERIE 3",((android.widget.TextView)view.findViewById(R.id.set_label)).getText().toString());
                    android.widget.Chronometer clock=view.findViewById(R.id.workout_clock), rest=view.findViewById(R.id.rest_clock);
                    assertTrue(rest.isCountDown());
                    assertTrue(rest.getBase()>SystemClock.elapsedRealtime());
                    assertTrue(SystemClock.elapsedRealtime()-clock.getBase()>=3723000);
                    assertTrue(rest.getTextSize()>clock.getTextSize());
                }
            });
            assertEquals(1,java.util.Arrays.stream(((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications()).filter(n->n.getId()==3100).count());
            // The deadline clears the service even with no further WebView updates.
            paused.put("autoFinishAt",System.currentTimeMillis()+300);
            context.startService(new Intent(context,WorkoutNotificationService.class).putExtra("state",paused.toString()));
            SystemClock.sleep(800);
            assertNull("Inactivity removes the live notification",notification());

        } finally { context.stopService(service); }
        SystemClock.sleep(1000);
        assertNull("Finished workout removes notification",notification());
    }
}
