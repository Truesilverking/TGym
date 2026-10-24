package app.framegym.mobile;
import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.datatypes.ExerciseSessionType;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.Arrays;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
@RunWith(AndroidJUnit4.class)
public class HealthActivitiesTest {
    @Test public void healthImportRequestsOnlyExerciseReadAccess() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        var permissions=Arrays.asList(context.getPackageManager().getPackageInfo(context.getPackageName(),PackageManager.GET_PERMISSIONS).requestedPermissions);
        assertTrue(permissions.contains("android.permission.health.READ_EXERCISE"));
        assertFalse(permissions.stream().anyMatch(p->p.startsWith("android.permission.health.WRITE_")));
        assertFalse(permissions.contains("android.permission.ACCESS_FINE_LOCATION"));
    }
    @Test public void providerSessionsKeepTheirActivityMeaning() {
        assumeTrue(Build.VERSION.SDK_INT>=34);
        assertEquals("running",HealthActivitiesPlugin.activityType(ExerciseSessionType.EXERCISE_SESSION_TYPE_RUNNING_TREADMILL));
        assertEquals("cycling",HealthActivitiesPlugin.activityType(ExerciseSessionType.EXERCISE_SESSION_TYPE_BIKING));
        assertEquals("strength",HealthActivitiesPlugin.activityType(ExerciseSessionType.EXERCISE_SESSION_TYPE_WEIGHTLIFTING));
        assertEquals("mobility",HealthActivitiesPlugin.activityType(ExerciseSessionType.EXERCISE_SESSION_TYPE_STRETCHING));
        assertEquals("other",HealthActivitiesPlugin.activityType(-999));
    }
}
