package app.framegym.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SoundPreferencesTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private byte[] wav(short sample) {
        ByteBuffer out = ByteBuffer.allocate(48).order(ByteOrder.LITTLE_ENDIAN);
        out.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(40).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII));
        out.putInt(16).putShort((short)1).putShort((short)1).putInt(16000).putInt(32000).putShort((short)2).putShort((short)16);
        out.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(4).putShort(sample).putShort(sample);
        return out.array();
    }
    private JSONObject settings(short sample) throws Exception {
        JSONObject clip = new JSONObject().put("id", "custom_test").put("data", Base64.encodeToString(wav(sample), Base64.NO_WRAP));
        return new JSONObject().put("enabled", true).put("vibration", true)
            .put("sounds", new JSONObject().put("rest", clip).put("notification", clip));
    }
    @After public void reset() throws Exception {
        SoundPreferences.stop();
        SoundPreferences.prune(context, SoundPreferences.configure(context, new JSONObject()).getJSONObject("channels"));
        context.getSharedPreferences(SoundPreferences.PREFS, 0).edit().clear().commit();
    }

    @Test public void importedWaveAndChannelRemainReadableFromPersistedConfig() throws Exception {
        JSONObject first = SoundPreferences.configure(context, settings((short)100));
        JSONObject persisted = SoundPreferences.config(context);
        assertFalse("Preferences retain paths rather than duplicate audio", persisted.has("sounds"));
        Uri uri = SoundPreferences.soundUri(context, persisted, "rest");
        assertNotNull(uri);
        try (java.io.InputStream stream = context.getContentResolver().openInputStream(uri)) {
            byte[] bytes = new byte[48]; assertEquals(48, stream.read(bytes)); assertArrayEquals(wav((short)100), bytes);
        }
        JSONObject second = SoundPreferences.configure(context, settings((short)100));
        assertEquals(first.getJSONObject("channels").getString("audible"), second.getJSONObject("channels").getString("audible"));
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            assertEquals("Android can read the channel WAV after the WebView closes",android.content.pm.PackageManager.PERMISSION_GRANTED,
                context.checkUriPermission(uri,-1,android.os.Process.SYSTEM_UID,android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION));
            int systemUi = context.getPackageManager().getApplicationInfo("com.android.systemui",0).uid;
            assertEquals("System UI can play the persisted sound",android.content.pm.PackageManager.PERMISSION_GRANTED,
                context.checkUriPermission(uri,-1,systemUi,android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION));
            assertEquals(uri, manager.getNotificationChannel(first.getJSONObject("channels").getString("audible")).getSound());
            assertNull(manager.getNotificationChannel(first.getJSONObject("channels").getString("silent")).getSound());
            assertFalse(manager.getNotificationChannel(first.getJSONObject("channels").getString("silent")).shouldVibrate());
        }
    }

    @Test public void changedAudioGetsANewChannelAndOldAssetIsRemoved() throws Exception {
        String first = SoundPreferences.configure(context, settings((short)1)).getJSONObject("channels").getString("audible");
        String firstFile = SoundPreferences.config(context).getJSONObject("files").getString("rest");
        JSONObject nextChannels = SoundPreferences.configure(context, settings((short)2)).getJSONObject("channels");
        String next = nextChannels.getString("audible");
        assertNotEquals(first, next);
        assertTrue("An already scheduled alarm keeps its WAV until rescheduling succeeds",new java.io.File(new java.io.File(context.getFilesDir(), "sounds"), firstFile).exists());
        SoundPreferences.prune(context, nextChannels);
        assertFalse(new java.io.File(new java.io.File(context.getFilesDir(), "sounds"), firstFile).exists());
        assertEquals(1, new java.io.File(context.getFilesDir(), "sounds").listFiles().length);
    }

    @Test public void quietWindowMutedChannelsAndDeadlineClaimArePersistent() throws Exception {
        JSONObject input = settings((short)1).put("enabled", false).put("quietOn", true).put("quietStart", "22:00").put("quietEnd", "07:00");
        JSONObject channels = SoundPreferences.configure(context, input).getJSONObject("channels");
        Calendar at = Calendar.getInstance(); at.set(Calendar.HOUR_OF_DAY, 23); at.set(Calendar.MINUTE, 0);
        assertEquals(channels.getString("silent"), SoundPreferences.notificationChannel(context, at.getTimeInMillis()));
        at.set(Calendar.HOUR_OF_DAY, 12);
        assertEquals(channels.getString("muted"), SoundPreferences.notificationChannel(context, at.getTimeInMillis()));
        context.getSharedPreferences(SoundPreferences.PREFS, 0).edit().remove("lastRest").commit();
        assertTrue(SoundPreferences.claimRest(context, 12345));
        assertFalse(SoundPreferences.claimRest(context, 12345));
        assertFalse(SoundPreferences.claimRest(context, 12000));
        assertEquals(12345, context.getSharedPreferences(SoundPreferences.PREFS, 0).getLong("lastRest", 0));
        assertTrue(SoundPreferences.claimRest(context, 13000));
    }

    @Test public void invalidClipsAreRejectedAndUpdatesIgnoreSameOrOlderVersions() throws Exception {
        byte[] invalid = wav((short)1); invalid[22] = 2;
        try { SoundPreferences.validateWav(invalid); fail("Stereo clip must be normalized first"); }
        catch (IllegalArgumentException expected) {}
        assertTrue(UpdateMessagingService.newerVersion("1.16.0", "1.15.24"));
        assertFalse(UpdateMessagingService.newerVersion("1.15.24", "1.15.24"));
        assertFalse(UpdateMessagingService.newerVersion("1.9.99", "1.15.24"));
    }
    @Test public void everyBundledPresetDecodesAndCompletesInAndroidMediaPlayer() throws Exception {
        String json;
        try (java.io.InputStream stream = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("audio-audit.json")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[8192]; int count;
            while ((count = stream.read(chunk)) != -1) bytes.write(chunk, 0, count);
            json = bytes.toString("UTF-8");
        }
        org.json.JSONArray clips = new org.json.JSONArray(json);
        assertEquals(24, clips.length());
        for (int i = 0; i < clips.length(); i++) {
            JSONObject clip = clips.getJSONObject(i);
            String event = clip.getString("event"), label = clip.getString("id") + "/" + event;
            SoundPreferences.configure(context, new JSONObject().put("sounds", new JSONObject().put(event, clip)));
            Uri uri = SoundPreferences.soundUri(context, SoundPreferences.config(context), event);
            assertNotNull(label, uri);
            java.util.concurrent.CountDownLatch ended = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.atomic.AtomicBoolean failed = new java.util.concurrent.atomic.AtomicBoolean(false);
            android.media.MediaPlayer media = new android.media.MediaPlayer();
            try {
                media.setAudioAttributes(SoundPreferences.attributes()); media.setDataSource(context, uri);
                media.setOnCompletionListener(done -> ended.countDown());
                media.setOnErrorListener((player, what, extra) -> { failed.set(true); ended.countDown(); return true; });
                media.prepare(); assertTrue(label + " duration", media.getDuration() > 0);
                media.start(); assertTrue(label + " completes", ended.await(5, java.util.concurrent.TimeUnit.SECONDS));
                assertFalse(label + " has no decoder error", failed.get());
            } finally { media.release(); }
        }
    }

}
