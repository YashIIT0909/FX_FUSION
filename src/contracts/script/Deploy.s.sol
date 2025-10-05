//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/swap/currency_swap.sol";
import "../src/basket/basketNFT.sol";
import "../src/facade/facade.sol";
import "../src/tokens/MockFiat.sol";

contract DeployScript is Script {
    // Pyth Oracle address for Base Sepolia testnet
    address constant PYTH_ADDRESS = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;

    struct Currency {
        string name;
        string symbol;
        bytes32 priceFeedId;
    }

    function run() external {
        vm.startBroadcast();

        // ===== STEP 1: DEPLOY CORE CONTRACTS =====
        CurrencySwap currencySwap = new CurrencySwap(PYTH_ADDRESS);
        console.log("CurrencySwap deployed at:", address(currencySwap));

        BasketNFT basketNFT = new BasketNFT("Currency Basket NFT", "CBASKET");
        console.log("BasketNFT deployed at:", address(basketNFT));

        Facade facade = new Facade(
            payable(address(currencySwap)),
            address(basketNFT)
        );
        console.log("Facade deployed at:", address(facade));

        basketNFT.setFacade(address(facade));
        console.log("Facade set in BasketNFT");

        // ===== STEP 2: DEPLOY AND REGISTER FIAT TOKENS =====
        // Using WORKING price feeds from Base Sepolia
        Currency[] memory currencies = new Currency[](6);
        currencies[0] = Currency({
            name: "Fake US Dollar",
            symbol: "fUSD",
            priceFeedId: 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a // USDC/USD (≈$1)
        });
        currencies[1] = Currency({
            name: "Fake Euro",
            symbol: "fEUR",
            priceFeedId: 0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b // EUR/USD (works!)
        });
        currencies[2] = Currency({
            name: "Fake British Pound",
            symbol: "fGBP",
            priceFeedId: 0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1 // GBP/USD (works!)
        });
        currencies[3] = Currency({
            name: "Fake Japanese Yen",
            symbol: "fYEN",
            priceFeedId: 0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52 // JPY/USD (fallback)
        });
        currencies[4] = Currency({
            name: "Fake Swiss Franc",
            symbol: "fCHF",
            priceFeedId: 0x0b1e3297e69f162877b577b0b9a47508bfd7357ae086aa21bff4dcfa8155e24e // CHF/USD (fallback)
        });
        currencies[5] = Currency({
            name: "Fake Indian Rupee",
            symbol: "fINR",
            priceFeedId: 0x605d5c2fbd7cc4f5a28cd621202e20dfb1c7d335696b15c3e5027c0ac64bb1ab // INR/USD (fallback)
        });

        // Deploy and register fiat tokens
        for (uint i = 0; i < currencies.length; i++) {
            MockFiatToken token = new MockFiatToken(
                currencies[i].name,
                currencies[i].symbol
            );

            token.setSwapContract(address(currencySwap));

            console.log(
                string.concat(currencies[i].symbol, " deployed at:"),
                address(token)
            );

            facade.registerToken(
                currencies[i].symbol,
                address(token),
                currencies[i].priceFeedId
            );

            console.log(
                string.concat(
                    "Registered ",
                    currencies[i].symbol,
                    " with facade and currency swap"
                )
            );
        }

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia Testnet");
        console.log("CurrencySwap:", address(currencySwap));
        console.log("BasketNFT:", address(basketNFT));
        console.log("Facade:", address(facade));
        console.log("Pyth Oracle:", PYTH_ADDRESS);
        console.log("\n=== PRICE FEED STATUS ===");
        console.log("ETH/USD: WORKING");
        console.log("USDC/USD: WORKING (used for fUSD)");
        console.log("EUR/USD: WORKING");
        console.log("GBP/USD: WORKING");
        console.log("JPY/USD, CHF/USD, INR/USD: Fallback feeds");
    }
}
