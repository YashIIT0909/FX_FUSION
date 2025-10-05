//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/facade/facade.sol";
import "../src/swap/currency_swap.sol";

contract DebugScript is Script {
    address constant FACADE_ADDRESS =
        0x6fed5f6895b2D95dA607564B0437cEdebf4cA535;
    address constant CURRENCY_SWAP_ADDRESS =
        0xa5A5bBbB2455194d0b9bab5545FE4D6175d63C81;

    function run() external view {
        Facade facade = Facade(payable(FACADE_ADDRESS));
        CurrencySwap currencySwap = CurrencySwap(
            payable(CURRENCY_SWAP_ADDRESS)
        );

        console.log("=== DEBUGGING CONTRACT STATE ===");

        // Check if fUSD is registered in facade
        address fUSDAddr = facade.tokens("fUSD");
        console.log("fUSD address in Facade:", fUSDAddr);

        // Check if fUSD is registered in currency swap
        address fUSDAddrSwap = currencySwap.tokens("fUSD");
        console.log("fUSD address in CurrencySwap:", fUSDAddrSwap);

        // Check price feed for fUSD
        bytes32 fUSDPriceFeed = currencySwap.priceFeedIds("fUSD");
        console.log("fUSD price feed ID:", vm.toString(fUSDPriceFeed));

        // Try to get ETH to fUSD rate
        try currencySwap.getETHToTokenRate("fUSD") returns (uint256 rate) {
            console.log("ETH to fUSD rate:", rate);
        } catch {
            console.log("ERROR: Could not get ETH to fUSD rate");
        }

        // Check if we can call swapETHToToken (this will revert in view, but we can see the error)
        console.log("=== Checking other tokens ===");
        string[6] memory tokens = [
            "fUSD",
            "fEUR",
            "fGBP",
            "fYEN",
            "fCHF",
            "fINR"
        ];

        for (uint i = 0; i < tokens.length; i++) {
            address tokenAddr = currencySwap.tokens(tokens[i]);
            bytes32 priceFeed = currencySwap.priceFeedIds(tokens[i]);
            console.log(string.concat(tokens[i], " - Address: "), tokenAddr);
            console.log(
                string.concat(tokens[i], " - Price Feed: "),
                vm.toString(priceFeed)
            );

            // Test rate calculation for each token
            try currencySwap.getETHToTokenRate(tokens[i]) returns (
                uint256 rate
            ) {
                console.log(string.concat(tokens[i], " - ETH Rate: "), rate);
            } catch {
                console.log(string.concat(tokens[i], " - Rate ERROR"));
            }
        }
    }
}
