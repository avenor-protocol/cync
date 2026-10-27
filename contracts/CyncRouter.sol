// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Forwards tips to the recipient and takes a small platform fee.
contract CyncRouter {
    uint16 public constant MAX_FEE_BPS = 100; // 1%

    address public owner;
    address public feeRecipient;
    uint16 public feeBps;

    event ActionExecuted(bytes32 indexed actionId, address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeeUpdated(uint16 feeBps, address feeRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InvalidAddress();
    error FeeTooHigh();
    error ZeroValue();
    error TransferFailed();

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

    function tip(address to, bytes32 actionId) external payable {
        if (to == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert ZeroValue();

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 amount = msg.value - fee;

        _send(to, amount);
        if (fee > 0) _send(feeRecipient, fee);

        emit ActionExecuted(actionId, msg.sender, to, amount, fee);
    }

    function setFee(uint16 _feeBps, address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        emit FeeUpdated(_feeBps, _feeRecipient);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _send(address to, uint256 value) private {
        (bool ok, ) = to.call{value: value}("");
        if (!ok) revert TransferFailed();
    }
}
