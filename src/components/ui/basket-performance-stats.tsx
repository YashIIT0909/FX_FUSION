'use client';

import { Basket } from '@/src/lib/types';
import { DollarSign, TrendingUp, TrendingDown, Target, Clock } from 'lucide-react';

interface BasketPerformanceStatsProps {
    basket: Basket;
}

export function BasketPerformanceStats({ basket }: BasketPerformanceStatsProps) {
    const totalPnl = basket.totalValue - basket.initialValue;
    const isPnlPositive = totalPnl >= 0;
    const bestPerformer = basket.tokens.reduce((best, token) =>
        token.pnlPercentage > best.pnlPercentage ? token : best
    );
    const worstPerformer = basket.tokens.reduce((worst, token) =>
        token.pnlPercentage < worst.pnlPercentage ? token : worst
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
                <DollarSign className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-white">
                    {basket.totalValue.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">Current Value</div>
                <div className="text-xs text-gray-500">
                    Initial: {basket.initialValue.toFixed(2)}
                </div>
            </div>

            <div className="text-center">
                <div className={`text-xl font-bold ${isPnlPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPnlPositive ? '+' : ''}{totalPnl.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">Total P&L</div>
                <div className={`text-xs ${isPnlPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPnlPositive ? '+' : ''}{basket.performance.toFixed(2)}%
                </div>
            </div>

            <div className="text-center">
                <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-green-500">
                    +{bestPerformer.pnlPercentage.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-400">Best Performer</div>
                <div className="text-xs text-gray-500">
                    {bestPerformer.symbol.replace('f', '')}
                </div>
            </div>

            <div className="text-center">
                <TrendingDown className="h-6 w-6 text-red-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-red-500">
                    {worstPerformer.pnlPercentage.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-400">Worst Performer</div>
                <div className="text-xs text-gray-500">
                    {worstPerformer.symbol.replace('f', '')}
                </div>
            </div>

            <div className="text-center">
                <Target className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                <div className="text-xl font-bold text-white">
                    {basket.tokens.length}
                </div>
                <div className="text-sm text-gray-400">Currencies</div>
                <div className="text-xs text-gray-500">
                    Diversified Portfolio
                </div>
            </div>
        </div>
    );
}