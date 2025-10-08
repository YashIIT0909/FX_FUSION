'use client';

import { useWalletStore, useBasketStore } from '@/src/lib/store';
import { PnlChart } from '@/src/components/ui/pnl-chart';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { useEffect } from 'react';
import { PnlDataPoint } from '@/src/lib/types';

interface BasketDetailPageProps {
    params: { id: string };
}

export default function BasketDetailPage({ params }: BasketDetailPageProps) {
    const isConnected = useWalletStore(state => state.isConnected);
    const { userBaskets } = useBasketStore();

    useEffect(() => {
        if (!isConnected) {
            redirect('/');
        }
    }, [isConnected]);

    if (!isConnected) {
        return null;
    }

    const basket = [...userBaskets].find(b => b.id === params.id);

    if (!basket) {
        notFound();
    }

    // Generate mock PnL data
    const mockPnlData: PnlDataPoint[] = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - 29 + i);
        const baseValue = basket.totalValue * 0.9;
        const randomVariation = Math.sin(i * 0.3) * 200 + Math.random() * 100 - 50;
        const value = baseValue + randomVariation;
        return {
            timestamp: date.toLocaleDateString(),
            value: Number(value.toFixed(2)),
            pnl: Number((value - baseValue).toFixed(2)),
        };
    });

    const isPositive = basket.performance >= 0;
    const totalPnl = basket.tokens.reduce((sum, token) => sum + token.pnl, 0);

    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Button */}
                <div className="mb-6">
                    <Link href="/baskets">
                        <Button variant="outline" className="border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Baskets
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{basket.name}</h1>
                            <p className="text-gray-400">{basket.description}</p>
                        </div>
                        <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                            {isPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                            <span className="text-xl font-bold">
                                {isPositive ? '+' : ''}{basket.performance.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="text-center">
                            <DollarSign className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-white">${basket.totalValue.toLocaleString()}</div>
                            <div className="text-sm text-gray-400">Total Value</div>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ${totalPnl.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-400">Total P&L</div>
                        </div>
                        <div className="text-center">
                            <Clock className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-white">{basket.lockDuration}</div>
                            <div className="text-sm text-gray-400">Days Locked</div>
                        </div>
                        <div className="text-center">
                            <Users className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-white">{basket.tokens.length}</div>
                            <div className="text-sm text-gray-400">Currencies</div>
                        </div>
                    </div>
                </div>

                {/* PnL Chart */}
                <PnlChart data={mockPnlData} className="mb-8" />

                {/* Token Breakdown */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
                    <h2 className="text-xl font-semibold text-white mb-6">Token Breakdown</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {basket.tokens.map((token) => {
                            const tokenIsPositive = token.pnl >= 0;

                            return (
                                <div key={token.symbol} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                                <span className="text-white font-semibold text-sm">{token.symbol}</span>
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">{token.symbol}</div>
                                                <div className="text-gray-400 text-sm">{token.weight}% allocation</div>
                                            </div>
                                        </div>
                                        <div className={`text-right ${tokenIsPositive ? 'text-green-500' : 'text-red-500'}`}>
                                            <div className="font-semibold">
                                                {tokenIsPositive ? '+' : ''}${token.pnl.toFixed(2)}
                                            </div>
                                            <div className="text-sm">
                                                {tokenIsPositive ? '+' : ''}{token.pnlPercentage.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Amount:</span>
                                            <span className="text-white">{token.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Current Price:</span>
                                            <span className="text-white">${token.currentPrice.toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Creator Info */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 mt-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Basket Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <span className="text-gray-400">Creator:</span>
                            <span className="text-white ml-2 font-mono">{basket.creator}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Created:</span>
                            <span className="text-white ml-2">{new Date(basket.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Lock Duration:</span>
                            <span className="text-white ml-2">{basket.lockDuration} days</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Status:</span>
                            <span className="text-green-500 ml-2">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}