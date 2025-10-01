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

    // token symbol => token contract
    mapping(string => address) public tokens;

    // symbol => Pyth price feed id (bytes32)
    mapping(string => bytes32) public priceFeedIds;

    // Pyth oracle contract
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

    constructor(address _pyth) {
        pyth = IPyth(_pyth);
    }

    /// @notice Register token + price feed id (callable by deployer/owner in production).
    /// For simplicity here we allow anyone to call (you can add Ownable if needed).
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

    /// @notice Get price from pyth for a symbol (returns price scaled to 1e18 for ease).
    /// Pyth returns (price, expo) where real price = price * 10^expo. We convert to 1e18 scale.
    function getPriceScaled(
        string memory symbol
    ) public view returns (int256 priceScaled, uint8 expo) {
        bytes32 id = priceFeedIds[symbol];
        require(id != bytes32(0), "no price feed for symbol");
        PythStructs.Price memory px = pyth.getPriceUnsafe(id);
        // px.price is int64-like in pyth structs, px.expo is int32 negative sometimes
        // Convert px.price * 10^expo into a 1e18 scaled integer
        // Handling expo: if expo is negative, multiply by 10^(18+expo) etc.
        int256 price = px.price;
        int32 e = px.expo;
        expo = uint8(uint32(int32(e < 0 ? -e : e))); // just pass as info
        // We transform: scaled = price * 10^(18 + expo) if expo < 0 -> 18 - |expo|
        if (e < 0) {
            uint256 factor = 10 ** (uint256(18) - uint256(uint32(-e)));
            priceScaled = int256(
                (uint256(int256(price < 0 ? -price : price)) * factor)
            );
            if (price < 0) priceScaled = -priceScaled;
        } else {
            // expo >= 0
            uint256 factor = 10 ** (uint256(18) + uint256(uint32(e)));
            priceScaled = int256(
                uint256(int256(price < 0 ? -price : price)) * factor
            );
            if (price < 0) priceScaled = -priceScaled;
        }
        // Note: callers should check publishTime/conf if needed
    }

    /// @notice Computes rate: how many units of toSymbol per 1 unit of fromSymbol, scaled by 1e18.
    /// E.g., if 1 CHF = 1.1 USD, returns 1.1 * 1e18
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
        // priceFrom and priceTo are both scaled to 1e18 representing e.g., USD per unit of X depending on feed
        // To get #to per 1 from: rate = priceFrom / priceTo
        // Use 1e18 scaling: rate = (priceFrom * 1e18) / priceTo
        rateScaled =
            (uint256(int256(priceFrom)) * SCALE) /
            uint256(int256(priceTo));
    }

    /// @notice Swap a given `amount` of `fromSymbol` (user must have beforehand approved the swap contract to move their tokens).
    /// Steps:
    /// 1. transfer tokens from user into the fromToken reserve
    /// 2. compute target amount using Pyth provided exchange rate
    /// 3. ensure reserve has enough of toToken
    /// 4. transfer toToken from its reserve to user
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

        // ISwapToken fromToken = ISwapToken(fromTokenAddr);
        // ISwapToken toToken = ISwapToken(toTokenAddr);

        // Move user's fromToken into reserve: we expect user has approved this contract
        // Note: due to visibility, we will call ERC20.transferFrom directly on fromToken
        IERC20(fromTokenAddr).transferFrom(msg.sender, address(this), amount);
        // Now move transferred tokens into the token contract reserve by calling swapTransfer from this contract to token contract
        // But our token design had swapReceive(address from, uint256 amount) with only swapContract allowed.
        // To keep simple: token reserves are managed by token contract address; but here we are temporarily holding tokens.
        // We'll transfer the tokens to the token contract reserve now:
        IERC20(fromTokenAddr).transfer(fromTokenAddr, amount);

        // Compute rate using Pyth
        uint256 rate = getExchangeRate(fromSymbol, toSymbol); // scaled 1e18
        // amountToSend = (amount * rate) / 1e18
        amountToSend = (amount * rate) / SCALE;

        // Ensure toToken reserve has enough
        uint256 reserveBalance = IERC20(toTokenAddr).balanceOf(toTokenAddr);
        require(
            reserveBalance >= amountToSend,
            "not enough reserve for target token"
        );

        // Now call token contract to send tokens from its reserve to msg.sender
        ISwapToken(toTokenAddr).swapTransfer(msg.sender, amountToSend);

        emit Swapped(msg.sender, fromSymbol, toSymbol, amount, amountToSend);
    }
}
