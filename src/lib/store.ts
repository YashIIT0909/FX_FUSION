import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Basket, PriceData, UserBalance } from './types';

declare global {
    interface Window {
        ethereum?: any;
    }
}

interface WalletState {
    isConnected: boolean;
    address: string | null; // Add address property
    provider: any;
    signer: any;
    connect: () => Promise<void>;
    disconnect: () => void;
}

interface PriceState {
    prices: Record<string, PriceData>;
    updatePrice: (symbol: string, data: PriceData) => void;
    updatePrices: (prices: Record<string, PriceData>) => void;
}

export const usePriceStore = create<PriceState>((set) => ({
    prices: {},
    updatePrice: (symbol, data) => {
        set((state) => ({
            prices: { ...state.prices, [symbol]: data },
        }));
    },
    updatePrices: (prices) => {
        // This console log will now show the clean, incoming price batches
        set((state) => ({
            // Merging with the previous state is still correct for batch updates
            prices: { ...state.prices, ...prices },
        }));
    },
}));

interface BasketState {
    userBaskets: Basket[];
    selectedBasket: Basket | null;
    userBalances: UserBalance[];
    addBasket: (basket: Basket) => void;
    setUserBaskets: (baskets: Basket[]) => void;
    setSelectedBasket: (basket: Basket | null) => void;
    setUserBalances: (balances: UserBalance[]) => void;
}

export const useBasketStore = create<BasketState>()(
    persist(
        (set) => ({
            userBaskets: [],
            selectedBasket: null,
            userBalances: [], // Remove hardcoded data and initialize as empty
            addBasket: (basket) =>
                set((state) => ({
                    userBaskets: [...state.userBaskets, basket],
                })),
            setUserBaskets: (baskets) => set({ userBaskets: baskets }),
            setSelectedBasket: (basket) => set({ selectedBasket: basket }),
            setUserBalances: (balances) => set({ userBalances: balances }), // Rename function
        }),
        { name: 'basket-storage' }
    )
);

export const useWalletStore = create<WalletState>((set, get) => ({
    isConnected: false,
    address: null, // Initialize address as null
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
                    address, // Set the address on connect
                    provider,
                    signer,
                });
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    },
    disconnect: () => {
        set({
            isConnected: false,
            address: null, // Clear the address on disconnect
            provider: null,
            signer: null,
        });
    },
}));