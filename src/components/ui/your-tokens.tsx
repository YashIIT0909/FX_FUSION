'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Wallet, DollarSign, Euro, PoundSterling, JapaneseYen as Yen, RefreshCw } from 'lucide-react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { Skeleton } from './skeleton';
import { Button } from './button';
import { useWalletStore, useBasketStore } from '@/src/lib/store';


interface EthereumError extends Error {
    code?: number;
    data?: unknown;
}

const tokenIcons: Record<string, JSX.Element> = {
    USD: <DollarSign className="h-8 w-8 text-white" />,
    EUR: <Euro className="h-8 w-8 text-white" />,
    GBP: <PoundSterling className="h-8 w-8 text-white" />,
    JPY: <Yen className="h-8 w-8 text-white" />,
};

const tokenContracts = [
    { symbol: 'fUSD', address: process.env.NEXT_PUBLIC_fUSD_Token, displayName: 'USD', color: 'from-green-500 to-emerald-600' },
    { symbol: 'fEUR', address: process.env.NEXT_PUBLIC_fEUR_Token, displayName: 'EUR', color: 'from-blue-500 to-blue-600' },
    { symbol: 'fGBP', address: process.env.NEXT_PUBLIC_fGBP_Token, displayName: 'GBP', color: 'from-purple-500 to-purple-600' },
    { symbol: 'fYEN', address: process.env.NEXT_PUBLIC_fYEN_Token, displayName: 'JPY', color: 'from-red-500 to-red-600' },
];

const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)"
];

export function YourTokens() {
    const { isConnected, address, connect } = useWalletStore();
    const { userBalances, setUserBalances } = useBasketStore();
    const [isLoading, setIsLoading] = useState(true);

    // Debug environment variables
    useEffect(() => {
        console.log("🔧 Environment Variables Check:");
        tokenContracts.forEach(token => {
            console.log(`${token.symbol}: ${token.address || 'NOT SET'}`);
        });
    }, []);

    const fetchBalances = async (user: string) => {
        try {
            setIsLoading(true);
            console.log("=== Fetching token balances for user:", user);
            console.log("Available token contracts:", tokenContracts);
            const provider = new BrowserProvider(window.ethereum);

            const results = await Promise.all(
                tokenContracts.map(async (token) => {
                    try {
                        if (!token.address) {
                            console.warn(`⚠️ Address not found for ${token.symbol} - check environment variables`);
                            return {
                                symbol: token.symbol,
                                displayName: token.displayName,
                                balance: 0,
                                eligible: false
                            };
                        }

                        console.log(`📊 Fetching balance for ${token.symbol} at ${token.address}`);

                        // First check if there's code at this address
                        const code = await provider.getCode(token.address);
                        if (code === '0x') {
                            console.warn(`⚠️ No contract found at ${token.address} for ${token.symbol}`);
                            return {
                                symbol: token.symbol,
                                displayName: token.displayName,
                                balance: 0,
                                eligible: false
                            };
                        }

                        const contract = new Contract(token.address, erc20Abi, provider);
                        const balanceRaw = await contract.balanceOf(user);
                        const balance = parseFloat(formatUnits(balanceRaw, 18));
                        console.log(`✅ ${token.symbol} balance: ${balance} (raw: ${balanceRaw.toString()})`);

                        return {
                            symbol: token.symbol,
                            displayName: token.displayName,
                            balance,
                            eligible: balance > 0
                        };
                    } catch (err) {
                        console.error(`❌ Error fetching ${token.symbol} balance at ${token.address}:`, err);
                        return {
                            symbol: token.symbol,
                            displayName: token.displayName,
                            balance: 0,
                            eligible: false
                        };
                    }
                })
            );

            console.log("📊 All balances fetched:", results);
            setUserBalances(results);
        } catch (err) {
            console.error("❌ Error in fetchBalances:", err);
            setUserBalances(tokenContracts.map(t => ({
                symbol: t.symbol,
                displayName: t.displayName,
                balance: 0,
                eligible: false
            })));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (address) {
            fetchBalances(address);
        } else {
            // When disconnected, clear balances and stop loading
            setUserBalances([]);
            setIsLoading(false);
        }
    }, [address]);


    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center">
                        <Wallet className="h-5 w-5 mr-2 text-blue-500" />
                        Your Tokens
                    </div>
                    {isConnected && address && (
                        <Button
                            onClick={() => fetchBalances(address)}
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                            className="bg-transparent border-slate-600 text-white hover:bg-slate-700"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {isLoading && isConnected ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-600/20 to-slate-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50"></div>
                                <Skeleton className="relative h-36 rounded-2xl bg-slate-900/50 border border-slate-700/50" />
                            </div>
                        ))
                    ) : !isConnected ? (
                        <div className="col-span-full text-center text-gray-400 py-12 flex flex-col items-center gap-6">
                            <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl">
                                <Wallet className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-white mb-2">Connect Your Wallet</p>
                                <p className="text-gray-400 mb-4">View your token balances and portfolio</p>
                                <Button
                                    onClick={connect}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                                >
                                    Connect Wallet
                                </Button>
                            </div>
                        </div>
                    ) : (
                        userBalances.map((token) => {
                            const tokenConfig = tokenContracts.find(t => t.symbol === token.symbol);
                            return (
                                <div
                                    key={token.symbol}
                                    className="relative group"
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-r ${tokenConfig?.color || 'from-slate-600/20 to-slate-500/20'} rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50`}></div>
                                    <div className={`relative p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] ${token.balance > 0
                                        ? 'bg-slate-900/80 border-slate-600/50 hover:border-slate-500/50 shadow-xl'
                                        : 'bg-slate-900/40 border-slate-800/50 hover:border-slate-700/50'
                                        }`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`p-3 rounded-xl bg-gradient-to-r ${tokenConfig?.color || 'from-slate-600 to-slate-700'} shadow-inner`}>
                                                {tokenIcons[tokenConfig?.displayName || 'USD']}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-white font-bold text-lg">{tokenConfig?.displayName}</div>
                                                <div className="text-gray-400 text-sm">{token.symbol}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-sm font-medium">Balance</span>
                                                <span className={`font-bold text-lg ${token.balance > 0 ? 'text-white' : 'text-gray-500'}`}>
                                                    {token.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                </span>
                                            </div>

                                            {token.balance > 0 ? (
                                                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-600/30 rounded-xl p-2 text-center">
                                                    <span className="text-green-400 text-xs font-medium flex items-center justify-center">
                                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                                                        Active Balance
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/30 rounded-xl p-2 text-center">
                                                    <span className="text-slate-400 text-xs font-medium">No Balance</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
