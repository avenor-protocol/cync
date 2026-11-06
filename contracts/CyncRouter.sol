// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Executes Cync actions (transfer, tip, donate) in native S or allowlisted ERC-20s
///         such as USSD / USDC, forwarding to the recipient and taking a small platform fee.
///         The router never holds user funds: native payments are split inside one call,
///         token payments are pulled straight from the sender to the recipient and fee wallet.
contract CyncRouter {
    /// @notice The only action types the router accepts; any other value reverts during ABI decoding.
    enum ActionKind {
        Transfer,
        Tip,
        Donate
    }

    uint16 public constant MAX_FEE_BPS = 100; // 1%

    address public owner;
    /// @notice Proposed owner; becomes owner only after calling acceptOwnership().
    address public pendingOwner;
    address public feeRecipient;
    uint16 public feeBps;

    /// @notice Tokens that can be used with executeToken (owner-managed allowlist).
    mapping(address => bool) public allowedTokens;

    /// @param token address(0) for native S.
    event ActionExecuted(
        bytes32 indexed actionId,
        address indexed from,
        address indexed to,
        ActionKind kind,
        address token,
        uint256 amount,
        uint256 fee
    );
    event TokenAllowed(address indexed token, bool allowed);
    event FeeUpdated(uint16 feeBps, address feeRecipient);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotPendingOwner();
    error InvalidAddress();
    error FeeTooHigh();
    error ZeroValue();
    error TransferFailed();
    error TokenNotAllowed();
    error TokenTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _feeRecipient, uint16 _feeBps) {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeUpdated(_feeBps, _feeRecipient);
    }

    /// @notice Execute an action in native S. The fee is taken from msg.value.
    function execute(ActionKind kind, address to, bytes32 actionId) external payable {
        if (to == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert ZeroValue();

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 amount = msg.value - fee;

        _send(to, amount);
        if (fee > 0) _send(feeRecipient, fee);

        emit ActionExecuted(actionId, msg.sender, to, kind, address(0), amount, fee);
    }

    /// @notice Execute an action in an allowlisted ERC-20. The sender must approve this router for `amount` first.
    /// @param amount Gross amount; the fee is taken from it, same as the native action.
    function executeToken(ActionKind kind, address token, address to, uint256 amount, bytes32 actionId) external {
        if (!allowedTokens[token]) revert TokenNotAllowed();
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroValue();

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 net = amount - fee;

        _pull(token, msg.sender, to, net);
        if (fee > 0) _pull(token, msg.sender, feeRecipient, fee);

        emit ActionExecuted(actionId, msg.sender, to, kind, token, net, fee);
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token.code.length == 0) revert InvalidAddress();
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function setFee(uint16 _feeBps, address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        emit FeeUpdated(_feeBps, _feeRecipient);
    }

    /// @notice Step 1 of 2: propose a new owner. Nothing changes until they call acceptOwnership(),
    ///         so a mistyped or keyless address cannot take the router. address(0) cancels a proposal.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Step 2 of 2: the proposed owner takes ownership.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function _send(address to, uint256 value) private {
        (bool ok, ) = to.call{value: value}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev transferFrom that also accepts tokens returning no value (e.g. USDT-style).
    function _pull(address token, address from, address to, uint256 value) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TokenTransferFailed();
    }
}
