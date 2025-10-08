import { Basket, TokenAllocation, PnlDataPoint, PriceHistoryPoint } from '../types';
import { priceService } from './priceService';

export class PerformanceCalculator {

    static calculateTokenPerformance(
        token: TokenAllocation,
        baseCurrency: string = 'fUSD'
    ): TokenAllocation {
        const currentPrice = priceService.convertCurrency(token.symbol, baseCurrency, 1);
        const initialPrice = token.initialPrice;

        // Calculate P&L
        const currentValue = token.amount * currentPrice;
        const initialValue = token.amount * initialPrice;
        const pnl = currentValue - initialValue;
        const pnlPercentage = initialValue > 0 ? (pnl / initialValue) * 100 : 0;

        return {
            ...token,
            currentPrice,
            pnl,
            pnlPercentage,
        };
    }

    static calculateBasketPerformance(basket: Basket): Basket {
        // Update each token's performance
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

    static generatePnlHistory(
        basket: Basket,
        daysBack: number = 30
    ): PnlDataPoint[] {
        const history: PnlDataPoint[] = [];

        for (let i = daysBack - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            // Simulate historical performance based on current performance
            // In production, you'd store actual historical data
            const daysFactor = i / daysBack;
            const simulatedPerformance = basket.performance * daysFactor;
            const simulatedValue = basket.initialValue * (1 + simulatedPerformance / 100);
            const simulatedPnl = simulatedValue - basket.initialValue;

            history.push({
                timestamp: date.toLocaleDateString(),
                value: Number(simulatedValue.toFixed(2)),
                pnl: Number(simulatedPnl.toFixed(2)),
                pnlPercentage: Number(simulatedPerformance.toFixed(2)),
            });
        }

        return history;
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
}