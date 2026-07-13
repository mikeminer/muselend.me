// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @notice Base Sepolia ERC-20 mirror created for one specific Base Creator Coin.
/// @dev The factory is the only minter. These tokens are testnet representations, not bridged assets.
contract BaseCreatorTokenMirror is ERC20 {
    address public immutable factory;
    address public immutable sourceToken;
    address public immutable currency;
    address public immutable hook;
    uint8 private immutable _sourceDecimals;

    error OnlyFactory();

    constructor(
        address sourceToken_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address currency_,
        address hook_
    ) ERC20(name_, symbol_) {
        factory = msg.sender;
        sourceToken = sourceToken_;
        currency = currency_;
        hook = hook_;
        _sourceDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _sourceDecimals;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != factory) revert OnlyFactory();
        _mint(to, amount);
    }

    function coinType() external pure returns (uint8) {
        return 0;
    }

    function contractVersion() external pure returns (string memory) {
        return "2.6.1-mirror-testnet";
    }

    function getPoolKey() external view returns (address, address, uint24, int24, address) {
        return address(this) < currency
            ? (address(this), currency, 10_000, int24(200), hook)
            : (currency, address(this), 10_000, int24(200), hook);
    }
}

/// @notice One-time Base Creator Coin balance mirror for Base Sepolia testing.
/// @dev A dedicated, non-funded attester signs metadata and balances read from Base mainnet.
contract BaseCreatorTokenMirrorFactory is EIP712 {
    using ECDSA for bytes32;

    uint256 public constant SOURCE_CHAIN_ID = 8453;
    uint256 public constant DESTINATION_CHAIN_ID = 84532;
    uint256 public constant MAX_CLAIM_TOKENS = 1_000_000;
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "Claim(address wallet,address sourceToken,uint256 amount,string name,string symbol,uint8 decimals,uint256 deadline)"
    );

    struct Claim {
        address wallet;
        address sourceToken;
        uint256 amount;
        string name;
        string symbol;
        uint8 decimals;
        uint256 deadline;
    }

    address public immutable attester;
    address public immutable currency;
    address public immutable hook;
    mapping(address sourceToken => address mirror) public mirrorFor;
    mapping(address sourceToken => bytes32 metadataHash) public metadataHashFor;
    mapping(address wallet => mapping(address sourceToken => bool claimed)) public hasClaimed;

    event MirrorCreated(
        address indexed sourceToken, address indexed mirror, string name, string symbol, uint8 decimals
    );
    event Claimed(
        address indexed wallet, address indexed sourceToken, address indexed mirror, uint256 amount
    );

    error AlreadyClaimed();
    error ClaimExpired();
    error ClaimTooLarge();
    error InvalidAttester();
    error InvalidClaim();
    error InvalidMetadata();
    error InvalidSignature();
    error MetadataMismatch();
    error WrongChain();

    constructor(address attester_, address currency_, address hook_)
        EIP712("MuseLend Base Creator Mirror", "1")
    {
        if (attester_ == address(0)) revert InvalidAttester();
        if (currency_ == address(0) || hook_ == address(0)) revert InvalidClaim();
        attester = attester_;
        currency = currency_;
        hook = hook_;
    }

    function claim(Claim calldata voucher, bytes calldata signature) external returns (address mirror) {
        if (block.chainid != DESTINATION_CHAIN_ID) revert WrongChain();
        if (
            voucher.wallet != msg.sender || voucher.sourceToken == address(0) || voucher.amount == 0
                || voucher.decimals > 18
        ) revert InvalidClaim();
        if (block.timestamp > voucher.deadline) revert ClaimExpired();
        if (hasClaimed[msg.sender][voucher.sourceToken]) revert AlreadyClaimed();

        bytes memory nameBytes = bytes(voucher.name);
        bytes memory symbolBytes = bytes(voucher.symbol);
        if (
            nameBytes.length == 0 || nameBytes.length > 96 || symbolBytes.length == 0
                || symbolBytes.length > 24
        ) {
            revert InvalidMetadata();
        }
        if (voucher.amount > MAX_CLAIM_TOKENS * 10 ** voucher.decimals) revert ClaimTooLarge();

        if (hashClaim(voucher).recover(signature) != attester) revert InvalidSignature();

        bytes32 metadataHash = keccak256(abi.encode(voucher.name, voucher.symbol, voucher.decimals));
        mirror = mirrorFor[voucher.sourceToken];
        if (mirror == address(0)) {
            mirror = address(
                new BaseCreatorTokenMirror{ salt: bytes32(uint256(uint160(voucher.sourceToken))) }(
                    voucher.sourceToken, voucher.name, voucher.symbol, voucher.decimals, currency, hook
                )
            );
            mirrorFor[voucher.sourceToken] = mirror;
            metadataHashFor[voucher.sourceToken] = metadataHash;
            emit MirrorCreated(voucher.sourceToken, mirror, voucher.name, voucher.symbol, voucher.decimals);
        } else if (metadataHashFor[voucher.sourceToken] != metadataHash) {
            revert MetadataMismatch();
        }

        hasClaimed[msg.sender][voucher.sourceToken] = true;
        BaseCreatorTokenMirror(mirror).mint(msg.sender, voucher.amount);
        emit Claimed(msg.sender, voucher.sourceToken, mirror, voucher.amount);
    }

    function hashClaim(Claim calldata voucher) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CLAIM_TYPEHASH,
                    voucher.wallet,
                    voucher.sourceToken,
                    voucher.amount,
                    keccak256(bytes(voucher.name)),
                    keccak256(bytes(voucher.symbol)),
                    voucher.decimals,
                    voucher.deadline
                )
            )
        );
    }
}
