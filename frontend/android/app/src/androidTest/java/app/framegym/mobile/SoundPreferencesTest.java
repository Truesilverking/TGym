package app.framegym.mobile;

import android.app.NotificationManager;
import android.app.NotificationChannel;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.util.Base64;
import androidx.test.core.app.ActivityScenario;
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
        return settings(wav(sample));
    }
    private JSONObject settings(byte[] data) throws Exception {
        JSONObject clip = new JSONObject().put("id", "custom_test").put("data", Base64.encodeToString(data, Base64.NO_WRAP));
        return new JSONObject().put("enabled", true).put("vibration", true)
            .put("sounds", new JSONObject().put("rest", clip).put("notification", clip));
    }
    private byte[] tone(int millis) {
        int samples=16000*millis/1000;
        ByteBuffer out=ByteBuffer.allocate(44+samples*2).order(ByteOrder.LITTLE_ENDIAN);
        out.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36+samples*2).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII));
        out.putInt(16).putShort((short)1).putShort((short)1).putInt(16000).putInt(32000).putShort((short)2).putShort((short)16);
        out.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(samples*2);
        for(int i=0;i<samples;i++)out.putShort((short)(Math.sin(2*Math.PI*660*i/16000)*2000));
        return out.array();
    }
    private Object playbackField(String name) throws Exception {
        java.lang.reflect.Field field=SoundPreferences.class.getDeclaredField(name);field.setAccessible(true);return field.get(null);
    }
    private void awaitPlaybackReleased() throws Exception {
        for(int wait=0;wait<60&&playbackField("player")!=null;wait++)SystemClock.sleep(100);
        assertNull("Finished/failed clips release MediaPlayer",playbackField("player"));
        assertNull("Finished/failed clips release their audio-focus lease",playbackField("focusManager"));
    }
    private void shell(String command) throws Exception {
        try(android.os.ParcelFileDescriptor.AutoCloseInputStream stream=new android.os.ParcelFileDescriptor.AutoCloseInputStream(
            InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))){
            byte[] buffer=new byte[1024];while(stream.read(buffer)!=-1){}
        }
    }
    @After public void reset() throws Exception {
        context.stopService(new Intent(context,WorkoutNotificationService.class));
        SoundPreferences.stop();
        // This class runs only against the disposable instrumentation target.
        // Product pruning deliberately preserves OS-customized channels/assets.
        if(Build.VERSION.SDK_INT>=26){
            NotificationManager manager=context.getSystemService(NotificationManager.class);
            for(NotificationChannel channel:manager.getNotificationChannels())if(channel.getId().startsWith("tgym_sound_"))manager.deleteNotificationChannel(channel.getId());
        }
        SoundPreferences.prune(context, SoundPreferences.configure(context, new JSONObject()).getJSONObject("channels"));
        context.getSharedPreferences(SoundPreferences.PREFS, 0).edit().clear().commit();
    }

    private String channelId(byte[] data,boolean vibration) throws Exception {
        StringBuilder hash=new StringBuilder();
        for(byte value:java.security.MessageDigest.getInstance("SHA-256").digest(data))hash.append(String.format(java.util.Locale.ROOT,"%02x",value&255));
        return "tgym_sound_"+hash.substring(0,24)+(vibration?"_v":"_n");
    }
    private String existingChannel(byte[] data,int importance,Uri sound,boolean vibration) throws Exception {
        String id=channelId(data,true);
        NotificationChannel channel=new NotificationChannel(id,"OS channel fixture",importance);
        channel.setSound(sound,SoundPreferences.attributes());channel.enableVibration(vibration);
        if(vibration)channel.setVibrationPattern(new long[]{0,200,100,200});
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);return id;
    }

    @Test public void aNewAudioHashCannotResurrectABlockedAndroidChannel() throws Exception {
        if(Build.VERSION.SDK_INT<26)return;
        byte[] first=wav((short)7211),second=wav((short)7212);
        String blocked=existingChannel(first,NotificationManager.IMPORTANCE_NONE,null,true);
        SoundPreferences.configure(context,settings(first));
        JSONObject legacy=SoundPreferences.config(context);legacy.remove("channelIds");
        context.getSharedPreferences(SoundPreferences.PREFS,0).edit().putString("config",legacy.toString()).commit();
        assertTrue(new java.io.File(new java.io.File(context.getFilesDir(),"sounds"),legacy.getJSONObject("files").getString("notification")).delete());
        JSONObject migrated=SoundPreferences.configure(context,settings(second).put("vibration",false)).getJSONObject("channels");
        for(String kind:new String[]{"audible","muted","silent"})assertEquals(blocked,migrated.getString(kind));
        assertEquals(NotificationManager.IMPORTANCE_NONE,context.getSystemService(NotificationManager.class).getNotificationChannel(migrated.getString("audible")).getImportance());
        assertEquals(blocked,SoundPreferences.fallbackChannels(context,true).getJSONObject("channels").getString("audible"));
        SoundPreferences.prune(context,migrated);
        assertNotNull("Blocked OS channel remains available for the owner to change",context.getSystemService(NotificationManager.class).getNotificationChannel(blocked));
    }

    @Test public void aSilentOSChoiceSurvivesReturningToAnExistingAudibleHash() throws Exception {
        if(Build.VERSION.SDK_INT<26)return;
        byte[] first=wav((short)7311),second=wav((short)7312);
        String silent=existingChannel(first,NotificationManager.IMPORTANCE_HIGH,null,true);
        SoundPreferences.configure(context,settings(second));
        SoundPreferences.configure(context,settings(first));
        JSONObject migrated=SoundPreferences.configure(context,settings(second)).getJSONObject("channels");
        NotificationChannel actual=context.getSystemService(NotificationManager.class).getNotificationChannel(migrated.getString("audible"));
        assertNull("An immutable existing target cannot turn sound back on",actual.getSound());
        assertEquals("Reuse the owner's silent channel rather than creating a bypass ID",silent,actual.getId());
        SoundPreferences.prune(context,migrated);
        assertNotNull(context.getSystemService(NotificationManager.class).getNotificationChannel(silent));
    }

    @Test public void userSoundVibrationAndItsReferencedWavSurvivePresetMigrationAndPruning() throws Exception {
        if(Build.VERSION.SDK_INT<26)return;
        SoundPreferences.configure(context,settings(wav((short)7410)));
        JSONObject previous=SoundPreferences.config(context);
        Uri selected=SoundPreferences.soundUri(context,previous,"notification");
        String selectedFile=previous.getJSONObject("files").getString("notification");
        byte[] first=wav((short)7411),second=wav((short)7412);
        existingChannel(first,NotificationManager.IMPORTANCE_HIGH,selected,false);
        SoundPreferences.configure(context,settings(first));
        JSONObject migrated=SoundPreferences.configure(context,settings(second)).getJSONObject("channels");
        NotificationChannel actual=context.getSystemService(NotificationManager.class).getNotificationChannel(migrated.getString("audible"));
        assertEquals(selected,actual.getSound());assertFalse("OS-disabled vibration remains disabled",actual.shouldVibrate());
        SoundPreferences.prune(context,migrated);
        assertTrue("A WAV referenced by a kept/customized channel must not be pruned",new java.io.File(new java.io.File(context.getFilesDir(),"sounds"),selectedFile).isFile());
        try(java.io.InputStream sound=context.getContentResolver().openInputStream(selected)){assertTrue(sound.read()!=-1);}
    }

    @Test public void anOSRingtoneUriIsReusedWithoutGrantingAnotherProvidersUri() throws Exception {
        if(Build.VERSION.SDK_INT<26)return;
        byte[] first=wav((short)7511),second=wav((short)7512);
        Uri ringtone=android.provider.Settings.System.DEFAULT_NOTIFICATION_URI;
        String selected=existingChannel(first,NotificationManager.IMPORTANCE_HIGH,ringtone,true);
        SoundPreferences.configure(context,settings(first));
        JSONObject migrated=SoundPreferences.configure(context,settings(second)).getJSONObject("channels");
        assertEquals(selected,migrated.getString("audible"));
        assertEquals(ringtone,context.getSystemService(NotificationManager.class).getNotificationChannel(selected).getSound());
        SoundPreferences.prune(context,migrated);
        assertNotNull(context.getSystemService(NotificationManager.class).getNotificationChannel(selected));
    }

    @Test public void liftingABlockedAliasRestoresSeparateMutedAndQuietChannels() throws Exception {
        if(Build.VERSION.SDK_INT<26)return;
        JSONObject first=SoundPreferences.configure(context,settings(wav((short)7611))).getJSONObject("channels");
        JSONObject original=SoundPreferences.config(context),second=SoundPreferences.configure(context,settings(wav((short)7612))).getJSONObject("channels");
        JSONObject pending=SoundPreferences.config(context);
        String unblocked=first.getString("audible");
        // This is the persisted state immediately after the owner unblocks a
        // formerly blocked channel; altering OS importance from app code is forbidden.
        pending.put("channelIds",new JSONObject().put("audible",unblocked).put("muted",unblocked).put("silent",unblocked))
            .put("channelDefaults",original.getJSONObject("channelDefaults")).put("enabled",false);
        context.getSharedPreferences(SoundPreferences.PREFS,0).edit().putString("config",pending.toString()).commit();
        JSONObject refreshed=SoundPreferences.channels(context);
        assertEquals(second.getString("audible"),refreshed.getString("audible"));
        assertNotEquals(refreshed.getString("audible"),refreshed.getString("muted"));
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        assertNull(manager.getNotificationChannel(refreshed.getString("muted")).getSound());
        assertNull(manager.getNotificationChannel(refreshed.getString("silent")).getSound());
        assertEquals(refreshed.getString("muted"),SoundPreferences.notificationChannel(context,System.currentTimeMillis()));
    }

    @Test public void transientFocusIsReleasedOnCompletionStopAndDecoderFailure() throws Exception {
        Intent host=new Intent(context,WorkoutNotificationTestActivity.class).putExtra("audioFocusOnly",true);
        try(ActivityScenario<WorkoutNotificationTestActivity> scenario=ActivityScenario.launch(host)){
            SoundPreferences.configure(context,settings(tone(800)).put("vibration",false));
            assertTrue("A foreground preview obtains transient focus",SoundPreferences.play(context,"notification",true,0));
            assertNotNull(playbackField("focusManager"));
            assertTrue(((android.media.MediaPlayer)playbackField("player")).isPlaying());
            awaitPlaybackReleased();
            assertTrue(SoundPreferences.play(context,"notification",true,0));
            SoundPreferences.stop();awaitPlaybackReleased();
            String filename=SoundPreferences.config(context).getJSONObject("files").getString("notification");
            try(java.io.FileOutputStream broken=new java.io.FileOutputStream(new java.io.File(new java.io.File(context.getFilesDir(),"sounds"),filename))){
                broken.write(new byte[]{1,2,3,4});
            }
            assertFalse("Decoder failure must not leave music ducked",SoundPreferences.play(context,"notification",true,0));
            awaitPlaybackReleased();
        }
    }

    @Test public void aColdBackgroundDeadlineStartsForegroundBeforeRequestingFocus() throws Exception {
        android.app.AlarmManager alarms=context.getSystemService(android.app.AlarmManager.class);
        boolean exactBefore=Build.VERSION.SDK_INT<31||alarms.canScheduleExactAlarms();
        try{
            shell("pm grant "+context.getPackageName()+" android.permission.POST_NOTIFICATIONS");
            if(Build.VERSION.SDK_INT>=31&&!exactBefore)shell("appops set "+context.getPackageName()+" SCHEDULE_EXACT_ALARM allow");
            try(ActivityScenario<WorkoutNotificationTestActivity> scenario=ActivityScenario.launch(
                new Intent(context,WorkoutNotificationTestActivity.class).putExtra("audioFocusOnly",true))){
                SoundPreferences.configure(context,settings(tone(3000)).put("vibration",false));
            }
            context.stopService(new Intent(context,WorkoutNotificationService.class));SystemClock.sleep(250);
            long now=System.currentTimeMillis(),deadline=now+1500;
            context.getSharedPreferences(SoundPreferences.PREFS,0).edit().remove("lastRest").commit();
            JSONObject state=new JSONObject().put("active",true).put("paused",false).put("observedAt",now).put("elapsedMs",60000)
                .put("workoutLabel","WORKOUT").put("restLabel","REST").put("setLabel","SET 2")
                .put("restSignalAt",deadline).put("restEndsAt",deadline);
            context.getSharedPreferences(WorkoutTimerAlarms.PREFS,0).edit().putString("state",state.toString()).commit();
            WorkoutTimerAlarms.sync(context,state);
            shell("input keyevent KEYCODE_HOME");
            for(int wait=0;wait<70&&playbackField("player")==null;wait++)SystemClock.sleep(100);
            assertNotNull("A native alarm can play with the WebView closed",playbackField("player"));
            assertNotNull("The foreground timer owns transient focus",playbackField("focusManager"));
            assertEquals(deadline,context.getSharedPreferences(SoundPreferences.PREFS,0).getLong("lastRest",0));
            Object playing=playbackField("player");
            context.startService(new Intent(context,WorkoutNotificationService.class).putExtra("state",state.toString()));
            SystemClock.sleep(100);
            assertSame("Duplicate payload/receiver refresh cannot restart the alert",playing,playbackField("player"));
            awaitPlaybackReleased();
        }finally{
            context.stopService(new Intent(context,WorkoutNotificationService.class));WorkoutTimerAlarms.cancel(context);
            // Like POST_NOTIFICATIONS above, this grant belongs only to the
            // disposable instrumentation target. Revoking exact-alarm access
            // here would stop the app (and its test runner) on Android 12+.
        }
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
    @Test public void notificationMuteKeepsChannelsAndFallbackIsSilentAndStable() throws Exception {
        JSONObject channels=SoundPreferences.configure(context,settings((short)1).put("notificationEnabled",false)).getJSONObject("channels");
        assertEquals(channels.getString("muted"),SoundPreferences.notificationChannel(context,System.currentTimeMillis()));
        assertTrue("Other event audio stays enabled",SoundPreferences.config(context).getBoolean("enabled"));
        JSONObject first=SoundPreferences.fallbackChannels(context,true).getJSONObject("channels");
        assertEquals(first.toString(),SoundPreferences.fallbackChannels(context,true).getJSONObject("channels").toString());
        if(Build.VERSION.SDK_INT>=26){
            NotificationManager manager=context.getSystemService(NotificationManager.class);
            assertNull(manager.getNotificationChannel(first.getString("audible")).getSound());
            assertTrue(manager.getNotificationChannel(first.getString("muted")).shouldVibrate());
            assertNull(manager.getNotificationChannel(first.getString("silent")).getSound());
            assertFalse(manager.getNotificationChannel(first.getString("silent")).shouldVibrate());
        }
    }
    @Test public void nativeWorkAndRestClaimsAreIndependentAndIgnoreDuplicateOrAbandonedDeadlines() throws Exception {
        context.getSharedPreferences(SoundPreferences.PREFS,0).edit().remove("lastRest").remove("lastWork").commit();
        assertTrue(SoundPreferences.claimTimer(context,"rest",12345));
        assertTrue(SoundPreferences.claimTimer(context,"work",12345));
        assertFalse(SoundPreferences.claimTimer(context,"work",12345));
        assertFalse(SoundPreferences.claimTimer(context,"rest",12345));
        long now=System.currentTimeMillis();
        SoundPreferences.configure(context,new JSONObject().put("enabled",false).put("vibration",false));
        JSONObject state=new JSONObject().put("restSignalAt",now-60001).put("workSignalAt",now+1);
        WorkoutTimerAlarms.completeDue(context,state,now);
        assertEquals(12345,context.getSharedPreferences(SoundPreferences.PREFS,0).getLong("lastRest",0));
        assertEquals(12345,context.getSharedPreferences(SoundPreferences.PREFS,0).getLong("lastWork",0));
        state.put("workSignalAt",now);WorkoutTimerAlarms.completeDue(context,state,now);
        assertEquals(now,context.getSharedPreferences(SoundPreferences.PREFS,0).getLong("lastWork",0));
        assertFalse(SoundPreferences.claimTimer(context,"work",now));
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
