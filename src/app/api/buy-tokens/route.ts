import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import contractJson from "@/src/contracts/out/facade.sol/Facade.json"

const FACADE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FACADE_ADDRESS || "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";
const FACADE_ABI = contractJson.abi;

export async function POST(request: NextRequest) {
    console.log("=== Buy Tokens API Called (Ethereum Sepolia) ===");

    if (!FACADE_CONTRACT_ADDRESS) {
        console.error("Server configuration error: FACADE_CONTRACT_ADDRESS not set in environment");
        return NextResponse.json(
            { success: false, error: "Server configuration error. Check server logs." },
            { status: 500 }
        );
    }

    try {
        const { tokenSymbol, flowAmount } = await request.json();
        console.log("Request parameters:", { tokenSymbol, ethAmount: flowAmount }); // Renamed for clarity

        if (!tokenSymbol || !flowAmount) {
            console.error("Missing required parameters");
            return NextResponse.json(
                { success: false, error: 'Missing required parameters: tokenSymbol and ethAmount' },
                { status: 400 }
            );
        }

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
        console.log("Token mapping:", { requested: tokenSymbol, mapped: targetTokenSymbol });

        if (!targetTokenSymbol) {
            console.error("Unsupported token:", tokenSymbol);
            return NextResponse.json(
                { success: false, error: `Unsupported token: ${tokenSymbol}` },
                { status: 400 }
            );
        }

        const ethAmountWei = ethers.parseEther(flowAmount.toString());
        console.log("ETH amount in wei:", ethAmountWei.toString());

        // Add validation for minimum amount
        if (ethAmountWei <= 0) {
            return NextResponse.json(
                { success: false, error: 'Amount must be greater than 0' },
                { status: 400 }
            );
        }

        // Test contract connection first
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const contract = new ethers.Contract(FACADE_CONTRACT_ADDRESS, FACADE_ABI, provider);

            // Check if contract exists
            const code = await provider.getCode(FACADE_CONTRACT_ADDRESS);
            console.log("Contract bytecode exists:", code !== "0x");

            // Check if function exists in ABI
            const functionExists = contract.interface.hasFunction("buyMockFiat");
            console.log("Function exists in ABI:", functionExists);

            // Check token registration
            console.log("=== CHECKING TOKEN REGISTRATION ===");
            try {
                const tokenAddress = await contract.tokens(targetTokenSymbol);
                console.log(`Token ${targetTokenSymbol} is registered at:`, tokenAddress);

                if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                    console.error(`Token ${targetTokenSymbol} is not registered in Facade contract`);
                    return NextResponse.json({
                        success: false,
                        error: `Token ${targetTokenSymbol} is not registered in the Facade contract. Please contact support.`,
                    }, { status: 400 });
                }
            } catch (registrationError) {
                console.error("Failed to check token registration:", registrationError);
            }

            // Check ETH token registration
            try {
                const ethTokenAddress = await contract.tokens("ETH");
                console.log("ETH token is registered at:", ethTokenAddress);
            } catch (registrationError) {
                console.error("Failed to check ETH token registration:", registrationError);
            }

        } catch (contractError) {
            console.error("Contract validation error:", contractError);
        }

        const facadeInterface = new ethers.Interface(FACADE_ABI);

        // Try to validate the function exists
        const fragment = facadeInterface.getFunction("buyMockFiat");
        if (!fragment) {
            console.error("Function buyMockFiat not found in ABI");
            return NextResponse.json(
                { success: false, error: 'Contract function not found' },
                { status: 500 }
            );
        }

        console.log("Function fragment:", {
            name: fragment.name,
            inputs: fragment.inputs.map(input => ({ name: input.name, type: input.type }))
        });

        const transactionData = facadeInterface.encodeFunctionData("buyMockFiat", [
            "ETH",
            targetTokenSymbol
        ]);

        console.log("=== TRANSACTION DATA DEBUG ===");
        console.log("Encoded data:", transactionData);
        console.log("Encoded data length:", transactionData.length);
        console.log("Encoded data type:", typeof transactionData);
        console.log("Function parameters:", ["ETH", targetTokenSymbol]);
        console.log("Data starts with 0x:", transactionData.startsWith('0x'));

        // Verify the encoding by trying to decode it back
        try {
            const decoded = facadeInterface.decodeFunctionData("buyMockFiat", transactionData);
            console.log("Decoded data verification:", decoded);
        } catch (decodeError) {
            console.error("Failed to decode transaction data:", decodeError);
        }

        console.log("Preparing transaction response");
        const response = {
            success: true,
            data: {
                to: FACADE_CONTRACT_ADDRESS,
                value: ethAmountWei.toString(),
                data: transactionData,
                gasLimit: "500000", // Higher gas limit for Ethereum
            }
        };

        console.log("=== FINAL RESPONSE ===");
        console.log("Response data field:", response.data.data);
        console.log("Response data field length:", response.data.data.length);
        console.log("Full response:", JSON.stringify(response, null, 2));

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Error in buy-tokens API:', error);
        console.error('Error stack:', error.stack);

        return NextResponse.json({
            success: false,
            error: error.reason || error.message || 'Failed to prepare transaction',
        }, { status: 500 });
    }
}