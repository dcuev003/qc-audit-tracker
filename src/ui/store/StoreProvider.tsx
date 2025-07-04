import React, { useEffect } from 'react';
import { useStore } from './store';

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const syncWithChromeStorage = useStore((state) => state.syncWithChromeStorage);
  const subscribeToStorageChanges = useStore((state) => state.subscribeToStorageChanges);
  const unsubscribeFromStorageChanges = useStore((state) => state.unsubscribeFromStorageChanges);
  const activeTimers = useStore((state) => state.activeTimers);

  useEffect(() => {
    console.log('[StoreProvider] Initializing...');
    
    // Initial sync
    syncWithChromeStorage().then(() => {
      console.log('[StoreProvider] Initial sync completed');
      // After sync, check if we have active timers and start real-time updates
      const state = useStore.getState();
      const hasActiveTimers = state.activeTimers.activeAudit || state.activeTimers.activeOffPlatform;
      console.log('[StoreProvider] Checking for active timers:', { hasActiveTimers });
      if (hasActiveTimers) {
        state.startRealtimeUpdates();
      }
    });
    
    // Subscribe to changes
    console.log('[StoreProvider] Subscribing to storage changes...');
    subscribeToStorageChanges();
    
    // Cleanup
    return () => {
      console.log('[StoreProvider] Cleaning up...');
      unsubscribeFromStorageChanges();
    };
  }, []);

  // Monitor active timers and start/stop real-time updates accordingly
  useEffect(() => {
    const hasActiveTimers = activeTimers.activeAudit || activeTimers.activeOffPlatform;
    const state = useStore.getState();
    
    if (hasActiveTimers && !state._realtimeUpdateInterval) {
      state.startRealtimeUpdates();
    } else if (!hasActiveTimers && state._realtimeUpdateInterval) {
      state.stopRealtimeUpdates();
    }
  }, [activeTimers.activeAudit, activeTimers.activeOffPlatform]);

  return <>{children}</>;
}