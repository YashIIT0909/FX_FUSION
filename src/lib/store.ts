import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Basket, PriceData, UserBalance, BasketMetadata } from './types';
import { Contract } from 'ethers';
import BasketNFTContract from '@/src/contracts/out/basketNFT.sol/BasketNFT.json';
import FacadeContract from '@/src/contracts/out/facade.sol/Facade.json';
import { priceService } from './services/priceService';
import { PerformanceCalculator } from './services/performanceCalculator';

declare global {
    interface Window {
        ethereum?: any;
    }
}

// Token symbol to address mapping (only USD, EUR, GBP, YEN)
const TOKEN_ADDRESSES: Record<string, string> = {
    fEUR: process.env.NEXT_PUBLIC_fEUR_Token || '',
    fGBP: process.env.NEXT_PUBLIC_fGBP_Token || '',
    fUSD: process.env.NEXT_PUBLIC_fUSD_Token || '',
    fYEN: process.env.NEXT_PUBLIC_fYEN_Token || '',
};

const ADDRESS_TO_SYMBOL: Record<string, string> = {};
Object.entries(TOKEN_ADDRESSES).forEach(([symbol, address]) => {
    if (address) ADDRESS_TO_SYMBOL[address.toLowerCase()] = symbol;
});

interface WalletState {
    isConnected: boolean;
    address: string | null;
    provider: any;
    signer: any;
    connect: () => Promise<void>;
    disconnect: () => void;
}

interface PriceState {
    prices: Record<string, PriceData>;
    updatePrice: (symbol: string, data: PriceData) => void;
    updatePrices: (prices: Record<string, PriceData>) => void;
    startMonitoring: () => void;
    stopMonitoring: () => void;
}

export const usePriceStore = create<PriceState>((set, get) => ({
    prices: {},
    updatePrice: (symbol, data) => {
        set((state) => ({
            prices: { ...state.prices, [symbol]: data },
        }));
    },
    updatePrices: (prices) => {
        set((state) => ({
            prices: { ...state.prices, ...prices },
        }));
    },
    startMonitoring: () => {
        priceService.startMonitoring();
        priceService.subscribe((prices) => {
            set({ prices });
        });
    },
    stopMonitoring: () => {
        priceService.stopMonitoring();
    },
}));

interface BasketState {
    userBaskets: Basket[];
    selectedBasket: Basket | null;
    userBalances: UserBalance[];
    isLoadingBaskets: boolean;
    performanceUpdateInterval: NodeJS.Timeout | null;
    addBasket: (basket: Basket) => void;
    setUserBaskets: (baskets: Basket[]) => void;
    setSelectedBasket: (basket: Basket | null) => void;
    setUserBalances: (balances: UserBalance[]) => void;
    loadUserBaskets: (userAddress: string, signer: any) => Promise<void>;
    updateBasketPerformance: () => void;
    startPerformanceMonitoring: () => void;
    stopPerformanceMonitoring: () => void;
}

export const useBasketStore = create<BasketState>()(
    persist(
        (set, get) => ({
            userBaskets: [],
            selectedBasket: null,
            userBalances: [],
            isLoadingBaskets: false,
            performanceUpdateInterval: null,

            addBasket: (basket) =>
                set((state) => ({
                    userBaskets: [...state.userBaskets, basket],
                })),

            setUserBaskets: (baskets) => set({ userBaskets: baskets }),
            setSelectedBasket: (basket) => set({ selectedBasket: basket }),
            setUserBalances: (balances) => set({ userBalances: balances }),

            updateBasketPerformance: () => {
                const state = get();
                const updatedBaskets = state.userBaskets.map(basket =>
                    PerformanceCalculator.calculateBasketPerformance(basket)
                );
                set({ userBaskets: updatedBaskets });

                // Update selected basket if it exists
                if (state.selectedBasket) {
                    const updatedSelected = updatedBaskets.find(b => b.id === state.selectedBasket!.id);
                    if (updatedSelected) {
                        set({ selectedBasket: updatedSelected });
                    }
                }
            },

            startPerformanceMonitoring: () => {
                const state = get();
                if (state.performanceUpdateInterval) return;

                const interval = setInterval(() => {
                    get().updateBasketPerformance();
                }, 30000); // Update every 30 seconds

                set({ performanceUpdateInterval: interval });
            },

            stopPerformanceMonitoring: () => {
                const state = get();
                if (state.performanceUpdateInterval) {
                    clearInterval(state.performanceUpdateInterval);
                    set({ performanceUpdateInterval: null });
                }
            },

            loadUserBaskets: async (userAddress: string, signer: any) => {
                set({ isLoadingBaskets: true });
                try {
                    const basketNFTAddress = process.env.NEXT_PUBLIC_BASKET_NFT_CONTRACT;

                    if (!basketNFTAddress) {
                        throw new Error('Contract addresses not configured');
                    }

                    const basketNFTContract = new Contract(basketNFTAddress, BasketNFTContract.abi, signer);

                    const balance = await basketNFTContract.balanceOf(userAddress);
                    const basketCount = parseInt(balance.toString());

                    if (basketCount === 0) {
                        set({ userBaskets: [], isLoadingBaskets: false });
                        return;
                    }

                    const baskets: Basket[] = [];

                    for (let i = 0; i < basketCount; i++) {
                        try {
                            const tokenId = await basketNFTContract.tokenOfOwnerByIndex(userAddress, i);
                            const tokenIdNum = parseInt(tokenId.toString());

                            const basketData = await basketNFTContract.getBasket(tokenIdNum);
                            const tokenAddresses = basketData.tokens;
                            const amounts = basketData.amounts;

                            // Get metadata
                            let metadata: BasketMetadata | null = null;
                            try {
                                const metadataURI = await basketNFTContract.tokenURI(tokenIdNum);
                                if (metadataURI && metadataURI.startsWith('data:application/json;base64,')) {
                                    const base64Data = metadataURI.split(',')[1];
                                    metadata = JSON.parse(atob(base64Data)) as BasketMetadata;
                                }
                            } catch (e) {
                                console.warn('Could not fetch metadata for token', tokenIdNum);
                            }

                            // Convert blockchain data to basket format
                            const tokens = tokenAddresses.map((address: string, index: number) => {
                                const symbol = ADDRESS_TO_SYMBOL[address.toLowerCase()] || 'UNKNOWN';
                                const amount = parseFloat(amounts[index].toString()) / 1e18;
                                const initialPrice = metadata?.initialPrices?.[symbol] || 1;

                                return {
                                    symbol,
                                    weight: 0,
                                    amount,
                                    initialAmount: amount,
                                    initialPrice,
                                    currentPrice: priceService.getCurrentPrice(symbol),
                                    pnl: 0,
                                    pnlPercentage: 0,
                                    tokenAddress: address,
                                    priceHistory: [],
                                };
                            });

                            // Calculate weights
                            interface TokenCalculation {
                                symbol: string;
                                weight: number;
                                amount: number;
                                initialAmount: number;
                                initialPrice: number;
                                currentPrice: number;
                                pnl: number;
                                pnlPercentage: number;
                                tokenAddress: string;
                                priceHistory: any[];
                            }

                            const totalValue: number = tokens.reduce((sum: number, token: TokenCalculation) => sum + token.amount, 0);
                            interface TokenWithCalculatedWeight extends TokenCalculation {
                                weight: number;
                            }

                            tokens.forEach((token: TokenCalculation) => {
                                token.weight = totalValue > 0 ? (token.amount / totalValue) * 100 : 0;
                            });

                            const lockEndDate = metadata?.lockEndDate ||
                                new Date(Date.now() + (metadata?.lockDuration || 30) * 24 * 60 * 60 * 1000).toISOString();

                            const basket: Basket = {
                                id: `basket-${tokenIdNum}`,
                                tokenId: tokenIdNum,
                                name: metadata?.name || `Basket #${tokenIdNum}`,
                                description: metadata?.description || 'Custom currency basket',
                                tokens,
                                performance: 0,
                                totalValue,
                                initialValue: totalValue,
                                createdAt: metadata?.createdAt || new Date().toISOString(),
                                lockDuration: metadata?.lockDuration || 30,
                                lockEndDate,
                                creator: userAddress,
                                isPublic: false,
                                baseCurrency: metadata?.baseCurrency || 'fUSD',
                                isLocked: PerformanceCalculator.isBasketLocked({ lockEndDate } as Basket),
                            };

                            baskets.push(PerformanceCalculator.calculateBasketPerformance(basket));
                        } catch (error) {
                            console.error(`Error loading basket at index ${i}:`, error);
                        }
                    }

                    set({ userBaskets: baskets, isLoadingBaskets: false });
                } catch (error) {
                    console.error('Error loading user baskets:', error);
                    set({ userBaskets: [], isLoadingBaskets: false });
                }
            },
        }),
        { name: 'basket-storage' }
    )
);

export const useWalletStore = create<WalletState>((set, get) => ({
    isConnected: false,
    address: null,
    provider: null,
    signer: null,
    connect: async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const { ethers } = await import('ethers');
                const provider = new ethers.BrowserProvider(window.ethereum);
                await provider.send('eth_requestAccounts', []);
                const signer = await provider.getSigner();
                const address = await signer.getAddress();

                set({
                    isConnected: true,
                    address,
                    provider,
                    signer,
                });

                // Start price monitoring
                usePriceStore.getState().startMonitoring();

                // Load and start monitoring baskets
                const basketStore = useBasketStore.getState();
                await basketStore.loadUserBaskets(address, signer);
                basketStore.startPerformanceMonitoring();
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    },
    disconnect: () => {
        // Stop monitoring
        usePriceStore.getState().stopMonitoring();
        useBasketStore.getState().stopPerformanceMonitoring();

        set({
            isConnected: false,
            address: null,
            provider: null,
            signer: null,
        });

        useBasketStore.getState().setUserBaskets([]);
    },
}));