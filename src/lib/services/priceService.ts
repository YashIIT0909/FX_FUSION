import { PriceData } from '../types';

class PriceService {
    private priceCache: Map<string, PriceData> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;
    private subscribers: Set<(prices: Record<string, PriceData>) => void> = new Set();

    // Mock exchange rates - in production, you'd fetch from a real API
    private mockRates: Record<string, number> = {
        'fUSD': 1.0,
        'fEUR': 0.85, // 1 USD = 0.85 EUR
        'fGBP': 0.73, // 1 USD = 0.73 GBP  
        'fYEN': 110.0, // 1 USD = 110 YEN
    };

    startMonitoring() {
        if (this.updateInterval) return;

        this.updatePrices(); // Initial update
        this.updateInterval = setInterval(() => {
            this.updatePrices();
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

        // Send current prices immediately
        const currentPrices: Record<string, PriceData> = {};
        this.priceCache.forEach((price, symbol) => {
            currentPrices[symbol] = price;
        });
        callback(currentPrices);

        return () => this.subscribers.delete(callback);
    }

    private updatePrices() {
        const now = new Date().toISOString();
        const updatedPrices: Record<string, PriceData> = {};

        Object.entries(this.mockRates).forEach(([symbol, baseRate]) => {
            const previousPrice = this.priceCache.get(symbol);

            // Simulate price fluctuations (±2% random movement)
            const fluctuation = (Math.random() - 0.5) * 0.04; // ±2%
            const newRate = baseRate * (1 + fluctuation);

            const change24h = previousPrice
                ? ((newRate - previousPrice.price) / previousPrice.price) * 100
                : 0;

            const priceData: PriceData = {
                symbol,
                price: newRate,
                change24h,
                lastUpdated: now,
            };

            this.priceCache.set(symbol, priceData);
            updatedPrices[symbol] = priceData;
        });

        // Notify all subscribers
        this.subscribers.forEach(callback => callback(updatedPrices));
    }

    getCurrentPrice(symbol: string): number {
        return this.priceCache.get(symbol)?.price || this.mockRates[symbol] || 1;
    }

    getAllPrices(): Record<string, PriceData> {
        const prices: Record<string, PriceData> = {};
        this.priceCache.forEach((price, symbol) => {
            prices[symbol] = price;
        });
        return prices;
    }

    // Convert amount from one currency to another
    convertCurrency(fromSymbol: string, toSymbol: string, amount: number): number {
        const fromRate = this.getCurrentPrice(fromSymbol);
        const toRate = this.getCurrentPrice(toSymbol);

        // Convert to USD first, then to target currency
        const usdAmount = fromSymbol === 'fUSD' ? amount : amount / fromRate;
        return toSymbol === 'fUSD' ? usdAmount : usdAmount * toRate;
    }
}

export const priceService = new PriceService();