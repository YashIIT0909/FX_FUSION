// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFiatToken is ERC20 {
    address public swapContract;
    bool public swapContractSet;

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        uint256 initial = 1_000_000_000 * (10 ** decimals());
        _mint(address(this), initial);
    }

    function setSwapContract(address _swapContract) external {
        require(!swapContractSet, "swap contract already set");
        require(_swapContract != address(0), "zero address");
        swapContract = _swapContract;
        swapContractSet = true;
    }

    function swapTransfer(address to, uint256 amount) external {
        require(msg.sender == swapContract, "only swap contract");
        _transfer(address(this), to, amount);
    }

    function swapReceive(address from, uint256 amount) external {
        require(msg.sender == swapContract, "only swap contract");
        _transfer(from, address(this), amount);
    }

    // (Optional) helper to inspect reserve balance
    function reserveBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }
}
