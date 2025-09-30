'use client';

import { useEffect, useState } from 'react';
import { useWalletStore, useBasketStore } from '@/src/lib/store';
import { Contract, EventLog } from 'ethers';
import AppContract from '@/contracts/out/App.sol/App.json';
import BasketJsonNFTContract from '@/contracts/out/BasketJsonNFT.sol/BasketJsonNFT.json';
import { BasketCard } from './basket-card';
import { Skeleton } from './skeleton';
import { Basket } from '@/src/lib/types';


function parseTokenUri(uri: string): any {
    const base64Json = uri.split('data:application/json;base64,')[1];
    if (!base64Json) return null;
    try {
        const jsonString = atob(base64Json);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to parse token URI JSON:", error);
        return null;
    }
}

export function UserBaskets() {
    const { signer, isConnected, address } = useWalletStore();
    const { userBaskets, setUserBaskets } = useBasketStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBaskets = async () => {
            if (!signer || !address) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const appContractAddress = process.env.NEXT_PUBLIC_App;
                if (!appContractAddress) {
                    throw new Error("App contract address not configured.");
                }

                const contract = new Contract(appContractAddress, AppContract.abi, signer);

                // Filter for BasketCreated events for the connected user
                const filter = contract.filters.BasketCreated(address);
                const events = await contract.queryFilter(filter);

                const basketNFTAddress = await contract.basketNFT();
                const basketNftContract = new Contract(basketNFTAddress, BasketJsonNFTContract.abi, signer);

                if (events.length === 0) {
                    setUserBaskets([]);
                    setIsLoading(false);
                    return;
                }

                const fetchedBaskets: Basket[] = await Promise.all(
                    events.map(async (event) => {
                        const eventLog = event as EventLog;
                        const { user, nftId, tokens, amounts } = eventLog.args;

                        // Fetch on-chain struct data and metadata URI
                        const [basketData, tokenUri] = await Promise.all([
                            contract.nftBaskets(nftId),
                            basketNftContract.tokenURI(nftId)
                        ]);

                        // Parse metadata from URI
                        const metadata = parseTokenUri(tokenUri);

                        return {
                            id: nftId.toString(),
                            name: metadata?.name || 'Unnamed Basket',
                            description: metadata?.description || 'No description.',
                            tokens: metadata?.allocations || [], // Use allocations from metadata for weights
                            performance: 0, // Placeholder
                            totalValue: parseFloat(metadata?.initialAmount) || 0, // Placeholder
                            createdAt: new Date(Number(basketData.unlockTimestamp - basketData.lockDuration) * 1000).toISOString(),
                            lockDuration: Number(basketData.lockDuration) / (24 * 60 * 60), // Convert seconds to days
                            creator: user,
                            isPublic: false, // Assuming user baskets are private
                        };
                    })
                );

                // Sort by creation date, newest first
                fetchedBaskets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setUserBaskets(fetchedBaskets);
            } catch (error) {
                console.error("Failed to fetch user baskets:", error);
                setUserBaskets([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBaskets();
    }, [signer, address, isConnected]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-80 rounded-lg bg-slate-800/50" />
                ))}
            </div>
        );
    }

    if (!isConnected || userBaskets.length === 0) {
        return (
            <div className="text-center py-16 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                <h3 className="text-xl font-semibold text-white">No Baskets Found</h3>
                <p className="text-gray-400 mt-2">You haven't created any baskets yet.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userBaskets.map((basket) => (
                <BasketCard key={basket.id} basket={basket} />
            ))}
        </div>
    );
}