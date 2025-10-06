'use client';

import { useWalletStore, useBasketStore } from '@/src/lib/store';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { ArrowLeft, Plus, Minus, DollarSign, Percent, Clock } from 'lucide-react';
import Link from 'next/link';
import { redirect, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserBalance, Basket, TokenAllocation } from '@/src/lib/types';
import { YourTokens } from '@/src/components/ui/your-tokens';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import AppContract from '@/src/contracts/out/facade.sol/Facade.json'; // Assuming you have the ABI here

const ERC20_ABI = ["function approve(address spender, uint256 amount) public returns (bool)"];

const ALL_TOKENS = ['fUSD', 'fEUR', 'fGBP', 'fYEN', 'fINR', 'fCHF'];

// Pyth Contract Address from App.sol
const PYTH_CONTRACT_ADDRESS = "0x2880aB155794e7179c9eE2e38200202908C17B43";
const PYTH_ABI = ["function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount)"];

// Pyth Price Feed IDs from your App.sol contract
const PYTH_PRICE_IDS: Record<string, string> = {
    fCHF: '0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e28f8', // USD_CHF
    fEUR: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b', // EUR_USD
    fGBP: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1', // GBP_USD
    fINR: '0x0ac0f9a2886fc2dd708bc66cc2cea359052ce89d324f45d95fadbc6c4fcf1809', // USD_INR
    fUSD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // USDC_USD

    fYEN: '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52', // USD_YEN
};

const PYTH_HERMES_URL = "https://hermes.pyth.network";

const TOKEN_ADDRESSES: Record<string, string | undefined> = {
    fCHF: process.env.NEXT_PUBLIC_fCHF_Token,
    fEUR: process.env.NEXT_PUBLIC_fEUR_Token,
    fGBP: process.env.NEXT_PUBLIC_fGBP_Token,
    fINR: process.env.NEXT_PUBLIC_fINR_Token,
    fUSD: process.env.NEXT_PUBLIC_fUSD_Token,
    fYEN: process.env.NEXT_PUBLIC_fYEN_Token,
};

export default function CreateBasket() {
    const { isConnected, signer } = useWalletStore();
    const { userBalances, addBasket } = useBasketStore();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        lockDuration: 30,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get eligible tokens from userBalances (only those with a balance > 0)
    const eligibleTokens = userBalances.filter(token => token.balance > 0);

    // Initial token selection state
    const [initialToken, setInitialToken] = useState<string>('');
    const [initialAmount, setInitialAmount] = useState<number>(0);

    // Allocation state: [{ symbol, percentage }]
    const [allocations, setAllocations] = useState<{ symbol: string; percentage: number }[]>([]);

    // Calculate total allocation percentage
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);

    // Only allow allocation to tokens other than initialToken
    const remainingTokens = ALL_TOKENS.filter(t => t !== initialToken).map(symbol => ({ symbol, balance: 0, eligible: true }));

    // Form validation
    const isValidForm =
        formData.name &&
        formData.description &&
        initialToken &&
        initialAmount > 0 &&
        allocations.length > 0 &&
        totalPercentage === 100;

    useEffect(() => {
        if (!isConnected) {
            redirect('/');
        }
    }, [isConnected]);

    if (!isConnected) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidForm) return;

        setIsSubmitting(true);

        try {
            if (!signer) {
                throw new Error("Wallet is not connected or signer is not available.");
            }

            const appContractAddress = process.env.NEXT_PUBLIC_App;

            if (!appContractAddress) {
                throw new Error("App contract address is not configured.");
            }

            // --- START: APPROVAL LOGIC ---
            const initialTokenAddress = TOKEN_ADDRESSES[initialToken];
            if (!initialTokenAddress) {
                throw new Error(`Address for token ${initialToken} not found in environment variables.`);
            }

            const tokenContract = new Contract(initialTokenAddress, ERC20_ABI, signer);
            const _inputAmount = parseUnits(initialAmount.toString(), 18);

            console.log(`Approving ${appContractAddress} to spend ${_inputAmount.toString()} of ${initialToken}`);
            const approveTx = await tokenContract.approve(appContractAddress, _inputAmount);
            await approveTx.wait(); // Wait for approval to be mined
            console.log('Approval successful');
            // --- END: APPROVAL LOGIC ---

            const contract = new Contract(appContractAddress, AppContract.abi, signer);
            const pythContract = new Contract(PYTH_CONTRACT_ADDRESS, PYTH_ABI, signer);

            // 1. Prepare parameters for executeBasket
            const _inputTokenName = initialToken;
            // const _inputAmount = parseUnits(initialAmount.toString(), 18); // Already defined above
            const _outputTokenNames = allocations.map(a => a.symbol);
            const _outputPercentages = allocations.map(a => a.percentage * 100); // Convert 0-100 scale to 0-10000 for contract
            const _basket_lockout_period = formData.lockDuration * 24 * 60 * 60; // Convert days to seconds

            // 2. Construct JSON metadata
            const metadata = {
                name: formData.name,
                description: formData.description,
                initialToken: _inputTokenName,
                initialAmount: initialAmount.toString(),
                allocations: allocations,
            };
            const _jsonMetadata = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;

            // 3. Fetch Pyth updateData
            const allInvolvedTokens = Array.from(new Set([_inputTokenName, ..._outputTokenNames]));
            const priceIds = allInvolvedTokens.map(token => PYTH_PRICE_IDS[token]);
            const priceUpdateData = await (await fetch(`${PYTH_HERMES_URL}/api/latest_vaas?ids[]=${priceIds.join('&ids[]=')}`)).json();
            const _updateData = priceUpdateData.map((v: string) => "0x" + Buffer.from(v, 'base64').toString('hex'));

            // 4. Get Pyth fee and call the contract
            const pythFee = await pythContract.getUpdateFee(_updateData);
            const tx = await contract.executeBasket(
                _inputTokenName,
                _inputAmount,
                _outputTokenNames,
                _outputPercentages,
                _basket_lockout_period,
                _jsonMetadata,
                _updateData,
                { value: pythFee } // Send fee as msg.value
            );

            await tx.wait(); // Wait for transaction to be mined

            // This part can be removed if the contract is the source of truth
            // Or updated to reflect the on-chain reality after creation
            const newBasket: Basket = {
                id: `user-basket-${Date.now()}`, // This should ideally come from a contract event
                name: formData.name,
                description: formData.description,
                tokens: allocations.map(a => ({
                    symbol: a.symbol,
                    weight: a.percentage,
                    amount: (initialAmount * a.percentage) / 100,
                    currentPrice: 1, pnl: 0, pnlPercentage: 0
                })),
                performance: 0,
                totalValue: initialAmount,
                createdAt: new Date().toISOString(),
                lockDuration: formData.lockDuration,
                creator: await signer.getAddress(),
                isPublic: false,
            };
            addBasket(newBasket);

            router.push('/dashboard');

        } catch (error) {
            console.error('Failed to create basket:', error);
            // You can add user-friendly error notifications here
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update allocation
    const updateAllocation = (index: number, value: string) => {
        const updated = [...allocations];
        // Use parseInt to avoid floating point issues and handle empty input
        updated[index].percentage = value === '' ? 0 : parseInt(value, 10);
        setAllocations(updated);
    };

    // Add allocation token
    const addAllocationToken = () => {
        const available = remainingTokens.find(
            t => !allocations.some(a => a.symbol === t.symbol)
        );
        if (available) {
            setAllocations([...allocations, { symbol: available.symbol, percentage: 0 }]);
        }
    };

    // Remove allocation token
    const removeAllocationToken = (index: number) => {
        setAllocations(allocations.filter((_, i) => i !== index));
    };

    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Button */}
                <div className="mb-6">
                    <Link href="/dashboard">
                        <Button variant="outline" className="border-slate-700 text-gray-300 hover:text-white hover:bg-slate-800">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Create New Basket</h1>
                    <p className="text-gray-400">Design your custom currency portfolio</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Information */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-white">Basket Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., My Global Portfolio"
                                    className="bg-slate-900 border-slate-700 text-white"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-white">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe your investment strategy..."
                                    className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lockDuration" className="text-white">Lock Duration (Days)</Label>
                                <Select
                                    value={formData.lockDuration.toString()}
                                    onValueChange={(value) => setFormData({ ...formData, lockDuration: parseInt(value) })}
                                >
                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700">
                                        <SelectItem value="7">7 days</SelectItem>
                                        <SelectItem value="30">30 days</SelectItem>
                                        <SelectItem value="60">60 days</SelectItem>
                                        <SelectItem value="90">90 days</SelectItem>
                                        <SelectItem value="180">180 days</SelectItem>
                                        <SelectItem value="365">1 year</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Available Balances */}
                    <YourTokens />

                    {/* Token Allocation */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Token Allocation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Initial Token Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-white">Initial Token</Label>
                                    <Select
                                        value={initialToken}
                                        onValueChange={(value) => {
                                            setInitialToken(value);
                                            setInitialAmount(0);
                                            setAllocations([]);
                                        }}
                                    >
                                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                            <SelectValue placeholder="Select initial token" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700">
                                            {eligibleTokens.map((token) => (
                                                <SelectItem key={token.symbol} value={token.symbol}>
                                                    {token.symbol.replace('f', '')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">Amount</Label>
                                    <Input
                                        type="number"
                                        value={initialAmount}
                                        onChange={(e) => setInitialAmount(Number(e.target.value))}
                                        min="0"
                                        max={
                                            initialToken
                                                ? eligibleTokens.find(t => t.symbol === initialToken)?.balance || 0
                                                : 0
                                        }
                                        className="bg-slate-800 border-slate-600 text-white"
                                        disabled={!initialToken}
                                    />
                                    {initialToken && (
                                        <div className="text-xs text-gray-400">
                                            Max: {eligibleTokens.find(t => t.symbol === initialToken)?.balance.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Allocation to other tokens */}
                            {initialToken && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-white font-medium">Allocate to other tokens</span>
                                        <Button
                                            type="button"
                                            onClick={addAllocationToken}
                                            disabled={allocations.length >= remainingTokens.length || totalPercentage >= 100}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Token
                                        </Button>
                                    </div>
                                    {allocations.map((alloc, idx) => (
                                        <div key={alloc.symbol} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                            <div>
                                                <Label className="text-white">Token</Label>
                                                <Select
                                                    value={alloc.symbol}
                                                    onValueChange={(value) => {
                                                        const updated = [...allocations];
                                                        updated[idx].symbol = value;
                                                        setAllocations(updated);
                                                    }}
                                                >
                                                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-slate-700">
                                                        {remainingTokens
                                                            .filter(t => !allocations.some((a, i) => a.symbol === t.symbol && i !== idx))
                                                            .map((token) => (
                                                                <SelectItem key={token.symbol} value={token.symbol}>
                                                                    {token.symbol.replace('f', '')}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-white">Percentage (%)</Label>
                                                <Input
                                                    type="number"
                                                    value={alloc.percentage}
                                                    onChange={(e) => updateAllocation(idx, e.target.value)}
                                                    min="0"
                                                    max={100 - (totalPercentage - alloc.percentage)}
                                                    className="bg-slate-800 border-slate-600 text-white"
                                                />

                                            </div>
                                            <Button
                                                type="button"
                                                onClick={() => removeAllocationToken(idx)}
                                                variant="outline"
                                                size="sm"
                                                className="border-red-500 text-red-500 hover:bg-red-500/10"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white font-medium">Total Allocated:</span>
                                            <span className={`text-lg font-bold ${totalPercentage === 100 ? 'text-green-500' : 'text-red-500'
                                                }`}>
                                                {totalPercentage}%
                                            </span>
                                        </div>
                                        {totalPercentage !== 100 && (
                                            <p className="text-sm text-red-500 mt-2">
                                                Total allocation must equal 100%
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!initialToken && (
                                <div className="text-center py-8 text-gray-400">
                                    Select an initial token and amount to start allocation
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={!isValidForm || isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Creating Basket...
                                </>
                            ) : (
                                'Create Basket'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}