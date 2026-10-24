package app.framegym.mobile;

import android.content.Context;
import android.util.AtomicFile;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ProfileClockJournalTest {
    private File directory,path;
    private ProfileClockJournalStore clock;
    @Before public void setup() {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        directory=new File(context.getCacheDir(),"clock-test-"+java.util.UUID.randomUUID());
        assertTrue(directory.mkdirs());path=new File(directory,ProfileClockJournalStore.FILE);clock=new ProfileClockJournalStore(path);
    }
    @After public void cleanup() {
        if(directory!=null){File[] files=directory.listFiles();if(files!=null)for(File file:files)file.delete();directory.delete();}
    }
    private interface Throwing { void run() throws Exception; }
    private void rejects(Throwing work) throws Exception { try{work.run();fail("Expected invalid clock metadata to be rejected");}catch(IOException expected){ } }
    private void raw(String text) throws IOException {try(FileOutputStream out=new FileOutputStream(path)){out.write(text.getBytes(StandardCharsets.UTF_8));}}

    @Test public void missingAndMalformedMetadataDoNotInventAClock() throws Exception {
        assertNull(clock.read());assertFalse(path.exists());raw("broken");assertNull(clock.read());
    }
    @Test public void epochMillisecondsAcceptLongWithoutRoundingAndOnlyThreeFieldsAreWritten() throws Exception {
        long timestamp=System.currentTimeMillis()-100;
        assertEquals((double)timestamp,ProfileSnapshotPlugin.number(new JSONObject().put("at",timestamp).get("at")),0);
        assertNull(ProfileSnapshotPlugin.number("123"));
        assertTrue(clock.write("active",timestamp-10,timestamp));
        JSONObject saved=clock.read();assertEquals(3,saved.length());assertEquals(timestamp-10,saved.getLong("at"));assertEquals(timestamp,saved.getLong("_ts"));
        assertTrue(path.length()<128);
    }
    @Test public void lateOlderMetadataCannotReplaceTheNewerJournal() throws Exception {
        clock.write("new",1000,2000);assertFalse(clock.write("old",900,1900));
        assertEquals("new",clock.read().getString("id"));assertEquals(1000,clock.read().getLong("at"));
        assertFalse(clock.write("new",950,2000));assertTrue(clock.write("new",1100,2000));assertEquals(1100,clock.read().getLong("at"));
    }
    @Test public void metadataWritesDoNotDisturbAnUnfinishedFullProfileLease() throws Exception {
        File fullPath=new File(directory,ProfileSnapshotStore.FILE);ProfileSnapshotStore full=new ProfileSnapshotStore(fullPath);
        byte[] data="{\"workouts\":[{\"id\":\"kept\"}]}".getBytes(StandardCharsets.UTF_8);
        String token=full.begin(data.length);full.append(token,0,new String(data,StandardCharsets.UTF_8));
        clock.write("active",1000,2000);full.commit(token);
        assertEquals(new String(data,StandardCharsets.UTF_8),full.read());assertEquals(1000,clock.read().getLong("at"));
        String abandoned=full.begin(data.length);full.append(abandoned,0,"{");clock.write("active",1100,2100);full.abort(abandoned);
        assertEquals(1100,new ProfileClockJournalStore(path).read().getLong("at"));
    }
    @Test public void interruptedJournalWriteRecoversThePreviousMetadata() throws Exception {
        clock.write("active",1000,2000);AtomicFile interrupted=new AtomicFile(path);
        try(FileOutputStream out=interrupted.startWrite()){out.write("partial".getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
        assertEquals(1000,new ProfileClockJournalStore(path).read().getLong("at"));
    }
    @Test public void failedSilentFinishIsDetectedAndKeepsThePreviousJournal() throws Exception {
        clock.write("active",1000,2000);
        ProfileClockJournalStore failed=new ProfileClockJournalStore(new AtomicFile(path){@Override public void finishWrite(FileOutputStream output){super.failWrite(output);}});
        rejects(()->failed.write("active",1100,2100));assertEquals(1000,clock.read().getLong("at"));
    }
    @Test public void invalidOrFutureValuesNeverOverwriteThePreviousClock() throws Exception {
        clock.write("active",1000,2000);
        rejects(()->clock.write("",1000,2100));rejects(()->clock.write("active",Double.NaN,2100));rejects(()->clock.write("active",1100,Double.POSITIVE_INFINITY));
        rejects(()->clock.write("active",2200,2100));rejects(()->clock.write("active",1000,System.currentTimeMillis()+60000));
        assertEquals(1000,clock.read().getLong("at"));
    }
    @Test public void clockRollbackCanReplaceAFormerlyFutureJournal() throws Exception {
        raw(new JSONObject().put("id","old").put("at",1000).put("_ts",System.currentTimeMillis()+60000).toString());
        assertTrue(clock.write("active",1100,2100));assertEquals("active",clock.read().getString("id"));
    }
}
