// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { MirrorTokenVerification } from "./libraries/MirrorTokenVerification.sol";

/// @notice Timelocked registry backed by live Zora Creator Coin interface checks.
contract CreatorTokenValidator is AccessControl {
    using MirrorTokenVerification for address;

    bytes32 public constant VALIDATOR_ADMIN_ROLE = keccak256("VALIDATOR_ADMIN_ROLE");
    uint8 public constant MIRROR_VERSION = 4;
    mapping(address token => uint8 version) public canonicalVersion;
    mapping(address token => bytes32 responseHash) public canonicalContractVersion;
    mapping(address token => bytes32 responseHash) public canonicalPoolKey;
    address public mirrorFactory;
    event CanonicalTokenUpdated(address indexed token, uint8 indexed version);
    event MirrorFactoryUpdated(address indexed factory);

    error InvalidCreatorToken();
    error InvalidMirrorFactory();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VALIDATOR_ADMIN_ROLE, admin);
    }

    function setCanonical(address token, uint8 version) external onlyRole(VALIDATOR_ADMIN_ROLE) {
        (bool valid, bytes32 versionHash, bytes32 poolHash) = _inspect(token);
        if (!valid || version == 0) revert InvalidCreatorToken();
        canonicalVersion[token] = version;
        canonicalContractVersion[token] = versionHash;
        canonicalPoolKey[token] = poolHash;
        emit CanonicalTokenUpdated(token, version);
    }

    function setMirrorFactory(address factory) external onlyRole(VALIDATOR_ADMIN_ROLE) {
        if (factory.code.length == 0) revert InvalidMirrorFactory();
        mirrorFactory = factory;
        emit MirrorFactoryUpdated(factory);
    }

    function validate(address token, uint8 requiredVersion) external view returns (bool) {
        if (requiredVersion == 0) return false;
        if (canonicalVersion[token] == 0) {
            if (requiredVersion != MIRROR_VERSION || !token.isOfficialMirror(mirrorFactory)) return false;
            (bool mirrorValid,,) = _inspect(token);
            return mirrorValid;
        }
        if (canonicalVersion[token] != requiredVersion) return false;
        (bool valid, bytes32 versionHash, bytes32 poolHash) = _inspect(token);
        return valid && canonicalContractVersion[token] == versionHash && canonicalPoolKey[token] == poolHash;
    }

    function _inspect(address token)
        internal
        view
        returns (bool valid, bytes32 versionHash, bytes32 poolHash)
    {
        if (token.code.length == 0) {
            return (false, bytes32(0), bytes32(0));
        }

        (bool typeOk, bytes memory typeData) = token.staticcall(abi.encodeWithSignature("coinType()"));
        if (!typeOk || typeData.length != 32 || abi.decode(typeData, (uint256)) != 0) {
            return (false, bytes32(0), bytes32(0));
        }

        (bool versionOk, bytes memory versionData) =
            token.staticcall(abi.encodeWithSignature("contractVersion()"));
        if (!versionOk || versionData.length < 96) return (false, bytes32(0), bytes32(0));

        (bool poolOk, bytes memory poolData) = token.staticcall(abi.encodeWithSignature("getPoolKey()"));
        if (!poolOk || poolData.length != 160) return (false, bytes32(0), bytes32(0));
        (address currency0, address currency1,,, address hook) =
            abi.decode(poolData, (address, address, uint24, int24, address));
        if ((currency0 != token && currency1 != token) || hook == address(0)) {
            return (false, bytes32(0), bytes32(0));
        }
        return (true, keccak256(versionData), keccak256(poolData));
    }
}
