package app.framegym.mobile;

import android.content.Context;
import android.util.AtomicFile;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real AtomicFile semantics, always in an isolated cache directory. */
@RunWith(AndroidJUnit4.class)
public class ProfileSnapshotTest {
    private File directory,path;
    private ProfileSnapshotStore store;
    @Before public void setup() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        directory=new File(context.getCacheDir(),"snapshot-test-"+java.util.UUID.randomUUID());
        assertTrue(directory.mkdirs());path=new File(directory,ProfileSnapshotStore.FILE);store=new ProfileSnapshotStore(path);
    }
    @After public void cleanup() {
        if(store!=null)store.abortCurrent();
        if(directory!=null) { File[] files=directory.listFiles(); if(files!=null)for(File file:files)file.delete(); directory.delete(); }
    }
    private void legacy(String data) throws IOException {
        try(FileOutputStream out=new FileOutputStream(path)){out.write(data.getBytes(StandardCharsets.UTF_8));}
    }
    private String begin(String data) throws IOException { return store.begin(data.getBytes(StandardCharsets.UTF_8).length); }
    private void save(String data) throws IOException { String token=begin(data);store.append(token,0,data);store.commit(token); }
    private void rejects(Throwing work) throws Exception { try {work.run();fail("Expected a rejected unsafe snapshot operation");}catch(IOException expected) { } }
    private interface Throwing { void run() throws Exception; }

    @Test public void readsTheLegacyPrivateProfileWithoutChangingItsShape() throws Exception {
        String data="{\"workouts\":[{\"id\":\"kept\"}],\"active\":{\"id\":\"paused\"},\"note\":\"🏋️漢\"}";
        legacy(data);assertEquals(data,store.read());assertEquals(data,new ProfileSnapshotStore(path).read());
    }
    @Test public void commitsExactUnicodeAndPreservesEveryChunk() throws Exception {
        String first="{\"note\":\"🏋️漢",last="\uFEFF\",\"workouts\":[{\"id\":\"same\"}]}";
        String token=begin(first+last);store.append(token,0,first);store.append(token,1,last);store.commit(token);
        assertEquals(first+last,new ProfileSnapshotStore(path).read());
    }
    @Test public void canceledPartialWriteRetainsThePreviouslyConfirmedProfile() throws Exception {
        legacy("{\"version\":1}");String token=begin("{\"version\":2}");store.append(token,0,"{\"version\":");store.abort(token);
        assertEquals("{\"version\":1}",new ProfileSnapshotStore(path).read());
    }
    @Test public void aFreshReaderRecoversTheOldFileAfterAnInterruptedAtomicWrite() throws Exception {
        legacy("{\"version\":1}");
        AtomicFile interrupted=new AtomicFile(path);
        try(FileOutputStream out=interrupted.startWrite()){out.write("{\"partial\":".getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
        assertEquals("{\"version\":1}",new ProfileSnapshotStore(path).read());
    }
    @Test public void staleCallsCannotAbortOrAppendToTheNewLease() throws Exception {
        legacy("{\"version\":0}");String old=begin("{\"version\":1}");store.append(old,0,"{\"version\":");
        String next=begin("{\"version\":2}");
        rejects(()->store.append(old,1,"1}"));rejects(()->store.abort(old));rejects(()->store.commit(old));
        store.append(next,0,"{\"version\":2}");store.commit(next);assertEquals("{\"version\":2}",store.read());
    }
    @Test public void outOfOrderAndDuplicateChunksAreRejectedWithoutAdvancingTheLease() throws Exception {
        String token=begin("{\"v\":1}");rejects(()->store.append(token,1,"{\"v\":"));
        store.append(token,0,"{\"v\":");rejects(()->store.append(token,0,"{\"v\":"));
        store.append(token,1,"1}");store.commit(token);assertEquals("{\"v\":1}",store.read());
    }
    @Test public void partialOrOversizedPayloadCannotCommitOverThePreviousFile() throws Exception {
        legacy("{\"v\":0}");String token=begin("{\"v\":1}");store.append(token,0,"{");
        rejects(()->store.commit(token));rejects(()->store.append(token,1,"\"v\":10000}"));store.abort(token);
        assertEquals("{\"v\":0}",store.read());
    }
    @Test public void chunkLimitCountsUtf8BytesAndRejectsMalformedSurrogates() throws Exception {
        StringBuilder large=new StringBuilder();for(int i=0;i<21846;i++)large.append('漢');
        String token=store.begin(large.toString().getBytes(StandardCharsets.UTF_8).length);
        rejects(()->store.append(token,0,large.toString()));rejects(()->store.append(token,0,"\uD800"));store.abort(token);
    }
    @Test public void aLiveReadCannotRollbackTheCurrentWrite() throws Exception {
        legacy("{\"v\":0}");String token=begin("{\"v\":1}");store.append(token,0,"{\"v\":1}");
        rejects(()->store.read());store.commit(token);assertEquals("{\"v\":1}",store.read());
    }
    @Test public void bootRecoveryRevokesTheOldWebViewLeaseBeforeReadingThePreviousProfile() throws Exception {
        legacy("{\"v\":0}");String token=begin("{\"v\":1}");store.append(token,0,"{\"v\":");
        assertEquals("{\"v\":0}",store.recoverRead());
        rejects(()->store.append(token,1,"1}"));rejects(()->store.commit(token));rejects(()->store.abort(token));
        save("{\"v\":2}");assertEquals("{\"v\":2}",store.read());
    }
    @Test public void aFiveMegabyteProfileCommitsWithoutChangingAnyBytes() throws Exception {
        char[] chars=new char[65536];java.util.Arrays.fill(chars,'a');String block=new String(chars);
        String first="{\"asset\":\"",last="🏋️漢\"}";
        long bytes=first.getBytes(StandardCharsets.UTF_8).length+80L*chars.length+last.getBytes(StandardCharsets.UTF_8).length;
        String token=store.begin(bytes);store.append(token,0,first);
        StringBuilder expected=new StringBuilder(first);
        for(int i=0;i<80;i++){store.append(token,i+1,block);expected.append(block);}
        store.append(token,81,last);expected.append(last);store.commit(token);
        assertEquals(bytes,path.length());assertEquals(expected.toString(),new ProfileSnapshotStore(path).read());
    }
    @Test public void silentAtomicFinishFailureCannotReportSuccessEvenForEqualLengthSnapshots() throws Exception {
        legacy("{\"v\":0}");
        store=new ProfileSnapshotStore(new AtomicFile(path){@Override public void finishWrite(FileOutputStream stream){super.failWrite(stream);}});
        String token=begin("{\"v\":1}");store.append(token,0,"{\"v\":1}");rejects(()->store.commit(token));
        assertEquals("{\"v\":0}",new ProfileSnapshotStore(path).read());
    }
    @Test public void invalidBeginDoesNotRevokeTheActiveLeaseAndSuccessfulRetryRemainsPossible() throws Exception {
        String token=begin("{\"v\":1}");rejects(()->store.begin(0));store.append(token,0,"{\"v\":1}");store.commit(token);
        save("{\"v\":2}");assertEquals("{\"v\":2}",store.read());
    }
    @Test public void aMissingSnapshotAndFirstWriteAbortDoNotInventAnEmptyProfile() throws Exception {
        rejects(()->store.read());String token=begin("{\"v\":1}");store.append(token,0,"{");store.abort(token);rejects(()->store.read());
    }
    @Test public void characterModeCountsUtf16AndVerifiesTheDifferentUtf8ByteCount() throws Exception {
        String first="{\"note\":\"\uD83C\uDFCB\uFE0F\u6F22",last="\uFEFF\"}";
        String data=first+last;assertTrue(data.getBytes(StandardCharsets.UTF_8).length>data.length());
        String token=store.beginCharacters(data.length());store.append(token,0,first);store.append(token,1,last);store.commit(token);
        assertEquals(data,new ProfileSnapshotStore(path).read());assertEquals(data.getBytes(StandardCharsets.UTF_8).length,path.length());
    }
    @Test public void incompleteOrExcessCharactersCannotCommitAndLegacyByteRetryStillWorks() throws Exception {
        legacy("{\"v\":0}");String token=store.beginCharacters(7);store.append(token,0,"{\"v\":");
        rejects(()->store.commit(token));rejects(()->store.append(token,1,"123}"));store.abort(token);
        assertEquals("{\"v\":0}",store.read());save("{\"v\":2}");assertEquals("{\"v\":2}",store.read());
    }
    @Test public void invalidCharacterCountsDoNotRevokeTheCurrentLease() throws Exception {
        String token=store.beginCharacters(7);rejects(()->store.beginCharacters(0));rejects(()->store.beginCharacters(-1));
        store.append(token,0,"{\"v\":1}");store.commit(token);assertEquals("{\"v\":1}",store.read());
    }
    @Test public void characterModeStillRejectsInvalidUtf8AndOversizedChunksBeforeWriting() throws Exception {
        legacy("{\"v\":0}");StringBuilder large=new StringBuilder();for(int i=0;i<21846;i++)large.append('\u6F22');
        String token=store.beginCharacters(large.length());rejects(()->store.append(token,0,"\uD800"));rejects(()->store.append(token,0,large.toString()));
        store.abort(token);assertEquals("{\"v\":0}",new ProfileSnapshotStore(path).read());
    }
    @Test public void characterModeDetectsSilentFinishFailureEvenWhenOldAndNewLengthsMatch() throws Exception {
        legacy("{\"v\":0}");store=new ProfileSnapshotStore(new AtomicFile(path){@Override public void finishWrite(FileOutputStream stream){super.failWrite(stream);}});
        String token=store.beginCharacters(7);store.append(token,0,"{\"v\":1}");rejects(()->store.commit(token));
        assertEquals("{\"v\":0}",new ProfileSnapshotStore(path).read());
    }
    @Test public void fiveMegabytesOfCharacterChunksCommitWithoutAPrecomputedByteTotal() throws Exception {
        char[] chars=new char[16384];java.util.Arrays.fill(chars,'a');String block=new String(chars);
        String first="{\"asset\":\"",last="\uD83C\uDFCB\uFE0F\u6F22\uFEFF\"}";
        String token=store.beginCharacters(first.length()+320L*chars.length+last.length());store.append(token,0,first);
        StringBuilder expected=new StringBuilder(first);
        for(int i=0;i<320;i++){store.append(token,i+1,block);expected.append(block);}
        store.append(token,321,last);expected.append(last);store.commit(token);
        assertEquals(expected.toString(),new ProfileSnapshotStore(path).read());assertEquals(expected.toString().getBytes(StandardCharsets.UTF_8).length,path.length());
    }
}
