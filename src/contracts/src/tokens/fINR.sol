// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract fINR is ERC20 {
    constructor() ERC20("flowINR", "fINR") {
        _mint(address(this), 1_000_000_000 * 10 ** decimals());
    }

    function buyTokens(uint256 rate) external payable {
        require(msg.value > 0, "Send ETH to buy fINR");

        uint256 tokensToBuy = (msg.value * rate) / 1e18;
        require(
            balanceOf(address(this)) >= tokensToBuy,
            "Not enough fINR in contract"
        );
        _transfer(address(this), msg.sender, tokensToBuy);
    }

    function sellTokens(uint256 tokenAmount, uint256 rate) external {
        require(tokenAmount > 0, "Specify an amount of fINR to sell");
        require(
            balanceOf(msg.sender) >= tokenAmount,
            "You don't have enough fINR"
        );

        uint256 etherToReturn = (tokenAmount * 1e18) / rate;
        require(
            address(this).balance >= etherToReturn,
            "Not enough ETH in contract"
        );

        _transfer(msg.sender, address(this), tokenAmount);
        payable(msg.sender).transfer(etherToReturn);
    }
}
