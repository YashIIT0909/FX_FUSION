'use client';

import { useState } from 'react';
import { useWalletStore } from '@/src/lib/store';
import { Button } from './button';
import { TrendingUp, Wallet, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navigation() {
    const { isConnected, address, connect, disconnect } = useWalletStore();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    const navItems = [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/baskets', label: 'Baskets' },
        { href: '/create', label: 'Create Basket' },
    ];

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <nav className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <TrendingUp className="h-8 w-8 text-blue-500" />
                        <span className="text-xl font-bold text-white">FXFusion</span>
                    </Link>

                    {/* Desktop Navigation */}
                    {isConnected && (
                        <div className="hidden md:flex space-x-8">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === item.href
                                        ? 'text-blue-400 bg-blue-500/10'
                                        : 'text-gray-300 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Wallet Connection */}
                    <div className="flex items-center space-x-4">
                        {isConnected ? (
                            <div className="flex items-center space-x-3">
                                <div className="hidden sm:flex items-center space-x-2 bg-slate-800 px-3 py-2 rounded-lg">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm text-gray-300">{formatAddress(address!)}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={disconnect}
                                    className="border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800"
                                >
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <Button
                                onClick={connect}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Wallet className="w-4 h-4 mr-2" />
                                Connect Wallet
                            </Button>
                        )}

                        {/* Mobile menu button */}
                        {isConnected && (
                            <button
                                className="md:hidden text-gray-300 hover:text-white"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isConnected && mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-800">
                        <div className="px-2 pt-2 pb-3 space-y-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${pathname === item.href
                                        ? 'text-blue-400 bg-blue-500/10'
                                        : 'text-gray-300 hover:text-white hover:bg-slate-800'
                                        }`}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}