'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TokenAllocation } from '@/src/lib/types';
import { performanceTracker } from '@/src/lib/services/performanceTracker';
import { useEffect, useState } from 'react';

interface TokenPerformanceChartProps {
    token: TokenAllocation;
    basketId: string;
    baseCurrency: string;
    timeframe: '1H' | '6H' | '24H' | '7D';
}

export function TokenPerformanceChart({ token, basketId, baseCurrency, timeframe }: TokenPerformanceChartProps) {
    const [data, setData] = useState<any[]>([]);
    const isPositive = token.pnl >= 0;

    useEffect(() => {
        const hours = {
            '1H': 1,
            '6H': 6,
            '24H': 24,
            '7D': 168
        }[timeframe];

        const history = performanceTracker.getTokenHistory(basketId, token.symbol, hours);
        const chartData = history.map(point => ({
            timestamp: new Date(point.timestamp).toLocaleTimeString(),
            price: point.price,
            pnl: point.pnl
        }));

        setData(chartData);
    }, [basketId, token.symbol, timeframe]);

    return (
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                            {token.symbol.replace('f', '')}
                        </span>
                    </div>
                    <div>
                        <h3 className="text-white font-medium">{token.symbol.replace('f', '')}</h3>
                        <p className="text-gray-400 text-sm">vs {baseCurrency.replace('f', '')}</p>
                    </div>
                </div>
                <div className={`text-right ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    <div className="font-semibold">
                        {isPositive ? '+' : ''}{token.pnlPercentage.toFixed(2)}%
                    </div>
                    <div className="text-sm">
                        {token.currentPrice.toFixed(4)}
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={150}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="timestamp"
                        stroke="#9CA3AF"
                        fontSize={10}
                        tick={false}
                    />
                    <YAxis
                        stroke="#9CA3AF"
                        fontSize={10}
                        tickFormatter={(value) => value.toFixed(3)}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                        }}
                        formatter={(value: number, name: string) => [
                            name === 'price' ? value.toFixed(4) : `${value.toFixed(2)}%`,
                            name === 'price' ? 'Exchange Rate' : 'P&L'
                        ]}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}