// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract BasketNFT is ERC721, ERC721Enumerable {
    uint256 private _tokenIdCounter;
    address public facade;

    struct BasketItem {
        address token;
        uint256 amount;
        uint256 initialPrice; // Price at creation time (in wei, scaled by 1e18)
        uint16 allocationPercentage; // Percentage allocated (in basis points)
    }

    struct BasketInfo {
        string baseCurrency; // The currency everything is measured against
        uint256 initialValue; // Total initial value in base currency
        uint256 lockEndTimestamp; // When the lock period ends
        bool isActive; // Whether the basket is active
        uint256 createdAt; // Creation timestamp
    }

    mapping(uint256 => BasketItem[]) public basketItems;
    mapping(uint256 => BasketInfo) public basketInfo;
    mapping(uint256 => string) private _tokenURIs;

    event BasketMinted(
        address indexed owner,
        uint256 tokenId,
        string baseCurrency,
        uint256 lockEndTimestamp
    );
    event BasketUnlocked(uint256 tokenId);

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {}

    function setFacade(address _facade) external {
        require(facade == address(0), "facade already set");
        require(_facade != address(0), "zero");
        facade = _facade;
    }

    function mintBasket(
        address owner,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata initialPrices,
        uint16[] calldata allocationPercentages,
        string calldata baseCurrency,
        uint256 lockDurationDays,
        string calldata metadataURI
    ) external returns (uint256) {
        require(msg.sender == facade, "only facade");
        require(
            tokens.length == amounts.length && tokens.length > 0,
            "invalid basket"
        );
        require(
            tokens.length == initialPrices.length,
            "prices length mismatch"
        );
        require(
            tokens.length == allocationPercentages.length,
            "allocations length mismatch"
        );

        _tokenIdCounter++;
        uint256 tid = _tokenIdCounter;

        // Calculate total initial value
        uint256 totalInitialValue = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalInitialValue += (amounts[i] * initialPrices[i]) / 1e18;
        }

        // Store basket items with allocation info
        for (uint256 i = 0; i < tokens.length; i++) {
            basketItems[tid].push(
                BasketItem({
                    token: tokens[i],
                    amount: amounts[i],
                    initialPrice: initialPrices[i],
                    allocationPercentage: allocationPercentages[i]
                })
            );
        }

        // Store basket info
        basketInfo[tid] = BasketInfo({
            baseCurrency: baseCurrency,
            initialValue: totalInitialValue,
            lockEndTimestamp: block.timestamp + (lockDurationDays * 1 days),
            isActive: true,
            createdAt: block.timestamp
        });

        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tid] = metadataURI;
        }

        _mint(owner, tid);

        emit BasketMinted(
            owner,
            tid,
            baseCurrency,
            basketInfo[tid].lockEndTimestamp
        );
        return tid;
    }

    function getBasket(
        uint256 tokenId
    )
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory amounts,
            uint256[] memory initialPrices,
            uint16[] memory allocationPercentages
        )
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        uint256 n = basketItems[tokenId].length;
        tokens = new address[](n);
        amounts = new uint256[](n);
        initialPrices = new uint256[](n);
        allocationPercentages = new uint16[](n);

        for (uint256 i = 0; i < n; i++) {
            BasketItem memory item = basketItems[tokenId][i];
            tokens[i] = item.token;
            amounts[i] = item.amount;
            initialPrices[i] = item.initialPrice;
            allocationPercentages[i] = item.allocationPercentage;
        }

        return (tokens, amounts, initialPrices, allocationPercentages);
    }

    function getBasketInfo(
        uint256 tokenId
    ) external view returns (BasketInfo memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return basketInfo[tokenId];
    }

    function isBasketLocked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return block.timestamp < basketInfo[tokenId].lockEndTimestamp;
    }

    function unlockBasket(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not basket owner");
        require(
            block.timestamp >= basketInfo[tokenId].lockEndTimestamp,
            "Still locked"
        );

        basketInfo[tokenId].isActive = false;
        emit BasketUnlocked(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            _ownerOf(tokenId) != address(0),
            "URI query for nonexistent token"
        );
        return _tokenURIs[tokenId];
    }

    // Required overrides for ERC721Enumerable
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
