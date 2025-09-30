'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Wallet, DollarSign, Euro, PoundSterling, JapaneseYen as Yen, Banknote, Coins } from 'lucide-react';
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

// Contract addresses (replace with env variables if needed)
const tokenContracts = [
    { symbol: 'fUSD', address: process.env.NEXT_PUBLIC_fUSD_Token },
    { symbol: 'fEUR', address: process.env.NEXT_PUBLIC_fEUR_Token },
    { symbol: 'fGBP', address: process.env.NEXT_PUBLIC_fGBP_Token },
    { symbol: 'fYEN', address: process.env.NEXT_PUBLIC_fYEN_Token },
    { symbol: 'fINR', address: process.env.NEXT_PUBLIC_fINR_Token },
    { symbol: 'fCHF', address: process.env.NEXT_PUBLIC_fCHF_Token },
];


const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];

export function YourTokens() {
    const { isConnected, address, connect } = useWalletStore();
    const { userBalances, setUserBalances } = useBasketStore();
    const [isLoading, setIsLoading] = useState(true);

    const fetchBalances = async (user: string) => {
        try {
            setIsLoading(true);
            const provider = new BrowserProvider(window.ethereum);

            const results = await Promise.all(
                tokenContracts.map(async (token) => {
                    try {
                        if (!token.address) {
                            console.error(`Address not found for ${token.symbol}`);
                            return { symbol: token.symbol, balance: 0, eligible: false };
                        }
                        const contract = new Contract(token.address, erc20Abi, provider);
                        const bal = await contract.balanceOf(user);
                        console.log(bal)
                        const balance = parseFloat(formatUnits(bal, 18));
                        return { symbol: token.symbol, balance, eligible: balance > 0 };
                    } catch (err) {
                        console.error(`Error fetching ${token.symbol} balance:`, err);
                        return { symbol: token.symbol, balance: 0, eligible: false };
                    }
                })
            );

            setUserBalances(results);
        } catch (err) {
            console.error("Error fetching balances:", err);
            setUserBalances(tokenContracts.map(t => ({ symbol: t.symbol, balance: 0, eligible: false })));
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
                <CardTitle className="text-white flex items-center">
                    <Wallet className="h-5 w-5 mr-2 text-blue-500" />
                    Your Tokens
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
