// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../swap/currency_swap.sol";
import "../basket/basketNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Facade {
    CurrencySwap public currencySwap;
    BasketNFT public basketNft;

    // symbol => token address (duplicate of currencySwap.tokens but kept here for convenience)
    mapping(string => address) public tokens;

    // constructor receives deployed CurrencySwap (with Pyth address) and BasketNFT
    constructor(address currencySwapAddr, address basketNftAddr) {
        currencySwap = CurrencySwap(currencySwapAddr);
        basketNft = BasketNFT(basketNftAddr);
    }

    /// @notice register token both in Facade and CurrencySwap
    function registerToken(
        string calldata symbol,
        address tokenAddr,
        bytes32 priceFeedId
    ) external {
        tokens[symbol] = tokenAddr;
        currencySwap.registerToken(symbol, tokenAddr, priceFeedId);
    }

    /// @notice Buy mock fiat token using native chain token (payable). This function:
    ///  - reads price via CurrencySwap.getExchangeRate(nativeSymbol, targetSymbol)
    ///  - calculates how many target tokens to send for msg.value
    ///  - sends target tokens from its reserve to buyer by invoking token.swapTransfer
    /// Notes: We assume Pyth has a price feed mapping for native token (e.g., FLOW/native) and target.
    function buyMockFiat(
        string calldata nativeSymbol,
        string calldata targetSymbol
    ) external payable {
        require(msg.value > 0, "send native currency");
        // For simplicity: we treat native currency amount as `amount` in 18 decimals
        uint256 nativeAmount = msg.value;

        uint256 rateScaled = currencySwap.getExchangeRate(
            nativeSymbol,
            targetSymbol
        ); // scaled 1e18
        // tokensToSend = nativeAmount * rateScaled / 1e18
        uint256 tokensToSend = (nativeAmount * rateScaled) / 1e18;

        address targetTokenAddr = tokens[targetSymbol];
        require(targetTokenAddr != address(0), "unregistered target");

        // We expect the token contract reserve has the tokens and swapContract on token is set to currencySwap
        // Directly instruct token contract to send tokens from its reserve to msg.sender
        ISwapToken(targetTokenAddr).swapTransfer(msg.sender, tokensToSend);
    }

    /// @notice High-level swap wrapper: calls CurrencySwap.swapTokens (which pulls tokens from msg.sender).
    function swapTokens(
        string calldata fromSymbol,
        string calldata toSymbol,
        uint256 amount
    ) external {
        // Note: user must have approved CurrencySwap to spend `amount` of fromToken
        currencySwap.swapTokens(fromSymbol, toSymbol, amount);
    }

    /// @notice Mint a basket NFT by converting `fromSymbol` tokens into a basket of other tokens per `percentages`.
    /// percent array elements are numbers in basis points (0..10000) representing percent*100 (e.g., 2500 = 25.00%).
    /// Example: percentages = [5000,3000,2000] sums to 10000.
    function mintBasketFromToken(
        string calldata fromSymbol,
        uint256 fromAmount,
        string[] calldata toSymbols,
        uint16[] calldata percentages, // basis points per basket token
        string calldata metadataURI
    ) external {
        require(
            toSymbols.length == percentages.length && toSymbols.length > 0,
            "invalid basket data"
        );
        // check sum to 10000
        uint256 sum = 0;
        for (uint256 i = 0; i < percentages.length; i++) sum += percentages[i];
        require(sum == 10000, "percent must sum to 10000");

        // Pull from user: user must approve CurrencySwap or this Facade to take tokens.
        address fromTokenAddr = tokens[fromSymbol];
        require(fromTokenAddr != address(0), "unregistered from token");

        // Transfer from user to this Facade first
        IERC20(fromTokenAddr).transferFrom(
            msg.sender,
            address(this),
            fromAmount
        );

        // Now for each target token, compute its share and call currencySwap.swapTokens to swap.
        // To make currencySwap pull tokens, we first need to forward tokens from this contract to currencySwap.
        // So this contract will approve/transfer tokens to currencySwap as needed.
        // We'll keep arrays to pass to NFT.
        address[] memory basketTokens = new address[](toSymbols.length);
        uint256[] memory basketAmounts = new uint256[](toSymbols.length);

        // For safety, set approval for currencySwap to move tokens from this contract
        IERC20(fromTokenAddr).approve(address(currencySwap), fromAmount);

        for (uint256 i = 0; i < toSymbols.length; i++) {
            string memory toSym = toSymbols[i];
            uint256 share = (fromAmount * percentages[i]) / 10000; // amount of fromToken to convert to this symbol

            // Call currencySwap.swapTokens(fromSymbol, toSym, share) — currencySwap expects caller to be the user, but here
            // it's called from Facade, so currencySwap will transferFrom Facade to token reserves (we approved it).
            uint256 preBalance = IERC20(tokens[toSym]).balanceOf(address(this));
            currencySwap.swapTokens(fromSymbol, toSym, share);
            // after swap, currencySwap transferred target tokens to msg.sender originally; but in our CurrencySwap implementation
            // it transferred tokens to msg.sender of swapTokens call. Because we call via Facade, tokens will be sent to Facade.
            uint256 postBalance = IERC20(tokens[toSym]).balanceOf(
                address(this)
            );
            uint256 got = postBalance - preBalance;

            basketTokens[i] = tokens[toSym];
            basketAmounts[i] = got;
        }

        // Now mint NFT to msg.sender with basket composition
        basketNft.mintBasket(
            msg.sender,
            basketTokens,
            basketAmounts,
            metadataURI
        );

        // (Optional) any dust handling or refund of leftover tokens can be done here
    }
}
