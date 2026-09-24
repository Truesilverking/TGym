package app.framegym.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SoundPreferences")
public class SoundPreferencesPlugin extends Plugin {
    @PluginMethod public void configure(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(SoundPreferences.configure(getContext(), call.getData()))); }
        catch (Exception error) { call.reject("Cannot save sound preferences", error); }
    }
    @PluginMethod public void play(PluginCall call) {
        boolean played = SoundPreferences.play(getContext(), call.getString("event", "notification"), call.getBoolean("preview", false), call.getLong("occurrence", 0L));
        JSObject result = new JSObject(); result.put("handled", true); result.put("played", played); call.resolve(result);
    }
    @PluginMethod public void stop(PluginCall call) { SoundPreferences.stop(); call.resolve(); }
    @PluginMethod public void prune(PluginCall call) {
        try { SoundPreferences.prune(getContext(), call.getObject("channels", new JSObject())); call.resolve(); }
        catch (Exception error) { call.reject("Cannot clean up old sounds", error); }
    }
}
