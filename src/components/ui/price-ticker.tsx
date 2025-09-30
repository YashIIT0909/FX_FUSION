'use client';

import { useEffect, useState } from 'react';
import { usePriceStore } from '@/src/lib/store';
import { PriceData } from '@/src/lib/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceHistoryPoint {
    timestamp: number;
    price: number;
}

// This interface matches the data structure sent by our new API route
interface ApiPriceData {
    symbol: string;
    price: number;
    change24h: number;
}

interface PriceTickerProps {
    symbols?: string[];
    className?: string;
}

export function PriceTicker({
    symbols = ['BTC/USD', 'ETH/USD', 'EUR/USD', 'GBP/USD', 'FLOW/USD', 'USD/CHF', 'USD/INR', 'USD/JPY'],
    className = ''
}: PriceTickerProps) {
    const { prices, updatePrices } = usePriceStore();
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const [priceChanges, setPriceChanges] = useState<Record<string, boolean>>({});
    const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryPoint[]>>({});

    useEffect(() => {
        console.log("PriceTicker: Connecting to backend price stream at /api/price-stream...");
        const eventSource = new EventSource('/api/price-stream');

        eventSource.onopen = () => {
            console.log("✅ PriceTicker: Connection to backend stream established.");
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const pythPrices: Record<string, ApiPriceData> = JSON.parse(event.data);
                const storePrices: Record<string, PriceData> = {};
                const updatedSymbols: Record<string, boolean> = {};

                Object.entries(pythPrices).forEach(([symbol, data]) => {
                    storePrices[symbol] = {
                        symbol: data.symbol,
                        price: data.price,
                        change24h: data.change24h,
                    };
                    updatedSymbols[symbol] = true;
                });

                if (Object.keys(storePrices).length > 0) {
                    updatePrices(storePrices);
                    setLastUpdate(Date.now());
                    setPriceChanges(updatedSymbols);

                    // Update price history for each currency
                    const timestamp = Date.now();
                    setPriceHistory(prev => {
                        const updated = { ...prev };

                        Object.entries(storePrices).forEach(([symbol, priceData]) => {
                            const history = updated[symbol] || [];
                            const newHistory = [...history, { timestamp, price: priceData.price }];

                            // Keep only last 20 points for the mini graph
                            updated[symbol] = newHistory.slice(-20);
                        });

                        return updated;
                    });

                    setTimeout(() => setPriceChanges({}), 700);
                }
            } catch (error) {
                console.error("PriceTicker: Failed to parse price data from backend.", error);
            }
        };

        // CHANGED: Removed eventSource.close() from the error handler.
        // This allows the browser's EventSource to automatically attempt reconnection.
        eventSource.onerror = (error) => {
            console.error("PriceTicker: Error with backend stream connection. The browser will attempt to reconnect.", error);
            setIsConnected(false);
            // DO NOT close the connection here. Let the browser handle it.
        };

        return () => {
            console.log("PriceTicker: Unmounting component, closing backend connection.");
            setIsConnected(false);
            eventSource.close();
        };
    }, [updatePrices]);

    const formatPrice = (symbol: string, price: number): string => {
        if (symbol.includes('BTC')) return price.toFixed(0);
        if (symbol.includes('ETH')) return price.toFixed(2);
        if (symbol.includes('FLOW')) return price.toFixed(4);
        if (symbol.includes('INR') || symbol.includes('JPY')) return price.toFixed(2);
        if (symbol.includes('CHF') || symbol.includes('EUR') || symbol.includes('GBP')) return price.toFixed(4);
        return price.toFixed(4);
    };

    const getCurrencySymbol = (symbol: string): string => {
        if (symbol.includes('USD') && !symbol.startsWith('USD')) return '$';
        if (symbol.includes('EUR')) return '€';
        if (symbol.includes('GBP')) return '£';
        if (symbol.includes('JPY')) return '¥';
        if (symbol.includes('INR')) return '₹';
        if (symbol.includes('CHF')) return 'CHF ';
        return '';
    };

    const generateSVGPath = (points: PriceHistoryPoint[]) => {
        if (points.length < 2) return '';

        const width = 240; // Reduced to fit within card padding (288px - 48px padding)
        const height = 128; // Increased for taller graph area
        const padding = 12;

        const minPrice = Math.min(...points.map(p => p.price));
        const maxPrice = Math.max(...points.map(p => p.price));
        const priceRange = maxPrice - minPrice || 0.0001;

        const pathData = points.map((point, index) => {
            const x = padding + (index / (points.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((point.price - minPrice) / priceRange) * (height - 2 * padding);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        return pathData;
    };

    return (
        <>
            <style jsx>{`
                @keyframes scroll {
                    0% {
                        transform: translateX(0);
                    }
                    100% {
                        transform: translateX(-50%);
                    }
                }
                .animate-scroll {
                    animation: scroll 30s linear infinite;
                }
                .animate-scroll:hover {
                    animation-play-state: paused;
                }
            `}</style>
            <div className={`bg-slate-800/50 rounded-lg p-4 ${className}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Live Crypto & FX Rates</h3>
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-gray-400">
                            {isConnected ? 'Connected' : 'Connecting...'}
                        </span>
                    </div>
                </div>

                {/* Infinite Carousel */}
                <div className="relative overflow-hidden">
                    <div className="flex animate-scroll gap-4">
                        {/* First set of cards */}
                        {symbols.map((symbol) => {
                            const price = prices[symbol];
                            const history = priceHistory[symbol] || [];

                            if (!price) {
                                return (
                                    <div key={symbol} className="flex-shrink-0 w-72 h-80 bg-slate-900/50 rounded-lg p-6 border border-slate-700 animate-pulse">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-400">{symbol}</span>
                                        </div>
                                        <div className="h-32 bg-gray-600 rounded mb-4"></div>
                                        <div className="h-8 bg-gray-600 rounded mb-2"></div>
                                        <div className="h-6 bg-gray-600 rounded w-3/4"></div>
                                    </div>
                                );
                            }

                            const isPositive = price.change24h >= 0;
                            const cardClassName = `flex-shrink-0 w-72 h-80 bg-slate-900/50 rounded-lg p-6 border border-slate-700 transition-colors duration-200 ${priceChanges[symbol] ? 'price-card-flash' : ''}`;

                            return (
                                <div key={symbol} className={cardClassName}>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-lg font-medium text-gray-300">{symbol}</span>
                                        {isPositive ? (
                                            <TrendingUp className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <TrendingDown className="h-5 w-5 text-red-500" />
                                        )}
                                    </div>

                                    {/* Larger Graph */}
                                    <div className="mb-6 h-24 flex items-center justify-center">
                                        {history.length > 1 ? (
                                            <svg width="100%" height="96" className="overflow-visible">
                                                <path
                                                    d={generateSVGPath(history)}
                                                    stroke="#ffffff"
                                                    strokeWidth="2"
                                                    fill="none"
                                                    className="drop-shadow-sm"
                                                />
                                            </svg>
                                        ) : (
                                            <div className="w-full h-full bg-slate-800/50 rounded flex items-center justify-center">
                                                <div className="text-gray-500 text-sm">Loading chart...</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-2xl font-bold text-white mb-2">
                                        {getCurrencySymbol(symbol)}{formatPrice(symbol, price.price)}
                                    </div>
                                    {price.change24h !== 0 && (
                                        <div className={`text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                            {isPositive ? '+' : ''}{price.change24h.toFixed(2)}%
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Duplicate set for infinite scroll */}
                        {symbols.map((symbol) => {
                            const price = prices[symbol];
                            const history = priceHistory[symbol] || [];

                            if (!price) {
                                return (
                                    <div key={`${symbol}-duplicate`} className="flex-shrink-0 w-72 h-80 bg-slate-900/50 rounded-lg p-6 border border-slate-700 animate-pulse">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-400">{symbol}</span>
                                        </div>
                                        <div className="h-32 bg-gray-600 rounded mb-4"></div>
                                        <div className="h-8 bg-gray-600 rounded mb-2"></div>
                                        <div className="h-6 bg-gray-600 rounded w-3/4"></div>
                                    </div>
                                );
                            }

                            const isPositive = price.change24h >= 0;
                            const cardClassName = `flex-shrink-0 w-72 h-80 bg-slate-900/50 rounded-lg p-6 border border-slate-700 transition-colors duration-200 ${priceChanges[symbol] ? 'price-card-flash' : ''}`;

                            return (
                                <div key={`${symbol}-duplicate`} className={cardClassName}>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-lg font-medium text-gray-300">{symbol}</span>
                                        {isPositive ? (
                                            <TrendingUp className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <TrendingDown className="h-5 w-5 text-red-500" />
                                        )}
                                    </div>

                                    {/* Larger Graph */}
                                    <div className="mb-6 h-32 flex items-center justify-center">
                                        {history.length > 1 ? (
                                            <svg width="240" height="128" viewBox="0 0 240 128" className="w-full h-full">
                                                <path
                                                    d={generateSVGPath(history)}
                                                    stroke="#ffffff"
                                                    strokeWidth="2"
                                                    fill="none"
                                                    className="drop-shadow-sm"
                                                />
                                            </svg>
                                        ) : (
                                            <div className="w-full h-full bg-slate-800/50 rounded flex items-center justify-center">
                                                <div className="text-gray-500 text-sm">Loading chart...</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-2xl font-bold text-white mb-2">
                                        {getCurrencySymbol(symbol)}{formatPrice(symbol, price.price)}
                                    </div>
                                    {price.change24h !== 0 && (
                                        <div className={`text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                            {isPositive ? '+' : ''}{price.change24h.toFixed(2)}%
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                    Last data received: {new Date(lastUpdate).toLocaleTimeString()}
                    {' | '}
                    Prices in store: {Object.keys(prices).length}
                </div>
            </div>
        </>
    );
}