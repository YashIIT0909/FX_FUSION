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
    }

    mapping(uint256 => BasketItem[]) public basketItems;
    mapping(uint256 => string) private _tokenURIs;

    event BasketMinted(address indexed owner, uint256 tokenId);

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
        string calldata metadataURI
    ) external returns (uint256) {
        require(msg.sender == facade, "only facade");
        require(
            tokens.length == amounts.length && tokens.length > 0,
            "invalid basket"
        );

        _tokenIdCounter++;
        uint256 tid = _tokenIdCounter;

        // Store basket items
        for (uint256 i = 0; i < tokens.length; i++) {
            basketItems[tid].push(
                BasketItem({token: tokens[i], amount: amounts[i]})
            );
        }

        // Store metadata URI if provided
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tid] = metadataURI;
        }

        // CRITICAL: Actually mint the NFT to the owner
        _mint(owner, tid);

        emit BasketMinted(owner, tid);
        return tid;
    }

    function getBasket(
        uint256 tokenId
    )
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        uint256 n = basketItems[tokenId].length;
        tokens = new address[](n);
        amounts = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            tokens[i] = basketItems[tokenId][i].token;
            amounts[i] = basketItems[tokenId][i].amount;
        }

        // CRITICAL: Actually return the values
        return (tokens, amounts);
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
