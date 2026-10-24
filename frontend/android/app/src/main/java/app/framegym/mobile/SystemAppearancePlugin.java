package app.framegym.mobile;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.View;
import android.view.Window;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;

@CapacitorPlugin(name = "SystemAppearance")
public class SystemAppearancePlugin extends Plugin {
    /** A fixed HTML control has no Android child View. Keep its small exclusion
     * in window coordinates so scrolling WebView content cannot move the area. */
    @PluginMethod public void setGestureExclusion(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        double left=call.getDouble("left",0.0), top=call.getDouble("top",0.0);
        double right=call.getDouble("right",0.0), bottom=call.getDouble("bottom",0.0);
        double viewportWidth=call.getDouble("viewportWidth",0.0), viewportHeight=call.getDouble("viewportHeight",0.0);
        getActivity().runOnUiThread(() -> {
            Window window=getActivity().getWindow();
            try {
                View web=((BridgeActivity)getActivity()).getBridge().getWebView();
                int[] origin=new int[2]; web.getLocationInWindow(origin);
                Rect rect=enabled?gestureExclusionRect(web.getWidth(),web.getHeight(),origin[0],origin[1],
                    viewportWidth,viewportHeight,left,top,right,bottom):null;
                boolean applied=applyGestureExclusion(window,rect);
                JSObject result=new JSObject(); result.put("applied",applied); result.put("enabled",applied&&rect!=null);
                call.resolve(result);
            } catch (RuntimeException error) {
                applyGestureExclusion(window,null);
                call.reject("Cannot synchronize the floating control gesture area",error);
            }
        });
    }

    static Rect gestureExclusionRect(int width,int height,int originX,int originY,
            double viewportWidth,double viewportHeight,double left,double top,double right,double bottom) {
        for(double value:new double[]{viewportWidth,viewportHeight,left,top,right,bottom})
            if(Double.isNaN(value)||Double.isInfinite(value))throw new IllegalArgumentException("Gesture bounds must be finite");
        if(width<=0||height<=0||viewportWidth<=0||viewportHeight<=0||right<=left||bottom<=top||right-left>96||bottom-top>96)
            throw new IllegalArgumentException("Only a small visible control can exclude system gestures");
        double l=Math.max(0,Math.min(viewportWidth,left)),r=Math.max(0,Math.min(viewportWidth,right));
        double t=Math.max(0,Math.min(viewportHeight,top)),b=Math.max(0,Math.min(viewportHeight,bottom));
        if(r<=l||b<=t)return null;
        return new Rect(originX+(int)Math.floor(l*width/viewportWidth),originY+(int)Math.floor(t*height/viewportHeight),
            originX+(int)Math.ceil(r*width/viewportWidth),originY+(int)Math.ceil(b*height/viewportHeight));
    }

    static boolean applyGestureExclusion(Window window,Rect rect) {
        if(Build.VERSION.SDK_INT<29)return false;
        window.setSystemGestureExclusionRects(rect==null?Collections.emptyList():Collections.singletonList(rect));
        return true;
    }

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
