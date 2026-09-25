package app.framegym.mobile;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

/** Debug-only host that starts the service from a foreground app, matching normal TGym use. */
public class WorkoutNotificationTestActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            long now=System.currentTimeMillis();
            JSONObject payload=new JSONObject().put("active",true).put("name","QA Workout")
                .put("workoutLabel","Workout").put("restLabel","Rest").put("restDoneLabel","Done").put("accentColor","#BF5AF2").put("elapsedMs",3720000)
                .put("setLabel","SET 2").put("setNumber",2)
                .put("observedAt",now).put("paused",false).put("restEndsAt",now+5000).put("autoFinishAt",now+60000);
            ContextCompat.startForegroundService(this,new Intent(this,WorkoutNotificationService.class).putExtra("state",payload.toString()));
        } catch(Exception ignored) {}
        getWindow().getDecorView().postDelayed(this::finish,250);
    }
}
