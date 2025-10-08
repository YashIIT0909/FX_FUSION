import { PriceData } from '../types';

interface APIResponse {
    success: boolean;
    data: {
        flowUsdPrice: number;
        conversionRates: Record<string, number>;
        rawPrices: Record<string, number>;
        timestamp: string;
        error?: string;
    };
}

class PriceService {
    private priceCache: Map<string, PriceData> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;
    private subscribers: Set<(prices: Record<string, PriceData>) => void> = new Set();
    private lastUpdate: Date = new Date(0);

    async startMonitoring() {
        if (this.updateInterval) return;

        await this.updatePrices(); // Initial update
        this.updateInterval = setInterval(async () => {
            await this.updatePrices();
        }, 30000); // Update every 30 seconds
    }

    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    subscribe(callback: (prices: Record<string, PriceData>) => void) {
        this.subscribers.add(callback);

        // Send current prices immediately if available
        if (this.priceCache.size > 0) {
            const currentPrices: Record<string, PriceData> = {};
            this.priceCache.forEach((price, symbol) => {
                currentPrices[symbol] = price;
            });
            callback(currentPrices);
        }

        return () => this.subscribers.delete(callback);
    }

    private async updatePrices() {
        try {
            const response = await fetch('/api/price-feeds');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiData: APIResponse = await response.json();

            if (!apiData.success) {
                console.warn('Price API returned error:', apiData.data.error);
            }

            const { conversionRates, timestamp } = apiData.data;
            const now = new Date(timestamp);
            const updatedPrices: Record<string, PriceData> = {};

            // Convert ETH-based rates to USD-based rates for our currencies
            const ethUsdPrice = apiData.data.flowUsdPrice;

            // Calculate USD exchange rates
            const usdRates = {
                fUSD: 1.0, // Base currency
                fEUR: ethUsdPrice / conversionRates.EUR, // ETH/EUR to USD/EUR
                fGBP: ethUsdPrice / conversionRates.GBP, // ETH/GBP to USD/GBP
                fYEN: ethUsdPrice / conversionRates.JPY, // ETH/JPY to USD/JPY
            };

            Object.entries(usdRates).forEach(([symbol, rate]) => {
                const previousPrice = this.priceCache.get(symbol);

                // Calculate 24h change
                const change24h = previousPrice && this.isRecentUpdate()
                    ? ((rate - previousPrice.price) / previousPrice.price) * 100
                    : 0;

                const priceData: PriceData = {
                    symbol,
                    price: rate,
                    change24h,
                    lastUpdated: timestamp,
                };

                this.priceCache.set(symbol, priceData);
                updatedPrices[symbol] = priceData;
            });

            this.lastUpdate = now;

            // Notify all subscribers
            this.subscribers.forEach(callback => callback(updatedPrices));

        } catch (error) {
            console.error('Failed to fetch price data:', error);

            // If we have cached data and it's recent (< 5 minutes old), use it
            if (this.priceCache.size > 0 && this.isRecentUpdate(5 * 60 * 1000)) {
                console.log('Using cached price data due to API error');
                return;
            }

            // Otherwise, don't update and let the UI handle the lack of data
            console.error('No recent cached data available');
        }
    }

    private isRecentUpdate(maxAgeMs: number = 60000): boolean {
        return (Date.now() - this.lastUpdate.getTime()) < maxAgeMs;
    }

    getCurrentPrice(symbol: string): number {
        const cached = this.priceCache.get(symbol);
        if (cached && this.isRecentUpdate()) {
            return cached.price;
        }

        // Fallback to base rates if no recent data
        const fallbackRates: Record<string, number> = {
            'fUSD': 1.0,
            'fEUR': 0.85,
            'fGBP': 0.73,
            'fYEN': 110.0,
        };

        return fallbackRates[symbol] || 1;
    }

    getAllPrices(): Record<string, PriceData> {
        const prices: Record<string, PriceData> = {};
        this.priceCache.forEach((price, symbol) => {
            prices[symbol] = price;
        });
        return prices;
    }

    // Convert amount from one currency to another using real exchange rates
    convertCurrency(fromSymbol: string, toSymbol: string, amount: number): number {
        if (fromSymbol === toSymbol) return amount;

        const fromRate = this.getCurrentPrice(fromSymbol);
        const toRate = this.getCurrentPrice(toSymbol);

        // Convert through USD
        const usdAmount = fromSymbol === 'fUSD' ? amount : amount / fromRate;
        return toSymbol === 'fUSD' ? usdAmount : usdAmount * toRate;
    }

    // Check if price data is stale
    isPriceDataStale(): boolean {
        return !this.isRecentUpdate(60000); // 1 minute threshold
    }
}

export const priceService = new PriceService();