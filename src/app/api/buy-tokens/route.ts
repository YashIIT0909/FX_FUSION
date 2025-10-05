import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import contractJson from "@/src/contracts/out/facade.sol/Facade.json"

const FACADE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FACADE_ADDRESS || "";
const FACADE_ABI = contractJson.abi;

export async function POST(request: NextRequest) {
    console.log("=== Buy Tokens API Called (Ethereum Sepolia) ===");

    if (!FACADE_CONTRACT_ADDRESS) {
        console.error("FACADE_CONTRACT_ADDRESS not set");
        return NextResponse.json(
            { success: false, error: "Server configuration error" },
            { status: 500 }
        );
    }

    try {
        const { tokenSymbol, flowAmount } = await request.json();
        console.log("Request:", { tokenSymbol, ethAmount: flowAmount });

        if (!tokenSymbol || !flowAmount) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Map frontend token symbols to contract token symbols
        const tokenMapping: { [key: string]: string } = {
            'USDC': 'fUSD',
            'USD': 'fUSD',
            'INR': 'fINR',
            'EUR': 'fEUR',
            'GBP': 'fGBP',
            'JPY': 'fYEN',
            'CHF': 'fCHF'
        };

        const targetTokenSymbol = tokenMapping[tokenSymbol];
        if (!targetTokenSymbol) {
            return NextResponse.json(
                { success: false, error: `Unsupported token: ${tokenSymbol}` },
                { status: 400 }
            );
        }

        const ethAmountWei = ethers.parseEther(flowAmount.toString());
        if (ethAmountWei <= 0) {
            return NextResponse.json(
                { success: false, error: 'Amount must be greater than 0' },
                { status: 400 }
            );
        }

        // Create interface and encode function call for buyFiatWithETH
        const facadeInterface = new ethers.Interface(FACADE_ABI);
        const transactionData = facadeInterface.encodeFunctionData("buyFiatWithETH", [
            targetTokenSymbol
        ]);

        console.log("Encoded transaction data:", transactionData);
        console.log("Target token:", targetTokenSymbol);
        console.log("ETH amount:", ethAmountWei.toString());

        const response = {
            success: true,
            data: {
                to: FACADE_CONTRACT_ADDRESS,
                value: ethAmountWei.toString(),
                data: transactionData,
                gasLimit: "300000"
            }
        };

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Error in buy-tokens API:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to prepare transaction',
        }, { status: 500 });
    }
}