// This route runs on the standard Node.js runtime
export const dynamic = 'force-dynamic';

import { HermesClient } from "@pythnetwork/hermes-client";

export interface PriceUpdate {
    symbol: string;
    price: number;
    change24h: number;
}

interface RawPriceUpdate {
    id: string;
    price?: PriceData;
}

interface PriceData {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
}

const symbolMap: Record<string, string> = {
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43": "BTC/USD",
    "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace": "ETH/USD",
    "2fb245b9a84554a0f15aa123cbb5f64cd263b59e9a87d80148cbffab50c69f30": "FLOW/USD",
    "0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e28f8": "USD/CHF",
    "0ac0f9a2886fc2dd708bc66cc2cea359052ce89d324f45d95fadbc6c4fcf1809": "USD/INR",
    "ef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52": "USD/JPY",
    "84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1": "GBP/USD",
    "a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b": "EUR/USD",
};

const priceIds = Object.keys(symbolMap);

export async function GET() {
    const connection = new HermesClient("https://hermes.pyth.network/");
    let pythEventSource: EventSource | undefined;
    let keepAliveInterval: NodeJS.Timeout;

    const stream = new ReadableStream({
        async start(controller) {
            keepAliveInterval = setInterval(() => {
                controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
            }, 10000);

            try {
                pythEventSource = await connection.getPriceUpdatesStream(priceIds);

                pythEventSource.onopen = () => {
                    console.log("✅ API Route (Node.js): Connection to Pyth network opened.");
                };

                pythEventSource.onmessage = (event) => {
                    try {
                        // First, parse the entire message string into a single object.
                        const priceUpdatePayload = JSON.parse(event.data);
                        const processedPrices: Record<string, PriceUpdate> = {};

                        // Then, check if that object contains the '.parsed' key and that its value is an array.
                        if (priceUpdatePayload.parsed && Array.isArray(priceUpdatePayload.parsed)) {
                            // If it does, loop through the array of price updates.
                            priceUpdatePayload.parsed.forEach((update: RawPriceUpdate) => {
                                const symbol = symbolMap[update.id];
                                if (symbol && update.price?.price) {
                                    const priceValue = parseFloat(update.price.price);
                                    const expo = update.price.expo;
                                    processedPrices[symbol] = {
                                        symbol,
                                        price: priceValue * Math.pow(10, expo),
                                        change24h: 0,
                                    };
                                }
                            });
                        }

                        if (Object.keys(processedPrices).length > 0) {
                            const data = `data: ${JSON.stringify(processedPrices)}\n\n`;
                            controller.enqueue(new TextEncoder().encode(data));
                        }
                    } catch (e) {
                        console.warn("⚠️ API Route (Node.js): Received a message from Pyth that was not a price update.");
                    }
                };

                pythEventSource.onerror = (error) => {
                    console.error("❌ API Route (Node.js): Connection error from Pyth EventSource:", error);
                    controller.error(error);
                };
            } catch (error) {
                console.error("❌ API Route (Node.js): Failed to establish stream with Pyth:", error);
                controller.error(error);
            }
        },
        cancel() {
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
            }
            if (pythEventSource) {
                pythEventSource.close();
                console.log("🔌 API Route (Node.js): Client disconnected. Closed connection to Pyth.");
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}