'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Wallet, DollarSign, Euro, PoundSterling, JapaneseYen as Yen, Banknote, Coins, RefreshCw } from 'lucide-react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { Skeleton } from './skeleton';
import { Button } from './button';
import { useWalletStore, useBasketStore } from '@/src/lib/store';


interface EthereumError extends Error {
    code?: number;
    data?: unknown;
}

const tokenIcons: Record<string, JSX.Element> = {
    USD: <DollarSign className="h-6 w-6 text-green-500" />,
    EUR: <Euro className="h-6 w-6 text-blue-500" />,
    GBP: <PoundSterling className="h-6 w-6 text-purple-500" />,
    JPY: <Yen className="h-6 w-6 text-red-500" />,
    INR: <Banknote className="h-6 w-6 text-orange-500" />,
    CHF: <Coins className="h-6 w-6 text-yellow-500" />,
};

const tokenContracts = [
    { symbol: 'fUSD', address: process.env.NEXT_PUBLIC_fUSD_Token, displayName: 'USD' },
    { symbol: 'fEUR', address: process.env.NEXT_PUBLIC_fEUR_Token, displayName: 'EUR' },
    { symbol: 'fGBP', address: process.env.NEXT_PUBLIC_fGBP_Token, displayName: 'GBP' },
    { symbol: 'fYEN', address: process.env.NEXT_PUBLIC_fYEN_Token, displayName: 'JPY' },
    { symbol: 'fINR', address: process.env.NEXT_PUBLIC_fINR_Token, displayName: 'INR' },
    { symbol: 'fCHF', address: process.env.NEXT_PUBLIC_fCHF_Token, displayName: 'CHF' },
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading && isConnected ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-32 rounded-lg bg-slate-900/50" />
                        ))
                    ) : !isConnected ? (
                        <div className="col-span-full text-center text-gray-400 py-8 flex flex-col items-center gap-4">
                            <p>Please connect your wallet to see your token balances.</p>
                            <Button onClick={connect}>Connect Wallet</Button>
                        </div>
                    ) : (
                        userBalances.map((token) => (
                            <div
                                key={token.symbol}
                                className={`p-4 rounded-lg border transition-all hover:border-slate-600 ${token.balance > 0
                                    ? 'bg-slate-900/50 border-slate-700'
                                    : 'bg-slate-900/20 border-slate-800'
                                    }`}
                            >
                                <div className="flex items-center space-x-3 mb-3">
                                    {tokenIcons[token.symbol.replace('f', '')]}
                                    <div>
                                        <div className="text-white font-medium">{token.symbol}</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Balance:</span>
                                        <span className={`font-semibold ${token.balance > 0 ? 'text-white' : 'text-gray-500'}`}>
                                            {token.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </span>
                                    </div>
                                    {token.balance === 0 && (
                                        <div className="text-center py-2">
                                            <span className="text-gray-500 text-xs">No balance</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
