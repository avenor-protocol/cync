// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CyncRouter} from "../contracts/CyncRouter.sol";

/// @dev Recipient whose receive() always reverts.
contract RevertingReceiver {
    receive() external payable {
        revert("nope");
    }
}

/// @dev Recipient that re-enters router.execute once, forwarding what it received.
contract ReentrantReceiver {
    CyncRouter public immutable router;
    address public immutable target;
    bool private entered;

    constructor(CyncRouter _router, address _target) {
        router = _router;
        target = _target;
    }

    receive() external payable {
        if (!entered) {
            entered = true;
            router.execute{value: msg.value}(CyncRouter.ActionKind.Tip, target, bytes32("inner"));
        }
    }
}

contract CyncRouterTest is Test {
    event ActionExecuted(
        bytes32 indexed actionId,
        address indexed from,
        address indexed to,
        CyncRouter.ActionKind kind,
        address token,
        uint256 amount,
        uint256 fee
    );
    event FeeUpdated(uint16 feeBps, address feeRecipient);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    CyncRouter router;

    address deployer = makeAddr("deployer");
    address feeWallet = makeAddr("feeWallet");
    address alice = makeAddr("alice"); // tipper
    address bob = makeAddr("bob"); // recipient

    uint16 constant FEE_BPS = 100; // 1%
    bytes32 constant ACTION_ID = keccak256("action-1");
    CyncRouter.ActionKind constant TIP = CyncRouter.ActionKind.Tip;

    function setUp() public {
        vm.prank(deployer);
        router = new CyncRouter(feeWallet, FEE_BPS);
        vm.deal(alice, 100 ether);
    }

    // ---------------------------------------------------------------
    // constructor
    // ---------------------------------------------------------------

    function test_constructor_setsState() public view {
        assertEq(router.owner(), deployer);
        assertEq(router.feeRecipient(), feeWallet);
        assertEq(router.feeBps(), FEE_BPS);
        assertEq(router.MAX_FEE_BPS(), 100);
    }

    function test_constructor_emitsEvents() public {
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(address(0), address(this));
        vm.expectEmit(false, false, false, true);
        emit FeeUpdated(50, feeWallet);
        new CyncRouter(feeWallet, 50);
    }

    function test_constructor_revertsOnZeroFeeRecipient() public {
        vm.expectRevert(CyncRouter.InvalidAddress.selector);
        new CyncRouter(address(0), FEE_BPS);
    }

    function test_constructor_revertsWhenFeeTooHigh() public {
        vm.expectRevert(CyncRouter.FeeTooHigh.selector);
        new CyncRouter(feeWallet, 101);
    }

    function test_constructor_allowsMaxAndZeroFee() public {
        assertEq(new CyncRouter(feeWallet, 100).feeBps(), 100);
        assertEq(new CyncRouter(feeWallet, 0).feeBps(), 0);
    }

    // ---------------------------------------------------------------
    // tip: happy paths
    // ---------------------------------------------------------------

    function test_tip_splitsAmountAndFee() public {
        vm.prank(alice);
        router.execute{value: 1 ether}(TIP, bob, ACTION_ID);

        assertEq(bob.balance, 0.99 ether);
        assertEq(feeWallet.balance, 0.01 ether);
        assertEq(address(router).balance, 0);
        assertEq(alice.balance, 99 ether);
    }

    function test_tip_emitsActionExecuted() public {
        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, TIP, address(0), 0.99 ether, 0.01 ether);

        vm.prank(alice);
        router.execute{value: 1 ether}(TIP, bob, ACTION_ID);
    }

    function test_tip_zeroFee_sendsEverythingToRecipient() public {
        vm.prank(deployer);
        router.setFee(0, feeWallet);

        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, TIP, address(0), 1 ether, 0);

        vm.prank(alice);
        router.execute{value: 1 ether}(TIP, bob, ACTION_ID);

        assertEq(bob.balance, 1 ether);
        assertEq(feeWallet.balance, 0);
    }

    function test_tip_zeroFee_doesNotCallFeeRecipient() public {
        // A fee recipient that always reverts must not block tips when fee is 0.
        RevertingReceiver bad = new RevertingReceiver();
        vm.startPrank(deployer);
        router.setFee(0, address(bad));
        vm.stopPrank();

        vm.prank(alice);
        router.execute{value: 1 ether}(TIP, bob, ACTION_ID);
        assertEq(bob.balance, 1 ether);
    }

    function test_tip_feeRoundsDownForTinyAmounts() public {
        // 99 wei * 100 / 10_000 = 0 -> recipient gets everything
        vm.prank(alice);
        router.execute{value: 99}(TIP, bob, ACTION_ID);
        assertEq(bob.balance, 99);
        assertEq(feeWallet.balance, 0);

        // 100 wei -> fee = 1 wei
        vm.prank(alice);
        router.execute{value: 100}(TIP, bob, ACTION_ID);
        assertEq(bob.balance, 99 + 99);
        assertEq(feeWallet.balance, 1);
    }

    function test_tip_usesUpdatedFee() public {
        vm.prank(deployer);
        router.setFee(50, feeWallet); // 0.5%

        vm.prank(alice);
        router.execute{value: 2 ether}(TIP, bob, ACTION_ID);

        assertEq(feeWallet.balance, 0.01 ether);
        assertEq(bob.balance, 1.99 ether);
    }

    function test_tip_toSelfStillWorks() public {
        vm.prank(alice);
        router.execute{value: 1 ether}(TIP, alice, ACTION_ID);
        assertEq(alice.balance, 100 ether - 1 ether + 0.99 ether);
    }

    // ---------------------------------------------------------------
    // tip: reverts
    // ---------------------------------------------------------------

    function test_tip_revertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.InvalidAddress.selector);
        router.execute{value: 1 ether}(TIP, address(0), ACTION_ID);
    }

    function test_tip_revertsOnZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.ZeroValue.selector);
        router.execute(TIP, bob, ACTION_ID);
    }

    function test_tip_revertsWhenRecipientRejectsEth() public {
        RevertingReceiver bad = new RevertingReceiver();
        vm.prank(alice);
        vm.expectRevert(CyncRouter.TransferFailed.selector);
        router.execute{value: 1 ether}(TIP, address(bad), ACTION_ID);

        // whole tx reverted: nothing moved
        assertEq(alice.balance, 100 ether);
        assertEq(feeWallet.balance, 0);
        assertEq(address(router).balance, 0);
    }

    function test_tip_revertsWhenFeeRecipientRejectsEth() public {
        RevertingReceiver bad = new RevertingReceiver();
        vm.prank(deployer);
        router.setFee(FEE_BPS, address(bad));

        vm.prank(alice);
        vm.expectRevert(CyncRouter.TransferFailed.selector);
        router.execute{value: 1 ether}(TIP, bob, ACTION_ID);

        // recipient payment was rolled back too
        assertEq(bob.balance, 0);
        assertEq(alice.balance, 100 ether);
    }

    function test_plainEthTransferToRouterReverts() public {
        vm.prank(alice);
        (bool ok, ) = address(router).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(router).balance, 0);
    }

    // ---------------------------------------------------------------
    // tip: reentrancy (no state is written after external calls)
    // ---------------------------------------------------------------

    function test_tip_reentrantRecipient_accountingStaysConsistent() public {
        address finalRecipient = makeAddr("final");
        ReentrantReceiver r = new ReentrantReceiver(router, finalRecipient);

        vm.prank(alice);
        router.execute{value: 1 ether}(TIP, address(r), ACTION_ID);

        // outer: 0.99 to r, 0.01 fee. inner: r forwards 0.99 -> 0.9801 to final, 0.0099 fee
        assertEq(finalRecipient.balance, 0.9801 ether);
        assertEq(feeWallet.balance, 0.01 ether + 0.0099 ether);
        assertEq(address(r).balance, 0);
        assertEq(address(router).balance, 0);
    }

    // ---------------------------------------------------------------
    // action kinds
    // ---------------------------------------------------------------

    function test_execute_transfer_recordsKind() public {
        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, CyncRouter.ActionKind.Transfer, address(0), 0.99 ether, 0.01 ether);

        vm.prank(alice);
        router.execute{value: 1 ether}(CyncRouter.ActionKind.Transfer, bob, ACTION_ID);
        assertEq(bob.balance, 0.99 ether);
    }

    function test_execute_donate_recordsKind() public {
        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, CyncRouter.ActionKind.Donate, address(0), 0.99 ether, 0.01 ether);

        vm.prank(alice);
        router.execute{value: 1 ether}(CyncRouter.ActionKind.Donate, bob, ACTION_ID);
        assertEq(bob.balance, 0.99 ether);
    }

    function test_execute_revertsOnUnknownKind() public {
        // kind 3 is outside the enum; ABI decoding must reject it before any value moves
        bytes memory data = abi.encodeWithSelector(CyncRouter.execute.selector, uint8(3), bob, ACTION_ID);
        vm.prank(alice);
        (bool ok, ) = address(router).call{value: 1 ether}(data);

        assertFalse(ok);
        assertEq(alice.balance, 100 ether);
        assertEq(bob.balance, 0);
        assertEq(feeWallet.balance, 0);
    }

    // ---------------------------------------------------------------
    // setFee
    // ---------------------------------------------------------------

    function test_setFee_updatesAndEmits() public {
        address newWallet = makeAddr("newWallet");

        vm.expectEmit(false, false, false, true);
        emit FeeUpdated(25, newWallet);

        vm.prank(deployer);
        router.setFee(25, newWallet);

        assertEq(router.feeBps(), 25);
        assertEq(router.feeRecipient(), newWallet);
    }

    function test_setFee_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.setFee(10, feeWallet);
    }

    function test_setFee_revertsWhenTooHigh() public {
        vm.prank(deployer);
        vm.expectRevert(CyncRouter.FeeTooHigh.selector);
        router.setFee(101, feeWallet);
    }

    function test_setFee_allowsMax() public {
        vm.prank(deployer);
        router.setFee(100, feeWallet);
        assertEq(router.feeBps(), 100);
    }

    function test_setFee_revertsOnZeroRecipient() public {
        vm.prank(deployer);
        vm.expectRevert(CyncRouter.InvalidAddress.selector);
        router.setFee(10, address(0));
    }

    // ---------------------------------------------------------------
    // transferOwnership
    // ---------------------------------------------------------------

    function test_transferOwnership_onlyProposes() public {
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferStarted(deployer, alice);

        vm.prank(deployer);
        router.transferOwnership(alice);

        // nothing changes until alice accepts
        assertEq(router.owner(), deployer);
        assertEq(router.pendingOwner(), alice);
        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.setFee(10, feeWallet);
    }

    function test_acceptOwnership_updatesAndEmits() public {
        vm.prank(deployer);
        router.transferOwnership(alice);

        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(deployer, alice);
        vm.prank(alice);
        router.acceptOwnership();

        assertEq(router.owner(), alice);
        assertEq(router.pendingOwner(), address(0));
    }

    function test_acceptOwnership_onlyPendingOwner() public {
        vm.prank(deployer);
        router.transferOwnership(alice);

        vm.prank(bob);
        vm.expectRevert(CyncRouter.NotPendingOwner.selector);
        router.acceptOwnership();

        // the current owner cannot accept on the new owner's behalf either
        vm.prank(deployer);
        vm.expectRevert(CyncRouter.NotPendingOwner.selector);
        router.acceptOwnership();
    }

    function test_acceptOwnership_revertsWithoutProposal() public {
        // pendingOwner is address(0), which can never be msg.sender
        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotPendingOwner.selector);
        router.acceptOwnership();
    }

    function test_acceptOwnership_cannotBeReused() public {
        vm.prank(deployer);
        router.transferOwnership(alice);
        vm.prank(alice);
        router.acceptOwnership();

        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotPendingOwner.selector);
        router.acceptOwnership();
    }

    function test_transferOwnership_wrongAddressCanBeReplaced() public {
        address typo = makeAddr("typo");
        vm.prank(deployer);
        router.transferOwnership(typo);

        // the owner notices and proposes the right address; the typo can no longer accept
        vm.prank(deployer);
        router.transferOwnership(alice);
        vm.prank(typo);
        vm.expectRevert(CyncRouter.NotPendingOwner.selector);
        router.acceptOwnership();

        vm.prank(alice);
        router.acceptOwnership();
        assertEq(router.owner(), alice);
    }

    function test_transferOwnership_zeroAddressCancels() public {
        vm.prank(deployer);
        router.transferOwnership(alice);
        vm.prank(deployer);
        router.transferOwnership(address(0));

        assertEq(router.pendingOwner(), address(0));
        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotPendingOwner.selector);
        router.acceptOwnership();
        assertEq(router.owner(), deployer);
    }

    function test_transferOwnership_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.transferOwnership(alice);
    }

    function test_transferOwnership_oldOwnerLosesAccess() public {
        vm.prank(deployer);
        router.transferOwnership(alice);
        vm.prank(alice);
        router.acceptOwnership();

        vm.prank(deployer);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.setFee(10, feeWallet);

        vm.prank(alice);
        router.setFee(10, feeWallet);
        assertEq(router.feeBps(), 10);
    }

    // ---------------------------------------------------------------
    // fuzz
    // ---------------------------------------------------------------

    function testFuzz_tip_conservesValue(uint96 value, uint16 feeBps) public {
        value = uint96(bound(value, 1, type(uint96).max));
        feeBps = uint16(bound(feeBps, 0, 100));

        CyncRouter r = new CyncRouter(feeWallet, feeBps);
        vm.deal(alice, value);

        uint256 expectedFee = (uint256(value) * feeBps) / 10_000;

        vm.prank(alice);
        r.execute{value: value}(TIP, bob, ACTION_ID);

        assertEq(feeWallet.balance, expectedFee);
        assertEq(bob.balance, value - expectedFee);
        assertEq(bob.balance + feeWallet.balance, value);
        assertEq(address(r).balance, 0);
        assertLe(expectedFee, uint256(value) / 100 + 1); // never above ~1%
    }

    function testFuzz_execute_everyKindChargesSameFee(uint8 kind, uint96 value) public {
        kind = uint8(bound(kind, 0, 2));
        value = uint96(bound(value, 1, 100 ether));
        uint256 expectedFee = (uint256(value) * FEE_BPS) / 10_000;

        vm.prank(alice);
        router.execute{value: value}(CyncRouter.ActionKind(kind), bob, ACTION_ID);

        assertEq(feeWallet.balance, expectedFee);
        assertEq(bob.balance, value - expectedFee);
        assertEq(address(router).balance, 0);
    }

    function testFuzz_setFee_rejectsAboveMax(uint16 feeBps) public {
        feeBps = uint16(bound(feeBps, 101, type(uint16).max));
        vm.prank(deployer);
        vm.expectRevert(CyncRouter.FeeTooHigh.selector);
        router.setFee(feeBps, feeWallet);
    }

    function testFuzz_onlyOwnerCanSetFee(address caller) public {
        vm.assume(caller != deployer);
        vm.prank(caller);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.setFee(10, feeWallet);
    }
}
