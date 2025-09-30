export interface Basket {
    id: string;
    name: string;
    description: string;
    tokens: TokenAllocation[];
    performance: number;
    totalValue: number;
    createdAt: string;
    lockDuration: number;
    creator: string;
    isPublic: boolean;
}

export interface TokenAllocation {
    symbol: string;
    weight: number;
    amount: number;
    currentPrice: number;
    pnl: number;
    pnlPercentage: number;
}

export interface PriceData {
    symbol: string;
    price: number;
    change24h: number;
    // lastUpdated: Date; // REMOVED
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