'use client';

import { useWalletStore, useBasketStore } from '@/src/lib/store';
import { PnlChart } from '@/src/components/ui/pnl-chart';
import { TokenPerformanceChart } from '@/src/components/ui/token-performance-chart';
import { BasketPerformanceStats } from '@/src/components/ui/basket-performance-stats';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Lock, Unlock, Clock } from 'lucide-react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { performanceTracker } from '@/src/lib/services/performanceTracker';
import { PnlDataPoint } from '@/src/lib/types';

interface BasketDetailPageProps {
    params: { id: string };
}

export default function BasketDetailPage({ params }: BasketDetailPageProps) {
    const isConnected = useWalletStore(state => state.isConnected);
    const { userBaskets } = useBasketStore();
    const [selectedTimeframe, setSelectedTimeframe] = useState<'1H' | '6H' | '24H' | '7D'>('24H');
    const [pnlData, setPnlData] = useState<PnlDataPoint[]>([]);

    useEffect(() => {
        if (!isConnected) {
            redirect('/');
        }
    }, [isConnected]);

    const basket = userBaskets.find(b => b.tokenId.toString() === params.id);

    useEffect(() => {
        if (basket) {
            // Start tracking this basket
            performanceTracker.startTracking([basket]);

            // Load historical data based on timeframe
            const hours = {
                '1H': 1,
                '6H': 6,
                '24H': 24,
                '7D': 168
            }[selectedTimeframe];

            const history = performanceTracker.getBasketHistory(basket.id, hours);
            setPnlData(history);
        }

        return () => {
            performanceTracker.stopTracking();
        };
    }, [basket, selectedTimeframe]);

    if (!isConnected) {
        return null;
    }

    if (!basket) {
        notFound();
    }

    const isPositive = basket.performance >= 0;
    const totalPnl = basket.tokens.reduce((sum, token) => sum + token.pnl, 0);
    const daysRemaining = Math.max(0, Math.ceil((new Date(basket.lockEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Button */}
                <div className="mb-6">
                    <Link href="/dashboard">
                        <Button variant="outline" className="border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-white">{basket.name}</h1>
                                <div className="flex items-center gap-2">
                                    {basket.isLocked ? (
                                        <div className="flex items-center px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-sm">
                                            <Lock className="w-4 h-4 mr-1" />
                                            Locked
                                        </div>
                                    ) : (
                                        <div className="flex items-center px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                            <Unlock className="w-4 h-4 mr-1" />
                                            Unlocked
                                        </div>
                                    )}
                                    <div className="flex items-center px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm">
                                        <Clock className="w-4 h-4 mr-1" />
                                        {daysRemaining}d remaining
                                    </div>
                                </div>
                            </div>
                            <p className="text-gray-400 mb-4">{basket.description}</p>
                            <div className="text-sm text-gray-500">
                                Base Currency: <span className="text-white font-medium">{basket.baseCurrency.replace('f', '')}</span>
                            </div>
                        </div>
                        <div className={`flex items-center space-x-2 px-6 py-3 rounded-lg ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                            {isPositive ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                            <div className="text-right">
                                <div className="text-2xl font-bold">
                                    {isPositive ? '+' : ''}{basket.performance.toFixed(2)}%
                                </div>
                                <div className="text-sm opacity-75">
                                    {isPositive ? '+' : ''}${totalPnl.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Stats */}
                    <BasketPerformanceStats basket={basket} />
                </div>

                {/* Timeframe Selection */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Performance Chart</h2>
                    <div className="flex items-center gap-2">
                        {(['1H', '6H', '24H', '7D'] as const).map((timeframe) => (
                            <Button
                                key={timeframe}
                                variant={selectedTimeframe === timeframe ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedTimeframe(timeframe)}
                                className={selectedTimeframe === timeframe
                                    ? 'bg-blue-600 text-white'
                                    : 'border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800'
                                }
                            >
                                {timeframe}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* PnL Chart */}
                <PnlChart data={pnlData} className="mb-8" />

                {/* Token Performance */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 mb-8">
                    <h2 className="text-xl font-semibold text-white mb-6">Individual Currency Performance</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {basket.tokens.map((token) => (
                            <TokenPerformanceChart
                                key={token.symbol}
                                token={token}
                                basketId={basket.id}
                                baseCurrency={basket.baseCurrency}
                                timeframe={selectedTimeframe}
                            />
                        ))}
                    </div>
                </div>

                {/* Token Breakdown */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
                    <h2 className="text-xl font-semibold text-white mb-6">Currency Breakdown</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {basket.tokens.map((token) => {
                            const tokenIsPositive = token.pnl >= 0;
                            const equivalentInBase = token.amount * token.currentPrice;

                            return (
                                <div key={token.symbol} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">
                                                    {token.symbol.replace('f', '')}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">{token.symbol.replace('f', '')}</div>
                                                <div className="text-gray-400 text-sm">{token.weight.toFixed(1)}% allocation</div>
                                            </div>
                                        </div>
                                        <div className={`text-right ${tokenIsPositive ? 'text-green-500' : 'text-red-500'}`}>
                                            <div className="font-semibold">
                                                {tokenIsPositive ? '+' : ''}${token.pnl.toFixed(2)}
                                            </div>
                                            <div className="text-sm">
                                                {tokenIsPositive ? '+' : ''}{token.pnlPercentage.toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Amount:</span>
                                            <span className="text-white">{token.amount.toLocaleString()} {token.symbol.replace('f', '')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Initial Rate:</span>
                                            <span className="text-white">{token.initialPrice.toFixed(4)} {basket.baseCurrency.replace('f', '')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Current Rate:</span>
                                            <span className="text-white">{token.currentPrice.toFixed(4)} {basket.baseCurrency.replace('f', '')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Value in {basket.baseCurrency.replace('f', '')}:</span>
                                            <span className="text-white">{equivalentInBase.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}