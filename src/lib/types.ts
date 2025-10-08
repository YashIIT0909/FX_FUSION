export interface Basket {
    id: string;
    tokenId: number;
    name: string;
    description: string;
    tokens: TokenAllocation[];
    performance: number;
    totalValue: number;
    initialValue: number; // Add initial value
    createdAt: string;
    lockDuration: number;
    lockEndDate: string; // Add lock end date
    creator: string;
    isPublic: boolean;
    baseCurrency: string; // The currency everything is measured against (e.g., 'fUSD')
    isLocked: boolean; // Whether the basket is still locked
    transactionHash?: string;
}

export interface TokenAllocation {
    symbol: string;
    weight: number;
    amount: number;
    initialAmount: number; // Amount at creation
    initialPrice: number; // Price at creation (in base currency)
    currentPrice: number;
    pnl: number;
    pnlPercentage: number;
    tokenAddress: string;
    priceHistory: PriceHistoryPoint[]; // Track price changes
}

export interface PriceHistoryPoint {
    timestamp: string;
    price: number; // Price in base currency
    pnl: number; // P&L at this point
}

export interface PriceData {
    symbol: string;
    price: number;
    change24h: number;
    lastUpdated: string;
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
    pnlPercentage: number;
}

export interface BlockchainBasket {
    tokenId: number;
    owner: string;
    tokens: string[];
    amounts: string[];
    metadataURI?: string;
}

export interface BasketMetadata {
    name: string;
    description: string;
    initialToken: string;
    initialAmount: string;
    allocations: { symbol: string; percentage: number }[];
    lockDuration: number;
    createdAt: string;
    lockEndDate: string;
    baseCurrency: string;
    initialPrices: Record<string, number>; // Prices at creation
}