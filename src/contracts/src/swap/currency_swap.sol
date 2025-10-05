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

    constructor(address _pyth) {
        pyth = IPyth(_pyth);
    }

    function registerToken(
        string calldata symbol,
        address tokenAddr,
        bytes32 priceFeedId
    ) external {
        // Allow zero address only for ETH (native currency)
        if (keccak256(bytes(symbol)) == keccak256(bytes("ETH"))) {
            require(tokenAddr == address(0), "ETH must have zero address");
        } else {
            require(tokenAddr != address(0), "zero token");
        }

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

        int256 price = px.price;
        int32 e = px.expo;
        expo = uint8(uint32(int32(e < 0 ? -e : e)));
        if (e < 0) {
            uint256 factor = 10 ** (uint256(18) - uint256(uint32(-e)));
            priceScaled = int256(
                (uint256(int256(price < 0 ? -price : price)) * factor)
            );
            if (price < 0) priceScaled = -priceScaled;
        } else {
            uint256 factor = 10 ** (uint256(18) + uint256(uint32(e)));
            priceScaled = int256(
                uint256(int256(price < 0 ? -price : price)) * factor
            );
            if (price < 0) priceScaled = -priceScaled;
        }
    }

    // NEW: Function specifically for ETH to token exchange rate
    function getETHToTokenRate(
        string memory targetSymbol
    ) public view returns (uint256 rateScaled) {
        // Only check that ETH and target token have price feeds
        require(
            priceFeedIds["ETH"] != bytes32(0),
            "ETH price feed not registered"
        );
        require(
            priceFeedIds[targetSymbol] != bytes32(0),
            "target token price feed not registered"
        );
        require(
            tokens[targetSymbol] != address(0),
            "target token not registered"
        );

        (int256 ethPrice, ) = getPriceScaled("ETH");
        (int256 targetPrice, ) = getPriceScaled(targetSymbol);
        require(ethPrice > 0 && targetPrice > 0, "invalid price data");

        rateScaled =
            (uint256(int256(ethPrice)) * SCALE) /
            uint256(int256(targetPrice));
    }

    // NEW: Function specifically for ETH to token swap
    function swapETHToToken(
        string calldata targetSymbol
    ) external payable returns (uint256 amountToSend) {
        require(msg.value > 0, "zero ETH amount");
        require(
            tokens[targetSymbol] != address(0),
            "target token not registered"
        );

        uint256 rate = getETHToTokenRate(targetSymbol);
        amountToSend = (msg.value * rate) / SCALE;

        address targetTokenAddr = tokens[targetSymbol];
        uint256 reserveBalance = ISwapToken(targetTokenAddr).reserveBalance();
        require(
            reserveBalance >= amountToSend,
            "not enough reserve for target token"
        );

        ISwapToken(targetTokenAddr).swapTransfer(msg.sender, amountToSend);

        emit ETHSwapped(msg.sender, targetSymbol, msg.value, amountToSend);
    }

    // Original function for token-to-token swaps (unchanged)
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
