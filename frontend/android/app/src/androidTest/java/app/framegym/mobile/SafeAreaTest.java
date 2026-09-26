package app.framegym.mobile;

import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Real window geometry: catches controls drawn underneath Android system bars. */
@RunWith(AndroidJUnit4.class)
public class SafeAreaTest {
    @Test public void webViewStaysInsideSystemBarsAndCutoutAfterRecreation() {
        assumeTrue(Build.VERSION.SDK_INT >= 35);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            assertSafeBounds(scenario);
            scenario.recreate();
            assertSafeBounds(scenario);
        }
    }

    private void assertSafeBounds(ActivityScenario<MainActivity> scenario) {
        AssertionError lastFailure = null;
        for (int attempt = 0; attempt < 50; attempt++) {
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            try {
                scenario.onActivity(activity -> {
                    View decor = activity.getWindow().getDecorView();
                    View web = activity.getBridge().getWebView();
                    WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(decor);
                    assertNotNull("Window insets must be available", windowInsets);
                    Insets bars = windowInsets.getInsetsIgnoringVisibility(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                    assertTrue("Test device must have a top system inset", bars.top > 0);
                    assertTrue("WebView must be laid out", web.getWidth() > 0 && web.getHeight() > 0);
                    int[] origin = new int[2], position = new int[2];
                    decor.getLocationOnScreen(origin);
                    web.getLocationOnScreen(position);
                    assertTrue("WebView overlaps status bar/cutout", position[1] >= origin[1] + bars.top);
                    assertTrue("WebView overlaps left system inset", position[0] >= origin[0] + bars.left);
                    assertTrue("WebView overlaps navigation bar",
                        position[1] + web.getHeight() <= origin[1] + decor.getHeight() - bars.bottom);
                    assertTrue("WebView overlaps right system inset",
                        position[0] + web.getWidth() <= origin[0] + decor.getWidth() - bars.right);
                });
                return;
            } catch (AssertionError failure) {
                lastFailure = failure;
                SystemClock.sleep(100);
            }
        }
        throw lastFailure;
    }
}
