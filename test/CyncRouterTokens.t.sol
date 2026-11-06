// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CyncRouter} from "../contracts/CyncRouter.sol";

/// @dev Minimal ERC-20 (USDC: 6 decimals, USSD: 18): transferFrom returns bool and reverts on failure.
contract MockToken {
    uint8 public immutable decimals;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
    }

    function approve(address spender, uint256 v) external returns (bool) {
        allowance[msg.sender][spender] = v;
        return true;
    }

    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        require(balanceOf[from] >= v, "balance");
        require(allowance[from][msg.sender] >= v, "allowance");
        allowance[from][msg.sender] -= v;
        balanceOf[from] -= v;
        balanceOf[to] += v;
        return true;
    }
}

/// @dev USDT-style token: transferFrom returns nothing.
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
    }

    function approve(address spender, uint256 v) external {
        allowance[msg.sender][spender] = v;
    }

    function transferFrom(address from, address to, uint256 v) external {
        require(balanceOf[from] >= v && allowance[from][msg.sender] >= v, "fail");
        allowance[from][msg.sender] -= v;
        balanceOf[from] -= v;
        balanceOf[to] += v;
    }
}

/// @dev Token whose transferFrom returns false instead of reverting.
contract FalseToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract CyncRouterTokensTest is Test {
    event ActionExecuted(
        bytes32 indexed actionId,
        address indexed from,
        address indexed to,
        CyncRouter.ActionKind kind,
        address token,
        uint256 amount,
        uint256 fee
    );
    event TokenAllowed(address indexed token, bool allowed);

    CyncRouter router;
    MockToken usdc;
    MockToken ussd;
    NoReturnToken usdt;

    address deployer = makeAddr("deployer");
    address feeWallet = makeAddr("feeWallet");
    address alice = makeAddr("alice"); // tipper
    address bob = makeAddr("bob"); // recipient

    bytes32 constant ACTION_ID = keccak256("action-1");
    CyncRouter.ActionKind constant TIP = CyncRouter.ActionKind.Tip;
    uint256 constant ONE = 1e6; // 1 USDC (6 decimals)
    uint256 constant USSD = 1e18; // 1 USSD (18 decimals, as on Sonic mainnet)

    function setUp() public {
        vm.prank(deployer);
        router = new CyncRouter(feeWallet, 100); // 1%

        usdc = new MockToken(6);
        ussd = new MockToken(18);
        usdt = new NoReturnToken();

        vm.startPrank(deployer);
        router.setTokenAllowed(address(usdc), true);
        router.setTokenAllowed(address(ussd), true);
        router.setTokenAllowed(address(usdt), true);
        vm.stopPrank();

        usdc.mint(alice, 1_000 * ONE);
        ussd.mint(alice, 1_000 * USSD);
        usdt.mint(alice, 1_000 * ONE);

        vm.startPrank(alice);
        usdc.approve(address(router), type(uint256).max);
        ussd.approve(address(router), type(uint256).max);
        usdt.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // tipToken: happy paths
    // ---------------------------------------------------------------

    function test_tipToken_splitsAmountAndFee() public {
        vm.prank(alice);
        router.executeToken(TIP, address(usdc), bob, 100 * ONE, ACTION_ID);

        assertEq(usdc.balanceOf(bob), 99 * ONE);
        assertEq(usdc.balanceOf(feeWallet), 1 * ONE);
        assertEq(usdc.balanceOf(alice), 900 * ONE);
        assertEq(usdc.balanceOf(address(router)), 0); // router never holds tokens
    }

    function test_tipToken_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, TIP, address(usdc), 99 * ONE, 1 * ONE);

        vm.prank(alice);
        router.executeToken(TIP, address(usdc), bob, 100 * ONE, ACTION_ID);
    }

    function test_tipToken_worksWithSecondAllowedToken() public {
        vm.prank(alice);
        router.executeToken(TIP, address(ussd), bob, 10 * USSD, ACTION_ID);

        assertEq(ussd.balanceOf(bob), 9.9e18);
        assertEq(ussd.balanceOf(feeWallet), 0.1e18);
        assertEq(usdc.balanceOf(bob), 0); // other token untouched
    }

    function test_tipToken_acceptsTokenWithoutReturnValue() public {
        vm.prank(alice);
        router.executeToken(TIP, address(usdt), bob, 100 * ONE, ACTION_ID);

        assertEq(usdt.balanceOf(bob), 99 * ONE);
        assertEq(usdt.balanceOf(feeWallet), 1 * ONE);
    }

    function test_tipToken_zeroFee_skipsFeeTransfer() public {
        vm.prank(deployer);
        router.setFee(0, feeWallet);

        vm.prank(alice);
        router.executeToken(TIP, address(usdc), bob, 100 * ONE, ACTION_ID);

        assertEq(usdc.balanceOf(bob), 100 * ONE);
        assertEq(usdc.balanceOf(feeWallet), 0);
    }

    function test_tipToken_tinyAmountRoundsFeeToZero() public {
        // 99 base units * 1% = 0.99 -> 0 fee
        vm.prank(alice);
        router.executeToken(TIP, address(usdc), bob, 99, ACTION_ID);
        assertEq(usdc.balanceOf(bob), 99);
        assertEq(usdc.balanceOf(feeWallet), 0);
    }

    function test_tipToken_doesNotTouchNativeBalances() public {
        vm.prank(alice);
        router.executeToken(TIP, address(usdc), bob, 100 * ONE, ACTION_ID);
        assertEq(address(router).balance, 0);
        assertEq(bob.balance, 0);
    }

    // ---------------------------------------------------------------
    // tipToken: reverts
    // ---------------------------------------------------------------

    function test_tipToken_revertsForTokenNotOnAllowlist() public {
        MockToken rogue = new MockToken(6);
        rogue.mint(alice, 100 * ONE);
        vm.startPrank(alice);
        rogue.approve(address(router), type(uint256).max);
        vm.expectRevert(CyncRouter.TokenNotAllowed.selector);
        router.executeToken(TIP, address(rogue), bob, 10 * ONE, ACTION_ID);
        vm.stopPrank();
    }

    function test_tipToken_revertsForZeroTokenAddress() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.TokenNotAllowed.selector);
        router.executeToken(TIP, address(0), bob, 10 * ONE, ACTION_ID);
    }

    function test_tipToken_revertsOnZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.InvalidAddress.selector);
        router.executeToken(TIP, address(usdc), address(0), 10 * ONE, ACTION_ID);
    }

    function test_tipToken_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.ZeroValue.selector);
        router.executeToken(TIP, address(usdc), bob, 0, ACTION_ID);
    }

    function test_tipToken_revertsWithoutAllowance() public {
        vm.prank(alice);
        usdc.approve(address(router), 0);

        vm.prank(alice);
        vm.expectRevert(CyncRouter.TokenTransferFailed.selector);
        router.executeToken(TIP, address(usdc), bob, 10 * ONE, ACTION_ID);
    }

    function test_tipToken_revertsWithInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.TokenTransferFailed.selector);
        router.executeToken(TIP, address(usdc), bob, 5_000 * ONE, ACTION_ID);
    }

    function test_tipToken_revertsWhenAllowanceCoversOnlyPartOfAmount() public {
        // allowance covers the net part but not the fee part -> whole tx must revert, nothing moves
        vm.prank(alice);
        usdc.approve(address(router), 99 * ONE);

        vm.prank(alice);
        vm.expectRevert(CyncRouter.TokenTransferFailed.selector);
        router.executeToken(TIP, address(usdc), bob, 100 * ONE, ACTION_ID);

        assertEq(usdc.balanceOf(bob), 0);
        assertEq(usdc.balanceOf(alice), 1_000 * ONE);
    }

    function test_tipToken_revertsWhenTokenReturnsFalse() public {
        FalseToken f = new FalseToken();
        vm.prank(deployer);
        router.setTokenAllowed(address(f), true);

        vm.prank(alice);
        vm.expectRevert(CyncRouter.TokenTransferFailed.selector);
        router.executeToken(TIP, address(f), bob, 10 * ONE, ACTION_ID);
    }

    function test_tipToken_cannotSpendOtherUsersAllowance() public {
        // bob never approved the router; a call from bob cannot pull alice's tokens
        vm.prank(bob);
        vm.expectRevert(CyncRouter.TokenTransferFailed.selector);
        router.executeToken(TIP, address(usdc), alice, 10 * ONE, ACTION_ID);
        assertEq(usdc.balanceOf(alice), 1_000 * ONE);
    }

    // ---------------------------------------------------------------
    // action kinds
    // ---------------------------------------------------------------

    function test_executeToken_donate_recordsKindAndToken() public {
        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, CyncRouter.ActionKind.Donate, address(ussd), 99 * USSD, 1 * USSD);

        vm.prank(alice);
        router.executeToken(CyncRouter.ActionKind.Donate, address(ussd), bob, 100 * USSD, ACTION_ID);
    }

    function test_executeToken_transfer_recordsKind() public {
        vm.expectEmit(true, true, true, true);
        emit ActionExecuted(ACTION_ID, alice, bob, CyncRouter.ActionKind.Transfer, address(usdc), 99 * ONE, 1 * ONE);

        vm.prank(alice);
        router.executeToken(CyncRouter.ActionKind.Transfer, address(usdc), bob, 100 * ONE, ACTION_ID);
    }

    function test_executeToken_revertsOnUnknownKind() public {
        bytes memory data =
            abi.encodeWithSelector(CyncRouter.executeToken.selector, uint8(3), address(usdc), bob, 10 * ONE, ACTION_ID);
        vm.prank(alice);
        (bool ok, ) = address(router).call(data);

        assertFalse(ok);
        assertEq(usdc.balanceOf(alice), 1_000 * ONE);
        assertEq(usdc.balanceOf(bob), 0);
    }

    // ---------------------------------------------------------------
    // allowlist management
    // ---------------------------------------------------------------

    function test_setTokenAllowed_updatesAndEmits() public {
        MockToken t = new MockToken(6);

        vm.expectEmit(true, false, false, true);
        emit TokenAllowed(address(t), true);
        vm.prank(deployer);
        router.setTokenAllowed(address(t), true);
        assertTrue(router.allowedTokens(address(t)));

        vm.prank(deployer);
        router.setTokenAllowed(address(t), false);
        assertFalse(router.allowedTokens(address(t)));
    }

    function test_setTokenAllowed_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.setTokenAllowed(address(usdc), false);
    }

    function test_setTokenAllowed_rejectsEoaAndZeroAddress() public {
        vm.startPrank(deployer);
        vm.expectRevert(CyncRouter.InvalidAddress.selector);
        router.setTokenAllowed(bob, true);
        vm.expectRevert(CyncRouter.InvalidAddress.selector);
        router.setTokenAllowed(address(0), true);
        vm.stopPrank();
    }

    function test_removingToken_blocksFurtherTips() public {
        vm.prank(deployer);
        router.setTokenAllowed(address(usdc), false);

        vm.prank(alice);
        vm.expectRevert(CyncRouter.TokenNotAllowed.selector);
        router.executeToken(TIP, address(usdc), bob, 10 * ONE, ACTION_ID);
    }

    function test_newOwnerManagesAllowlist() public {
        vm.prank(deployer);
        router.transferOwnership(alice);
        vm.prank(alice);
        router.acceptOwnership();

        vm.prank(deployer);
        vm.expectRevert(CyncRouter.NotOwner.selector);
        router.setTokenAllowed(address(usdc), false);

        vm.prank(alice);
        router.setTokenAllowed(address(usdc), false);
        assertFalse(router.allowedTokens(address(usdc)));
    }

    // ---------------------------------------------------------------
    // fuzz
    // ---------------------------------------------------------------

    function testFuzz_tipToken_conservesValue(uint96 amount, uint16 feeBps) public {
        amount = uint96(bound(amount, 1, type(uint96).max));
        feeBps = uint16(bound(feeBps, 0, 100));

        CyncRouter r = new CyncRouter(feeWallet, feeBps);
        MockToken t = new MockToken(6);
        r.setTokenAllowed(address(t), true);

        t.mint(alice, amount);
        vm.prank(alice);
        t.approve(address(r), amount);

        uint256 expectedFee = (uint256(amount) * feeBps) / 10_000;

        vm.prank(alice);
        r.executeToken(TIP, address(t), bob, amount, ACTION_ID);

        assertEq(t.balanceOf(feeWallet), expectedFee);
        assertEq(t.balanceOf(bob), amount - expectedFee);
        assertEq(t.balanceOf(alice), 0);
        assertEq(t.balanceOf(address(r)), 0);
    }
}
