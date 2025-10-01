// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../swap/currency_swap.sol";
import "../basket/basketNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Facade {
    CurrencySwap public currencySwap;
    BasketNFT public basketNft;

    mapping(string => address) public tokens;

    constructor(address currencySwapAddr, address basketNftAddr) {
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

    function buyMockFiat(
        string calldata nativeSymbol,
        string calldata targetSymbol
    ) external payable {
        require(msg.value > 0, "send native currency");
        uint256 nativeAmount = msg.value;

        uint256 rateScaled = currencySwap.getExchangeRate(
            nativeSymbol,
            targetSymbol
        );
        uint256 tokensToSend = (nativeAmount * rateScaled) / 1e18;

        address targetTokenAddr = tokens[targetSymbol];
        require(targetTokenAddr != address(0), "unregistered target");

        ISwapToken(targetTokenAddr).swapTransfer(msg.sender, tokensToSend);
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
        require(
            toSymbols.length == percentages.length && toSymbols.length > 0,
            "invalid basket data"
        );
        uint256 sum = 0;
        for (uint256 i = 0; i < percentages.length; i++) sum += percentages[i];
        require(sum == 10000, "percent must sum to 10000");

        address fromTokenAddr = tokens[fromSymbol];
        require(fromTokenAddr != address(0), "unregistered from token");

        IERC20(fromTokenAddr).transferFrom(
            msg.sender,
            address(this),
            fromAmount
        );

        address[] memory basketTokens = new address[](toSymbols.length);
        uint256[] memory basketAmounts = new uint256[](toSymbols.length);

        IERC20(fromTokenAddr).approve(address(currencySwap), fromAmount);

        for (uint256 i = 0; i < toSymbols.length; i++) {
            string memory toSym = toSymbols[i];
            uint256 share = (fromAmount * percentages[i]) / 10000;

            uint256 preBalance = IERC20(tokens[toSym]).balanceOf(address(this));
            currencySwap.swapTokens(fromSymbol, toSym, share);
            uint256 postBalance = IERC20(tokens[toSym]).balanceOf(
                address(this)
            );
            uint256 got = postBalance - preBalance;

            basketTokens[i] = tokens[toSym];
            basketAmounts[i] = got;
        }

        basketNft.mintBasket(
            msg.sender,
            basketTokens,
            basketAmounts,
            metadataURI
        );
    }
}
