package app.framegym.mobile;

import android.util.AtomicFile;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONException;
import org.json.JSONObject;

/** Independent, bounded metadata only. It never rewrites or chooses a profile. */
final class ProfileClockJournalStore {
    static final String FILE="framegym-clock.json";
    private final AtomicFile file;
    ProfileClockJournalStore(File path) { this(new AtomicFile(path)); }
    ProfileClockJournalStore(AtomicFile file) { this.file=file; }
    private static boolean positive(double value) { return !Double.isNaN(value) && !Double.isInfinite(value) && value>0; }
    private static boolean valid(JSONObject value) {
        Object id=value.opt("id"),at=value.opt("at"),timestamp=value.opt("_ts");
        return id instanceof String && ((String)id).length()>0 && ((String)id).length()<=256
            && at instanceof Number && positive(((Number)at).doubleValue())
            && timestamp instanceof Number && positive(((Number)timestamp).doubleValue());
    }
    synchronized JSONObject read() throws IOException {
        try {
            byte[] data=file.readFully();
            if(data.length>2048)return null;
            JSONObject value=new JSONObject(new String(data,StandardCharsets.UTF_8));
            return valid(value)?value:null;
        } catch(FileNotFoundException missing) { return null; }
        catch(JSONException malformed) { return null; }
    }
    synchronized boolean write(String id,double at,double timestamp) throws IOException {
        if(id==null || id.length()==0 || id.length()>256 || !positive(at) || !positive(timestamp)) throw new IOException("Invalid clock journal");
        if(timestamp>System.currentTimeMillis() || at>timestamp)throw new IOException("Clock journal timestamp is in the future");
        JSONObject previous=read();
        if(previous!=null) {
            double older=previous.optDouble("_ts");
            if(older<=System.currentTimeMillis() && (timestamp<older || timestamp==older && id.equals(previous.optString("id")) && at<=previous.optDouble("at")))return false;
        }
        byte[] data;
        try { data=new JSONObject().put("id",id).put("at",at).put("_ts",timestamp).toString().getBytes(StandardCharsets.UTF_8); }
        catch(JSONException invalid) { throw new IOException("Invalid clock journal",invalid); }
        if(data.length>2048)throw new IOException("Clock journal is too large");
        FileOutputStream output=file.startWrite();
        try { output.write(data);output.getFD().sync(); }
        catch(IOException error) { file.failWrite(output);throw error; }
        try { file.finishWrite(output); }
        finally { try {output.close();}catch(IOException ignored) { } }
        if(!Arrays.equals(data,file.readFully()))throw new IOException("Clock journal commit could not be verified");
        return true;
    }
}
