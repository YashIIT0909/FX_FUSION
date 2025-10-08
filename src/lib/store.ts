import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Basket, PriceData, UserBalance } from './types';
import { Contract } from 'ethers';
import BasketNFTContract from '@/src/contracts/out/basketNFT.sol/BasketNFT.json';
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

// Reverse mapping for address to symbol
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
    isMonitoring: boolean;
    lastUpdate: Date | null;
    dataQuality: 'fresh' | 'recent' | 'stale';
    updatePrice: (symbol: string, data: PriceData) => void;
    updatePrices: (prices: Record<string, PriceData>) => void;
    startMonitoring: () => Promise<void>;
    stopMonitoring: () => void;
    getDataQuality: () => { isStale: boolean; lastUpdate: string; staleness: 'fresh' | 'recent' | 'stale' };
}

export const usePriceStore = create<PriceState>((set, get) => ({
    prices: {},
    isMonitoring: false,
    lastUpdate: null,
    dataQuality: 'stale',

    updatePrice: (symbol, data) => {
        set((state) => ({
            prices: { ...state.prices, [symbol]: data },
            lastUpdate: new Date(),
            dataQuality: 'fresh'
        }));
    },

    updatePrices: (prices) => {
        set((state) => ({
            prices: { ...state.prices, ...prices },
            lastUpdate: new Date(),
            dataQuality: 'fresh'
        }));
    },

    startMonitoring: async () => {
        if (get().isMonitoring) return;

        set({ isMonitoring: true });

        try {
            await priceService.startMonitoring();

            // Subscribe to price updates
            priceService.subscribe((prices) => {
                get().updatePrices(prices);
            });

        } catch (error) {
            console.error('Failed to start price monitoring:', error);
            set({ isMonitoring: false });
        }
    },

    stopMonitoring: () => {
        priceService.stopMonitoring();
        set({ isMonitoring: false });
    },

    getDataQuality: () => {
        return PerformanceCalculator.getDataQuality();
    }
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
    updateBasketPerformance: () => void;
    startPerformanceMonitoring: () => void;
    stopPerformanceMonitoring: () => void;
    loadUserBaskets: (userAddress: string, signer: any) => Promise<void>;
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
                if (state.userBaskets.length === 0) return;

                const updatedBaskets = state.userBaskets.map(basket =>
                    PerformanceCalculator.calculateBasketPerformance(basket)
                );

                set({ userBaskets: updatedBaskets });
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
                        throw new Error('BasketNFT contract address not configured');
                    }

                    const basketNFTContract = new Contract(basketNFTAddress, BasketNFTContract.abi, signer);

                    // Get user's NFT balance
                    const balance = await basketNFTContract.balanceOf(userAddress);
                    const basketCount = parseInt(balance.toString());

                    if (basketCount === 0) {
                        set({ userBaskets: [], isLoadingBaskets: false });
                        return;
                    }

                    const baskets: Basket[] = [];

                    // Get all basket NFTs owned by user
                    for (let i = 0; i < basketCount; i++) {
                        try {
                            const tokenId = await basketNFTContract.tokenOfOwnerByIndex(userAddress, i);
                            const tokenIdNum = parseInt(tokenId.toString());

                            // Get basket data from enhanced NFT contract
                            const [tokenAddresses, amounts, initialPrices, allocationPercentages] =
                                await basketNFTContract.getBasket(tokenIdNum);
                            const basketInfo = await basketNFTContract.getBasketInfo(tokenIdNum);

                            // Convert blockchain data to basket format
                            const tokens = tokenAddresses.map((address: string, index: number) => {
                                const symbol = ADDRESS_TO_SYMBOL[address.toLowerCase()] || 'UNKNOWN';
                                const amount = parseFloat(amounts[index].toString()) / 1e18;
                                const initialPrice = parseFloat(initialPrices[index].toString()) / 1e18;
                                const weight = parseInt(allocationPercentages[index].toString()) / 100; // Convert from basis points

                                return {
                                    symbol,
                                    weight,
                                    amount,
                                    initialAmount: amount,
                                    initialPrice,
                                    currentPrice: initialPrice, // Will be updated by performance calculator
                                    pnl: 0,
                                    pnlPercentage: 0,
                                    tokenAddress: address,
                                    priceHistory: []
                                };
                            });

                            // Get metadata
                            let metadata: any = {};
                            try {
                                const metadataURI = await basketNFTContract.tokenURI(tokenIdNum);
                                if (metadataURI && metadataURI.startsWith('data:application/json;base64,')) {
                                    const base64Data = metadataURI.split(',')[1];
                                    metadata = JSON.parse(atob(base64Data));
                                }
                            } catch (e) {
                                console.warn('Could not fetch metadata for token', tokenIdNum);
                            }

                            // Convert timestamps
                            const createdAt = new Date(Number(basketInfo.createdAt) * 1000).toISOString();
                            const lockEndDate = new Date(Number(basketInfo.lockEndTimestamp) * 1000).toISOString();
                            const initialValue = parseFloat(basketInfo.initialValue.toString()) / 1e18;

                            const basket: Basket = {
                                id: `basket-${tokenIdNum}`,
                                tokenId: tokenIdNum,
                                name: metadata.name || `Basket #${tokenIdNum}`,
                                description: metadata.description || 'Custom currency basket',
                                tokens,
                                performance: 0,
                                totalValue: initialValue,
                                initialValue,
                                createdAt,
                                lockDuration: metadata.lockDuration || 30,
                                lockEndDate,
                                creator: userAddress,
                                isPublic: false,
                                baseCurrency: basketInfo.baseCurrency || 'fUSD',
                                isLocked: await basketNFTContract.isBasketLocked(tokenIdNum)
                            };

                            baskets.push(basket);
                        } catch (error) {
                            console.error(`Error loading basket at index ${i}:`, error);
                        }
                    }

                    // Update performance with real prices
                    const basketsWithPerformance = baskets.map(basket =>
                        PerformanceCalculator.calculateBasketPerformance(basket)
                    );

                    set({ userBaskets: basketsWithPerformance, isLoadingBaskets: false });
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

                // Start price monitoring when wallet connects
                const priceStore = usePriceStore.getState();
                await priceStore.startMonitoring();

                // Load user baskets after connecting
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
        const priceStore = usePriceStore.getState();
        const basketStore = useBasketStore.getState();

        priceStore.stopMonitoring();
        basketStore.stopPerformanceMonitoring();
        basketStore.setUserBaskets([]);

        set({
            isConnected: false,
            address: null,
            provider: null,
            signer: null,
        });
    },
}));