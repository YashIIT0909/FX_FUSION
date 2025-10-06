export interface Basket {
    id: string;
    tokenId: number; // Add tokenId to track NFT
    name: string;
    description: string;
    tokens: TokenAllocation[];
    performance: number;
    totalValue: number;
    createdAt: string;
    lockDuration: number;
    creator: string;
    isPublic: boolean;
    transactionHash?: string; // Add transaction hash
}

export interface TokenAllocation {
    symbol: string;
    weight: number;
    amount: number;
    currentPrice: number;
    pnl: number;
    pnlPercentage: number;
    tokenAddress: string; // Add token address
}

export interface PriceData {
    symbol: string;
    price: number;
    change24h: number;
}

export interface UserBalance {
    symbol: string;
    balance: number;
    swappedFrom?: string;
    eligible: boolean;
}

export interface PnlDataPoint {
    timestamp: string;
    value: number;
    pnl: number;
}

// Add new interface for blockchain basket data
export interface BlockchainBasket {
    tokenId: number;
    owner: string;
    tokens: string[];
    amounts: string[];
    metadataURI?: string;
}