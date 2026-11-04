package app.framegym.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.util.Log;
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
import java.util.Arrays;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/** Small app-owned WAV files and preferences remain available without the WebView. */
final class SoundPreferences {
    static final String PREFS = "tgym_sounds";
    private static final String[] EVENTS = {"rest", "work", "countdown", "set", "completion", "notification"};
    private static MediaPlayer player;
    private static AudioManager focusManager;
    private static Object focusRequest;
    private static AudioManager.OnAudioFocusChangeListener focusListener;
    private SoundPreferences() {}

    static JSONObject config(Context context) {
        try { return new JSONObject(context.getSharedPreferences(PREFS, 0).getString("config", "{}")); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    static synchronized JSONObject configure(Context context, JSONObject input) throws Exception {
        JSONObject previous = config(context);
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
        JSONObject channels = createChannels(context, saved, previous);
        saved.put("channelDefaults",channelDefaults(context,saved,previous,channels));
        saved.put("channelIds", channels);
        if (!context.getSharedPreferences(PREFS, 0).edit().putString("config", saved.toString()).commit()) throw new java.io.IOException("Cannot persist sound preferences");
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
                if (id.startsWith("tgym_sound_") && !id.equals(currentChannels.getString("audible")) && !id.equals(currentChannels.getString("muted")) && !id.equals(currentChannels.getString("silent")) && !hasUserOverrides(context, channel)) manager.deleteNotificationChannel(id);
            }
            for (NotificationChannel channel : manager.getNotificationChannels()) {
                Uri sound=channel.getSound();
                if (ownedSound(context,sound) && sound.getLastPathSegment()!=null && sound.getLastPathSegment().matches("[a-f0-9]{64}\\.wav")) current.add(sound.getLastPathSegment());
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

    private static JSONObject defaultChannelIds(Context context,JSONObject config) throws Exception {
        boolean vibration=config.optBoolean("vibration",true);
        String filename=config.optJSONObject("files")==null?"":config.optJSONObject("files").optString("notification");
        Uri sound=soundUri(context,config,"notification");
        String audible="tgym_sound_"+(sound==null?"silent":filename.substring(0,24))+(vibration?"_v":"_n");
        return new JSONObject().put("audible",audible).put("muted","tgym_sound_silent"+(vibration?"_v":"_n")).put("silent","tgym_sound_silent_n");
    }

    static JSONObject channels(Context context) throws Exception {
        JSONObject config=config(context),saved=config.optJSONObject("channelIds");
        if(Build.VERSION.SDK_INT>=26&&saved!=null){
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            boolean present=true;
            for(String kind:new String[]{"audible","muted","silent"}){
                NotificationChannel channel=manager.getNotificationChannel(saved.optString(kind));
                if(channel==null){present=false;break;}
                grantSound(context,channel.getSound());
            }
            if(present){
                NotificationChannel audible=manager.getNotificationChannel(saved.getString("audible"));
                boolean blockedAlias=saved.getString("audible").equals(saved.getString("muted"))&&saved.getString("audible").equals(saved.getString("silent"));
                if(blockedAlias&&audible.getImportance()!=NotificationManager.IMPORTANCE_NONE){
                    // The owner unblocked that channel in Android. Restore the
                    // ordinary muted/quiet routes rather than sharing its sound.
                    JSONObject next=createChannels(context,config,config);
                    JSONObject defaults=channelDefaults(context,config,config,next);
                    config.put("channelDefaults",defaults).put("channelIds",next);
                    if(!context.getSharedPreferences(PREFS,0).edit().putString("config",config.toString()).commit())throw new java.io.IOException("Cannot refresh channel preferences");
                    return next;
                }
                return new JSONObject(saved.toString());
            }
        }
        return createChannels(context,config,null);
    }

    /** Preserve the current Android choices when a new preset/gain changes the PCM hash. */
    private static JSONObject createChannels(Context context,JSONObject config,JSONObject previous) throws Exception {
        JSONObject ids=defaultChannelIds(context,config);
        boolean vibration=config.optBoolean("vibration",true);
        if(Build.VERSION.SDK_INT>=26){
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel old=null;
            if(previous!=null){
                old=manager.getNotificationChannel(previousAudibleId(context,previous));
            }
            if(old!=null&&old.getImportance()==NotificationManager.IMPORTANCE_NONE){
                // Reusing the blocked ID also handles an existing/deleted target hash
                // whose immutable behavior Android refuses to update.
                return new JSONObject().put("audible",old.getId()).put("muted",old.getId()).put("silent",old.getId());
            }
            boolean inheritImportance=old!=null&&(old.getImportance()!=NotificationManager.IMPORTANCE_HIGH||(Build.VERSION.SDK_INT>=29&&old.hasUserSetImportance()));
            JSONObject oldDefaults=previous==null?null:channelDefaults(context,previous,null,null);
            Uri oldAppSound=oldDefaults==null||oldDefaults.isNull("sound")?null:Uri.parse(oldDefaults.getString("sound"));
            boolean inheritSound=old!=null&&((Build.VERSION.SDK_INT>=30&&old.hasUserSetSound())||!Objects.equals(old.getSound(),oldAppSound));
            boolean inheritVibration=old!=null&&(old.shouldVibrate()!=oldDefaults.optBoolean("vibration",true)||
                (old.shouldVibrate()&&old.getVibrationPattern()!=null&&!Arrays.equals(old.getVibrationPattern(),new long[]{0,200,100,200})));
            int importance=inheritImportance?old.getImportance():NotificationManager.IMPORTANCE_HIGH;
            Uri sound=inheritSound?old.getSound():soundUri(context,config,"notification");
            boolean vibrate=inheritVibration?old.shouldVibrate():vibration;
            long[] pattern=inheritVibration?old.getVibrationPattern():null;
            // Android may own a user-selected ringtone URI that this app cannot grant.
            boolean foreignSound=inheritSound&&sound!=null&&!ownedSound(context,sound);
            if(!foreignSound)createChannel(context,manager,ids.getString("audible"),sound,vibrate,importance,pattern);
            createChannel(context,manager,ids.getString("muted"),null,vibrate,importance,pattern);
            createChannel(context,manager,ids.getString("silent"),null,false,importance,null);
            NotificationChannel made=foreignSound?null:manager.getNotificationChannel(ids.getString("audible"));
            if(old!=null&&(foreignSound||(inheritSound&&made!=null&&!Objects.equals(made.getSound(),sound))||
                (inheritImportance&&made!=null&&made.getImportance()!=importance)||(inheritVibration&&made!=null&&made.shouldVibrate()!=vibrate))){
                // Prefer the owner's channel to resurrecting a blocked/silent alert.
                ids.put("audible",old.getId());
            }
        }
        return ids;
    }

    @android.annotation.TargetApi(26)
    private static boolean hasUserOverrides(Context context,NotificationChannel channel){
        if(channel.getImportance()!=NotificationManager.IMPORTANCE_HIGH)return true;
        if(Build.VERSION.SDK_INT>=29&&channel.hasUserSetImportance())return true;
        if(Build.VERSION.SDK_INT>=30&&channel.hasUserSetSound())return true;
        String id=channel.getId(),filename=channel.getSound()==null?null:channel.getSound().getLastPathSegment();
        if(id.matches("tgym_sound_[a-f0-9]{24}_[vn]")){
            if(!ownedSound(context,channel.getSound())||filename==null||!filename.startsWith(id.substring(11,35)))return true;
        }else if(channel.getSound()!=null)return true;
        return channel.shouldVibrate()!=id.endsWith("_v")||(channel.shouldVibrate()&&channel.getVibrationPattern()!=null&&!Arrays.equals(channel.getVibrationPattern(),new long[]{0,200,100,200}));
    }

    private static boolean ownedSound(Context context,Uri sound){
        return sound!=null&&"content".equals(sound.getScheme())&&(context.getPackageName()+".fileprovider").equals(sound.getAuthority());
    }

    private static Uri configuredNotificationUri(Context context,JSONObject config){
        JSONObject files=config.optJSONObject("files");String filename=files==null?"":files.optString("notification");
        if(!filename.matches("[a-f0-9]{64}\\.wav"))return null;
        // Comparing policy must not mistake a missing default WAV for an OS choice.
        return FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",new File(new File(context.getFilesDir(),"sounds"),filename));
    }

    private static String previousAudibleId(Context context,JSONObject config) throws Exception {
        JSONObject ids=config.optJSONObject("channelIds");
        if(ids!=null)return ids.optString("audible");
        JSONObject files=config.optJSONObject("files");String filename=files==null?"":files.optString("notification");
        // Legacy native preferences predate channelIds. Missing audio must not
        // hide the real channel's OS block behind a new fallback identifier.
        return filename.matches("[a-f0-9]{64}\\.wav")?"tgym_sound_"+filename.substring(0,24)+(config.optBoolean("vibration",true)?"_v":"_n"):defaultChannelIds(context,config).getString("audible");
    }

    private static JSONObject channelDefaults(Context context,JSONObject config,JSONObject previous,JSONObject selected) throws Exception {
        String id=selected==null?previousAudibleId(context,config):selected.getString("audible");
        JSONObject existing=config.optJSONObject("channelDefaults");
        if(selected==null&&existing!=null&&id.equals(existing.optString("id")))return new JSONObject(existing.toString());
        String canonical=defaultChannelIds(context,config).getString("audible");
        if(selected!=null&&!id.equals(canonical)&&previous!=null&&id.equals(previousAudibleId(context,previous)))return channelDefaults(context,previous,null,null);
        Uri sound=configuredNotificationUri(context,config);
        return new JSONObject().put("id",id).put("sound",sound==null?JSONObject.NULL:sound.toString()).put("vibration",config.optBoolean("vibration",true));
    }

    private static void grantSound(Context context,Uri sound){
        if(!ownedSound(context,sound))return;
        context.grantUriPermission("com.android.systemui",sound,Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.grantUriPermission("android",sound,Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }

    static JSONObject fallbackChannels(Context context,boolean vibration) throws Exception {
        String muted="tgym_sound_fallback_v2_"+(vibration?"v":"n"),silent="tgym_sound_fallback_v2_n";
        if(Build.VERSION.SDK_INT>=26){
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            JSONObject previous=config(context);
            NotificationChannel old=manager.getNotificationChannel(previousAudibleId(context,previous));
            if(old!=null&&old.getImportance()==NotificationManager.IMPORTANCE_NONE){
                return new JSONObject().put("channels",new JSONObject().put("audible",old.getId()).put("muted",old.getId()).put("silent",old.getId())).put("notificationSoundsSupported",true);
            }
            createChannel(context,manager,muted,null,vibration);createChannel(context,manager,silent,null,false);
        }
        return new JSONObject().put("channels",new JSONObject().put("audible",muted).put("muted",muted).put("silent",silent)).put("notificationSoundsSupported",Build.VERSION.SDK_INT>=26);
    }

    @android.annotation.TargetApi(26)
    private static void createChannel(Context context,NotificationManager manager,String id,Uri sound,boolean vibration){
        createChannel(context,manager,id,sound,vibration,NotificationManager.IMPORTANCE_HIGH,null);
    }

    @android.annotation.TargetApi(26)
    private static void createChannel(Context context,NotificationManager manager,String id,Uri sound,boolean vibration,int importance,long[] pattern){
        grantSound(context,sound);
        NotificationChannel channel=new NotificationChannel(id,"TGym \u00b7 Alerts",importance);
        channel.setSound(sound,attributes());channel.enableVibration(vibration);
        if(vibration)channel.setVibrationPattern(pattern==null?new long[]{0,200,100,200}:pattern);
        manager.createNotificationChannel(channel);
    }

    static String notificationChannel(Context context, long now) throws Exception {
        JSONObject config = config(context);
        try{return channels(context).getString(quiet(config, now) ? "silent" : config.optBoolean("enabled", true)&&config.optBoolean("notificationEnabled",true) ? "audible" : "muted");}
        catch(Exception error){
            Log.w("TGymAudio","Alert sound unavailable; retaining silent notification delivery",error);
            return fallbackChannels(context,config.optBoolean("vibration",true)).getJSONObject("channels").getString(quiet(config,now)?"silent":"muted");
        }
    }

    /** Persist the deadline before playing so JS, service refresh and process recreation cannot double-alert. */
    static synchronized boolean claimRest(Context context, long occurrence) {
        return claimTimer(context,"rest",occurrence);
    }
    static synchronized boolean claimTimer(Context context,String event,long occurrence) {
        if (occurrence <= 0) return true;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
        String key="rest".equals(event)?"lastRest":"lastWork";
        if (prefs.getLong(key, 0) >= occurrence) return false;
        return prefs.edit().putLong(key, occurrence).commit();
    }

    static synchronized boolean play(Context context, String event, boolean preview, long occurrence) {
        if (("rest".equals(event)||"work".equals(event)) && !preview && !claimTimer(context,event,occurrence)) return false;
        JSONObject config = config(context);
        if (!preview && quiet(config, System.currentTimeMillis())) return false;
        // Respect Android silent/vibrate/DND modes as well as TGym's own preferences.
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notices = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean dnd = notices.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL;
        if (!preview && dnd) return false;
        if (!preview && config.optBoolean("vibration", true) && !"countdown".equals(event)) {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && audio.getRingerMode() != AudioManager.RINGER_MODE_SILENT) {
                long[] pattern = "set".equals(event) ? new long[]{0,30} : new long[]{0,200,100,200};
                if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), attributes());
                else vibrator.vibrate(pattern, -1, attributes());
            }
        }
        if (!config.optBoolean("enabled", true) || ("notification".equals(event)&&!config.optBoolean("notificationEnabled",true)) || audio.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return false;
        Uri uri = soundUri(context, config, event);
        if (uri == null) return false;
        stop();
        try {
            MediaPlayer next = new MediaPlayer();
            player = next;
            // A short notification may duck music, but must never seize permanent
            // focus or replay later after a call/another app denied the request.
            if (!requestFocus(context, next)) { stop(); return false; }
            // Hold CPU only while the short clip plays; release() clears the lock.
            next.setWakeMode(context, android.os.PowerManager.PARTIAL_WAKE_LOCK);
            next.setAudioAttributes(attributes());
            next.setDataSource(context, uri);
            next.setOnCompletionListener(done -> { synchronized (SoundPreferences.class) { if (player == done) stop(); } });
            next.setOnErrorListener((failed, what, extra) -> { Log.e("TGymAudio", "MediaPlayer event=" + event + " what=" + what + " extra=" + extra); synchronized (SoundPreferences.class) { if (player == failed) stop(); } return true; });
            next.prepare(); next.start(); return true;
        } catch (Exception error) { Log.e("TGymAudio", "Cannot play " + event, error); stop(); return false; }
    }

    private static boolean requestFocus(Context context, MediaPlayer owner) {
        focusManager = (AudioManager) context.getApplicationContext().getSystemService(Context.AUDIO_SERVICE);
        if (focusManager == null) return false;
        focusListener = change -> {
            if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                synchronized (SoundPreferences.class) {
                    // A late callback from an interrupted clip cannot stop its replacement.
                    if (player == owner) stop();
                }
            }
        };
        if (Build.VERSION.SDK_INT >= 26) {
            return Api26Focus.request(focusManager,focusListener);
        }
        return focusManager.requestAudioFocus(focusListener, AudioManager.STREAM_NOTIFICATION,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private static void abandonFocus() {
        AudioManager manager = focusManager;
        Object request = focusRequest;
        AudioManager.OnAudioFocusChangeListener listener = focusListener;
        focusManager = null; focusRequest = null; focusListener = null;
        if (manager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26 && request != null) Api26Focus.abandon(manager,request);
            else if (listener != null) manager.abandonAudioFocus(listener);
        } catch (RuntimeException error) { Log.w("TGymAudio", "Cannot release audio focus", error); }
    }

    /** Keep API-26 class references out of the API-23 playback path. */
    @android.annotation.TargetApi(26)
    private static final class Api26Focus {
        static boolean request(AudioManager manager,AudioManager.OnAudioFocusChangeListener listener){
            AudioFocusRequest request=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes()).setAcceptsDelayedFocusGain(false)
                .setOnAudioFocusChangeListener(listener,new android.os.Handler(android.os.Looper.getMainLooper())).build();
            focusRequest=request;
            return manager.requestAudioFocus(request)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        static void abandon(AudioManager manager,Object request){manager.abandonAudioFocusRequest((AudioFocusRequest)request);}
    }

    static synchronized void stop() {
        MediaPlayer previous = player; player = null;
        try { if (previous != null) previous.release(); }
        finally { abandonFocus(); }
    }
}
