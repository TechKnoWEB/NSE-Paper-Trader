import { useEffect, useCallback, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useAuthStore } from '@/store/settingsStore';
import type { DhanTick } from '@/types/dhan';

export interface DhanWebSocketResult {
  isConnected: boolean;
  lastTick: DhanTick | null;
  subscribe: (securityIds: string[]) => void;
  unsubscribe: (securityIds: string[]) => void;
}

export function useDhanWebSocket(): DhanWebSocketResult {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const updatePositionLTP = usePortfolioStore((s) => s.updatePositionLTP);

  const [isConnected, setIsConnected] = useState(false);
  const [lastTick, setLastTick] = useState<DhanTick | null>(null);

  const handleTick = useCallback(
    (data: Record<string, unknown>) => {
      const tick = data as unknown as DhanTick;
      if (tick.security_id && tick.LTP != null) {
        updatePositionLTP(tick.security_id, tick.LTP);
        setLastTick(tick);
      }
    },
    [updatePositionLTP]
  );

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    wsManager.connect(token);
    setIsConnected(true);
    wsManager.on('tick', handleTick);

    return () => {
      wsManager.off('tick', handleTick);
      wsManager.disconnect();
      setIsConnected(false);
    };
  }, [isAuthenticated, token, handleTick]);

  useEffect(() => {
    const checkAndDisconnect = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 5.5 * 3600000);
      const minutes = ist.getHours() * 60 + ist.getMinutes();

      if (minutes >= 930) {
        wsManager.disconnect();
        setIsConnected(false);
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(checkAndDisconnect, 30000);
    checkAndDisconnect();

    return () => clearInterval(intervalId);
  }, []);

  const subscribe = useCallback((securityIds: string[]) => {
    wsManager.send({ type: 'subscribe', instruments: securityIds });
  }, []);

  const unsubscribe = useCallback((securityIds: string[]) => {
    wsManager.send({ type: 'unsubscribe', instruments: securityIds });
  }, []);

  return {
    isConnected,
    lastTick,
    subscribe,
    unsubscribe,
  };
}
