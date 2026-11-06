// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CyncRouter} from "../contracts/CyncRouter.sol";
import {TestToken} from "../contracts/testnet/TestToken.sol";
import {DeployTestnet} from "../script/DeployTestnet.s.sol";

contract DeployTestnetTest is Test {
    address feeWallet = makeAddr("fee");
    address payer = makeAddr("payer");
    address creator = makeAddr("creator");

    CyncRouter router;
    TestToken ussd;
    TestToken usdc;

    function setUp() public {
        vm.chainId(14601);
        vm.setEnv("FEE_RECIPIENT", vm.toString(feeWallet));
        vm.setEnv("FEE_BPS", "100");
        (router, ussd, usdc) = new DeployTestnet().run();
    }

    function test_DeploysRouterWithFee() public view {
        assertEq(router.feeRecipient(), feeWallet);
        assertEq(router.feeBps(), 100);
        assertTrue(router.owner() != address(0));
    }

    function test_TokensMatchRealDecimalsAndAreAllowed() public view {
        assertEq(ussd.decimals(), 18);
        assertEq(usdc.decimals(), 6);
        assertEq(ussd.symbol(), "USSD");
        assertEq(usdc.symbol(), "USDC");
        assertTrue(router.allowedTokens(address(ussd)));
        assertTrue(router.allowedTokens(address(usdc)));
    }

    function test_DripGivesThousandTokens() public {
        vm.prank(payer);
        ussd.drip();
        vm.prank(payer);
        usdc.drip();
        assertEq(ussd.balanceOf(payer), 1_000e18);
        assertEq(usdc.balanceOf(payer), 1_000e6);
        assertEq(ussd.totalSupply(), 1_000e18);
    }

    function test_DripThenApproveThenPay() public {
        vm.startPrank(payer);
        usdc.drip();
        usdc.approve(address(router), 25e6);
        router.executeToken(CyncRouter.ActionKind.Donate, address(usdc), creator, 25e6, keccak256("demo"));
        vm.stopPrank();

        assertEq(usdc.balanceOf(creator), 24.75e6);
        assertEq(usdc.balanceOf(feeWallet), 0.25e6);
        assertEq(usdc.balanceOf(payer), 975e6);
        assertEq(usdc.allowance(payer, address(router)), 0);
    }

    function test_TransferFromNeedsAllowance() public {
        vm.prank(payer);
        ussd.drip();
        vm.expectRevert(TestToken.InsufficientAllowance.selector);
        vm.prank(creator);
        ussd.transferFrom(payer, creator, 1);
    }

    function test_TransferNeedsBalance() public {
        vm.expectRevert(TestToken.InsufficientBalance.selector);
        vm.prank(payer);
        ussd.transfer(creator, 1);
    }

    // fee parsing is tested without vm.setEnv: env vars are process-wide and would race other tests' setUp

    function test_AcceptsFeeInRange() public {
        DeployTestnet script = new DeployTestnet();
        assertEq(script.checkedFeeBps(0), 0);
        assertEq(script.checkedFeeBps(100), 100);
    }

    function test_RefusesFeeAboveMax() public {
        DeployTestnet script = new DeployTestnet();
        vm.expectRevert(bytes("FEE_BPS must be 0-100 (max 1%)"));
        script.checkedFeeBps(101);
    }

    function test_RefusesFeeThatWouldWrapIntoRange() public {
        // uint16(65636) == 100: without the check this typo would deploy with a 1% fee
        DeployTestnet script = new DeployTestnet();
        vm.expectRevert(bytes("FEE_BPS must be 0-100 (max 1%)"));
        script.checkedFeeBps(65636);
    }

    function test_RefusesOtherChains() public {
        vm.chainId(146);
        DeployTestnet script = new DeployTestnet();
        vm.expectRevert(bytes("Sonic testnet only: the test tokens are freely mintable"));
        script.run();
    }
}
