import { NextResponse } from 'next/server';
import { HermesClient } from '@pythnetwork/hermes-client';

const connection = new HermesClient("https://hermes.pyth.network", {});

// Price IDs for Ethereum network (these are the same as they're universal)
const priceIds = {
    ETH_USD: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    USD_CHF: "0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e28f8",
    USD_INR: "0x0ac0f9a2886fc2dd708bc66cc2cea359052ce89d324f45d95fadbc6c4fcf1809",
    USD_YEN: "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
    GBP_USD: "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
    EUR_USD: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
    USDC_USD: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
};

export async function GET() {
    try {
        // Get latest price updates for all price feeds
        const priceUpdates = await connection.getLatestPriceUpdates(Object.values(priceIds));

        // Parse price data
        const prices: { [key: string]: number } = {};

        priceUpdates.parsed?.forEach((priceUpdate) => {
            const priceId = priceUpdate.id.startsWith('0x') ? priceUpdate.id : `0x${priceUpdate.id}`;
            console.log(`Price ID: ${priceId}, Price: ${priceUpdate.price.price}, Expo: ${priceUpdate.price.expo}`);

            const price = Number(priceUpdate.price.price) * Math.pow(10, priceUpdate.price.expo);
            console.log(`Calculated price for ${priceId}: ${price}`);

            // Map price IDs to currency pairs
            if (priceId === priceIds.ETH_USD) {
                prices.ETH_USD = price;
                console.log('ETH_USD price set:', price);
            } else if (priceId === priceIds.USD_CHF) {
                prices.USD_CHF = price;
            } else if (priceId === priceIds.USD_INR) {
                prices.USD_INR = price;
            } else if (priceId === priceIds.USD_YEN) {
                prices.USD_YEN = price;
            } else if (priceId === priceIds.GBP_USD) {
                prices.GBP_USD = price;
            } else if (priceId === priceIds.EUR_USD) {
                prices.EUR_USD = price;
            } else if (priceId === priceIds.USDC_USD) {
                prices.USDC_USD = price;
            }
        });

        console.log('All parsed prices:', prices);

        // Calculate ETH to other currencies conversion rates
        const ethUsdPrice = prices.ETH_USD;

        console.log('Final ETH_USD Price:', ethUsdPrice);
        if (!ethUsdPrice || ethUsdPrice <= 0) {
            throw new Error('ETH/USD price not available or invalid');
        }

        const conversionRates = {
            USDC: ethUsdPrice / (prices.USDC_USD || 1), // ETH to USDC
            USD: ethUsdPrice, // ETH to USD (direct)
            INR: ethUsdPrice * (prices.USD_INR || 83), // ETH to INR
            CHF: ethUsdPrice * (prices.USD_CHF || 0.9), // ETH to CHF
            JPY: ethUsdPrice * (prices.USD_YEN || 150), // ETH to JPY
            EUR: ethUsdPrice / (prices.EUR_USD || 1.1), // ETH to EUR
            GBP: ethUsdPrice / (prices.GBP_USD || 1.25), // ETH to GBP
        };

        console.log('Calculated conversion rates:', conversionRates);

        return NextResponse.json({
            success: true,
            data: {
                flowUsdPrice: ethUsdPrice, // Keep the same key name for compatibility
                conversionRates,
                rawPrices: prices,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching price feeds:', error);

        // Fallback rates based on current ETH price
        const fallbackRates = {
            USDC: 2400, // Approximate ETH price
            USD: 2400,
            INR: 200000, // ETH to INR
            CHF: 2160,
            JPY: 360000, // ETH to JPY
            EUR: 2200,
            GBP: 1900,
        };

        return NextResponse.json({
            success: false,
            data: {
                flowUsdPrice: 2400, // ETH price fallback
                conversionRates: fallbackRates,
                rawPrices: {},
                timestamp: new Date().toISOString(),
                error: 'Using fallback rates due to API error'
            }
        });
    }
}