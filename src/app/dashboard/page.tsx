'use client';

import { useWalletStore, useBasketStore, usePriceStore } from '@/src/lib/store';
import { PriceTicker } from '@/src/components/ui/price-ticker';
import { BasketCard } from '@/src/components/ui/basket-card';
import { BuyTokensModal } from '@/src/components/ui/buy-tokens-modal';
import { YourTokens } from '@/src/components/ui/your-tokens';
import { Button } from '@/src/components/ui/button';
import { Plus, TrendingUp, ShoppingCart, RefreshCw, Activity } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
    const { isConnected, address, signer } = useWalletStore();
    const { userBaskets, isLoadingBaskets, loadUserBaskets, updateBasketPerformance } = useBasketStore();
    const { prices } = usePriceStore();
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    useEffect(() => {
        if (!isConnected) {
            redirect('/');
        }
    }, [isConnected]);

    useEffect(() => {
        // Load baskets when wallet connects
        if (isConnected && address && signer && userBaskets.length === 0) {
            loadUserBaskets(address, signer);
        }
    }, [isConnected, address, signer]);

    // Update performance when prices change
    useEffect(() => {
        if (Object.keys(prices).length > 0 && userBaskets.length > 0) {
            updateBasketPerformance();
            setLastUpdate(new Date());
        }
    }, [prices]);

    const handleRefreshBaskets = async () => {
        if (!address || !signer) return;

        setIsRefreshing(true);
        try {
            await loadUserBaskets(address, signer);
        } catch (error) {
            console.error('Error refreshing baskets:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (!isConnected) {
        return null;
    }

    // Calculate portfolio statistics
    const totalPortfolioValue = userBaskets.reduce((sum, basket) => sum + basket.totalValue, 0);
    const totalInitialValue = userBaskets.reduce((sum, basket) => sum + basket.initialValue, 0);
    const totalPnl = totalPortfolioValue - totalInitialValue;
    const totalPnlPercentage = totalInitialValue > 0 ? (totalPnl / totalInitialValue) * 100 : 0;
    const isPnlPositive = totalPnl >= 0;

    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                            <p className="text-gray-400">Monitor your FX baskets performance in real-time</p>
                            <div className="flex items-center mt-2 text-sm text-gray-500">
                                <Activity className="w-4 h-4 mr-1" />
                                Last updated: {lastUpdate.toLocaleTimeString()}
                            </div>
                        </div>
                        <div className="mt-4 md:mt-0 flex items-center gap-4">
                            <Button
                                onClick={handleRefreshBaskets}
                                disabled={isRefreshing}
                                variant="outline"
                                className="border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                onClick={() => setIsBuyModalOpen(true)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Buy Tokens
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Portfolio Overview */}
                {userBaskets.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 mb-8">
                        <h2 className="text-xl font-semibold text-white mb-4">Portfolio Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {totalPortfolioValue.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-400">Total Current Value</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-400">
                                    {totalInitialValue.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-400">Total Initial Value</div>
                            </div>
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${isPnlPositive ? 'text-green-500' : 'text-red-500'}`}>
                                    {isPnlPositive ? '+' : ''}{totalPnl.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-400">Total P&L</div>
                            </div>
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${isPnlPositive ? 'text-green-500' : 'text-red-500'}`}>
                                    {isPnlPositive ? '+' : ''}{totalPnlPercentage.toFixed(2)}%
                                </div>
                                <div className="text-sm text-gray-400">Total P&L (%)</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Live Prices */}
                <PriceTicker className="mb-8" />

                {/* Your Tokens Section */}
                <section className="mb-12">
                    <YourTokens />
                </section>

                {/* User Baskets Section */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-semibold text-white">My Baskets</h2>
                        <Link href="/create">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Basket
                            </Button>
                        </Link>
                    </div>

                    {isLoadingBaskets ? (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <h3 className="text-xl font-semibold text-white mb-2">Loading your baskets...</h3>
                            <p className="text-gray-400">Fetching data from blockchain</p>
                        </div>
                    ) : userBaskets.length === 0 ? (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-12 text-center">
                            <TrendingUp className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">No baskets created yet</h3>
                            <p className="text-gray-400 mb-6">
                                Create your first currency basket to start tracking performance
                            </p>
                            <Link href="/create">
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Your First Basket
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {userBaskets.map((basket) => (
                                <BasketCard key={basket.id} basket={basket} showCreator={false} />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Buy Tokens Modal */}
            <BuyTokensModal
                isOpen={isBuyModalOpen}
                onClose={() => setIsBuyModalOpen(false)}
            />
        </div>
    );
}