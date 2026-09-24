package app.framegym.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.util.AtomicFile;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/** Small app-owned WAV files and preferences remain available without the WebView. */
final class SoundPreferences {
    static final String PREFS = "tgym_sounds";
    private static final String[] EVENTS = {"rest", "work", "countdown", "set", "completion", "notification"};
    private static MediaPlayer player;
    private SoundPreferences() {}

    static JSONObject config(Context context) {
        try { return new JSONObject(context.getSharedPreferences(PREFS, 0).getString("config", "{}")); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    static synchronized JSONObject configure(Context context, JSONObject input) throws Exception {
        JSONObject saved = new JSONObject(input.toString());
        JSONObject sounds = input.optJSONObject("sounds"), files = new JSONObject();
        File directory = new File(context.getFilesDir(), "sounds");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("Cannot save sounds");
        for (String event : EVENTS) {
            JSONObject choice = sounds == null ? null : sounds.optJSONObject(event);
            if (choice == null || "silent".equals(choice.optString("id"))) continue;
            String encoded = choice.optString("data", "");
            if (encoded.length() > 214000) throw new IllegalArgumentException("Sound is too large");
            byte[] wav = Base64.decode(encoded, Base64.DEFAULT);
            validateWav(wav);
            String filename = hex(MessageDigest.getInstance("SHA-256").digest(wav)) + ".wav";
            File file = new File(directory, filename);
            if (!file.isFile()) {
                AtomicFile atomic = new AtomicFile(file);
                FileOutputStream stream = atomic.startWrite();
                try { stream.write(wav); atomic.finishWrite(stream); }
                catch (Exception error) { atomic.failWrite(stream); throw error; }
            }
            files.put(event, filename);
        }
        saved.remove("sounds");
        saved.put("files", files);
        if (!context.getSharedPreferences(PREFS, 0).edit().putString("config", saved.toString()).commit()) throw new java.io.IOException("Cannot persist sound preferences");
        JSONObject channels = channels(context);
        return new JSONObject().put("channels", channels).put("notificationSoundsSupported", Build.VERSION.SDK_INT >= 26);
    }

    /** Old alarm channel URIs remain valid until JS confirms replacement scheduling succeeded. */
    static synchronized void prune(Context context, JSONObject expectedChannels) throws Exception {
        JSONObject currentChannels = channels(context);
        for (String kind : new String[]{"audible", "muted", "silent"}) if (!currentChannels.optString(kind).equals(expectedChannels.optString(kind))) return;
        JSONObject files = config(context).optJSONObject("files");
        Set<String> current = new HashSet<>();
        if (files != null) for (String event : EVENTS) current.add(files.optString(event));
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            for (NotificationChannel channel : manager.getNotificationChannels()) {
                String id = channel.getId();
                if (id.startsWith("tgym_sound_") && !id.equals(currentChannels.getString("audible")) && !id.equals(currentChannels.getString("muted")) && !id.equals(currentChannels.getString("silent"))) manager.deleteNotificationChannel(id);
            }
        }
        File[] stored = new File(context.getFilesDir(), "sounds").listFiles();
        if (stored != null) for (File file : stored) {
            if (file.getName().matches("[a-f0-9]{64}\\.wav") && !current.contains(file.getName())) file.delete();
        }
    }

    static void validateWav(byte[] wav) {
        if (wav.length < 46 || wav.length > 160044) throw new IllegalArgumentException("Invalid short WAV");
        ByteBuffer bytes = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        if (!"RIFF".equals(new String(wav, 0, 4, StandardCharsets.US_ASCII)) ||
            !"WAVEfmt ".equals(new String(wav, 8, 8, StandardCharsets.US_ASCII)) ||
            bytes.getInt(4) != wav.length - 8 || bytes.getInt(16) != 16 || bytes.getShort(20) != 1 || bytes.getShort(22) != 1 ||
            bytes.getInt(24) != 16000 || bytes.getInt(28) != 32000 || bytes.getShort(32) != 2 || bytes.getShort(34) != 16 ||
            !"data".equals(new String(wav, 36, 4, StandardCharsets.US_ASCII)) ||
            bytes.getInt(40) != wav.length - 44 || (wav.length - 44) % 2 != 0) {
            throw new IllegalArgumentException("Expected mono 16 kHz PCM WAV");
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return result.toString();
    }

    static boolean quiet(JSONObject config, long now) {
        if (!config.optBoolean("quietOn")) return false;
        Calendar date = Calendar.getInstance(); date.setTimeInMillis(now);
        int minute = date.get(Calendar.HOUR_OF_DAY) * 60 + date.get(Calendar.MINUTE);
        int start = minutes(config.optString("quietStart"), 22 * 60), end = minutes(config.optString("quietEnd"), 7 * 60);
        return start < end ? minute >= start && minute < end : start != end && (minute >= start || minute < end);
    }

    private static int minutes(String value, int fallback) {
        if (!value.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) return fallback;
        return Integer.parseInt(value.substring(0, 2)) * 60 + Integer.parseInt(value.substring(3));
    }

    static Uri soundUri(Context context, JSONObject config, String event) {
        JSONObject files = config.optJSONObject("files");
        String filename = files == null ? "" : files.optString(event);
        if (!filename.matches("[a-f0-9]{64}\\.wav")) return null;
        File file = new File(new File(context.getFilesDir(), "sounds"), filename);
        return file.isFile() ? FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file) : null;
    }

    static AudioAttributes attributes() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    }

    static JSONObject channels(Context context) throws Exception {
        JSONObject config = config(context);
        boolean vibration = config.optBoolean("vibration", true);
        String filename = config.optJSONObject("files") == null ? "" : config.optJSONObject("files").optString("notification");
        Uri sound = soundUri(context, config, "notification");
        String audible = "tgym_sound_" + (sound == null ? "silent" : filename.substring(0, 24)) + (vibration ? "_v" : "_n");
        String muted = "tgym_sound_silent" + (vibration ? "_v" : "_n"), silent = "tgym_sound_silent_n";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            createChannel(context, manager, audible, sound, vibration);
            createChannel(context, manager, muted, null, vibration);
            createChannel(context, manager, silent, null, false);
        }
        return new JSONObject().put("audible", audible).put("muted", muted).put("silent", silent);
    }

    @android.annotation.TargetApi(26)
    private static void createChannel(Context context, NotificationManager manager, String id, Uri sound, boolean vibration) {
        if (sound != null) {
            context.grantUriPermission("com.android.systemui", sound, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            context.grantUriPermission("android", sound, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        NotificationChannel channel = new NotificationChannel(id, "TGym · Alerts", NotificationManager.IMPORTANCE_HIGH);
        channel.setSound(sound, attributes()); channel.enableVibration(vibration);
        if (vibration) channel.setVibrationPattern(new long[]{0, 200, 100, 200});
        manager.createNotificationChannel(channel);
    }

    static String notificationChannel(Context context, long now) throws Exception {
        JSONObject config = config(context);
        return channels(context).getString(quiet(config, now) ? "silent" : config.optBoolean("enabled", true) ? "audible" : "muted");
    }

    /** Persist the deadline before playing so JS, service refresh and process recreation cannot double-alert. */
    static synchronized boolean claimRest(Context context, long occurrence) {
        if (occurrence <= 0) return true;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
        if (prefs.getLong("lastRest", 0) >= occurrence) return false;
        return prefs.edit().putLong("lastRest", occurrence).commit();
    }

    static synchronized boolean play(Context context, String event, boolean preview, long occurrence) {
        if ("rest".equals(event) && !preview && !claimRest(context, occurrence)) return false;
        JSONObject config = config(context);
        if (!preview && quiet(config, System.currentTimeMillis())) return false;
        // Respect Android silent/vibrate/DND modes as well as TGym's own preferences.
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notices = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean dnd = Build.VERSION.SDK_INT >= 23 && notices.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL;
        if (!preview && dnd) return false;
        if (!preview && config.optBoolean("vibration", true) && !"countdown".equals(event)) {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && audio.getRingerMode() != AudioManager.RINGER_MODE_SILENT) {
                long[] pattern = "set".equals(event) ? new long[]{0,30} : new long[]{0,200,100,200};
                if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), attributes());
                else vibrator.vibrate(pattern, -1, attributes());
            }
        }
        if ((!preview && !config.optBoolean("enabled", true)) || audio.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return false;
        Uri uri = soundUri(context, config, event);
        if (uri == null) return false;
        stop();
        try {
            MediaPlayer next = new MediaPlayer();
            player = next;
            next.setAudioAttributes(attributes());
            next.setDataSource(context, uri);
            next.setOnCompletionListener(done -> { synchronized (SoundPreferences.class) { if (player == done) player = null; done.release(); } });
            next.setOnErrorListener((failed, what, extra) -> { synchronized (SoundPreferences.class) { if (player == failed) player = null; failed.release(); } return true; });
            next.prepare(); next.start(); return true;
        } catch (Exception ignored) { stop(); return false; }
    }

    static synchronized void stop() {
        if (player != null) { player.release(); player = null; }
    }
}
