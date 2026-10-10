package com.geoconvey.supervisor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.net.ConnectivityManager;
import android.net.Network;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class LocationTrackingService extends Service implements LocationListener {

    private static final String TAG = "LocationTrackingService";
    private static final String CHANNEL_ID = "geoconvey_duty_tracking";
    private static final int NOTIFICATION_ID = 2026;
    private static final String OFFLINE_QUEUE_FILE = "geoconvey_offline_gps.json";

    private final Object queueLock = new Object();
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private ExecutorService networkExecutor;
    private ScheduledExecutorService periodicSyncScheduler;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    private String dutySessionId = "";
    private String supervisorId = "";
    private String authToken = "";
    private String serverUrl = "https://3-7-65-135.sslip.io";

    private Location lastRecordedLocation = null;
    private long lastRecordedTime = 0;

    /**
     * Check if Android Developer Options are enabled on this device
     */
    public static boolean isDeveloperOptionsEnabled(Context context) {
        if (context == null) return false;
        try {
            return Settings.Global.getInt(
                    context.getContentResolver(),
                    Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0
            ) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Check if a location comes from a mock provider
     */
    public static boolean isMockLocation(Location location) {
        if (location == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return location.isMock();
        } else {
            return location.isFromMockProvider();
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        networkExecutor = Executors.newSingleThreadExecutor();
        periodicSyncScheduler = Executors.newSingleThreadScheduledExecutor();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GeoConvey:BackgroundGpsWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        createNotificationChannel();
        registerNetworkCallback();
        startPeriodicSyncScheduler();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("ACTION_STOP_TRACKING".equals(action)) {
                stopTracking();
                stopSelf();
                return START_NOT_STICKY;
            }

            dutySessionId = intent.getStringExtra("dutySessionId");
            supervisorId = intent.getStringExtra("supervisorId");
            authToken = intent.getStringExtra("token");
            String customServer = intent.getStringExtra("serverUrl");
            if (customServer != null && !customServer.trim().isEmpty()) {
                serverUrl = customServer.trim().replaceAll("/+$", "");
            }
        }

        // Security check: If Developer Options are enabled, block immediately
        if (isDeveloperOptionsEnabled(this)) {
            Log.w(TAG, "Developer options enabled on start command! Aborting service.");
            sendSecurityEvent("DEVELOPER_OPTIONS_ENABLED", "Developer options enabled when starting tracking service");
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        // Acquire WakeLock so CPU doesn't sleep while phone is locked in pocket
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(12 * 60 * 60 * 1000L); // Max 12 hours safety timeout
        }

        Notification notification = buildNotification("GeoConvey • Duty in Progress", "Recording GPS route & bike conveyance in background");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startLocationUpdates();

        return START_STICKY;
    }

    private void startLocationUpdates() {
        if (locationManager == null) return;

        try {
            // Enforce high-accuracy GPS hardware only to eliminate cell-tower / network jumps
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        4000L, // 4 seconds
                        4.0f,  // 4 meters
                        this
                );
                Log.d(TAG, "High-accuracy GPS location updates registered for duty session: " + dutySessionId);
            } else {
                Log.w(TAG, "GPS Provider is not enabled on device!");
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission missing: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error starting location updates: " + e.getMessage());
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        // Security check: Developer options enabled during duty
        if (isDeveloperOptionsEnabled(this)) {
            Log.w(TAG, "Developer options enabled during active duty! Stopping tracking.");
            sendSecurityEvent("DEVELOPER_OPTIONS_ENABLED", "Developer options was enabled during active duty");
            stopTracking();
            stopSelf();
            return;
        }

        // Security check: Mock location detected
        if (isMockLocation(location)) {
            Log.w(TAG, "Mock location detected! Dropping point and reporting security violation.");
            sendSecurityEvent("MOCK_LOCATION_DETECTED", "Mock location provider detected: " + location.getProvider());
            return;
        }

        // Quality check 1: Discard stale locations (> 30s old)
        long now = System.currentTimeMillis();
        long ageMs = Math.abs(now - location.getTime());
        if (ageMs > 30000) {
            Log.d(TAG, "Stale location dropped, age: " + (ageMs / 1000) + "s");
            return;
        }

        // Quality check 2: Discard inaccurate locations (> 50m)
        if (location.hasAccuracy() && location.getAccuracy() > 50.0f) {
            Log.d(TAG, "Inaccurate location dropped: accuracy=" + location.getAccuracy() + "m");
            return;
        }

        // Quality check 3: Discard teleportation / jump > 100 km/h against last recorded location
        if (lastRecordedLocation != null) {
            float dist = lastRecordedLocation.distanceTo(location);
            long timeDiffSec = Math.max(1, (location.getTime() - lastRecordedLocation.getTime()) / 1000);
            double speedKmh = (dist / 1000.0) / (timeDiffSec / 3600.0);
            if (dist > 100 && speedKmh > 100.0) {
                Log.w(TAG, "GPS jump rejected! Distance=" + dist + "m, time=" + timeDiffSec + "s, speed=" + speedKmh + "km/h");
                return;
            }
        }

        boolean shouldRecord = false;

        if (lastRecordedLocation == null) {
            shouldRecord = true;
        } else {
            float dist = lastRecordedLocation.distanceTo(location);
            long elapsedSeconds = (now - lastRecordedTime) / 1000;
            float speed = location.hasSpeed() ? location.getSpeed() : 0.0f;
            boolean isMoving = speed >= 1.0f; // >= 3.6 km/h

            // Filter out stationary jitter / phantom drift (< 25m while sitting still)
            // Only record if moved >= 25m, or moved >= 10m with genuine movement speed (>= 1.0 m/s)
            if (dist >= 25.0f || (dist >= 10.0f && isMoving)) {
                shouldRecord = true;
            } else if (elapsedSeconds >= 300) {
                // Heartbeat point every 5 minutes while stationary (keeps live status without generating jitter)
                shouldRecord = true;
            }
        }

        if (shouldRecord) {
            lastRecordedLocation = location;
            lastRecordedTime = now;

            // Save point to offline storage & flush to cloud
            processAndRecordLocation(location);
        }
    }

    private void processAndRecordLocation(Location loc) {
        if (dutySessionId == null || dutySessionId.isEmpty()) return;

        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            String timeStr = sdf.format(new Date(loc.getTime()));

            JSONObject pointObj = new JSONObject();
            pointObj.put("clientUuid", "bg_" + UUID.randomUUID().toString());
            pointObj.put("dutySessionId", dutySessionId);
            pointObj.put("latitude", loc.getLatitude());
            pointObj.put("longitude", loc.getLongitude());
            pointObj.put("accuracy", loc.hasAccuracy() ? loc.getAccuracy() : 10.0f);
            pointObj.put("speed", loc.hasSpeed() ? loc.getSpeed() : 0.0f);
            pointObj.put("heading", loc.hasBearing() ? loc.getBearing() : 0.0f);
            pointObj.put("altitude", loc.hasAltitude() ? loc.getAltitude() : JSONObject.NULL);
            pointObj.put("provider", loc.getProvider() != null ? loc.getProvider() : "gps");
            pointObj.put("is_mock", isMockLocation(loc));
            pointObj.put("recordedAt", timeStr);

            // 1. Save to persistent offline queue immediately on device
            enqueueLocationPoint(pointObj);

            // 2. Trigger sync immediately (will succeed if online, or stay safely stored if offline)
            flushOfflineQueue();
        } catch (Exception e) {
            Log.e(TAG, "Error formatting location point: " + e.getMessage());
        }
    }

    private File getOfflineFile() {
        return new File(getFilesDir(), OFFLINE_QUEUE_FILE);
    }

    private JSONArray readOfflineQueue() {
        synchronized (queueLock) {
            File file = getOfflineFile();
            if (!file.exists()) {
                return new JSONArray();
            }
            try (FileInputStream fis = new FileInputStream(file);
                 InputStreamReader isr = new InputStreamReader(fis, "UTF-8");
                 BufferedReader reader = new BufferedReader(isr)) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                String content = sb.toString().trim();
                if (content.isEmpty()) return new JSONArray();
                return new JSONArray(content);
            } catch (Exception e) {
                Log.w(TAG, "Error reading offline queue file: " + e.getMessage());
                return new JSONArray();
            }
        }
    }

    private void writeOfflineQueue(JSONArray array) {
        synchronized (queueLock) {
            File file = getOfflineFile();
            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(array.toString().getBytes("UTF-8"));
                fos.flush();
            } catch (Exception e) {
                Log.e(TAG, "Error writing offline queue file: " + e.getMessage());
            }
        }
    }

    private void enqueueLocationPoint(JSONObject pointObj) {
        synchronized (queueLock) {
            try {
                JSONArray queue = readOfflineQueue();
                queue.put(pointObj);
                writeOfflineQueue(queue);
                int count = queue.length();
                Log.d(TAG, "Location saved offline on device. Total pending: " + count);
                if (count > 1) {
                    updateNotification("Recording route • 🛰️ " + count + " points saved offline (will sync when online)");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error enqueuing location point: " + e.getMessage());
            }
        }
    }

    private int getOfflineQueueSize() {
        synchronized (queueLock) {
            return readOfflineQueue().length();
        }
    }

    private void flushOfflineQueue() {
        if (dutySessionId == null || dutySessionId.isEmpty()) return;

        networkExecutor.execute(() -> {
            try {
                while (true) {
                    JSONArray currentQueue;
                    JSONArray batch = new JSONArray();
                    int batchSize;

                    synchronized (queueLock) {
                        currentQueue = readOfflineQueue();
                        int total = currentQueue.length();
                        if (total == 0) {
                            updateNotification("Recording GPS route & bike conveyance • 📡 Cloud Synced");
                            break;
                        }

                        batchSize = Math.min(total, 50);
                        for (int i = 0; i < batchSize; i++) {
                            batch.put(currentQueue.getJSONObject(i));
                        }
                    }

                    Log.d(TAG, "Attempting to sync " + batchSize + " points to cloud...");

                    JSONObject payload = new JSONObject();
                    payload.put("points", batch);

                    URL url = new URL(serverUrl + "/api/tracking/sync");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    if (authToken != null && !authToken.isEmpty()) {
                        conn.setRequestProperty("Authorization", "Bearer " + authToken);
                    }
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setDoOutput(true);

                    byte[] body = payload.toString().getBytes("UTF-8");
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body);
                        os.flush();
                    }

                    int code = conn.getResponseCode();
                    conn.disconnect();

                    if (code == 200 || code == 201) {
                        int remaining;
                        synchronized (queueLock) {
                            JSONArray freshQueue = readOfflineQueue();
                            JSONArray updatedQueue = new JSONArray();
                            for (int i = batchSize; i < freshQueue.length(); i++) {
                                updatedQueue.put(freshQueue.getJSONObject(i));
                            }
                            writeOfflineQueue(updatedQueue);
                            remaining = updatedQueue.length();
                        }

                        Log.d(TAG, "✅ Synced batch of " + batchSize + " points! Remaining offline points: " + remaining);

                        if (remaining == 0) {
                            updateNotification("Recording route • 📡 All locations cloud-synced");
                            break;
                        } else {
                            updateNotification("Syncing... • " + remaining + " offline points remaining");
                        }
                    } else {
                        Log.w(TAG, "Server responded with HTTP " + code + " during sync");
                        break;
                    }
                }
            } catch (Exception e) {
                int queueSize = getOfflineQueueSize();
                Log.d(TAG, "No internet or sync failed: " + e.getMessage() + ". " + queueSize + " points kept safely on disk.");
                if (queueSize > 0) {
                    updateNotification("Recording route • 🛰️ " + queueSize + " points saved offline (will sync when online)");
                }
            }
        });
    }

    private void registerNetworkCallback() {
        if (connectivityManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                networkCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        Log.d(TAG, "Internet connection restored! Flushing offline location queue...");
                        flushOfflineQueue();
                    }
                };
                connectivityManager.registerDefaultNetworkCallback(networkCallback);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not register network callback: " + e.getMessage());
        }
    }

    private void unregisterNetworkCallback() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {}
            networkCallback = null;
        }
    }

    private void startPeriodicSyncScheduler() {
        if (periodicSyncScheduler != null) {
            periodicSyncScheduler.scheduleWithFixedDelay(() -> {
                try {
                    int count = getOfflineQueueSize();
                    if (count > 0) {
                        Log.d(TAG, "Periodic check: " + count + " offline points pending, attempting sync...");
                        flushOfflineQueue();
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Periodic sync check error: " + e.getMessage());
                }
            }, 10, 15, TimeUnit.SECONDS);
        }
    }

    private void updateNotification(String text) {
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                Notification notification = buildNotification("GeoConvey • Duty in Progress", text);
                manager.notify(NOTIFICATION_ID, notification);
            }
        } catch (Exception ignored) {}
    }

    private void sendSecurityEvent(String eventType, String reason) {
        if (dutySessionId == null || dutySessionId.isEmpty()) return;
        networkExecutor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("duty_session_id", dutySessionId);
                payload.put("event_type", eventType);
                JSONObject details = new JSONObject();
                details.put("reason", reason);
                details.put("timestamp", System.currentTimeMillis());
                payload.put("details", details);

                URL url = new URL(serverUrl + "/api/tracking/security-event");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                if (authToken != null && !authToken.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + authToken);
                }
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);

                byte[] body = payload.toString().getBytes("UTF-8");
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                    os.flush();
                }

                int code = conn.getResponseCode();
                Log.d(TAG, "Security event reported to cloud: " + eventType + " -> HTTP " + code);
                conn.disconnect();
            } catch (Exception e) {
                Log.w(TAG, "Failed to send security event: " + e.getMessage());
            }
        });
    }

    private void stopTracking() {
        flushOfflineQueue();
        unregisterNetworkCallback();
        if (periodicSyncScheduler != null) {
            periodicSyncScheduler.shutdown();
        }
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception ignored) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        stopForeground(true);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "GeoConvey Duty Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active duty background GPS tracking status");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        : PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    @Override
    public void onDestroy() {
        stopTracking();
        if (networkExecutor != null) {
            networkExecutor.shutdown();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override
    public void onProviderEnabled(String provider) {}
    @Override
    public void onProviderDisabled(String provider) {}
}
