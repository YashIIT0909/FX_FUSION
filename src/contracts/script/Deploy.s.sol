//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/swap/currency_swap.sol";
import "../src/basket/basketNFT.sol";
import "../src/facade/facade.sol";
import "../src/tokens/MockFiat.sol";

contract DeployScript is Script {
    // Pyth Oracle address for Ethereum Sepolia testnet
    address constant PYTH_ADDRESS = 0xDd24F84d36BF92C65F92307595335bdFab5Bbd21;

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

        Facade facade = new Facade(address(currencySwap), address(basketNFT));
        console.log("Facade deployed at:", address(facade));

        // Set facade in BasketNFT
        basketNFT.setFacade(address(facade));
        console.log("Facade set in BasketNFT");

        // ===== STEP 1.5: REGISTER ETH WITH ADDRESS(0) =====
        facade.registerToken(
            "ETH",
            address(0), // ETH uses zero address
            0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace // ETH/USD price feed
        );
        console.log("ETH registered with facade at address(0)");

        // ===== STEP 2: DEPLOY AND REGISTER FIAT TOKENS =====
        Currency[] memory currencies = new Currency[](6);
        currencies[0] = Currency({
            name: "Fake US Dollar",
            symbol: "fUSD",
            priceFeedId: 0xeaa020c61cc479712813461ce153894a96a6c00b21fe15d5e9a76c78ddb9c50e
        });
        currencies[1] = Currency({
            name: "Fake Euro",
            symbol: "fEUR",
            priceFeedId: 0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b
        });
        currencies[2] = Currency({
            name: "Fake British Pound",
            symbol: "fGBP",
            priceFeedId: 0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1
        });
        currencies[3] = Currency({
            name: "Fake Japanese Yen",
            symbol: "fYEN",
            priceFeedId: 0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52
        });
        currencies[4] = Currency({
            name: "Fake Swiss Franc",
            symbol: "fCHF",
            priceFeedId: 0x0b1e3297e69f162877b577b0b9a47508bfd7357ae086aa21bff4dcfa8155e24e
        });
        currencies[5] = Currency({
            name: "Fake Indian Rupee",
            symbol: "fINR",
            priceFeedId: 0x605d5c2fbd7cc4f5a28cd621202e20dfb1c7d335696b15c3e5027c0ac64bb1ab
        });

        // Deploy and register fiat tokens (excluding ETH)
        for (uint i = 0; i < currencies.length; i++) {
            // Deploy ERC20 token
            MockFiatToken token = new MockFiatToken(
                currencies[i].name,
                currencies[i].symbol
            );

            token.setSwapContract(address(currencySwap));

            console.log(
                string.concat(currencies[i].symbol, " deployed at:"),
                address(token)
            );

            // Register the deployed token
            facade.registerToken(
                currencies[i].symbol,
                address(token),
                currencies[i].priceFeedId
            );

            console.log(
                string.concat(
                    "Registered ",
                    currencies[i].symbol,
                    " with facade"
                )
            );
        }

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Ethereum Sepolia Testnet");
        console.log("CurrencySwap:", address(currencySwap));
        console.log("BasketNFT:", address(basketNFT));
        console.log("Facade:", address(facade));
        console.log("Pyth Oracle:", PYTH_ADDRESS);

        console.log("\n=== REGISTERED TOKENS ===");
        console.log("ETH: address(0) - Native Sepolia ETH");
        console.log("All fiat tokens deployed and registered");

        console.log("\n=== USAGE ===");
        console.log("Users send native Sepolia ETH to buy fiat tokens");
        console.log("ETH is registered with address(0) for price feed access");
    }
}
