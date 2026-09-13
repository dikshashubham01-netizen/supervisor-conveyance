import React, { useState } from 'react';
import { openDeveloperSettings } from '../../utils/backgroundTracking';

export default function SecurityScreen({ onRecheck, violationType = 'DEVELOPER_OPTIONS' }) {
  const [isChecking, setIsChecking] = useState(false);

  const handleOpenSettings = async () => {
    await openDeveloperSettings();
  };

  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      if (onRecheck) {
        await onRecheck();
      }
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white p-6 select-none">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Warning Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center text-rose-500 animate-pulse">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            {violationType === 'MOCK_LOCATION'
              ? 'Mock Location Detected'
              : 'Developer Options Enabled'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {violationType === 'MOCK_LOCATION'
              ? 'GeoConvey has detected a mock location or GPS spoofing provider. Mock location apps must be disabled to ensure accurate route and bike conveyance records.'
              : 'Android Developer Options must be disabled to start duty or record conveyance. This security policy prevents GPS spoofing and ensures accurate distance calculation.'}
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 text-left text-xs text-slate-300 space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to resolve:
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>Tap <strong>"Open Settings"</strong> below.</li>
            <li>Toggle <strong>Developer options</strong> to <strong>OFF</strong>.</li>
            <li>Return to GeoConvey and tap <strong>"Check Again"</strong>.</li>
          </ol>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="w-full py-3.5 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open Developer Settings
          </button>

          <button
            type="button"
            onClick={handleRecheck}
            disabled={isChecking}
            className="w-full py-3 px-4 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isChecking ? (
              <>
                <svg className="animate-spin w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Checking Status...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                I Have Disabled It — Check Again
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
