'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/src/components/ui/select';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { ArrowDown, ChevronDown, Loader2, X, Zap, TrendingUp } from 'lucide-react';
import { ethers } from 'ethers';

interface BuyTokensModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ConversionRates {
    [key: string]: number;
}

interface PriceData {
    flowUsdPrice: number;
    conversionRates: ConversionRates;
    timestamp: string;
    error?: string;
}

interface EthereumError extends Error {
    code?: number;
    data?: unknown;
}

export function BuyTokensModal({ isOpen, onClose }: BuyTokensModalProps) {
    const [flowAmount, setFlowAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState('USDC');
    const [receivedAmount, setReceivedAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [priceData, setPriceData] = useState<PriceData | null>(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState<{ success: boolean; message: string } | null>(null);

    const availableTokens = [
        { symbol: 'USDC', name: 'USD Coin', color: 'from-blue-500 to-blue-600', emoji: '💵' },
        { symbol: 'EUR', name: 'Euro', color: 'from-purple-500 to-purple-600', emoji: '💶' },
        { symbol: 'GBP', name: 'British Pound', color: 'from-green-500 to-green-600', emoji: '💷' },
        { symbol: 'JPY', name: 'Japanese Yen', color: 'from-red-500 to-red-600', emoji: '💴' },
    ];

    // Fetch price data when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchPriceData();

            // Set up automatic refresh every 30 seconds
            const intervalId = setInterval(() => {
                fetchPriceData();
            }, 30000); // 30 seconds

            // Cleanup interval when modal closes
            return () => clearInterval(intervalId);
        }
    }, [isOpen]);

    const fetchPriceData = async () => {
        setIsLoadingPrices(true);
        try {
            const response = await fetch('/api/price-feeds');
            const result = await response.json();

            if (result.success) {
                setPriceData(result.data);
            } else {
                console.warn('Using fallback rates:', result.data.error);
                setPriceData(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch price data:', error);
            // Set fallback data
            setPriceData({
                flowUsdPrice: 1.25,
                conversionRates: {
                    USDC: 1.25,
                    USD: 1.25,
                    INR: 104,
                    CHF: 1.13,
                    JPY: 187.5,
                    EUR: 1.14,
                    GBP: 1.0,
                },
                timestamp: new Date().toISOString(),
                error: 'Failed to fetch live rates'
            });
        } finally {
            setIsLoadingPrices(false);
        }
    };

    // Calculate received amount when ETH amount or token changes
    useEffect(() => {
        if (flowAmount && selectedToken && priceData) {
            const rate = priceData.conversionRates[selectedToken];
            if (rate) {
                const calculated = (parseFloat(flowAmount) * rate).toFixed(2);
                setReceivedAmount(calculated);
            }
        } else {
            setReceivedAmount('');
        }
    }, [flowAmount, selectedToken, priceData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!flowAmount || !selectedToken) return;

        setIsLoading(true);
        setTransactionStatus(null);

        try {
            // 1. Fetch transaction data from your backend
            const response = await fetch('/api/buy-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tokenSymbol: selectedToken,
                    flowAmount: flowAmount, // This will be treated as ETH amount
                }),
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to prepare transaction.');
            }

            const { to, value, data, gasLimit } = result.data;

            // Validate that we have transaction data
            if (!data || data === "0x" || data === "") {
                throw new Error('Invalid transaction data received from server');
            }

            console.log("Raw transaction data from API:", { to, value, data, gasLimit });

            // 2. Use the user's wallet to send the transaction
            if (!window.ethereum) {
                throw new Error('Wallet not found. Please install a browser wallet like MetaMask.');
            }

            try {
                // Switch to Base Sepolia
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0x14a34" }], // Base Sepolia chain ID (84532)
                });
            } catch (error) {
                const switchError = error as EthereumError;
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0x14a34", // Base Sepolia chain ID
                            chainName: "Base Sepolia",
                            nativeCurrency: {
                                name: "Ethereum",
                                symbol: "ETH",
                                decimals: 18,
                            },
                            rpcUrls: ["https://sepolia.base.org"],
                            blockExplorerUrls: ["https://sepolia-explorer.base.org"],
                        }],
                    });
                } else {
                    throw switchError;
                }
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Prepare transaction object with proper data encoding
            const transactionRequest = {
                to: to,
                value: value,
                data: data,
                gasLimit: gasLimit,
            };

            console.log("Final transaction request:", transactionRequest);

            // Add gas estimation as fallback
            let finalGasLimit = gasLimit;
            try {
                const estimatedGas = await provider.estimateGas(transactionRequest);
                finalGasLimit = (estimatedGas * BigInt(120) / BigInt(100)).toString(); // 20% buffer
                console.log("Estimated gas:", estimatedGas.toString(), "Final gas limit:", finalGasLimit);
                transactionRequest.gasLimit = finalGasLimit;
            } catch (gasError) {
                console.warn("Gas estimation failed, using provided gas limit:", gasError);
            }

            const tx = await signer.sendTransaction(transactionRequest);

            setTransactionStatus({ success: false, message: `Transaction sent! Waiting for confirmation... Tx: ${tx.hash.substring(0, 10)}...` });

            // 3. Wait for the transaction to be confirmed
            const receipt = await tx.wait();

            console.log("Transaction receipt:", receipt);

            if (receipt && receipt.status === 1) {
                setTransactionStatus({ success: true, message: `Successfully purchased tokens! Tx: ${receipt.hash.substring(0, 10)}...` });
                setTimeout(() => handleClose(), 5000);
            } else {
                throw new Error(`Transaction failed on-chain. Status: ${receipt?.status}. Hash: ${receipt?.hash}`);
            }

        } catch (error: any) {
            console.error('Failed to buy tokens:', error);

            // Better error handling for different error types
            let errorMessage = 'An unknown error occurred.';

            if (error.code === 'ACTION_REJECTED') {
                errorMessage = 'Transaction rejected by user.';
            } else if (error.code === 'CALL_EXCEPTION') {
                errorMessage = 'Contract call failed - the function may not exist or parameters are invalid.';
            } else if (error.code === -32603) {
                errorMessage = 'Transaction failed - check contract state and parameters.';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient ETH for transaction.';
            } else if (error.message?.includes('execution reverted')) {
                errorMessage = 'Contract execution failed - check token amounts and contract state.';
            } else if (error.message?.includes('Invalid transaction data')) {
                errorMessage = 'Invalid transaction data - please try again.';
            } else {
                errorMessage = error.message || errorMessage;
            }

            setTransactionStatus({ success: false, message: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setFlowAmount('');
            setReceivedAmount('');
            setTransactionStatus(null);
            onClose();
        }
    };

    const currentRate = priceData?.conversionRates[selectedToken];
    const ethUsdValue = flowAmount && priceData ? (parseFloat(flowAmount) * priceData.flowUsdPrice).toFixed(2) : '0';
    const receivedUsdValue = receivedAmount && selectedToken !== 'USD' && priceData
        ? (parseFloat(receivedAmount) / (priceData.conversionRates[selectedToken] / priceData.flowUsdPrice)).toFixed(2)
        : receivedAmount;

    const selectedTokenData = availableTokens.find(token => token.symbol === selectedToken);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent
                className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 border-gray-700/50 text-white max-w-lg p-0 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl [&>button]:hidden [&>[data-dialog-close]]:hidden"
            >
                {/* Header */}
                <div className="relative p-6 pb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 rounded-t-3xl"></div>
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                    Swap Tokens
                                </h2>
                                <p className="text-sm text-gray-400">Lightning fast • Secure • Decentralized</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClose}
                            className="text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-full p-2 h-8 w-8 flex items-center justify-center relative z-50"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="px-6 pb-6 space-y-6">
                    {/* Loading indicator for prices */}
                    {isLoadingPrices && (
                        <div className="flex items-center justify-center py-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/20">
                            <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-400" />
                            <span className="text-blue-400 text-sm font-medium">Fetching live rates...</span>
                        </div>
                    )}

                    {/* Price data error indicator */}
                    {priceData?.error && (
                        <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/30 rounded-2xl p-3 backdrop-blur-sm">
                            <div className="flex items-center space-x-2">
                                <TrendingUp className="h-4 w-4 text-yellow-400" />
                                <p className="text-yellow-400 text-sm font-medium">{priceData.error}</p>
                            </div>
                        </div>
                    )}

                    {/* Trading Section with Arrow Between */}
                    <div className="relative">
                        {/* Sell Section */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50"></div>
                            <div className="relative bg-gray-800/80 backdrop-blur-xl rounded-t-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 h-40">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-gray-400 text-sm font-medium flex items-center">
                                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                                        You Pay
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded-full">
                                        Balance: 0.00 ETH
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <Input
                                        type="number"
                                        value={flowAmount}
                                        onChange={(e) => setFlowAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="bg-transparent border-none text-3xl font-bold text-white p-0 h-auto focus:ring-0 flex-1 placeholder:text-gray-600"
                                        disabled={isLoading || isLoadingPrices}
                                    />
                                    <div className="flex items-center bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl px-4 py-3 ml-4 shadow-lg hover:shadow-blue-500/25 transition-all duration-300">
                                        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mr-3 shadow-inner">
                                            <span className="text-white text-sm font-bold">Ξ</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-white font-bold text-sm">ETH</div>
                                            <div className="text-blue-200 text-xs">Base Sepolia</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-gray-400 text-sm mt-3 flex items-center">
                                    <span className="mr-2">≈</span>
                                    <span className="font-medium">${ethUsdValue}</span>
                                </div>
                            </div>
                        </div>

                        {/* Swap Arrow - Positioned between boxes */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                            <div className="bg-gray-700 rounded-xl p-3 border border-gray-600">
                                <ArrowDown className="h-5 w-5 text-gray-300" />
                            </div>
                        </div>

                        {/* Buy Section */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50"></div>
                            <div className="relative bg-gray-800/80 backdrop-blur-xl rounded-b-2xl p-6 border border-gray-700/50 border-t-0 hover:border-gray-600/50 transition-all duration-300 h-40">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-gray-400 text-sm font-medium flex items-center">
                                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                                        You Receive
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded-full">
                                        Balance: 0.00 {selectedToken}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-3xl font-bold text-white flex-1">
                                        {receivedAmount || '0.00'}
                                    </div>
                                    <Select
                                        value={selectedToken}
                                        onValueChange={setSelectedToken}
                                        disabled={isLoading || isLoadingPrices}
                                    >
                                        <SelectTrigger className="bg-gradient-to-r from-gray-700 to-gray-600 border-none rounded-2xl px-4 py-3 w-auto ml-4 [&>svg]:hidden shadow-lg hover:shadow-gray-500/25 transition-all duration-300">
                                            <div className="flex items-center">
                                                <div className={`w-8 h-8 bg-gradient-to-r ${selectedTokenData?.color} rounded-full flex items-center justify-center mr-3 shadow-inner`}>
                                                    <span className="text-white text-lg">{selectedTokenData?.emoji || '💰'}</span>
                                                </div>
                                                <div className="text-left mr-2">
                                                    <div className="text-white font-bold text-sm">{selectedToken}</div>
                                                    <div className="text-gray-300 text-xs">{selectedTokenData?.name}</div>
                                                </div>
                                                <ChevronDown className="h-4 w-4 text-gray-300" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-800/95 backdrop-blur-xl border-gray-700 rounded-2xl shadow-2xl">
                                            {availableTokens.map((token) => (
                                                <SelectItem
                                                    key={token.symbol}
                                                    value={token.symbol}
                                                    className="text-white hover:bg-gray-700/50 rounded-xl m-1 transition-all duration-200"
                                                >
                                                    <div className="flex items-center">
                                                        <div className={`w-8 h-8 bg-gradient-to-r ${token.color} rounded-full flex items-center justify-center mr-3 shadow-inner`}>
                                                            <span className="text-white text-lg">{token.emoji}</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-bold">{token.symbol}</div>
                                                            <div className="text-xs text-gray-400">{token.name}</div>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="text-gray-400 text-sm mt-3 flex items-center">
                                    <span className="mr-2">≈</span>
                                    <span className="font-medium">${selectedToken === 'USD' ? receivedAmount || '0.00' : receivedUsdValue}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exchange Rate Info */}
                    {flowAmount && currentRate && (
                        <div className="text-center bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm rounded-2xl p-3 border border-gray-600/30">
                            <div className="text-gray-300 text-sm">
                                <span className="font-medium">Rate:</span> 1 ETH = {currentRate.toFixed(4)} {selectedToken}
                            </div>
                        </div>
                    )}

                    {/* Transaction Status */}
                    {transactionStatus && (
                        <div className={`rounded-2xl p-4 text-center text-sm border backdrop-blur-sm transition-all duration-300 ${transactionStatus.success
                            ? 'bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-400 border-green-500/30 shadow-green-500/20'
                            : 'bg-gradient-to-r from-red-900/40 to-rose-900/40 text-red-400 border-red-500/30 shadow-red-500/20'
                            } shadow-lg`}>
                            <div className="flex items-center justify-center space-x-2">
                                {transactionStatus.success ? (
                                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs">✓</span>
                                    </div>
                                ) : (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                <span className="font-medium">{transactionStatus.message}</span>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        disabled={!flowAmount || !selectedToken || isLoading || isLoadingPrices}
                        className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 hover:from-blue-700 hover:via-purple-700 hover:to-cyan-700 text-white py-6 rounded-2xl text-lg font-bold shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center space-x-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                                <span>Processing Transaction...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center space-x-2">
                                <Zap className="h-5 w-5" />
                                <span>Swap Tokens</span>
                            </div>
                        )}
                    </Button>

                    {/* Footer Info */}
                    <div className="text-center text-xs text-gray-500 space-y-1">
                        <p>🔒 Powered by Base Sepolia • Gas fees apply</p>
                        <p>⚡ Transactions typically confirm in ~2 minutes</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}