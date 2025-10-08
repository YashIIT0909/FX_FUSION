import { Basket, TokenAllocation, PnlDataPoint, PriceHistoryPoint } from '../types';
import { priceService } from './priceService';
import { PerformanceCalculator } from './performanceCalculator';

interface PerformanceSnapshot {
    timestamp: number;
    basketId: string;
    totalValue: number;
    pnl: number;
    pnlPercentage: number;
    tokenPerformances: {
        symbol: string;
        price: number;
        value: number;
        pnl: number;
        pnlPercentage: number;
    }[];
}

class PerformanceTracker {
    private snapshots: Map<string, PerformanceSnapshot[]> = new Map();
    private trackingInterval: NodeJS.Timeout | null = null;
    private trackedBaskets: Map<string, Basket> = new Map();
    private priceSubscription: (() => void) | null = null;

    async startTracking(baskets: Basket[]) {
        // Start price monitoring first
        await priceService.startMonitoring();

        // Add baskets to tracking
        baskets.forEach(basket => {
            this.trackedBaskets.set(basket.id, basket);
            if (!this.snapshots.has(basket.id)) {
                this.snapshots.set(basket.id, []);
            }
        });

        // Subscribe to price updates
        if (!this.priceSubscription) {
            this.priceSubscription = priceService.subscribe((prices) => {
                // Update all tracked baskets when prices change
                this.trackedBaskets.forEach(basket => {
                    this.takeSnapshot(basket);
                });
            });
        }

        // Also take snapshots on regular intervals as backup
        if (!this.trackingInterval) {
            this.trackingInterval = setInterval(() => {
                this.trackedBaskets.forEach(basket => {
                    this.takeSnapshot(basket);
                });
            }, 60000); // Every minute as backup
        }
    }

    stopTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }

        if (this.priceSubscription) {
            this.priceSubscription();
            this.priceSubscription = null;
        }

        priceService.stopMonitoring();
    }

    private takeSnapshot(basket: Basket) {
        const timestamp = Date.now();

        // Calculate current performance using real prices
        const updatedBasket = PerformanceCalculator.calculateBasketPerformance(basket);

        const tokenPerformances = updatedBasket.tokens.map(token => ({
            symbol: token.symbol,
            price: token.currentPrice,
            value: token.amount * token.currentPrice,
            pnl: token.pnl,
            pnlPercentage: token.pnlPercentage
        }));

        const totalPnl = updatedBasket.totalValue - updatedBasket.initialValue;
        const totalPnlPercentage = updatedBasket.initialValue > 0
            ? (totalPnl / updatedBasket.initialValue) * 100
            : 0;

        const snapshot: PerformanceSnapshot = {
            timestamp,
            basketId: basket.id,
            totalValue: updatedBasket.totalValue,
            pnl: totalPnl,
            pnlPercentage: totalPnlPercentage,
            tokenPerformances
        };

        const basketSnapshots = this.snapshots.get(basket.id) || [];

        // Only add snapshot if it's different from the last one (avoid duplicates)
        const lastSnapshot = basketSnapshots[basketSnapshots.length - 1];
        if (!lastSnapshot ||
            Math.abs(lastSnapshot.totalValue - snapshot.totalValue) > 0.01 ||
            timestamp - lastSnapshot.timestamp > 60000) { // Force update every minute

            basketSnapshots.push(snapshot);

            // Keep only last 7 days of snapshots
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            const cutoffTime = timestamp - maxAge;
            const filteredSnapshots = basketSnapshots.filter(s => s.timestamp >= cutoffTime);

            this.snapshots.set(basket.id, filteredSnapshots);
        }
    }

    getBasketHistory(basketId: string, hours: number = 24): PnlDataPoint[] {
        const snapshots = this.snapshots.get(basketId) || [];
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

        return snapshots
            .filter(snapshot => snapshot.timestamp >= cutoffTime)
            .map(snapshot => ({
                timestamp: new Date(snapshot.timestamp).toLocaleTimeString(),
                value: snapshot.totalValue,
                pnl: snapshot.pnl,
                pnlPercentage: snapshot.pnlPercentage
            }));
    }

    getTokenHistory(basketId: string, tokenSymbol: string, hours: number = 24): PriceHistoryPoint[] {
        const snapshots = this.snapshots.get(basketId) || [];
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

        return snapshots
            .filter(snapshot => snapshot.timestamp >= cutoffTime)
            .map(snapshot => {
                const tokenPerf = snapshot.tokenPerformances.find(t => t.symbol === tokenSymbol);
                return {
                    timestamp: new Date(snapshot.timestamp).toISOString(),
                    price: tokenPerf?.price || 0,
                    pnl: tokenPerf?.pnl || 0
                };
            });
    }

    getCurrentPerformance(basketId: string): PerformanceSnapshot | null {
        const snapshots = this.snapshots.get(basketId) || [];
        return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    }

    // Get data quality metrics
    getDataQuality() {
        return PerformanceCalculator.getDataQuality();
    }
}

export const performanceTracker = new PerformanceTracker();