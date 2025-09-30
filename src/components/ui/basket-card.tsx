'use client';

import { Basket } from '@/src/lib/types';
import { Button } from './button';
import { TrendingUp, TrendingDown, Users, Clock, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface BasketCardProps {
    basket: Basket;
    showCreator?: boolean;
    variant?: 'default' | 'compact';
}

export function BasketCard({ basket, showCreator = true, variant = 'default' }: BasketCardProps) {
    const isPositive = basket.performance >= 0;

    return (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{basket.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{basket.description}</p>
                </div>
                <div className={`flex items-center space-x-1 px-2 py-1 rounded ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="text-sm font-medium">
                        {isPositive ? '+' : ''}{basket.performance.toFixed(1)}%
                    </span>
                </div>
            </div>

            {variant === 'default' && (
                <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Total Value</span>
                        <span className="text-white font-medium">${basket.totalValue.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Tokens</span>
                        <span className="text-white">{basket.tokens.length} currencies</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Lock Period</span>
                        <div className="flex items-center space-x-1 text-white">
                            <Clock className="h-3 w-3" />
                            <span>{basket.lockDuration} days</span>
                        </div>
                    </div>

                    {showCreator && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Creator</span>
                            <span className="text-white font-mono text-xs">{basket.creator}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-1 mb-4">
                {basket.tokens.slice(0, 4).map((token) => (
                    <span
                        key={token.symbol}
                        className="px-2 py-1 bg-slate-700 text-xs text-gray-300 rounded"
                    >
                        {token.symbol} {token.weight}%
                    </span>
                ))}
                {basket.tokens.length > 4 && (
                    <span className="px-2 py-1 bg-slate-700 text-xs text-gray-300 rounded">
                        +{basket.tokens.length - 4} more
                    </span>
                )}
            </div>

            <Link href={`/baskets/${basket.id}`}>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    View Details
                </Button>
            </Link>
        </div>
    );
}