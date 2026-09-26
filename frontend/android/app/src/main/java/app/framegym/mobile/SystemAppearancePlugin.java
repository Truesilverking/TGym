package app.framegym.mobile;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.View;
import android.view.Window;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemAppearance")
public class SystemAppearancePlugin extends Plugin {
    @PluginMethod public void setTheme(PluginCall call) {
        boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        getActivity().runOnUiThread(() -> {
            try {
                applyTheme((BridgeActivity) getActivity(), light);
                call.resolve();
            } catch (RuntimeException error) {
                call.reject("Cannot synchronize system-bar appearance", error);
            }
        });
    }

    @SuppressWarnings("deprecation")
    static void applyTheme(BridgeActivity activity, boolean light) {
        int background = Color.parseColor(light ? "#f2f2f7" : "#000000");
        int navigation = Color.parseColor(light && Build.VERSION.SDK_INT >= 26 ? "#f7f7fa" : "#0e0e10");
        Window window = activity.getWindow();
        View decor = window.getDecorView();
        View web = activity.getBridge().getWebView();
        web.setBackgroundColor(background);
        View surface = (View) web.getParent();
        surface.setBackground(new Drawable() {
            final Paint paint = new Paint();
            @Override public void draw(Canvas canvas) {
                paint.setColor(background); canvas.drawRect(getBounds(), paint);
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(surface);
                if (insets != null) {
                    androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                    paint.setColor(navigation);
                    canvas.drawRect(0, getBounds().bottom - bars.bottom, getBounds().right, getBounds().bottom, paint);
                    canvas.drawRect(0, 0, bars.left, getBounds().bottom, paint);
                    canvas.drawRect(getBounds().right - bars.right, 0, getBounds().right, getBounds().bottom, paint);
                }
            }
            @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); }
            @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); }
            @Override public int getOpacity() { return PixelFormat.OPAQUE; }
        });
        // Older Android uses these colours directly; API35+ draws transparent
        // gesture bars over the native surface above. Insets remain owned by Capacitor.
        window.setStatusBarColor(background);
        window.setNavigationBarColor(navigation);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decor);
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }
}
