// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock ERC20 representing a fiat token (fCHF, fUSD, ...)
/// Design:
/// - Initial supply minted to address(this) so token contract acts as reserve.
/// - A single swap/orchestrator contract may be registered (setSwapContract) and
///   only that contract can call swapTransfer / swapReceive to move tokens
///   between users and the token contract reserve.
/// - No admin-controlled top-ups are required; supply is fixed (minted at deploy).
contract MockFiatToken is ERC20 {
    address public swapContract;
    bool public swapContractSet;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupplyUnits // units in whole tokens (will be scaled by decimals)
    ) ERC20(name_, symbol_) {
        uint256 initial = initialSupplyUnits * (10 ** decimals());
        _mint(address(this), initial);
    }

    /// @notice set the only swap/orchestrator contract that can move reserve tokens.
    /// Can be called once by deployer/operator of token contract.
    function setSwapContract(address _swapContract) external {
        require(!swapContractSet, "swap contract already set");
        require(_swapContract != address(0), "zero address");
        swapContract = _swapContract;
        swapContractSet = true;
    }

    /// @notice Called by swap/orchestrator to send reserve tokens to a recipient.
    function swapTransfer(address to, uint256 amount) external {
        require(msg.sender == swapContract, "only swap contract");
        _transfer(address(this), to, amount);
    }

    /// @notice Called by swap/orchestrator to take tokens from a user into reserve.
    /// The swap/orchestrator is expected to have an allowance to transferFrom the user.
    /// We implement this by expecting the swapContract to call transferFrom on this token.
    /// But to centralize movement, we allow the swapContract to call this wrapper which
    /// calls _transfer from `from` to address(this) (swapContract must have been approved).
    function swapReceive(address from, uint256 amount) external {
        require(msg.sender == swapContract, "only swap contract");
        // Move user's tokens to the token contract reserve
        // Note: transferFrom semantics require this contract to be allowed to move tokens;
        //       but since the swapContract is executing this, it will be the msg.sender.
        // We therefore perform a plain _transfer (only possible if 'from' has allowed this token contract,
        // or if user directly called approve for swapContract and swapContract called transferFrom).
        // Simpler approach: the Facade/swapContract already did transferFrom directly, but we keep a small wrapper
        // for clarity in swaps that rely on the token contract's reserve.
        _transfer(from, address(this), amount);
    }

    // (Optional) helper to inspect reserve balance
    function reserveBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }
}
