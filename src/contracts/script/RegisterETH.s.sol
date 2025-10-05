//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/swap/currency_swap.sol";

contract RegisterETHScript is Script {
    address constant CURRENCY_SWAP_ADDRESS =
        0x2eDe85B1C710301F75A40c6428DcE8826210f9D2; // From your .env

    function run() external {
        vm.startBroadcast();

        CurrencySwap currencySwap = CurrencySwap(CURRENCY_SWAP_ADDRESS);

        // Register ETH with Pyth price feed
        currencySwap.registerToken(
            "ETH",
            address(0), // ETH doesn't have a token address
            0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace // ETH/USD price feed
        );

        console.log("ETH registered successfully!");

        vm.stopBroadcast();
    }
}
