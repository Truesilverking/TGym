package app.framegym.mobile;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

@CapacitorPlugin(name = "GoogleDriveAuth", requestCodes = { GoogleDriveAuthPlugin.AUTH_REQUEST })
public class GoogleDriveAuthPlugin extends Plugin {
    static final int AUTH_REQUEST = 9417;
    private static final String DRIVE_APPDATA = "https://www.googleapis.com/auth/drive.appdata";
    private AuthorizationClient authorizationClient;

    @PluginMethod
    public void authorize(PluginCall call) {
        boolean interactive = call.getBoolean("interactive", true);
        authorizationClient = Identity.getAuthorizationClient(getActivity());
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA)))
            .build();

        authorizationClient.authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    resolveToken(call, result);
                    return;
                }
                if (!interactive) {
                    call.reject("Google Drive needs authorization", "auth_required");
                    return;
                }
                PendingIntent pending = result.getPendingIntent();
                if (pending == null) {
                    call.reject("Google Drive authorization is unavailable", "auth_failed");
                    return;
                }
                saveCall(call);
                try {
                    getActivity().startIntentSenderForResult(pending.getIntentSender(), AUTH_REQUEST, null, 0, 0, 0);
                } catch (IntentSender.SendIntentException error) {
                    freeSavedCall();
                    call.reject("Could not open Google authorization", "auth_failed", error);
                }
            })
            .addOnFailureListener(error -> call.reject("Google Drive authorization failed", "auth_failed", error));
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null || token.isEmpty()) {
            call.reject("Google Drive did not return an access token", "auth_failed");
            return;
        }
        JSObject response = new JSObject();
        response.put("accessToken", token);
        // Google access tokens are normally valid for one hour; JS refreshes with the native
        // authorization client before this conservative 50-minute cache expires.
        response.put("expiresIn", 3000);
        call.resolve(response);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != AUTH_REQUEST) return;
        PluginCall call = getSavedCall();
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK || data == null) {
            freeSavedCall();
            call.reject("Google Drive authorization was cancelled", "access_denied");
            return;
        }
        try {
            AuthorizationResult result = authorizationClient.getAuthorizationResultFromIntent(data);
            freeSavedCall();
            resolveToken(call, result);
        } catch (Exception error) {
            freeSavedCall();
            call.reject("Google Drive authorization failed", "auth_failed", error);
        }
    }
}
