import { autoEndLingeringDutySessions } from './attendanceService.js';

let cronInterval = null;

/**
 * Initializes the server-side automatic midnight duty auto-end scheduler.
 * Runs on startup to catch any unclosed duties from downtime,
 * and checks periodically every 60 seconds for when IST midnight arrives.
 */
export function initMidnightCron() {
  console.log('⏰ Initializing Midnight Auto-End Scheduler (Asia/Kolkata)...');

  // Immediate check on boot
  autoEndLingeringDutySessions()
    .then((res) => {
      if (res.closedCount > 0) {
        console.log(`🌙 [Midnight Auto-End] Startup check: automatically closed ${res.closedCount} lingering session(s).`);
      }
    })
    .catch((err) => {
      console.error('❌ [Midnight Auto-End] Error in startup check:', err.message);
    });

  // Check every 60 seconds
  if (!cronInterval) {
    cronInterval = setInterval(async () => {
      try {
        const res = await autoEndLingeringDutySessions();
        if (res.closedCount > 0) {
          console.log(`🌙 [Midnight Auto-End] Closed ${res.closedCount} unended duty session(s) at midnight.`);
        }
      } catch (err) {
        console.error('❌ [Midnight Auto-End] Periodic check error:', err.message);
      }
    }, 60 * 1000);
  }

  return cronInterval;
}

export function stopMidnightCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
