package app.framegym.mobile;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.datatypes.DataOrigin;
import android.health.connect.datatypes.Metadata;
import android.health.connect.datatypes.WeightRecord;
import android.health.connect.datatypes.units.Mass;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Synthetic records only: these tests never read or write the device health datastore. */
@RunWith(AndroidJUnit4.class)
public class HealthWeightsTest {
    private static final Instant TO = Instant.parse("2026-11-20T12:00:00Z");
    private static final Instant FROM = TO.minus(30, ChronoUnit.DAYS);

    private static WeightRecord record(String id, String origin, Instant time, double kg) {
        Metadata metadata = new Metadata.Builder().setId(id)
            .setDataOrigin(new DataOrigin.Builder().setPackageName(origin).build())
            .setLastModifiedTime(TO.minusSeconds(30)).build();
        return new WeightRecord.Builder(metadata, time, Mass.fromGrams(kg * 1000)).build();
    }

    @Test public void weightPermissionIsSeparateReadOnlyAndDeclaredInPackage() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        var permissions = Arrays.asList(context.getPackageManager()
            .getPackageInfo(context.getPackageName(), PackageManager.GET_PERMISSIONS).requestedPermissions);
        assertTrue(permissions.contains(HealthWeightsPlugin.READ_PERMISSION));
        assertTrue(permissions.contains("android.permission.health.READ_EXERCISE"));
        assertFalse(permissions.stream().anyMatch(p -> p.startsWith("android.permission.health.WRITE_")));
        assertFalse(permissions.contains("android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"));
        assertFalse(permissions.contains("android.permission.health.READ_BODY_FAT"));
        CapacitorPlugin annotation = HealthWeightsPlugin.class.getAnnotation(CapacitorPlugin.class);
        assertEquals("HealthWeights", annotation.name());
        assertEquals(1, annotation.permissions().length);
        assertEquals("weight", annotation.permissions()[0].alias());
        assertArrayEquals(new String[]{HealthWeightsPlugin.READ_PERMISSION}, annotation.permissions()[0].strings());
    }

    @Test public void unavailableOrUnpermittedAccessNeverClaimsAConnection() throws Exception {
        for (JSObject result : Arrays.asList(HealthWeightsPlugin.accessStatus(33, true, true),
                HealthWeightsPlugin.accessStatus(34, false, true))) {
            assertFalse(result.getBoolean("available"));
            assertFalse(result.getBoolean("granted"));
        }
        JSObject denied = HealthWeightsPlugin.accessStatus(34, true, false);
        assertTrue(denied.getBoolean("available"));
        assertFalse(denied.getBoolean("granted"));
        JSObject granted = HealthWeightsPlugin.accessStatus(35, true, true);
        assertTrue(granted.getBoolean("available"));
        assertTrue(granted.getBoolean("granted"));
    }

    @Test public void recordMappingKeepsIdentityTimestampOriginAndCanonicalKilograms() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        Instant measured = TO.minus(2, ChronoUnit.DAYS);
        JSObject result = HealthWeightsPlugin.weightRow(record("synthetic-weight", "com.withings.wiscale2", measured, 80.125), FROM, TO);
        assertEquals("synthetic-weight", result.getString("id"));
        assertEquals("com.withings.wiscale2", result.getString("origin"));
        assertEquals(measured.toEpochMilli(), result.getLong("time"));
        assertEquals(TO.minusSeconds(30).toEpochMilli(), result.getLong("updatedAt"));
        assertEquals(80.125, result.getDouble("weightKg"), 0.000001);
        assertEquals(5, result.length());
    }

    @Test public void recordsOutsideTheBoundedRangeOrWeightDomainAreExcluded() {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        assertNotNull(HealthWeightsPlugin.weightRow(record("first", "com.withings.wiscale2", FROM, 80), FROM, TO));
        assertNull(HealthWeightsPlugin.weightRow(record("old", "com.withings.wiscale2", FROM.minusMillis(1), 80), FROM, TO));
        assertNull(HealthWeightsPlugin.weightRow(record("end", "com.withings.wiscale2", TO, 80), FROM, TO));
        assertNull(HealthWeightsPlugin.weightRow(record("future", "com.withings.wiscale2", TO.plusMillis(1), 80), FROM, TO));
        assertNull(HealthWeightsPlugin.weightRow(record("zero", "com.withings.wiscale2", TO.minusSeconds(1), 0), FROM, TO));
        assertNull(HealthWeightsPlugin.weightRow(record("too-large", "com.withings.wiscale2", TO.minusSeconds(1), 601), FROM, TO));
        assertNull(HealthWeightsPlugin.weightRow(null, FROM, TO));
        assertThrows(IllegalArgumentException.class, () -> new HealthWeightsPlugin.WeightBatch(FROM.minusSeconds(1), TO));
        assertThrows(IllegalArgumentException.class, () -> new HealthWeightsPlugin.WeightBatch(TO, FROM));
    }

    @Test public void multiplePagesResolveOnlyAfterTheTerminalPage() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        var batch = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        batch.startPage(-1);
        batch.addPage(Collections.singletonList(record("one", "com.withings.wiscale2", TO.minusSeconds(2), 80)), 7);
        assertThrows(IllegalStateException.class, batch::complete);
        batch.startPage(7);
        batch.addPage(Collections.singletonList(record("two", "com.withings.wiscale2", TO.minusSeconds(1), 81)), -1);
        JSObject result = batch.complete();
        assertTrue(result.getBoolean("complete"));
        assertEquals(2, result.getJSONArray("records").length());
        assertEquals(FROM.toEpochMilli(), result.getLong("from"));
        assertEquals(TO.toEpochMilli(), result.getLong("to"));
    }

    @Test public void repeatedOrUnexpectedTokensPoisonTheReadInsteadOfReturningPartialData() {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        var repeated = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        repeated.startPage(-1);
        repeated.addPage(Collections.emptyList(), 7);
        repeated.startPage(7);
        assertThrows(IllegalStateException.class, () -> repeated.addPage(Collections.emptyList(), 7));
        assertThrows(IllegalStateException.class, repeated::complete);
        var unexpected = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        unexpected.startPage(-1);
        unexpected.addPage(Collections.emptyList(), 7);
        assertThrows(IllegalStateException.class, () -> unexpected.startPage(8));
        assertThrows(IllegalStateException.class, unexpected::complete);
    }

    @Test public void pageCountBoundPreventsAnEndlessEmptyRead() {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        var bounded = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        for (int i = 0; i < HealthWeightsPlugin.MAX_PAGES - 1; i++) {
            bounded.startPage(i - 1);
            bounded.addPage(Collections.emptyList(), i);
        }
        bounded.startPage(HealthWeightsPlugin.MAX_PAGES - 2);
        assertThrows(IllegalStateException.class, () -> bounded.addPage(Collections.emptyList(), 100));
        assertThrows(IllegalStateException.class, bounded::complete);
    }

    @Test public void recordLimitNeverResolvesATruncatedImport() {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        var batch = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        WeightRecord row = record("synthetic-limit", "com.withings.wiscale2", TO.minusSeconds(1), 80);
        for (int i = 0; i < HealthWeightsPlugin.MAX_RECORDS / HealthWeightsPlugin.PAGE_SIZE; i++) {
            batch.startPage(i - 1);
            batch.addPage(Collections.nCopies(HealthWeightsPlugin.PAGE_SIZE, row), i);
        }
        batch.startPage(9);
        assertThrows(IllegalStateException.class, () -> batch.addPage(Collections.singletonList(row), -1));
        assertThrows(IllegalStateException.class, batch::complete);
    }

    @Test public void exactlyTheRecordLimitAndAnEmptyFinalReadAreComplete() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        var batch = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        WeightRecord row = record("synthetic-exact", "com.withings.wiscale2", TO.minusSeconds(1), 80);
        int pages = HealthWeightsPlugin.MAX_RECORDS / HealthWeightsPlugin.PAGE_SIZE;
        for (int i = 0; i < pages; i++) {
            batch.startPage(i - 1);
            batch.addPage(Collections.nCopies(HealthWeightsPlugin.PAGE_SIZE, row), i == pages - 1 ? -1 : i);
        }
        assertEquals(HealthWeightsPlugin.MAX_RECORDS, batch.complete().getJSONArray("records").length());
        var empty = new HealthWeightsPlugin.WeightBatch(FROM, TO);
        empty.startPage(-1); empty.addPage(Collections.emptyList(), -1);
        assertTrue(empty.complete().getBoolean("complete"));
        assertEquals(0, empty.complete().getJSONArray("records").length());
    }
}
