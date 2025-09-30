'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { ChevronDown, Loader2, Plus, Minus, Info } from 'lucide-react';
import { ethers } from 'ethers';

// --- Types and Constants ---

const APP_CONTRACT_ADDRESS = "0xbDAf839b2974d02B6c304218f45ddC4BEC2A86Fd";

const tokenAddresses: { [key: string]: string } = {
    'fUSD': "0xF593c97eda277dF2B6055956F924D0764BDe3e5f",
    'fINR': "0x1093D107199F1981C3EDb052c16C5cE3f24B8EdE",
    'fEUR': "0xe117d02216653d291Bf507ae7D7A8366d5BD7764",
    'fGBP': "0x96b1c80f49b7D19217e1d0A426942B5d26FDcA79",
    'fYEN': "0xE215b93453388334aA648eE7F008fb695439AC6c",
    'fCHF': "0x3F2cF12Dd2188a08De8e84F7c3631aDeDc6705e3"
};

const availableTokens = [
    { symbol: 'fUSD', name: 'Fiat USD' },
    { symbol: 'fINR', name: 'Fiat INR' },
    { symbol: 'fEUR', name: 'Fiat EUR' },
    { symbol: 'fGBP', name: 'Fiat GBP' },
    { symbol: 'fYEN', name: 'Fiat YEN' },
    { symbol: 'fCHF', name: 'Fiat CHF' },
];

interface LiquidityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface EthereumError extends Error {
    code?: number | string;
}

type Mode = 'add' | 'remove';

// --- Component ---

export function LiquidityModal({ isOpen, onClose }: LiquidityModalProps) {
    const [mode, setMode] = useState<Mode>('add');
    const [tokenA, setTokenA] = useState('fUSD');
    const [tokenB, setTokenB] = useState('fINR');
    const [amountA, setAmountA] = useState('');
    const [amountB, setAmountB] = useState('');
    const [lpAmount, setLpAmount] = useState('');
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState<{ success: boolean; message: string } | null>(null);

    // --- Effects ---

    // Effect to calculate amountB when amountA or tokens change
    useEffect(() => {
        const calculatePairAmount = async () => {
            if (mode === 'add' && amountA && parseFloat(amountA) > 0 && tokenA !== tokenB) {
                setIsCalculating(true);
                try {
                    const response = await fetch('/api/calculate-liquidity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tokenNameA: tokenA, tokenNameB: tokenB, amountA }),
                    });
                    const result = await response.json();
                    if (result.success) {
                        setAmountB(result.data.amountB);
                    } else {
                        setAmountB('Error fetching rate');
                    }
                } catch (error) {
                    setAmountB('Error');
                } finally {
                    setIsCalculating(false);
                }
            } else if (mode === 'add') {
                setAmountB('');
            }
        };

        const debounceTimeout = setTimeout(calculatePairAmount, 500); // Debounce to avoid spamming the API
        return () => clearTimeout(debounceTimeout);
    }, [amountA, tokenA, tokenB, mode]);


    // --- Handlers ---

    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        setTransactionStatus(null); // Clear status on mode switch
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setTransactionStatus(null);

        try {
            if (!window.ethereum) throw new Error('Wallet not found.');
            let provider = new ethers.BrowserProvider(window.ethereum);
            let signer = await provider.getSigner();

            const endpoint = mode === 'add' ? '/api/add-liquidity' : '/api/remove-liquidity';
            const body = mode === 'add'
                ? { tokenNameA: tokenA, tokenNameB: tokenB, amountA }
                : { tokenNameA: tokenA, tokenNameB: tokenB, lpTokenAmount: lpAmount };

            // If adding liquidity, approve tokens first
            if (mode === 'add') {
                const tokenAContract = new ethers.Contract(tokenAddresses[tokenA], [
                    "function approve(address spender, uint256 amount) external returns (bool)"
                ], signer);

                const tokenBContract = new ethers.Contract(tokenAddresses[tokenB], [
                    "function approve(address spender, uint256 amount) external returns (bool)"
                ], signer);

                setTransactionStatus({ success: false, message: 'Approving tokens...' });

                // Add 2% slippage tolerance
                const amountAWithSlippage = ethers.parseEther((parseFloat(amountA) * 1.02).toString());
                const amountBWithSlippage = ethers.parseEther((parseFloat(amountB) * 1.02).toString());

                try {
                    const approvalTxA = await tokenAContract.approve(APP_CONTRACT_ADDRESS, amountAWithSlippage);
                    await approvalTxA.wait();
                    setTransactionStatus({ success: false, message: 'First token approved, approving second token...' });

                    const approvalTxB = await tokenBContract.approve(APP_CONTRACT_ADDRESS, amountBWithSlippage);
                    await approvalTxB.wait();
                    setTransactionStatus({ success: false, message: 'Tokens approved, executing transaction...' });
                } catch (error: any) {
                    throw new Error('Token approval failed: ' + error.message);
                }
            }

            // Get transaction data from backend
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || `Failed to prepare ${mode} liquidity transaction.`);
            }

            const { to, value, data } = result.data;

            console.log(value)

            // Execute the transaction
            let tx = await signer.sendTransaction({
                to,
                value: BigInt(value) + BigInt(1_000_000_000),// This includes the Pyth oracle update fee
                data
            });

            // 2. Use the user's wallet to send the transaction
            if (!window.ethereum) throw new Error('Wallet not found.');
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            tx = await signer.sendTransaction({ to, value, data });

            setTransactionStatus({ success: false, message: `Transaction sent... Tx: ${tx.hash.substring(0, 10)}...` });
            const receipt = await tx.wait();

            if (receipt && receipt.status === 1) {
                setTransactionStatus({ success: true, message: `Liquidity ${mode === 'add' ? 'added' : 'removed'} successfully!` });
                setTimeout(() => handleClose(), 3000);
            } else {
                throw new Error('Transaction failed on-chain.');
            }
        } catch (error: any) {
            const errorMessage = error.code === 'ACTION_REJECTED' ? 'Transaction rejected.' : (error.message || 'An unknown error occurred.');
            setTransactionStatus({ success: false, message: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (isLoading) return;
        setAmountA('');
        setAmountB('');
        setLpAmount('');
        setTransactionStatus(null);
        onClose();
    };

    // --- Render Logic ---

    const isAddButtonDisabled = !amountA || !amountB || isCalculating || isLoading || tokenA === tokenB;
    const isRemoveButtonDisabled = !lpAmount || parseFloat(lpAmount) <= 0 || isLoading || tokenA === tokenB;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md p-6 rounded-2xl">
                <div className="flex justify-center bg-gray-800 p-1 rounded-full border border-gray-700">
                    <Button onClick={() => handleModeChange('add')} variant="ghost" className={`w-1/2 rounded-full ${mode === 'add' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Add</Button>
                    <Button onClick={() => handleModeChange('remove')} variant="ghost" className={`w-1/2 rounded-full ${mode === 'remove' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Remove</Button>
                </div>

                {/* --- ADD LIQUIDITY VIEW --- */}
                {mode === 'add' && (
                    <div className="space-y-4 pt-4">
                        <TokenInput
                            label="You Deposit"
                            amount={amountA}
                            onAmountChange={setAmountA}
                            selectedToken={tokenA}
                            onTokenChange={setTokenA}
                            disabled={isLoading}
                        />
                        <div className="flex justify-center"><Plus className="h-6 w-6 text-gray-500" /></div>
                        <TokenInput
                            label="You Deposit"
                            amount={amountB}
                            onAmountChange={() => { }}
                            selectedToken={tokenB}
                            onTokenChange={setTokenB}
                            disabled={isLoading}
                            readOnly={true}
                            isCalculating={isCalculating}
                        />
                        <div className="bg-blue-900/30 text-blue-300 text-xs p-3 rounded-lg flex items-start space-x-2">
                            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>You only need to input the first amount. The second is calculated based on live prices to ensure a fair ratio.</span>
                        </div>
                        <Button onClick={handleSubmit} disabled={isAddButtonDisabled} className="w-full ...">
                            {isLoading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</> : 'Add Liquidity'}
                        </Button>
                    </div>
                )}

                {/* --- REMOVE LIQUIDITY VIEW --- */}
                {mode === 'remove' && (
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-300">Select Pool Tokens</p>
                            <div className="grid grid-cols-2 gap-4">
                                <TokenSelector selectedToken={tokenA} onTokenChange={setTokenA} disabled={isLoading} />
                                <TokenSelector selectedToken={tokenB} onTokenChange={setTokenB} disabled={isLoading} />
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <label className="text-sm text-gray-400">LP Token Amount</label>
                            <Input
                                type="number"
                                value={lpAmount}
                                onChange={(e) => setLpAmount(e.target.value)}
                                placeholder="0.0"
                                className="bg-transparent ... text-2xl"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex justify-center"><Minus className="h-6 w-6 text-gray-500" /></div>

                        <p className="text-center text-gray-300">You will receive both {tokenA} and {tokenB}.</p>

                        <Button onClick={handleSubmit} disabled={isRemoveButtonDisabled} className="w-full ...">
                            {isLoading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</> : 'Remove Liquidity'}
                        </Button>
                    </div>
                )}

                {/* --- Transaction Status --- */}
                {transactionStatus && (
                    <div className={`rounded-lg p-3 mt-4 text-center text-sm ${transactionStatus.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {transactionStatus.message}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}


// --- Helper Sub-components ---

interface TokenInputProps {
    label: string;
    amount: string;
    onAmountChange: (value: string) => void;
    selectedToken: string;
    onTokenChange: (token: string) => void;
    disabled: boolean;
    readOnly?: boolean;
    isCalculating?: boolean;
}

function TokenInput({ amount, onAmountChange, selectedToken, onTokenChange, disabled, readOnly, isCalculating }: TokenInputProps) {
    return (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex justify-between items-center mb-2">
                <div className='flex-1 pr-2'>
                    {readOnly ? (
                        <div className="text-2xl font-semibold text-white h-9 flex items-center">
                            {isCalculating ? <Loader2 className="h-5 w-5 animate-spin" /> : amount || '0.0'}
                        </div>
                    ) : (
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => onAmountChange(e.target.value)}
                            placeholder="0.0"
                            className="bg-transparent border-none text-2xl font-semibold text-white p-0 h-auto focus:ring-0"
                            disabled={disabled}
                        />
                    )}
                </div>
                <TokenSelector selectedToken={selectedToken} onTokenChange={onTokenChange} disabled={disabled} />
            </div>
        </div>
    );
}

interface TokenSelectorProps {
    selectedToken: string;
    onTokenChange: (token: string) => void;
    disabled: boolean;
}

function TokenSelector({ selectedToken, onTokenChange, disabled }: TokenSelectorProps) {
    return (
        <Select value={selectedToken} onValueChange={onTokenChange} disabled={disabled}>
            <SelectTrigger className="bg-gray-700 border-none rounded-full px-3 py-2 w-auto min-w-[110px] [&>svg]:hidden">
                <SelectValue placeholder="Select">
                    <div className="flex items-center">
                        <span className="text-white font-medium mr-1">{selectedToken}</span>
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
                {availableTokens.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol} className="text-white hover:bg-gray-700">
                        {token.symbol}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}