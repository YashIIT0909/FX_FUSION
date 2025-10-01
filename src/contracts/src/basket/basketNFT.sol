// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BasketNFT is ERC721 {
    uint256 private _tokenIdCounter;

    address public facade;

    struct BasketItem {
        address token;
        uint256 amount;
    }

    mapping(uint256 => BasketItem[]) public basketItems;

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
        for (uint256 i = 0; i < tokens.length; i++) {
            basketItems[tid].push(
                BasketItem({token: tokens[i], amount: amounts[i]})
            );
        }

        if (bytes(metadataURI).length > 0) {}

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
        uint256 n = basketItems[tokenId].length;
        tokens = new address[](n);
        amounts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            tokens[i] = basketItems[tokenId][i].token;
            amounts[i] = basketItems[tokenId][i].amount;
        }
    }
}
