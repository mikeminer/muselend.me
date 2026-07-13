// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { MirrorTokenVerification } from "./libraries/MirrorTokenVerification.sol";

/// @title MuseLend bounded risk configuration
/// @notice Mainnet starts disabled and token configurations are explicit and versioned.
contract MuseLendRiskManager is AccessControl {
    using MirrorTokenVerification for address;

    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");
    bytes32 public constant PAUSE_GUARDIAN_ROLE = keccak256("PAUSE_GUARDIAN_ROLE");
    uint16 public constant MAX_ADVANCE_RATE_BPS = 6000;
    uint16 public constant MAX_SENIOR_COVERAGE_BPS = 9000;
    uint16 public constant MAX_COVERAGE_CAP_BPS = 20_000;
    uint16 public constant MAX_ORIGINATION_FEE_BPS = 200;

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
    uint128 public globalSeniorDebtCap;
    uint128 public globalJuniorCoverageCap;
    uint16 public originationFeeBps;
    mapping(address token => TokenConfig) public tokenConfig;
    mapping(address token => bool configured) public tokenConfigSet;
    mapping(address token => mapping(uint32 term => uint16 premiumBps)) public premiumBpsByTerm;
    address public mirrorFactory;
    TokenConfig public mirrorTokenConfig;
    mapping(uint32 term => uint16 premiumBps) public mirrorPremiumBpsByTerm;

    event TokenConfigUpdated(address indexed token, TokenConfig config);
    event TermUpdated(address indexed token, uint32 indexed term, uint16 premiumBps, bool allowed);
    event PauseUpdated(bool openingsPaused, bool depositsPaused);
    event GlobalCapsUpdated(uint128 seniorDebtCap, uint128 juniorCoverageCap);
    event OriginationFeeUpdated(uint16 feeBps);
    event MirrorTokenConfigUpdated(address indexed factory, TokenConfig config);
    event MirrorTermUpdated(uint32 indexed term, uint16 premiumBps, bool allowed);

    constructor(
        address admin,
        address riskAdmin,
        address pauseGuardian,
        bool mainnetEnabled_,
        uint128 initialSeniorDebtCap,
        uint128 initialJuniorCoverageCap,
        uint16 initialOriginationFeeBps
    ) {
        if (
            admin == address(0) || riskAdmin == address(0) || pauseGuardian == address(0)
                || initialSeniorDebtCap == 0 || initialJuniorCoverageCap == 0
                || initialOriginationFeeBps > MAX_ORIGINATION_FEE_BPS
        ) {
            revert InvalidRiskConfiguration();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ADMIN_ROLE, riskAdmin);
        _grantRole(PAUSE_GUARDIAN_ROLE, pauseGuardian);
        mainnetEnabled = mainnetEnabled_;
        globalSeniorDebtCap = initialSeniorDebtCap;
        globalJuniorCoverageCap = initialJuniorCoverageCap;
        originationFeeBps = initialOriginationFeeBps;
    }

    /// @notice Sets protocol-wide exposure limits. The role is assigned to the governance timelock.
    function setGlobalCaps(uint128 seniorDebtCap, uint128 juniorCoverageCap)
        external
        onlyRole(RISK_ADMIN_ROLE)
    {
        if (seniorDebtCap == 0 || juniorCoverageCap == 0) revert InvalidRiskConfiguration();
        globalSeniorDebtCap = seniorDebtCap;
        globalJuniorCoverageCap = juniorCoverageCap;
        emit GlobalCapsUpdated(seniorDebtCap, juniorCoverageCap);
    }

    function setOriginationFee(uint16 feeBps) external onlyRole(RISK_ADMIN_ROLE) {
        if (feeBps > MAX_ORIGINATION_FEE_BPS) revert InvalidRiskConfiguration();
        originationFeeBps = feeBps;
        emit OriginationFeeUpdated(feeBps);
    }

    function setTokenConfig(address token, TokenConfig calldata config_) external onlyRole(RISK_ADMIN_ROLE) {
        if (token == address(0)) revert InvalidRiskConfiguration();
        _validateTokenConfig(config_);
        tokenConfig[token] = config_;
        tokenConfigSet[token] = true;
        emit TokenConfigUpdated(token, config_);
    }

    /// @notice Enables bounded defaults only for mirrors proven to come from the official factory.
    /// @dev Testnet-only by construction. Mainnet deployments cannot enable this fallback.
    function setMirrorTokenConfig(address factory, TokenConfig calldata config_)
        external
        onlyRole(RISK_ADMIN_ROLE)
    {
        if (mainnetEnabled || factory.code.length == 0) revert InvalidRiskConfiguration();
        _validateTokenConfig(config_);
        mirrorFactory = factory;
        mirrorTokenConfig = config_;
        emit MirrorTokenConfigUpdated(factory, config_);
    }

    function setTerm(address token, uint32 term, uint16 premiumBps, bool allowed)
        external
        onlyRole(RISK_ADMIN_ROLE)
    {
        if (term < 1 days || term > 30 days || premiumBps > 2000) revert UnsupportedTerm();
        premiumBpsByTerm[token][term] = allowed ? premiumBps + 1 : 0;
        emit TermUpdated(token, term, premiumBps, allowed);
    }

    function setMirrorTerm(uint32 term, uint16 premiumBps, bool allowed) external onlyRole(RISK_ADMIN_ROLE) {
        _validateTerm(term, premiumBps);
        mirrorPremiumBpsByTerm[term] = allowed ? premiumBps + 1 : 0;
        emit MirrorTermUpdated(term, premiumBps, allowed);
    }

    function termPremium(address token, uint32 term) external view returns (uint16 premiumBps) {
        uint16 encoded = premiumBpsByTerm[token][term];
        if (encoded == 0 && !tokenConfigSet[token] && token.isOfficialMirror(mirrorFactory)) {
            encoded = mirrorPremiumBpsByTerm[term];
        }
        if (encoded == 0) revert UnsupportedTerm();
        return encoded - 1;
    }

    function getTokenConfig(address token) external view returns (TokenConfig memory) {
        if (!tokenConfigSet[token] && token.isOfficialMirror(mirrorFactory)) return mirrorTokenConfig;
        return tokenConfig[token];
    }

    function _validateTokenConfig(TokenConfig calldata config_) internal pure {
        if (
            config_.advanceRateBps > MAX_ADVANCE_RATE_BPS
                || config_.seniorCoverageBps > MAX_SENIOR_COVERAGE_BPS || config_.coverageCapBps < 10_000
                || config_.coverageCapBps > MAX_COVERAGE_CAP_BPS || config_.maximumPriceImpactBps > 3000
                || config_.minimumPositionUsdc == 0
                || config_.maximumPositionUsdc < config_.minimumPositionUsdc
        ) revert InvalidRiskConfiguration();
    }

    function _validateTerm(uint32 term, uint16 premiumBps) internal pure {
        if (term < 1 days || term > 30 days || premiumBps > 2000) revert UnsupportedTerm();
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
