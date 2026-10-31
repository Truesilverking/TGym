package app.framegym.mobile;

import android.util.AtomicFile;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

/** One fixed private profile file. All access goes through the plugin's IO queue. */
final class ProfileSnapshotStore {
    static final String FILE = "framegym-state.json";
    static final int CHUNK_BYTES = 64 * 1024;
    private final AtomicFile file;
    private Write pending;

    private static final class Write {
        final String token = UUID.randomUUID().toString();
        final FileOutputStream stream;
        final long expectedBytes,expectedCharacters;
        final MessageDigest digest = sha256();
        long bytes,characters;
        int index;
        Write(FileOutputStream stream, long bytes,long characters) { this.stream=stream;this.expectedBytes=bytes;this.expectedCharacters=characters; }
    }

    ProfileSnapshotStore(File path) { this(new AtomicFile(path)); }
    ProfileSnapshotStore(AtomicFile file) { this.file=file; }

    private static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }

    synchronized String read() throws IOException {
        // openRead can roll back an unfinished write. Never do that to a live lease.
        if (pending!=null) throw new IOException("Profile snapshot is being written");
        return new String(file.readFully(), StandardCharsets.UTF_8);
    }

    synchronized String recoverRead() throws IOException {
        // Only boot calls the bridge reader. A WebView reload can leave the old
        // JS lease alive in this process; roll it back before restoring its file.
        abortCurrent();
        return read();
    }

    synchronized String begin(long bytes) throws IOException {
        if (bytes<=0) throw new IOException("Invalid snapshot byte count");
        return start(bytes,-1);
    }

    synchronized String beginCharacters(long characters) throws IOException {
        if(characters<=0)throw new IOException("Invalid snapshot character count");
        return start(-1,characters);
    }

    private String start(long bytes,long characters) throws IOException {
        abortCurrent();
        pending=new Write(file.startWrite(),bytes,characters);
        return pending.token;
    }

    private Write current(String token) throws IOException {
        if (pending==null || token==null || !pending.token.equals(token)) throw new IOException("Snapshot token is not current");
        return pending;
    }

    synchronized void append(String token, int index, String data) throws IOException {
        Write write=current(token);
        if (index!=write.index || data==null) throw new IOException("Invalid snapshot chunk sequence");
        ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(data));
        int size=encoded.remaining();
        if (size<=0 || size>CHUNK_BYTES
            || write.expectedBytes>=0 && size>write.expectedBytes-write.bytes
            || write.expectedCharacters>=0 && data.length()>write.expectedCharacters-write.characters) throw new IOException("Invalid snapshot chunk size");
        byte[] bytes=new byte[size]; encoded.get(bytes);
        try { write.stream.write(bytes); }
        catch (IOException error) { abortCurrent(); throw error; }
        write.digest.update(bytes);write.bytes+=size;write.characters+=data.length();write.index++;
    }

    synchronized void commit(String token) throws IOException {
        Write write=current(token);
        if (write.expectedBytes>=0 && write.bytes!=write.expectedBytes
            || write.expectedCharacters>=0 && write.characters!=write.expectedCharacters) throw new IOException("Incomplete profile snapshot");
        try { write.stream.getFD().sync(); }
        catch (IOException error) { abortCurrent(); throw error; }
        byte[] expected=write.digest.digest();
        // AtomicFile.finishWrite logs some failures instead of throwing. Release
        // the lease, then independently verify the committed file on this worker.
        pending=null;
        try { file.finishWrite(write.stream); }
        finally { try { write.stream.close(); } catch (IOException ignored) { } }
        MessageDigest actual=sha256(); long size=0;
        try (FileInputStream input=file.openRead()) {
            byte[] buffer=new byte[8192]; int read;
            while ((read=input.read(buffer))!=-1) { actual.update(buffer,0,read); size+=read; }
        }
        if (size!=write.bytes || !MessageDigest.isEqual(expected,actual.digest())) throw new IOException("Profile snapshot commit could not be verified");
    }

    synchronized void abort(String token) throws IOException { current(token); abortCurrent(); }
    synchronized void abortCurrent() {
        if (pending==null) return;
        Write write=pending; pending=null;
        file.failWrite(write.stream);
    }
}
