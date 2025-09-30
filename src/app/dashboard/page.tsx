'use client';

import { useWalletStore, useBasketStore } from '@/src/lib/store';
import { PriceTicker } from '@/src/components/ui/price-ticker';
import { BasketCard } from '@/src/components/ui/basket-card';
import { BuyTokensModal } from '@/src/components/ui/buy-tokens-modal';
import { YourTokens } from '@/src/components/ui/your-tokens';
import { Button } from '@/src/components/ui/button';
import { Plus, TrendingUp, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LiquidityModal } from '@/src/components/ui/liquidity-modal';
import { UserBaskets } from '@/src/components/ui/user-baskets';


export default function Dashboard() {
    const isConnected = useWalletStore(state => state.isConnected);
    const { userBaskets } = useBasketStore();
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [isLiquidityModalOpen, setIsLiquidityModalOpen] = useState(false);

    useEffect(() => {
        if (!isConnected) {
            redirect('/');
        }
    }, [isConnected]);

    if (!isConnected) {
        return null; // Will redirect
    }

    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                            <p className="text-gray-400">Manage your FX baskets and track performance</p>
                        </div>
                        <div className="mt-4 md:mt-0 flex items-center gap-4">
                            <Button
                                onClick={() => setIsBuyModalOpen(true)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Buy Tokens
                            </Button>
                            <Button
                                onClick={() => setIsLiquidityModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Manage Liquidity
                            </Button>
                        </div>
                    </div>
                </div>

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

                    {userBaskets.length === 0 ? (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-12 text-center">
                            <TrendingUp className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">No baskets minted yet</h3>
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

                {/* Public Baskets Section */}

            </div>

            {/* Buy Tokens Modal */}
            <BuyTokensModal
                isOpen={isBuyModalOpen}
                onClose={() => setIsBuyModalOpen(false)}
            />
            <LiquidityModal
                isOpen={isLiquidityModalOpen}
                onClose={() => setIsLiquidityModalOpen(false)}
            />
        </div>
    );
}