package app.framegym.mobile;

import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Build;
import android.view.View;
import android.view.Window;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SystemAppearanceTest {
    @Test public void floatingControlConvertsViewportToSmallWindowRect() {
        Rect right=SystemAppearancePlugin.gestureExclusionRect(1080,2184,0,173,400,800,356,72,400,116);
        assertEquals(new Rect(961,369,1080,490),right);
        Rect left=SystemAppearancePlugin.gestureExclusionRect(1080,2184,0,173,400,800,0,200,44,244);
        assertEquals(new Rect(0,719,119,840),left);
        assertNull(SystemAppearancePlugin.gestureExclusionRect(1080,2184,0,173,400,800,410,72,454,116));
        for(double[] invalid:new double[][]{{0,0,400,800},{0,0,44,Double.NaN},{0,0,44,Double.POSITIVE_INFINITY}}){
            try{SystemAppearancePlugin.gestureExclusionRect(1080,2184,0,173,400,800,invalid[0],invalid[1],invalid[2],invalid[3]);fail("Invalid or full-screen gesture exclusions must be rejected");}
            catch(IllegalArgumentException expected){}
        }
    }

    @Test public void floatingControlWindowAreaCanBeReplacedAndCleared() {
        if(Build.VERSION.SDK_INT<29)return;
        java.util.concurrent.CountDownLatch checked=new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
        Application application=(Application)InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
        // Install before launch: this debug-only host closes after 250ms, which
        // can precede ActivityScenario.onActivity after its idle synchronization.
        Application.ActivityLifecycleCallbacks callback=new Application.ActivityLifecycleCallbacks(){
            private boolean installed;
            private void install(Activity activity){
                if(!(activity instanceof WorkoutNotificationTestActivity)||installed)return;
                installed=true;
                Window window=activity.getWindow();
                View decor=window.getDecorView();
                Runnable verify=()->{
                    try{
                        assertTrue("Host Window must be attached",decor.isAttachedToWindow());
                        Rect right=new Rect(961,369,1080,490),left=new Rect(0,719,119,840);
                        assertTrue(SystemAppearancePlugin.applyGestureExclusion(window,right));
                        assertEquals(java.util.Collections.singletonList(right),window.getSystemGestureExclusionRects());
                        assertTrue(SystemAppearancePlugin.applyGestureExclusion(window,left));
                        assertEquals(java.util.Collections.singletonList(left),window.getSystemGestureExclusionRects());
                        assertTrue(SystemAppearancePlugin.applyGestureExclusion(window,null));
                        assertTrue(window.getSystemGestureExclusionRects().isEmpty());
                    }catch(Throwable error){failure.set(error);}
                    finally{
                        try{if(decor.isAttachedToWindow())SystemAppearancePlugin.applyGestureExclusion(window,null);}
                        catch(Throwable error){failure.compareAndSet(null,error);}
                        checked.countDown();
                    }
                };
                if(decor.isAttachedToWindow())verify.run();
                else decor.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){
                    public void onViewAttachedToWindow(View view){view.removeOnAttachStateChangeListener(this);verify.run();}
                    public void onViewDetachedFromWindow(View view){}
                });
            }
            public void onActivityCreated(Activity activity,android.os.Bundle state){install(activity);}
            public void onActivityResumed(Activity activity){install(activity);}
            public void onActivityStarted(Activity activity){}
            public void onActivityPaused(Activity activity){}
            public void onActivityStopped(Activity activity){}
            public void onActivitySaveInstanceState(Activity activity,android.os.Bundle state){}
            public void onActivityDestroyed(Activity activity){}
        };
        application.registerActivityLifecycleCallbacks(callback);
        try(ActivityScenario<WorkoutNotificationTestActivity> scenario=ActivityScenario.launch(WorkoutNotificationTestActivity.class)){
            try{assertTrue("Host Window must attach before finishing",checked.await(2,java.util.concurrent.TimeUnit.SECONDS));}
            catch(InterruptedException error){Thread.currentThread().interrupt();throw new AssertionError(error);}
            if(failure.get()!=null)throw new AssertionError("Attached Window gesture exclusion",failure.get());
        }finally{
            application.unregisterActivityLifecycleCallbacks(callback);
            InstrumentationRegistry.getInstrumentation().getTargetContext().stopService(new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),WorkoutNotificationService.class));
        }
    }
}
