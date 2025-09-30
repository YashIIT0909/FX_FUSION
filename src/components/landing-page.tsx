'use client';

import { Button } from '@/src/components/ui/button';
import { PriceTicker } from '@/src/components/ui/price-ticker';
import { useBasketStore, useWalletStore } from '@/src/lib/store';
import { TrendingUp, Shield, Zap, ChartBar as BarChart3, DollarSign, Globe, Target, Users, Clock, Award } from 'lucide-react';

export function LandingPage() {
    const { connect } = useWalletStore();

    const features = [
        {
            icon: <DollarSign className="h-8 w-8 text-blue-500" />,
            title: "Multi-Currency Baskets",
            description: "Create diversified portfolios across major global currencies with customizable allocations.",
            bgColor: "hover:bg-blue-500"
        },
        {
            icon: <BarChart3 className="h-8 w-8 text-green-500" />,
            title: "Real-Time Performance",
            description: "Track your portfolio's performance with live P&L calculations and detailed analytics.",
            bgColor: "hover:bg-green-500"
        },
        {
            icon: <Shield className="h-8 w-8 text-purple-500" />,
            title: "Secure & Decentralized",
            description: "Built on blockchain technology with smart contract security and wallet integration.",
            bgColor: "hover:bg-purple-500"
        },
        {
            icon: <Zap className="h-8 w-8 text-yellow-500" />,
            title: "Live Price Feeds",
            description: "Powered by Pyth Network for accurate, real-time exchange rate data.",
            bgColor: "hover:bg-yellow-500"
        },
        {
            icon: <Globe className="h-8 w-8 text-cyan-500" />,
            title: "Global Market Access",
            description: "Access major FX markets worldwide with institutional-grade execution and liquidity.",
            bgColor: "hover:bg-cyan-500"
        },
        {
            icon: <Target className="h-8 w-8 text-orange-500" />,
            title: "Smart Allocation",
            description: "AI-powered portfolio optimization with risk management and automatic rebalancing features.",
            bgColor: "hover:bg-orange-500"
        },
        {
            icon: <Clock className="h-8 w-8 text-pink-500" />,
            title: "24/7 Trading",
            description: "Round-the-clock market access with automated trading strategies and alerts.",
            bgColor: "hover:bg-pink-500"
        },
        {
            icon: <Award className="h-8 w-8 text-indigo-500" />,
            title: "Premium Analytics",
            description: "Advanced charting tools, technical indicators, and comprehensive market analysis.",
            bgColor: "hover:bg-indigo-500"
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="text-center space-y-8">
                        <div className="space-y-4">
                            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                                Professional
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500">
                                    {" "}FX Trading
                                </span>
                                <br />
                                Made Simple
                            </h1>
                            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                                Create and manage diversified currency baskets with real-time performance tracking,
                                powered by blockchain technology and live market data.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Button
                                onClick={connect}
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                            >
                                Get Started
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="border-slate-700 text-white hover:bg-slate-800 px-8 py-3 text-lg"
                            >
                                Learn More
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Live Ticker Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <PriceTicker />
            </section>

            {/* Features Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-white mb-4">Why Choose FXFusion?</h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Advanced features designed for professional FX portfolio management
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`group bg-slate-800/50 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all duration-300 cursor-pointer ${feature.bgColor}`}
                        >
                            <div className="mb-4">
                                <div className="group-hover:[&>svg]:text-white transition-colors duration-300">
                                    {feature.icon}
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white transition-colors duration-300">
                                {feature.title}
                            </h3>
                            <p className="text-gray-400 text-sm group-hover:text-gray-100 transition-colors duration-300">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>


            {/* CTA Section */}
            <section className="bg-gradient-to-r from-blue-600 to-green-600">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center space-y-8">
                        <h2 className="text-3xl font-bold text-white">
                            Ready to Start Trading?
                        </h2>
                        <p className="text-blue-100 text-lg max-w-2xl mx-auto">
                            Connect your wallet to access professional FX basket management tools
                        </p>
                        <Button
                            onClick={connect}
                            size="lg"
                            className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
                        >
                            Connect Wallet Now
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}