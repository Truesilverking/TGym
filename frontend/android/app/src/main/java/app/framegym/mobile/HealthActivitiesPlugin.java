package app.framegym.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.OutcomeReceiver;
import android.health.connect.HealthConnectManager;
import android.health.connect.HealthConnectException;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.ExerciseSessionType;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** On-device, foreground, read-only exercise import. No backend or credentials. */
@CapacitorPlugin(name="HealthActivities", permissions={@Permission(alias="exercise", strings={"android.permission.health.READ_EXERCISE"})})
public class HealthActivitiesPlugin extends Plugin {
    private boolean available() { return Build.VERSION.SDK_INT >= 34 && getContext().getSystemService(HealthConnectManager.class) != null; }
    private boolean granted() { return available() && getContext().checkSelfPermission("android.permission.health.READ_EXERCISE") == PackageManager.PERMISSION_GRANTED; }
    @PluginMethod public void status(PluginCall call) {
        JSObject result=new JSObject();result.put("available",available());result.put("granted",granted());call.resolve(result);
    }
    @PluginMethod public void connect(PluginCall call) {
        if (!available()) { call.reject("Health Connect requires Android 14 or newer");return; }
        if (granted()) { status(call);return; }
        requestPermissionForAlias("exercise",call,"permissionResult");
    }
    @PermissionCallback private void permissionResult(PluginCall call) { status(call); }
    @PluginMethod public void openSettings(PluginCall call) {
        if (!available()) { call.reject("Unavailable");return; }
        try { Intent intent=new Intent(HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS);intent.putExtra(Intent.EXTRA_PACKAGE_NAME,getContext().getPackageName());getActivity().startActivity(intent);call.resolve(); }
        catch (Exception e) { call.reject("Health permissions could not be opened"); }
    }
    @PluginMethod public void readActivities(PluginCall call) {
        if (!granted()) { call.reject("Exercise permission is required");return; }
        if (Build.VERSION.SDK_INT >= 34) readPage(call,-1,new JSArray(),Instant.now());
    }
    @RequiresApi(34) private void readPage(PluginCall call,long page,JSArray rows,Instant now) {
        var builder=new ReadRecordsRequestUsingFilters.Builder<>(ExerciseSessionRecord.class)
            .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(now.minus(30,ChronoUnit.DAYS)).setEndTime(now).build()).setPageSize(500);
        if (page!=-1) builder.setPageToken(page);
        try { getContext().getSystemService(HealthConnectManager.class).readRecords(builder.build(),getContext().getMainExecutor(),new OutcomeReceiver<ReadRecordsResponse<ExerciseSessionRecord>,HealthConnectException>() {
            @Override public void onResult(ReadRecordsResponse<ExerciseSessionRecord> response) {
                for (var record:response.getRecords()) {
                    // Future/open sessions are not completed workouts. Preserve the provider identity.
                    if (record.getEndTime().isAfter(now)) continue;
                    JSObject row=new JSObject();var metadata=record.getMetadata();
                    row.put("id",metadata.getId());row.put("origin",metadata.getDataOrigin().getPackageName());row.put("updatedAt",metadata.getLastModifiedTime().toEpochMilli());
                    row.put("start",record.getStartTime().toEpochMilli());row.put("end",record.getEndTime().toEpochMilli());row.put("type",activityType(record.getExerciseType()));
                    if(record.getTitle()!=null)row.put("name",record.getTitle().toString());
                    if(record.getNotes()!=null)row.put("note",record.getNotes().toString());
                    rows.put(row);
                }
                if (rows.length()>5000) {call.reject("Too many exercise records");return;}
                if(response.getNextPageToken()!=-1) {readPage(call,response.getNextPageToken(),rows,now);return;}
                JSObject result=new JSObject();result.put("records",rows);call.resolve(result);
            }
            @Override public void onError(HealthConnectException error) {call.reject("Health Connect could not read exercise sessions");}
        }); } catch(Exception e) {call.reject("Health Connect is unavailable or permission was revoked");}
    }
    @RequiresApi(34) static String activityType(int type) {
        return switch(type) {
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_RUNNING, ExerciseSessionType.EXERCISE_SESSION_TYPE_RUNNING_TREADMILL -> "running";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_WALKING -> "walking";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_HIKING -> "hiking";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_BIKING, ExerciseSessionType.EXERCISE_SESSION_TYPE_BIKING_STATIONARY -> "cycling";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_YOGA, ExerciseSessionType.EXERCISE_SESSION_TYPE_PILATES, ExerciseSessionType.EXERCISE_SESSION_TYPE_STRETCHING -> "mobility";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_GUIDED_BREATHING -> "recovery";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_STRENGTH_TRAINING, ExerciseSessionType.EXERCISE_SESSION_TYPE_WEIGHTLIFTING -> "strength";
            default -> "other";
        };
    }
}
