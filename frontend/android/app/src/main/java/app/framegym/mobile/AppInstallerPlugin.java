package app.framegym.mobile;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Download only to private cache; never launch an APK before all checks pass. */
@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private File pending;
    private String pendingHash;
    private long pendingCode;

    private String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format("%02x", b & 255));
        return out.toString();
    }
    private long code(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }
    @SuppressWarnings("deprecation")
    private String certificate(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
            ? info.signingInfo.getApkContentsSigners() : info.signatures;
        if (signatures == null || signatures.length != 1) throw new IOException("Unsupported signing certificate");
        return hex(MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()));
    }
    @SuppressWarnings("deprecation")
    private void validate(File apk, String sha, long expectedCode) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(apk)) {
            byte[] bytes = new byte[65536]; int count;
            while ((count = input.read(bytes)) != -1) digest.update(bytes, 0, count);
        }
        if (!hex(digest.digest()).equalsIgnoreCase(sha)) throw new IOException("APK checksum mismatch");
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo incoming = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        if (incoming == null || !installed.packageName.equals(incoming.packageName)) throw new IOException("Wrong APK package");
        if (code(incoming) != expectedCode || code(incoming) <= code(installed)) throw new IOException("APK version is not newer");
        if (!certificate(incoming).equals(certificate(installed))) throw new IOException("APK signing certificate mismatch");
    }
    private boolean allowed() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }
    private void launch(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (!allowed()) {
                    Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                    getActivity().startActivity(settings);
                    JSObject result = new JSObject(); result.put("permissionRequired", true); call.resolve(result);
                    return;
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", pending);
                Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(install);
                JSObject result = new JSObject(); result.put("installerOpened", true); call.resolve(result);
            } catch (Exception error) { call.reject("Could not open Android installer", error); }
        });
    }
    @PluginMethod
    public void install(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("Update already downloading"); return; }
        String address = call.getString("url", "");
        String sha = call.getString("sha256", "");
        long expectedCode = call.getInt("versionCode", 0);
        new Thread(() -> {
            File apk = new File(getContext().getCacheDir(), "tgym-update.apk");
            try {
                URL url = new URL(address);
                String path = url.getPath();
                boolean trusted = "https".equals(url.getProtocol()) && (
                    (url.getHost().equalsIgnoreCase("github.com") && path.startsWith("/Truesilverking/TGym/releases/download/")) ||
                    (url.getHost().equalsIgnoreCase("truesilverking.github.io") && path.startsWith("/TGym/downloads/")));
                if (!trusted || !sha.matches("[a-fA-F0-9]{64}") || expectedCode <= 0) throw new IOException("Invalid update metadata");
                HttpURLConnection connection = null;
                for (int redirects = 0; redirects < 6; redirects++) {
                    if (!url.getProtocol().equals("https")) throw new IOException("Insecure redirect");
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
                    connection.setInstanceFollowRedirects(false);
                    int status = connection.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String location = connection.getHeaderField("Location"); connection.disconnect();
                        url = new URL(url, location); connection = null; continue;
                    }
                    if (status != 200) throw new IOException("Download failed: " + status);
                    break;
                }
                if (connection == null) throw new IOException("Too many redirects");
                long total = connection.getContentLengthLong(), received = 0;
                try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[65536]; int count, lastPercent = -1;
                    while ((count = input.read(buffer)) != -1) {
                        received += count;
                        if (received > 300L * 1024 * 1024) throw new IOException("APK too large");
                        output.write(buffer, 0, count);
                        int percent = total > 0 ? (int)(100 * received / total) : 0;
                        if (percent != lastPercent) {
                            JSObject progress = new JSObject(); progress.put("percent", percent);
                            notifyListeners("progress", progress); lastPercent = percent;
                        }
                    }
                } finally { connection.disconnect(); }
                validate(apk, sha, expectedCode);
                pending = apk; pendingHash = sha; pendingCode = expectedCode;
                launch(call);
            } catch (Exception error) { apk.delete(); call.reject("Update verification/download failed", error); }
            finally { busy.set(false); }
        }).start();
    }
    @PluginMethod
    public void resumeInstall(PluginCall call) {
        if (pending == null) { call.reject("Download the update again"); return; }
        try { validate(pending, pendingHash, pendingCode); launch(call); }
        catch (Exception error) { call.reject("Update verification failed", error); }
    }
}
