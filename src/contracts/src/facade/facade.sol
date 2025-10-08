// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../swap/currency_swap.sol";
import "../basket/basketNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Facade {
    CurrencySwap public currencySwap;
    BasketNFT public basketNft;

    mapping(string => address) public tokens;

    // Events for tracking real data
    event BasketCreated(
        address indexed owner,
        uint256 indexed tokenId,
        string baseCurrency,
        uint256 initialValue,
        uint256 lockEndTimestamp
    );
    event TokensSwapped(
        string fromSymbol,
        string toSymbol,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 timestamp
    );

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

    error TokenNotRegistered(string symbol);
    error InvalidAmount();
    error InvalidAllocation();

    receive() external payable {}

    function buyFiatWithETH(string calldata targetSymbol) external payable {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        if (tokens[targetSymbol] == address(0)) {
            revert TokenNotRegistered(targetSymbol);
        }

        IERC20 targetToken = IERC20(tokens[targetSymbol]);
        uint256 balanceBefore = targetToken.balanceOf(address(this));

        // Perform the swap through CurrencySwap contract
        currencySwap.swapETHToToken{value: msg.value}(targetSymbol);

        uint256 balanceAfter = targetToken.balanceOf(address(this));
        uint256 tokensReceived = balanceAfter - balanceBefore;

        require(tokensReceived > 0, "No tokens received from swap");
        targetToken.transfer(msg.sender, tokensReceived);
    }

    function mintBasketFromToken(
        string calldata fromSymbol,
        uint256 fromAmount,
        string[] calldata toSymbols,
        uint16[] calldata percentages,
        string calldata metadataURI
    ) external {
        _validateBasketData(fromSymbol, toSymbols, percentages, fromAmount);

        address fromTokenAddr = tokens[fromSymbol];
        IERC20(fromTokenAddr).transferFrom(
            msg.sender,
            address(this),
            fromAmount
        );
        IERC20(fromTokenAddr).approve(address(currencySwap), fromAmount);

        // Get initial prices from the swap contract for real price tracking
        uint256[] memory initialPrices = new uint256[](toSymbols.length);

        (
            address[] memory basketTokens,
            uint256[] memory basketAmounts
        ) = _performSwapsWithPriceTracking(
                fromSymbol,
                fromAmount,
                toSymbols,
                percentages,
                initialPrices
            );

        // Parse lock duration from metadata (default 30 days)
        uint256 lockDurationDays = _parseLockDuration(metadataURI);

        // Mint the NFT with all required data
        uint256 tokenId = basketNft.mintBasket(
            msg.sender,
            basketTokens,
            basketAmounts,
            initialPrices,
            percentages,
            fromSymbol,
            lockDurationDays,
            metadataURI
        );

        // Calculate initial value for event
        uint256 initialValue = 0;
        for (uint i = 0; i < basketAmounts.length; i++) {
            initialValue += (basketAmounts[i] * initialPrices[i]) / 1e18;
        }

        emit BasketCreated(
            msg.sender,
            tokenId,
            fromSymbol,
            initialValue,
            block.timestamp + (lockDurationDays * 1 days)
        );
    }

    function _validateBasketData(
        string calldata fromSymbol,
        string[] calldata toSymbols,
        uint16[] calldata percentages,
        uint256 fromAmount
    ) private view {
        require(tokens[fromSymbol] != address(0), "From token not registered");
        require(fromAmount > 0, "Invalid from amount");
        require(
            toSymbols.length == percentages.length && toSymbols.length > 0,
            "Invalid basket data"
        );

        // Validate all target tokens are registered
        for (uint i = 0; i < toSymbols.length; i++) {
            require(
                tokens[toSymbols[i]] != address(0),
                "Target token not registered"
            );
        }

        // Validate percentages sum to 100% (10000 basis points)
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            require(percentages[i] > 0, "Invalid percentage");
            totalPercentage += percentages[i];
        }
        require(totalPercentage == 10000, "Percentages must sum to 100%");
    }

    function _performSwapsWithPriceTracking(
        string calldata fromSymbol,
        uint256 fromAmount,
        string[] calldata toSymbols,
        uint16[] calldata percentages,
        uint256[] memory initialPrices
    )
        private
        returns (address[] memory basketTokens, uint256[] memory basketAmounts)
    {
        basketTokens = new address[](toSymbols.length);
        basketAmounts = new uint256[](toSymbols.length);

        for (uint256 i = 0; i < toSymbols.length; i++) {
            basketTokens[i] = tokens[toSymbols[i]];
            uint256 swapAmount = (fromAmount * percentages[i]) / 10000;

            uint256 preBalance = IERC20(basketTokens[i]).balanceOf(
                address(this)
            );

            // Perform the swap
            currencySwap.swapTokens(fromSymbol, toSymbols[i], swapAmount);

            uint256 postBalance = IERC20(basketTokens[i]).balanceOf(
                address(this)
            );
            basketAmounts[i] = postBalance - preBalance;

            // Calculate and store the actual exchange rate achieved
            initialPrices[i] = basketAmounts[i] > 0
                ? (swapAmount * 1e18) / basketAmounts[i]
                : 1e18; // Default rate if no tokens received

            // Emit swap event for tracking
            emit TokensSwapped(
                fromSymbol,
                toSymbols[i],
                swapAmount,
                basketAmounts[i],
                block.timestamp
            );
        }
    }

    function _parseLockDuration(
        string calldata /* metadataURI */
    ) private pure returns (uint256) {
        // In a real implementation, you'd parse the JSON metadata
        // For now, return default 30 days
        // TODO: Implement JSON parsing to extract lockDuration
        return 30;
    }

    // View functions for getting current exchange rates
    function getCurrentExchangeRate(
        string calldata /* fromSymbol */,
        string calldata /* toSymbol */
    ) external pure returns (uint256) {
        // This would call the CurrencySwap contract to get current rates
        // Implementation depends on your CurrencySwap contract's interface
        return 1e18; // Placeholder
    }

    // Emergency functions
    function withdrawToken(string calldata symbol, uint256 amount) external {
        require(tokens[symbol] != address(0), "Token not registered");
        IERC20(tokens[symbol]).transfer(msg.sender, amount);
    }

    function getContractBalance(
        string calldata symbol
    ) external view returns (uint256) {
        require(tokens[symbol] != address(0), "Token not registered");
        return IERC20(tokens[symbol]).balanceOf(address(this));
    }
}
