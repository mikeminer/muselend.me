// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Versioned allowlist used until factory-level Zora validation is configured per network.
contract CreatorTokenValidator is AccessControl {
    bytes32 public constant VALIDATOR_ADMIN_ROLE = keccak256("VALIDATOR_ADMIN_ROLE");
    mapping(address token => uint8 version) public canonicalVersion;
    event CanonicalTokenUpdated(address indexed token, uint8 indexed version);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VALIDATOR_ADMIN_ROLE, admin);
    }

    function setCanonical(address token, uint8 version) external onlyRole(VALIDATOR_ADMIN_ROLE) {
        require(token != address(0), "zero token");
        canonicalVersion[token] = version;
        emit CanonicalTokenUpdated(token, version);
    }

    function validate(address token, uint8 requiredVersion) external view returns (bool) {
        return requiredVersion != 0 && canonicalVersion[token] == requiredVersion;
    }
}
