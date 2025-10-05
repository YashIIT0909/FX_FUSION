// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

interface ISwapToken {
    function swapReceive(address from, uint256 amount) external;

    function swapTransfer(address to, uint256 amount) external;

    function reserveBalance() external view returns (uint256);
}

contract CurrencySwap {
    uint256 public constant SCALE = 1e18;

    mapping(string => address) public tokens;

    mapping(string => bytes32) public priceFeedIds;

    IPyth public immutable pyth;

    // Hardcode ETH price feed (we know this works)
    bytes32 constant ETH_PRICE_FEED =
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    // Use USDC as USD reference (since USDC/USD works and is ~$1)
    bytes32 constant USD_REFERENCE_FEED =
        0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;

    event TokenRegistered(
        string symbol,
        address tokenAddr,
        bytes32 priceFeedId
    );
    event Swapped(
        address indexed user,
        string fromSym,
        string toSym,
        uint256 fromAmount,
        uint256 toAmount
    );
    event ETHSwapped(
        address indexed user,
        string toSym,
        uint256 ethAmount,
        uint256 tokenAmount
    );

    // Add custom errors for better debugging
    error TokenNotRegistered(string symbol);
    error InsufficientReserve(uint256 requested, uint256 available);
    error InvalidAmount();
    error PriceFeedNotFound(string symbol);
    error InvalidPriceData(string symbol);

    constructor(address _pyth) {
        pyth = IPyth(_pyth);
    }

    receive() external payable {}

    function registerToken(
        string calldata symbol,
        address tokenAddr,
        bytes32 priceFeedId
    ) external {
        require(tokenAddr != address(0), "zero token");
        tokens[symbol] = tokenAddr;
        priceFeedIds[symbol] = priceFeedId;
        emit TokenRegistered(symbol, tokenAddr, priceFeedId);
    }

    function getPriceScaled(
        string memory symbol
    ) public view returns (int256 priceScaled, uint8 expo) {
        bytes32 id = priceFeedIds[symbol];
        require(id != bytes32(0), "no price feed for symbol");

        PythStructs.Price memory px = pyth.getPriceUnsafe(id);
        return _processPrice(px, symbol);
    }

    function _getPriceFromFeed(
        bytes32 priceFeedId,
        string memory symbol
    ) private view returns (int256 priceScaled, uint8 expo) {
        PythStructs.Price memory px = pyth.getPriceUnsafe(priceFeedId);
        return _processPrice(px, symbol);
    }

    function _processPrice(
        PythStructs.Price memory px,
        string memory symbol
    ) private pure returns (int256 priceScaled, uint8 expo) {
        int256 price = px.price;
        int32 e = px.expo;

        if (price <= 0) {
            revert InvalidPriceData(symbol);
        }

        expo = uint8(uint32(int32(e < 0 ? -e : e)));

        if (e < 0) {
            // Convert to 18 decimal format
            uint256 factor = 10 ** (uint256(18) - uint256(uint32(-e)));
            priceScaled = int256(uint256(int256(price)) * factor);
        } else {
            uint256 factor = 10 ** (uint256(18) + uint256(uint32(e)));
            priceScaled = int256(uint256(int256(price)) * factor);
        }
    }

    // Updated to use working price feeds
    function getETHToTokenRate(
        string memory targetSymbol
    ) public view returns (uint256 rateScaled) {
        if (tokens[targetSymbol] == address(0)) {
            revert TokenNotRegistered(targetSymbol);
        }

        // Get ETH price in USD (we know this works)
        (int256 ethPrice, ) = _getPriceFromFeed(ETH_PRICE_FEED, "ETH");

        if (ethPrice <= 0) {
            revert InvalidPriceData("ETH");
        }

        // For fUSD, use USDC as reference since it's ~$1
        if (keccak256(bytes(targetSymbol)) == keccak256(bytes("fUSD"))) {
            (int256 usdcPrice, ) = _getPriceFromFeed(
                USD_REFERENCE_FEED,
                "USDC"
            );
            if (usdcPrice <= 0) {
                revert InvalidPriceData("USDC");
            }
            // ETH price / USDC price = how many USDC (≈USD) per ETH
            rateScaled = (uint256(ethPrice) * SCALE) / uint256(usdcPrice);
        }
        // For other tokens, use their direct price feeds
        else {
            bytes32 targetPriceFeed = priceFeedIds[targetSymbol];
            if (targetPriceFeed == bytes32(0)) {
                revert PriceFeedNotFound(targetSymbol);
            }

            (int256 targetPrice, ) = _getPriceFromFeed(
                targetPriceFeed,
                targetSymbol
            );
            if (targetPrice <= 0) {
                revert InvalidPriceData(targetSymbol);
            }

            // ETH price / target price = how many target tokens per ETH
            rateScaled = (uint256(ethPrice) * SCALE) / uint256(targetPrice);
        }
    }

    function swapETHToToken(
        string calldata targetSymbol
    ) external payable returns (uint256 amountToSend) {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        address targetTokenAddr = tokens[targetSymbol];
        if (targetTokenAddr == address(0)) {
            revert TokenNotRegistered(targetSymbol);
        }

        uint256 rate = getETHToTokenRate(targetSymbol);
        amountToSend = (msg.value * rate) / SCALE;

        uint256 reserveBalance = ISwapToken(targetTokenAddr).reserveBalance();
        if (reserveBalance < amountToSend) {
            revert InsufficientReserve(amountToSend, reserveBalance);
        }

        ISwapToken(targetTokenAddr).swapTransfer(msg.sender, amountToSend);

        emit ETHSwapped(msg.sender, targetSymbol, msg.value, amountToSend);
    }

    function getExchangeRate(
        string memory fromSymbol,
        string memory toSymbol
    ) public view returns (uint256 rateScaled) {
        require(
            tokens[fromSymbol] != address(0) && tokens[toSymbol] != address(0),
            "unregistered symbol"
        );
        (int256 priceFrom, ) = getPriceScaled(fromSymbol);
        (int256 priceTo, ) = getPriceScaled(toSymbol);
        require(priceFrom > 0 && priceTo > 0, "invalid price data");
        rateScaled =
            (uint256(int256(priceFrom)) * SCALE) /
            uint256(int256(priceTo));
    }

    function swapTokens(
        string calldata fromSymbol,
        string calldata toSymbol,
        uint256 amount
    ) external returns (uint256 amountToSend) {
        require(amount > 0, "zero amount");
        require(
            keccak256(bytes(fromSymbol)) != keccak256(bytes(toSymbol)),
            "same token"
        );

        address fromTokenAddr = tokens[fromSymbol];
        address toTokenAddr = tokens[toSymbol];
        require(
            fromTokenAddr != address(0) && toTokenAddr != address(0),
            "invalid token"
        );

        IERC20(fromTokenAddr).transferFrom(msg.sender, address(this), amount);
        IERC20(fromTokenAddr).transfer(fromTokenAddr, amount);

        uint256 rate = getExchangeRate(fromSymbol, toSymbol);
        amountToSend = (amount * rate) / SCALE;

        uint256 reserveBalance = IERC20(toTokenAddr).balanceOf(toTokenAddr);
        require(
            reserveBalance >= amountToSend,
            "not enough reserve for target token"
        );
        ISwapToken(toTokenAddr).swapTransfer(msg.sender, amountToSend);

        emit Swapped(msg.sender, fromSymbol, toSymbol, amount, amountToSend);
    }
}
