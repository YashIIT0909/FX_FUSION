'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PnlDataPoint } from '@/src/lib/types';

interface PnlChartProps {
    data: PnlDataPoint[];
    className?: string;
}

export function PnlChart({ data, className = '' }: PnlChartProps) {
    const isPositive = data.length > 0 && data[data.length - 1].pnl >= 0;

    return (
        <div className={`bg-slate-800/50 rounded-lg p-6 ${className}`}>
            <h3 className="text-lg font-semibold text-white mb-4">Portfolio Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="timestamp"
                        stroke="#9CA3AF"
                        fontSize={12}
                    />
                    <YAxis
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                        }}
                        formatter={(value: number, name: string) => [
                            `$${value.toFixed(2)}`,
                            name === 'value' ? 'Portfolio Value' : 'P&L'
                        ]}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke={isPositive ? "#10B981" : "#EF4444"}
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}