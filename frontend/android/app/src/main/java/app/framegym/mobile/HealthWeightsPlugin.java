package app.framegym.mobile;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.WeightRecord;
import android.os.Build;
import android.os.OutcomeReceiver;
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
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Foreground, opt-in, read-only weight import. No provider credentials or backend. */
@CapacitorPlugin(name="HealthWeights", permissions={@Permission(alias="weight", strings={"android.permission.health.READ_WEIGHT"})})
public class HealthWeightsPlugin extends Plugin {
    static final String READ_PERMISSION = "android.permission.health.READ_WEIGHT";
    static final int MAX_RECORDS = 5000;
    static final int MAX_PAGES = 20;
    static final int PAGE_SIZE = 500;

    static JSObject accessStatus(int sdk, boolean serviceAvailable, boolean permissionGranted) {
        boolean available = sdk >= 34 && serviceAvailable;
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("granted", available && permissionGranted);
        return result;
    }

    private boolean available() {
        return Build.VERSION.SDK_INT >= 34 && getContext().getSystemService(HealthConnectManager.class) != null;
    }
    private boolean granted() {
        return available() && getContext().checkSelfPermission(READ_PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }
    @PluginMethod public void status(PluginCall call) {
        call.resolve(accessStatus(Build.VERSION.SDK_INT, available(), granted()));
    }
    @PluginMethod public void connect(PluginCall call) {
        if (!available()) { call.reject("Health Connect requires Android 14 or newer"); return; }
        if (granted()) { status(call); return; }
        requestPermissionForAlias("weight", call, "weightPermissionResult");
    }
    @PermissionCallback private void weightPermissionResult(PluginCall call) { status(call); }
    @PluginMethod public void openSettings(PluginCall call) {
        if (!available()) { call.reject("Health Connect is unavailable"); return; }
        try {
            Intent intent = new Intent(HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS);
            intent.putExtra(Intent.EXTRA_PACKAGE_NAME, getContext().getPackageName());
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception ignored) { call.reject("Health permissions could not be opened"); }
    }
    @PluginMethod public void readWeights(PluginCall call) {
        if (!granted()) { call.reject("Weight permission is required"); return; }
        if (Build.VERSION.SDK_INT >= 34) {
            Instant to = Instant.now();
            readPage(call, -1, new WeightBatch(to.minus(30, ChronoUnit.DAYS), to));
        }
    }
    @RequiresApi(34) private void readPage(PluginCall call, long token, WeightBatch batch) {
        try {
            if (!granted()) { call.reject("Weight permission was revoked"); return; }
            batch.startPage(token);
            var builder = new ReadRecordsRequestUsingFilters.Builder<>(WeightRecord.class)
                .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(batch.from).setEndTime(batch.to).build())
                .setPageSize(PAGE_SIZE);
            if (token != -1) builder.setPageToken(token);
            getContext().getSystemService(HealthConnectManager.class).readRecords(builder.build(), getContext().getMainExecutor(),
                new OutcomeReceiver<ReadRecordsResponse<WeightRecord>, HealthConnectException>() {
                    @Override public void onResult(ReadRecordsResponse<WeightRecord> response) {
                        try {
                            if (!granted()) { call.reject("Weight permission was revoked"); return; }
                            long next = response.getNextPageToken();
                            batch.addPage(response.getRecords(), next);
                            if (next != -1) readPage(call, next, batch);
                            else call.resolve(batch.complete());
                        } catch (Exception ignored) { call.reject("Health Connect weight response was incomplete"); }
                    }
                    @Override public void onError(HealthConnectException ignored) {
                        call.reject("Health Connect could not read weight records");
                    }
                });
        } catch (Exception ignored) { call.reject("Health Connect weight response was incomplete or permission was revoked"); }
    }

    /** A bounded read is resolved only after its terminal page, never as partial success. */
    @RequiresApi(34) static final class WeightBatch {
        final Instant from, to;
        private final Set<Long> pages = new HashSet<>();
        private final JSArray records = new JSArray();
        private int readCount = 0;
        private boolean terminal = false;
        private boolean awaitingPage = false;
        private boolean failed = false;
        private long nextPageToken = -1;

        WeightBatch(Instant from, Instant to) {
            if (from == null || to == null || !from.isBefore(to) || Duration.between(from, to).compareTo(Duration.ofDays(30)) > 0)
                throw new IllegalArgumentException("Invalid weight range");
            this.from = from; this.to = to;
        }
        void startPage(long token) {
            if (failed || terminal || awaitingPage || token != nextPageToken || token < -1 || pages.size() >= MAX_PAGES || !pages.add(token)) fail("Invalid weight pagination");
            awaitingPage = true;
        }
        void addPage(List<WeightRecord> page, long next) {
            if (failed || terminal || !awaitingPage || page == null || page.size() > PAGE_SIZE || readCount + page.size() > MAX_RECORDS || next < -1)
                fail("Weight read exceeded its bound");
            awaitingPage = false;
            readCount += page.size();
            for (WeightRecord record : page) {
                JSObject row = weightRow(record, from, to);
                if (row != null) records.put(row);
            }
            if (next != -1 && (pages.contains(next) || pages.size() >= MAX_PAGES)) fail("Invalid weight pagination");
            terminal = next == -1;
            nextPageToken = next;
        }
        JSObject complete() {
            if (failed || !terminal || awaitingPage) throw new IllegalStateException("Incomplete weight read");
            JSObject result = new JSObject();
            result.put("records", records); result.put("complete", true);
            result.put("from", from.toEpochMilli()); result.put("to", to.toEpochMilli());
            return result;
        }
        private void fail(String message) {
            failed = true;
            throw new IllegalStateException(message);
        }
    }
    @RequiresApi(34) static JSObject weightRow(WeightRecord record, Instant from, Instant to) {
        if (record == null || record.getTime().isBefore(from) || !record.getTime().isBefore(to)) return null;
        var metadata = record.getMetadata();
        String id = metadata.getId(), origin = metadata.getDataOrigin().getPackageName();
        double kg = record.getWeight().getInGrams() / 1000d;
        if (id.isEmpty() || origin.isEmpty() || !Double.isFinite(kg) || kg <= 0 || kg > 600) return null;
        JSObject row = new JSObject();
        row.put("id", id); row.put("origin", origin); row.put("updatedAt", metadata.getLastModifiedTime().toEpochMilli());
        row.put("time", record.getTime().toEpochMilli()); row.put("weightKg", kg);
        return row;
    }
}
