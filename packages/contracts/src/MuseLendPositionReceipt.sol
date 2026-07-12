// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title Non-transferable MuseLend position receipt
contract MuseLendPositionReceipt is ERC721 {
    error OnlyPositionManager();
    error ReceiptNonTransferable();
    event PositionManagerSet(address indexed positionManager);

    address public immutable initializer;
    address public positionManager;

    constructor(address initializer_) ERC721("MuseLend Position", "MUSE-POS") {
        if (initializer_ == address(0)) revert OnlyPositionManager();
        initializer = initializer_;
    }

    /// @notice One-time wiring used because the receipt is deployed before the manager.
    function setPositionManager(address positionManager_) external {
        if (msg.sender != initializer || positionManager != address(0) || positionManager_ == address(0)) {
            revert OnlyPositionManager();
        }
        positionManager = positionManager_;
        emit PositionManagerSet(positionManager_);
    }

    modifier onlyPositionManager() {
        if (msg.sender != positionManager) revert OnlyPositionManager();
        _;
    }

    function mint(address owner, uint256 positionId) external onlyPositionManager {
        _safeMint(owner, positionId);
    }

    function burn(uint256 positionId) external onlyPositionManager {
        _burn(positionId);
    }

    function approve(address, uint256) public pure override {
        revert ReceiptNonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert ReceiptNonTransferable();
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert ReceiptNonTransferable();
        return super._update(to, tokenId, auth);
    }
}
