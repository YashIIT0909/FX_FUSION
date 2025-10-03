'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/src/components/ui/select';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { ArrowDown, ChevronDown, Loader2 } from 'lucide-react';
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
        { symbol: 'USDC', name: 'USD Coin' },
        { symbol: 'INR', name: 'Indian Rupee' },
        { symbol: 'EUR', name: 'Euro' },
        { symbol: 'GBP', name: 'British Pound' },
        { symbol: 'JPY', name: 'Japanese Yen' },
        { symbol: 'CHF', name: 'Swiss Franc' },
        { symbol: 'USD', name: 'US Dollar' },
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

    // Calculate received amount when flow amount or token changes
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
                // Switch to Ethereum Sepolia
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0xaa36a7" }], // Sepolia chain ID
                });
            } catch (error) {
                const switchError = error as EthereumError;
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0xaa36a7", // Sepolia chain ID
                            chainName: "Ethereum Sepolia",
                            nativeCurrency: {
                                name: "Sepolia Ether",
                                symbol: "SepoliaETH",
                                decimals: 18,
                            },
                            rpcUrls: ["https://rpc.sepolia.org"],
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
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

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md p-6 rounded-2xl">
                <div className="space-y-4">
                    {/* Loading indicator for prices */}
                    {isLoadingPrices && (
                        <div className="flex items-center justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-gray-400 text-sm">Loading live rates...</span>
                        </div>
                    )}

                    {/* Price data error indicator */}
                    {priceData?.error && (
                        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-2">
                            <p className="text-yellow-400 text-xs text-center">{priceData.error}</p>
                        </div>
                    )}

                    {/* Sell Section */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-sm">Sell</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <Input
                                type="number"
                                value={flowAmount}
                                onChange={(e) => setFlowAmount(e.target.value)}
                                placeholder="0"
                                className="bg-transparent border-none text-2xl font-semibold text-white p-0 h-auto focus:ring-0 flex-1"
                                disabled={isLoading || isLoadingPrices}
                            />
                            <div className="flex items-center bg-gray-700 rounded-full px-3 py-2 ml-4">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                                    <span className="text-white text-xs font-bold">F</span>
                                </div>
                                <span className="text-white font-medium">FLOW</span>
                            </div>
                        </div>
                        <div className="text-gray-400 text-sm mt-1">
                            ${ethUsdValue}
                        </div>
                    </div>

                    {/* Arrow Down */}
                    <div className="flex justify-center">
                        <div className="bg-gray-700 rounded-full p-2">
                            <ArrowDown className="h-4 w-4 text-gray-400" />
                        </div>
                    </div>

                    {/* Buy Section */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-sm">Buy</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="text-2xl font-semibold text-white flex-1">
                                {receivedAmount || '0'}
                            </div>
                            <Select
                                value={selectedToken}
                                onValueChange={setSelectedToken}
                                disabled={isLoading || isLoadingPrices}
                            >
                                <SelectTrigger className="bg-gray-700 border-none rounded-full px-3 py-2 w-auto ml-4 [&>svg]:hidden">
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                                            <span className="text-white text-xs font-bold">$</span>
                                        </div>
                                        <span className="text-white font-medium mr-1">{selectedToken}</span>
                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700">
                                    {availableTokens.map((token) => (
                                        <SelectItem key={token.symbol} value={token.symbol} className="text-white hover:bg-gray-700">
                                            <div className="flex items-center">
                                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                                                    <span className="text-white text-xs font-bold">$</span>
                                                </div>
                                                <span>{token.symbol}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-gray-400 text-sm mt-1">
                            ${selectedToken === 'USD' ? receivedAmount || '0' : receivedUsdValue}
                        </div>
                    </div>

                    {/* Exchange Rate Info */}
                    {flowAmount && currentRate && (
                        <div className="text-center text-gray-400 text-sm">
                            1 ETH = {currentRate.toFixed(4)} {selectedToken}
                        </div>
                    )}

                    {/* Transaction Status */}
                    {transactionStatus && (
                        <div className={`rounded-lg p-3 text-center text-sm ${transactionStatus.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {transactionStatus.message}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        disabled={!flowAmount || !selectedToken || isLoading || isLoadingPrices}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 rounded-xl text-lg font-semibold"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Processing...
                            </>
                        ) : (
                            'Get Tokens'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}