package app.framegym.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(GoogleDriveAuthPlugin.class);
        registerPlugin(UpdatePushPlugin.class);
    }
}
