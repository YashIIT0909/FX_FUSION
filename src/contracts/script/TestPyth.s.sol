//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract TestPythScript is Script {
    address constant PYTH_ADDRESS = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;
    bytes32 constant ETH_PRICE_FEED =
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    // Multiple USD-related price feeds to test
    bytes32 constant USD_PRICE_FEED_1 =
        0xeaa020c61cc479712813461ce153894a96a6c00b21fe15d5e9a76c78ddb9c50e; // Original
    bytes32 constant USDC_PRICE_FEED =
        0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a; // USDC/USD
    bytes32 constant USDT_PRICE_FEED =
        0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b; // USDT/USD
    bytes32 constant EUR_PRICE_FEED =
        0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b; // EUR/USD
    bytes32 constant GBP_PRICE_FEED =
        0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1; // GBP/USD

    function run() external view {
        IPyth pyth = IPyth(PYTH_ADDRESS);

        console.log("=== Testing Pyth Price Feeds (Base Sepolia) ===");

        // Test ETH price feed
        try pyth.getPriceUnsafe(ETH_PRICE_FEED) returns (
            PythStructs.Price memory ethPrice
        ) {
            console.log("ETH Price:", vm.toString(ethPrice.price));
            console.log("ETH Expo:", vm.toString(ethPrice.expo));
            console.log("ETH Publish Time:", ethPrice.publishTime);
        } catch {
            console.log("ERROR: ETH price feed failed!");
        }

        console.log("\n=== Testing Multiple USD-related Price Feeds ===");

        // Test USDC/USD price feed
        try pyth.getPriceUnsafe(USDC_PRICE_FEED) returns (
            PythStructs.Price memory usdcPrice
        ) {
            console.log("USDC Price:", vm.toString(usdcPrice.price));
            console.log("USDC Expo:", vm.toString(usdcPrice.expo));
            console.log("USDC works!");
        } catch {
            console.log("USDC price feed failed");
        }

        // Test USDT/USD price feed
        try pyth.getPriceUnsafe(USDT_PRICE_FEED) returns (
            PythStructs.Price memory usdtPrice
        ) {
            console.log("USDT Price:", vm.toString(usdtPrice.price));
            console.log("USDT Expo:", vm.toString(usdtPrice.expo));
            console.log("USDT works!");
        } catch {
            console.log("USDT price feed failed");
        }

        // Test EUR/USD price feed
        try pyth.getPriceUnsafe(EUR_PRICE_FEED) returns (
            PythStructs.Price memory eurPrice
        ) {
            console.log("EUR Price:", vm.toString(eurPrice.price));
            console.log("EUR Expo:", vm.toString(eurPrice.expo));
            console.log("EUR works!");
        } catch {
            console.log("EUR price feed failed");
        }

        // Test GBP/USD price feed
        try pyth.getPriceUnsafe(GBP_PRICE_FEED) returns (
            PythStructs.Price memory gbpPrice
        ) {
            console.log("GBP Price:", vm.toString(gbpPrice.price));
            console.log("GBP Expo:", vm.toString(gbpPrice.expo));
            console.log("GBP works!");
        } catch {
            console.log("GBP price feed failed");
        }

        console.log("\n=== Testing Rate Calculation with Working Feeds ===");

        // Try to calculate ETH to USDC rate if both work
        try pyth.getPriceUnsafe(ETH_PRICE_FEED) returns (
            PythStructs.Price memory ethPrice
        ) {
            try pyth.getPriceUnsafe(USDC_PRICE_FEED) returns (
                PythStructs.Price memory usdcPrice
            ) {
                console.log("ETH-USDC calculation working!");
                console.log("Raw ETH price:", vm.toString(ethPrice.price));
                console.log("Raw USDC price:", vm.toString(usdcPrice.price));

                if (ethPrice.price > 0 && usdcPrice.price > 0) {
                    // ETH price / USDC price = how many USDC tokens per ETH
                    uint256 rate = (uint256(int256(ethPrice.price)) * 1e18) /
                        uint256(int256(usdcPrice.price));
                    console.log("Calculated ETH->USDC rate:", rate);
                } else {
                    console.log("One or both prices are negative/zero");
                }
            } catch {
                console.log("USDC price feed failed in calculation");
            }
        } catch {
            console.log("ETH price feed failed in calculation");
        }
    }
}
