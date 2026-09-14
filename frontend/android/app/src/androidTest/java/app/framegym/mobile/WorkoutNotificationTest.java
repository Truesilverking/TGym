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
import org.json.JSONObject;
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
        long now=System.currentTimeMillis();
        JSONObject state=new JSONObject().put("active",true).put("name","QA Workout").put("workoutLabel","Workout").put("restLabel","Rest").put("elapsedMs",120000).put("observedAt",now).put("paused",false).put("restEndsAt",now+5000).put("autoFinishAt",now+60000);
        Intent service=new Intent(context,WorkoutNotificationService.class).putExtra("state",state.toString());
        try {
            context.startForegroundService(service);
            for(int wait=0;wait<50 && notification()==null;wait++) SystemClock.sleep(100);
            assertNotNull(notification());
            assertNotNull(notification().getNotification().contentView);
            assertNotNull(notification().getNotification().bigContentView);
            shell("input keyevent KEYCODE_HOME");
            SystemClock.sleep(6000);
            StatusBarNotification item=notification();
            assertNotNull("Workout remains visible in background",item);
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                View view=item.getNotification().contentView.apply(context,new FrameLayout(context));
                assertEquals("Rest row hides when countdown finishes",View.GONE,view.findViewById(R.id.rest_row).getVisibility());
                assertEquals(View.VISIBLE,view.findViewById(R.id.workout_clock).getVisibility());
                View expanded=item.getNotification().bigContentView.apply(context,new FrameLayout(context));
                assertEquals(View.VISIBLE,expanded.findViewById(R.id.workout_clock).getVisibility());
                assertEquals(View.GONE,expanded.findViewById(R.id.rest_row).getVisibility());
            });
            item.getNotification().contentIntent.send();
            SystemClock.sleep(1000);
        } finally { context.stopService(service); }
        SystemClock.sleep(1000);
        assertNull("Finished workout removes notification",notification());
    }
}
