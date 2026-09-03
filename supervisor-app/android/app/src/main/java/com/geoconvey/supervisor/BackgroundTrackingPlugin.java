package com.geoconvey.supervisor;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundTracking")
public class BackgroundTrackingPlugin extends Plugin {

    private static final String TAG = "BackgroundTrackingPlugin";

    @PluginMethod
    public void startTracking(PluginCall call) {
        String dutySessionId = call.getString("dutySessionId");
        String supervisorId = call.getString("supervisorId");
        String token = call.getString("token");
        String serverUrl = call.getString("serverUrl");

        if (dutySessionId == null || dutySessionId.isEmpty()) {
            call.reject("dutySessionId is required to start background tracking");
            return;
        }

        try {
            Intent intent = new Intent(getContext(), LocationTrackingService.class);
            intent.putExtra("dutySessionId", dutySessionId);
            intent.putExtra("supervisorId", supervisorId);
            intent.putExtra("token", token);
            intent.putExtra("serverUrl", serverUrl);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            Log.d(TAG, "Background tracking service started for dutySessionId: " + dutySessionId);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Background tracking started");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start background tracking service: " + e.getMessage());
            call.reject("Failed to start background tracking: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), LocationTrackingService.class);
            intent.setAction("ACTION_STOP_TRACKING");
            getContext().startService(intent);

            Log.d(TAG, "Background tracking service stopped");
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Background tracking stopped");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop background tracking: " + e.getMessage());
            call.reject("Failed to stop background tracking: " + e.getMessage());
        }
    }
}
