// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MuseLend bounded risk configuration
/// @notice Mainnet starts disabled and token configurations are explicit and versioned.
contract MuseLendRiskManager is AccessControl {
    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");
    bytes32 public constant PAUSE_GUARDIAN_ROLE = keccak256("PAUSE_GUARDIAN_ROLE");
    uint16 public constant MAX_ADVANCE_RATE_BPS = 6000;
    uint16 public constant MAX_SENIOR_COVERAGE_BPS = 9000;
    uint16 public constant MAX_COVERAGE_CAP_BPS = 20_000;

    error InvalidRiskConfiguration();
    error UnsupportedTerm();

    struct TokenConfig {
        bool enabled;
        uint8 canonicalZoraVersion;
        uint8 riskTier;
        uint16 advanceRateBps;
        uint16 seniorCoverageBps;
        uint16 coverageCapBps;
        uint16 maximumPriceImpactBps;
        uint128 minimumPositionUsdc;
        uint128 maximumPositionUsdc;
        uint128 maximumTokenExposureUsdc;
        uint128 maximumWalletExposureUsdc;
    }

    bool public openingsPaused;
    bool public depositsPaused;
    bool public immutable mainnetEnabled;
    mapping(address token => TokenConfig) public tokenConfig;
    mapping(address token => mapping(uint32 term => uint16 premiumBps)) public premiumBpsByTerm;

    event TokenConfigUpdated(address indexed token, TokenConfig config);
    event TermUpdated(address indexed token, uint32 indexed term, uint16 premiumBps, bool allowed);
    event PauseUpdated(bool openingsPaused, bool depositsPaused);

    constructor(address admin, address riskAdmin, address pauseGuardian, bool mainnetEnabled_) {
        if (admin == address(0) || riskAdmin == address(0) || pauseGuardian == address(0)) {
            revert InvalidRiskConfiguration();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ADMIN_ROLE, riskAdmin);
        _grantRole(PAUSE_GUARDIAN_ROLE, pauseGuardian);
        mainnetEnabled = mainnetEnabled_;
    }

    function setTokenConfig(address token, TokenConfig calldata config_) external onlyRole(RISK_ADMIN_ROLE) {
        if (
            token == address(0) || config_.advanceRateBps > MAX_ADVANCE_RATE_BPS
                || config_.seniorCoverageBps > MAX_SENIOR_COVERAGE_BPS || config_.coverageCapBps < 10_000
                || config_.coverageCapBps > MAX_COVERAGE_CAP_BPS || config_.maximumPriceImpactBps > 3000
                || config_.minimumPositionUsdc == 0
                || config_.maximumPositionUsdc < config_.minimumPositionUsdc
        ) revert InvalidRiskConfiguration();
        tokenConfig[token] = config_;
        emit TokenConfigUpdated(token, config_);
    }

    function setTerm(address token, uint32 term, uint16 premiumBps, bool allowed)
        external
        onlyRole(RISK_ADMIN_ROLE)
    {
        if (term < 1 days || term > 30 days || premiumBps > 2000) revert UnsupportedTerm();
        premiumBpsByTerm[token][term] = allowed ? premiumBps + 1 : 0;
        emit TermUpdated(token, term, premiumBps, allowed);
    }

    function termPremium(address token, uint32 term) external view returns (uint16 premiumBps) {
        uint16 encoded = premiumBpsByTerm[token][term];
        if (encoded == 0) revert UnsupportedTerm();
        return encoded - 1;
    }

    function getTokenConfig(address token) external view returns (TokenConfig memory) {
        return tokenConfig[token];
    }

    function pauseRisk() external onlyRole(PAUSE_GUARDIAN_ROLE) {
        openingsPaused = true;
        depositsPaused = true;
        emit PauseUpdated(true, true);
    }

    function unpauseRisk() external onlyRole(RISK_ADMIN_ROLE) {
        openingsPaused = false;
        depositsPaused = false;
        emit PauseUpdated(false, false);
    }
}
