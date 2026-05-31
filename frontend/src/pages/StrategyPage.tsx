import React, { useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStrategyStore } from '@/store/strategyStore';
import { useMarketStore } from '@/store/marketStore';
import StrategyBuilder from '@/components/strategy/StrategyBuilder';
import PayoffChart from '@/components/strategy/PayoffChart';
import ScenarioPanel from '@/components/strategy/ScenarioPanel';
import Spinner from '@/components/common/Spinner';
import apiClient from '@/services/apiClient';
import type { OptionChain } from '@/types/options';
import type { StrategyAnalysis } from '@/types/strategy';

export default function StrategyPage() {
  const {
    legs,
    underlyingPrice,
    scenarioSpotDelta,
    scenarioIvDelta,
    scenarioDaysDelta,
    setUnderlyingPrice,
    setPayoffData,
    setScenario,
  } = useStrategyStore();

  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: optionChain, isLoading: chainLoading } = useQuery({
    queryKey: ['option-chain', selectedSymbol],
    queryFn: async () => {
      const { data } = await apiClient.get('/option-chain', {
        params: { symbol: selectedSymbol },
      });
      return data as OptionChain;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  useEffect(() => {
    if (optionChain?.spot_price) {
      setUnderlyingPrice(optionChain.spot_price);
    }
  }, [optionChain?.spot_price, setUnderlyingPrice]);

  const currentSpot = optionChain?.spot_price ?? underlyingPrice ?? 0;
  const availableStrikes = optionChain?.strikes ?? [];
  const daysToExpiry = optionChain?.expiry
    ? Math.ceil(
        (new Date(optionChain.expiry).getTime() - Date.now()) / 86400000
      )
    : 0;

  const fetchPayoff = useCallback(() => {
    if (legs.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.post('/strategy/payoff', {
          legs,
          underlying_price: currentSpot,
          scenario: {
            spot_delta_pct: scenarioSpotDelta,
            iv_shift_pct: scenarioIvDelta,
            days_forward: scenarioDaysDelta,
          },
        });
        const result = data as StrategyAnalysis;
        setPayoffData({
          payoffTable: result.payoff_table,
          breakevens: result.breakevens,
          maxProfit: result.max_profit,
          maxLoss: result.max_loss,
          netPremium: result.net_premium,
          netGreeks: result.net_greeks,
        });
      } catch {
        // silently fail — payoff calc is not critical for page render
      }
    }, 300);
  }, [legs, currentSpot, scenarioSpotDelta, scenarioIvDelta, scenarioDaysDelta, setPayoffData]);

  useEffect(() => {
    fetchPayoff();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchPayoff]);

  const handlePaperTrade = useCallback(() => {
    // Place multi-leg order — handled by StrategyBuilder child
  }, []);

  if (chainLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <StrategyBuilder
      availableStrikes={availableStrikes}
      currentSpot={currentSpot}
      daysToExpiry={daysToExpiry}
      onPaperTrade={handlePaperTrade}
    />
  );
}
