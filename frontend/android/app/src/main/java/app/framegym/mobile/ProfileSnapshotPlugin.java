package app.framegym.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Small bridge messages, serialized file IO, and no caller-controlled paths. */
@CapacitorPlugin(name="ProfileSnapshot")
public class ProfileSnapshotPlugin extends Plugin {
    // Activity recreation must not create a second writer to the same AtomicFile.
    private static final ExecutorService worker=Executors.newSingleThreadExecutor();
    private static ProfileSnapshotStore store;
    private static ProfileClockJournalStore clock;
    private String ownedToken;
    @Override public void load() {
        synchronized(ProfileSnapshotPlugin.class) {
            if(store==null)store=new ProfileSnapshotStore(new File(getContext().getFilesDir(),ProfileSnapshotStore.FILE));
            if(clock==null)clock=new ProfileClockJournalStore(new File(getContext().getFilesDir(),ProfileClockJournalStore.FILE));
        }
    }
    private interface Work { JSObject run() throws Exception; }
    // JSONObject represents epoch milliseconds as Long; PluginCall.getDouble
    // accepts only Integer/Float/Double and would reject those valid timestamps.
    static Double number(Object value) { return value instanceof Number?((Number)value).doubleValue():null; }
    private void run(PluginCall call, Work work) {
        worker.execute(() -> {
            try { call.resolve(work.run()); }
            catch (Exception error) { call.reject("The private profile snapshot could not be saved or read",error); }
        });
    }
    @PluginMethod public void read(PluginCall call) {
        run(call,() -> { JSObject result=new JSObject(); result.put("data",store.recoverRead()); ownedToken=null; return result; });
    }
    @PluginMethod public void begin(PluginCall call) {
        boolean byteMode=call.getData().has("bytes"),characterMode=call.getData().has("characters");
        Double count=number(call.getData().opt(byteMode?"bytes":"characters"));
        run(call,() -> {
            if(byteMode==characterMode || count==null || Double.isNaN(count) || Double.isInfinite(count)
                || count<=0 || count!=Math.rint(count) || count>9007199254740991d)throw new IOException("Exactly one valid snapshot count is required");
            ownedToken=byteMode?store.begin(count.longValue()):store.beginCharacters(count.longValue());
            JSObject result=new JSObject(); result.put("token",ownedToken); return result;
        });
    }
    @PluginMethod public void readClock(PluginCall call) {
        run(call,() -> { JSObject result=new JSObject();result.put("journal",clock.read());return result; });
    }
    @PluginMethod public void writeClock(PluginCall call) {
        String id=call.getString("id");Double at=number(call.getData().opt("at")),timestamp=number(call.getData().opt("_ts"));
        run(call,() -> {
            if(at==null || timestamp==null)throw new IOException("Missing clock journal timestamp");
            JSObject result=new JSObject();result.put("saved",clock.write(id,at,timestamp));return result;
        });
    }
    @PluginMethod public void append(PluginCall call) {
        String token=call.getString("token"),data=call.getString("data"); Integer index=call.getInt("index");
        run(call,() -> { if(index==null)throw new IOException("Missing snapshot chunk index"); store.append(token,index,data); return new JSObject(); });
    }
    @PluginMethod public void commit(PluginCall call) {
        String token=call.getString("token");
        run(call,() -> { store.commit(token); if(token.equals(ownedToken))ownedToken=null; return new JSObject(); });
    }
    @PluginMethod public void abort(PluginCall call) {
        String token=call.getString("token");
        run(call,() -> { store.abort(token); if(token.equals(ownedToken))ownedToken=null; return new JSObject(); });
    }
    @Override protected void handleOnDestroy() {
        worker.execute(() -> {
            String token=ownedToken; ownedToken=null;
            // A newer Activity may already own a replacement lease.
            if(token!=null)try { store.abort(token); } catch(IOException stale) { }
        });
    }
}
