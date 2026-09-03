# Supervisor Location Monitoring & Bike Conveyance Management System

A standalone, full-stack **Supervisor Location Monitoring & Bike Conveyance Management System** built from scratch.

---

## 📱 Supervisor Mobile App (Android APK)

The Supervisor client is available as a **dedicated native Android Application (.apk)**:

- 📦 **APK File**: [`Supervisor-App.apk`](file:///c:/Users/Admin/Desktop/Sup/Supervisor-App.apk) *(7.35 MB, ready to install on phone/emulator)*
- 🌐 **Web/Dev Mode**: Run `npm run app` (starts mobile view at [http://localhost:5174](http://localhost:5174))
- 🔨 **Build Commands**:
  - `npm run app:build` (compiles web assets and syncs to Android)
  - `npm run app:apk` (compiles `Supervisor-App.apk` using Gradle)

---

## 🚀 Quick Start

### 1. Start Backend & Admin Web Dashboard
From the project root:
```bash
npm run dev
```
- **Admin Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API & SSE Stream**: [http://localhost:5000](http://localhost:5000)

### 2. Run Supervisor Mobile App in Browser / Dev Mode
```bash
npm run app
```
- **Supervisor Mobile App**: [http://localhost:5174](http://localhost:5174)

---

## 🔑 Default Credentials

| Role | Employee ID / Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Full administrative, map, verification, and report export access |
| **Supervisor 1** | `EMP001` | `supervisor123` | John Doe |
| **Supervisor 2** | `EMP002` | `supervisor123` | Priya Sharma |
| **Supervisor 3** | `EMP003` | `supervisor123` | Amit Patel (Currently active ON DUTY) |

*(Quick 1-click credential auto-fill buttons are provided directly on the login screen for testing convenience).*

---

## 🛠️ System Architecture

- **Supervisor App (Mobile / PWA Web App)**:
  - Mobile-first interface with large touch targets.
  - Live camera selfie capture with GPS coordinates and timestamp.
  - Bike odometer camera capture with **OCR number detection** (Tesseract.js) + manual entry input and discrepancy resolution.
  - Intelligent GPS tracker with distance and time-based throttling.
  - **Offline GPS Support**: Buffers location points in **IndexedDB** during network dropouts and automatically synchronizes with deduplication (`client_uuid`) upon reconnection.
  - **Screen Wake Lock API**: Prevents device display from sleeping during active field duty.
  - Clear indicator badges: `🟢 ON DUTY`, `🟢 Location Tracking Active`, `🟢 Synced` / `🟠 X waiting to sync`.

- **Admin Web Dashboard**:
  - Top KPI cards: Active Supervisors, Total KM Today, Total Conveyance Today, Tracking Issues.
  - **Full-Screen Live Map**: Real-time Leaflet OpenStreetMap displaying all active supervisors with custom pulsing markers and live updates via Server-Sent Events (SSE).
  - **Route Playback Map**: Complete GPS polyline visualization with distinct Start (`A`), Waypoint, and End/Current (`B`) markers, plus filtered noise toggle.
  - **Session Verification Console**: Side-by-side inspection of Start/End attendance selfies, Start/End bike odometer photos, OCR readings vs manual entries, GPS vs Odometer distance comparison, and one-click Approve / Reject / Request Review actions.
  - **Manual Distance Override with Mandatory Reason**: Logged directly into the system audit trail.
  - **Configurable Bike Conveyance Rate**: Configurable rate (default ₹4.50/KM) with historical rate protection guaranteeing that previously completed sessions retain their rate locked at completion time.
  - **13-Column Reports & Export**: Multi-filter report table with **Export CSV** and **Export Excel (.xlsx)**.
  - **Audit Logs Page**: Complete compliance audit log tracking all actions.

- **Backend & Database**:
  - Node.js + Express REST API with JWT authentication and role-based authorization.
  - SQLite database (`better-sqlite3`) configured with Write-Ahead Logging (WAL) and foreign keys enabled.
  - Strict privacy enforcement: GPS tracking is only recorded during an active duty session.

---

## 📐 Conveyance Calculation & Anomaly Warning Engine

1. **Odometer Distance**: `End KM − Start KM`
2. **GPS Distance**: Polyline distance computed using the Haversine formula across valid, noise-cleaned GPS points.
3. **Lower Valid Distance Policy**:
   - The system automatically selects `min(GPS Distance, Odometer Distance)` as the approved distance.
   - Example: GPS = 34.72 KM, Odometer = 32 KM &rarr; **Approved = 32 KM** (`Reason: Lower Valid Distance Selected`).
4. **Conveyance Formula**: `Approved KM × Active Rate` (e.g. `32 × ₹4.50 = ₹144.00`).
5. **Automatic Warning System (⚠️ NEEDS ADMIN REVIEW)**:
   - Invalid Odometer: `End KM < Start KM`.
   - Discrepancy > 20% between GPS KM and Odometer KM.
   - Long tracking gaps (> 30 minutes without location).
   - Poor GPS accuracy (> 100 meters) or impossible speed jumps (> 120 km/h).

---

## 🧪 Running Automated Tests

Run the complete test suite (unit + end-to-end integration):
```bash
npm --prefix server test
```
All 9 test suites cover:
- Haversine distance accuracy
- GPS noise and impossible speed filtering
- Lower valid distance selection
- Invalid odometer detection
- OCR number parsing & correction
- 13-column reports & Excel export
- Full E2E lifecycle (Auth &rarr; Start Duty &rarr; GPS Sync &rarr; End Duty &rarr; Verification &rarr; Audit &rarr; Reports)
