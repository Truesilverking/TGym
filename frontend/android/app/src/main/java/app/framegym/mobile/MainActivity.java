package app.framegym.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleDriveAuthPlugin.class);
        registerPlugin(UpdatePushPlugin.class);
        registerPlugin(AppInstallerPlugin.class);
        registerPlugin(WorkoutNotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
