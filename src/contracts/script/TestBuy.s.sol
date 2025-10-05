//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/facade/facade.sol";

contract TestBuyScript is Script {
    address constant FACADE_ADDRESS =
        0x6fed5f6895b2D95dA607564B0437cEdebf4cA535;

    function run() external {
        vm.startBroadcast();

        Facade facade = Facade(payable(FACADE_ADDRESS));

        console.log("=== Testing buyFiatWithETH ===");
        console.log("Sender address:", msg.sender);
        console.log("Sender ETH balance:", msg.sender.balance);

        // Test with small amounts for working tokens
        string[4] memory workingTokens = ["fUSD", "fEUR", "fGBP", "fYEN"];

        for (uint i = 0; i < workingTokens.length; i++) {
            console.log(string.concat("Testing ", workingTokens[i], "..."));

            try facade.buyFiatWithETH{value: 0.001 ether}(workingTokens[i]) {
                console.log(
                    string.concat(
                        "SUCCESS: ",
                        workingTokens[i],
                        " purchase worked!"
                    )
                );
            } catch Error(string memory reason) {
                console.log(
                    string.concat("ERROR with ", workingTokens[i], ": "),
                    reason
                );
            } catch (bytes memory lowLevelData) {
                console.log(
                    string.concat(
                        "LOW LEVEL ERROR with ",
                        workingTokens[i],
                        ": "
                    ),
                    vm.toString(lowLevelData)
                );
            }
        }

        vm.stopBroadcast();
    }
}
