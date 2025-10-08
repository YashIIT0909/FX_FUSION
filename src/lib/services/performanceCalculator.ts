import { Basket, TokenAllocation, PnlDataPoint } from '../types';
import { priceService } from './priceService';

export class PerformanceCalculator {

    static calculateTokenPerformance(
        token: TokenAllocation,
        baseCurrency: string = 'fUSD'
    ): TokenAllocation {
        // Get current exchange rate from price service
        const currentRate = priceService.convertCurrency(token.symbol, baseCurrency, 1);
        const initialRate = token.initialPrice;

        // Calculate values in base currency
        const currentValue = token.amount * currentRate;
        const initialValue = token.amount * initialRate;

        // Calculate P&L
        const pnl = currentValue - initialValue;
        const pnlPercentage = initialValue > 0 ? (pnl / initialValue) * 100 : 0;

        // Add current price data to history if available
        const currentPriceData = priceService.getAllPrices()[token.symbol];
        const updatedHistory = [...token.priceHistory];

        if (currentPriceData) {
            const historyPoint = {
                timestamp: currentPriceData.lastUpdated,
                price: currentRate,
                pnl: pnl
            };

            // Add to history if it's a new timestamp
            const lastEntry = updatedHistory[updatedHistory.length - 1];
            if (!lastEntry || lastEntry.timestamp !== historyPoint.timestamp) {
                updatedHistory.push(historyPoint);

                // Keep only last 24 hours of data (assuming updates every 30 seconds)
                const maxEntries = 24 * 60 * 2; // 24 hours * 60 minutes * 2 (30-second intervals)
                if (updatedHistory.length > maxEntries) {
                    updatedHistory.splice(0, updatedHistory.length - maxEntries);
                }
            }
        }

        return {
            ...token,
            currentPrice: currentRate,
            pnl,
            pnlPercentage,
            priceHistory: updatedHistory,
        };
    }

    static calculateBasketPerformance(basket: Basket): Basket {
        // Update each token's performance with real prices
        const updatedTokens = basket.tokens.map(token =>
            this.calculateTokenPerformance(token, basket.baseCurrency)
        );

        // Calculate overall basket performance
        const currentTotalValue = updatedTokens.reduce(
            (sum, token) => sum + (token.amount * token.currentPrice), 0
        );

        const totalPnl = currentTotalValue - basket.initialValue;
        const performance = basket.initialValue > 0
            ? (totalPnl / basket.initialValue) * 100
            : 0;

        return {
            ...basket,
            tokens: updatedTokens,
            totalValue: currentTotalValue,
            performance,
        };
    }

    static generateRealTimePnlHistory(basket: Basket, hoursBack: number = 24): PnlDataPoint[] {
        // Use actual price history from tokens to calculate P&L over time
        const history: PnlDataPoint[] = [];

        // Get the longest price history from all tokens
        let maxHistoryLength = 0;
        basket.tokens.forEach(token => {
            maxHistoryLength = Math.max(maxHistoryLength, token.priceHistory.length);
        });

        // Calculate P&L for each historical point
        for (let i = 0; i < maxHistoryLength; i++) {
            let totalValue = 0;
            let validDataPoint = true;
            let timestamp = '';

            basket.tokens.forEach(token => {
                if (i < token.priceHistory.length) {
                    const historyPoint = token.priceHistory[i];
                    totalValue += token.amount * historyPoint.price;
                    timestamp = historyPoint.timestamp;
                } else {
                    // Use initial price if no history available
                    totalValue += token.amount * token.initialPrice;
                    validDataPoint = false;
                }
            });

            if (validDataPoint || i === 0) {
                const pnl = totalValue - basket.initialValue;
                const pnlPercentage = basket.initialValue > 0 ? (pnl / basket.initialValue) * 100 : 0;

                history.push({
                    timestamp: timestamp || new Date().toISOString(),
                    value: Number(totalValue.toFixed(2)),
                    pnl: Number(pnl.toFixed(2)),
                    pnlPercentage: Number(pnlPercentage.toFixed(2)),
                });
            }
        }

        // Filter by time range
        const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
        return history.filter(point => {
            const pointTime = new Date(point.timestamp).getTime();
            return pointTime >= cutoffTime;
        });
    }

    static isBasketLocked(basket: Basket): boolean {
        return new Date() < new Date(basket.lockEndDate);
    }

    static getDaysRemaining(basket: Basket): number {
        const now = new Date();
        const lockEnd = new Date(basket.lockEndDate);
        const diffTime = lockEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }

    static getDataQuality(): {
        isStale: boolean;
        lastUpdate: string;
        staleness: 'fresh' | 'recent' | 'stale';
    } {
        const isStale = priceService.isPriceDataStale();
        const prices = priceService.getAllPrices();
        const latestUpdate = Object.values(prices)[0]?.lastUpdated || '';

        let staleness: 'fresh' | 'recent' | 'stale' = 'fresh';
        if (isStale) {
            staleness = 'stale';
        } else if (latestUpdate) {
            const updateTime = new Date(latestUpdate);
            const age = Date.now() - updateTime.getTime();
            if (age > 30000) { // 30 seconds
                staleness = 'recent';
            }
        }

        return {
            isStale,
            lastUpdate: latestUpdate,
            staleness
        };
    }
}