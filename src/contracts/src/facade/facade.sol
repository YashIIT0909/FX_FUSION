// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../swap/currency_swap.sol";
import "../basket/basketNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Facade {
    CurrencySwap public currencySwap;
    BasketNFT public basketNft;

    mapping(string => address) public tokens;

    // Fix: Change to payable address
    constructor(address payable currencySwapAddr, address basketNftAddr) {
        currencySwap = CurrencySwap(currencySwapAddr);
        basketNft = BasketNFT(basketNftAddr);
    }

    function registerToken(
        string calldata symbol,
        address tokenAddr,
        bytes32 priceFeedId
    ) external {
        tokens[symbol] = tokenAddr;
        currencySwap.registerToken(symbol, tokenAddr, priceFeedId);
    }

    // Add custom errors
    error TokenNotRegistered(string symbol);
    error InvalidAmount();

    // Add receive function to accept ETH
    receive() external payable {
        // Contract can receive ETH
    }

    // NEW: Simplified function for buying fiat tokens with ETH
    function buyFiatWithETH(string calldata targetSymbol) external payable {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        if (tokens[targetSymbol] == address(0)) {
            revert TokenNotRegistered(targetSymbol);
        }

        currencySwap.swapETHToToken{value: msg.value}(targetSymbol);
    }

    function swapTokens(
        string calldata fromSymbol,
        string calldata toSymbol,
        uint256 amount
    ) external {
        currencySwap.swapTokens(fromSymbol, toSymbol, amount);
    }

    function mintBasketFromToken(
        string calldata fromSymbol,
        uint256 fromAmount,
        string[] calldata toSymbols,
        uint16[] calldata percentages,
        string calldata metadataURI
    ) external {
        _validateBasketData(toSymbols, percentages);

        address fromTokenAddr = tokens[fromSymbol];
        require(fromTokenAddr != address(0), "unregistered from token");

        IERC20(fromTokenAddr).transferFrom(
            msg.sender,
            address(this),
            fromAmount
        );
        IERC20(fromTokenAddr).approve(address(currencySwap), fromAmount);

        (
            address[] memory basketTokens,
            uint256[] memory basketAmounts
        ) = _performSwaps(fromSymbol, fromAmount, toSymbols, percentages);

        basketNft.mintBasket(
            msg.sender,
            basketTokens,
            basketAmounts,
            metadataURI
        );
    }

    function _validateBasketData(
        string[] calldata toSymbols,
        uint16[] calldata percentages
    ) private pure {
        require(
            toSymbols.length == percentages.length && toSymbols.length > 0,
            "invalid basket data"
        );

        uint256 sum = 0;
        for (uint256 i = 0; i < percentages.length; i++) sum += percentages[i];
        require(sum == 10000, "percent must sum to 10000");
    }

    function _performSwaps(
        string calldata fromSymbol,
        uint256 fromAmount,
        string[] calldata toSymbols,
        uint16[] calldata percentages
    )
        private
        returns (address[] memory basketTokens, uint256[] memory basketAmounts)
    {
        basketTokens = new address[](toSymbols.length);
        basketAmounts = new uint256[](toSymbols.length);

        for (uint256 i = 0; i < toSymbols.length; i++) {
            basketTokens[i] = tokens[toSymbols[i]];
            uint256 preBalance = IERC20(basketTokens[i]).balanceOf(
                address(this)
            );

            currencySwap.swapTokens(
                fromSymbol,
                toSymbols[i],
                (fromAmount * percentages[i]) / 10000
            );

            basketAmounts[i] =
                IERC20(basketTokens[i]).balanceOf(address(this)) -
                preBalance;
        }
    }
}
