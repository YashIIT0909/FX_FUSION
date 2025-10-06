import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Basket, PriceData, UserBalance, BlockchainBasket } from './types';
import { Contract } from 'ethers';
import BasketNFTContract from '@/src/contracts/out/basketNFT.sol/BasketNFT.json';
import FacadeContract from '@/src/contracts/out/facade.sol/Facade.json';

declare global {
    interface Window {
        ethereum?: any;
    }
}

// Token symbol to address mapping
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
        set((state) => ({
            prices: { ...state.prices, ...prices },
        }));
    },
}));

interface BasketState {
    userBaskets: Basket[];
    selectedBasket: Basket | null;
    userBalances: UserBalance[];
    isLoadingBaskets: boolean;
    addBasket: (basket: Basket) => void;
    setUserBaskets: (baskets: Basket[]) => void;
    setSelectedBasket: (basket: Basket | null) => void;
    setUserBalances: (balances: UserBalance[]) => void;
    loadUserBaskets: (userAddress: string, signer: any) => Promise<void>;
}

export const useBasketStore = create<BasketState>()(
    persist(
        (set, get) => ({
            userBaskets: [],
            selectedBasket: null,
            userBalances: [],
            isLoadingBaskets: false,
            addBasket: (basket) =>
                set((state) => ({
                    userBaskets: [...state.userBaskets, basket],
                })),
            setUserBaskets: (baskets) => set({ userBaskets: baskets }),
            setSelectedBasket: (basket) => set({ selectedBasket: basket }),
            setUserBalances: (balances) => set({ userBalances: balances }),
            loadUserBaskets: async (userAddress: string, signer: any) => {
                set({ isLoadingBaskets: true });
                try {
                    const basketNFTAddress = process.env.NEXT_PUBLIC_BASKET_NFT;
                    const facadeAddress = process.env.NEXT_PUBLIC_FACADE_ADDRESS;

                    if (!basketNFTAddress || !facadeAddress) {
                        throw new Error('Contract addresses not configured');
                    }

                    const basketNFTContract = new Contract(basketNFTAddress, BasketNFTContract.abi, signer);
                    const facadeContract = new Contract(facadeAddress, FacadeContract.abi, signer);

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

                            // Get basket data from NFT contract
                            const basketData = await basketNFTContract.getBasket(tokenIdNum);
                            const tokenAddresses = basketData.tokens;
                            const amounts = basketData.amounts;

                            // Convert blockchain data to basket format
                            const tokens = tokenAddresses.map((address: string, index: number) => {
                                const symbol = ADDRESS_TO_SYMBOL[address.toLowerCase()] || 'UNKNOWN';
                                const amount = parseFloat(amounts[index].toString()) / 1e18; // Convert from wei

                                return {
                                    symbol,
                                    weight: 0, // Will calculate below
                                    amount,
                                    currentPrice: 1, // Default, can be updated with real prices
                                    pnl: 0,
                                    pnlPercentage: 0,
                                    tokenAddress: address
                                };
                            });

                            // Calculate weights based on amounts
                            interface TokenData {
                                symbol: string;
                                weight: number;
                                amount: number;
                                currentPrice: number;
                                pnl: number;
                                pnlPercentage: number;
                                tokenAddress: string;
                            }

                            const totalValue: number = tokens.reduce((sum: number, token: TokenData) => sum + token.amount, 0);

                            tokens.forEach((token: TokenData) => {
                                token.weight = totalValue > 0 ? (token.amount / totalValue) * 100 : 0;
                            });

                            // Try to get metadata (if stored)
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

                            const basket: Basket = {
                                id: `basket-${tokenIdNum}`,
                                tokenId: tokenIdNum,
                                name: metadata.name || `Basket #${tokenIdNum}`,
                                description: metadata.description || 'Custom currency basket',
                                tokens,
                                performance: 0, // Can be calculated based on price changes
                                totalValue,
                                createdAt: metadata.createdAt || new Date().toISOString(),
                                lockDuration: metadata.lockDuration || 30,
                                creator: userAddress,
                                isPublic: false,
                            };

                            baskets.push(basket);
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

                // Load user baskets after connecting
                const basketStore = useBasketStore.getState();
                await basketStore.loadUserBaskets(address, signer);
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    },
    disconnect: () => {
        set({
            isConnected: false,
            address: null,
            provider: null,
            signer: null,
        });
        // Clear baskets on disconnect
        useBasketStore.getState().setUserBaskets([]);
    },
}));