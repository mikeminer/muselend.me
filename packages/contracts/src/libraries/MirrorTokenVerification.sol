// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

/// @notice Verifies that a token was deployed by the configured MuseLend mirror factory.
library MirrorTokenVerification {
    function isOfficialMirror(address token, address expectedFactory) internal view returns (bool) {
        if (token.code.length == 0 || expectedFactory.code.length == 0) return false;

        (bool factoryOk, bytes memory factoryData) = token.staticcall(abi.encodeWithSignature("factory()"));
        if (!factoryOk || factoryData.length != 32 || abi.decode(factoryData, (address)) != expectedFactory) {
            return false;
        }

        (bool sourceOk, bytes memory sourceData) = token.staticcall(abi.encodeWithSignature("sourceToken()"));
        if (!sourceOk || sourceData.length != 32) return false;
        address sourceToken = abi.decode(sourceData, (address));
        if (sourceToken == address(0)) return false;

        (bool mirrorOk, bytes memory mirrorData) =
            expectedFactory.staticcall(abi.encodeWithSignature("mirrorFor(address)", sourceToken));
        return mirrorOk && mirrorData.length == 32 && abi.decode(mirrorData, (address)) == token;
    }
}
