// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CyncRouter} from "../contracts/CyncRouter.sol";
import {DeployMainnet} from "../script/DeployMainnet.s.sol";

// Calls deploy() directly: forge runs tests in parallel and vm.setEnv is shared between them.
contract DeployMainnetTest is Test {
    address feeWallet = makeAddr("fee");
    DeployMainnet script;
    address ussd;
    address usdc;

    function setUp() public {
        vm.chainId(146);
        script = new DeployMainnet();
        ussd = script.USSD();
        usdc = script.USDC();
        mockToken(ussd, 18);
        mockToken(usdc, 6);
    }

    function mockToken(address token, uint8 decimals) internal {
        vm.etch(token, hex"00");
        vm.mockCall(token, abi.encodeWithSignature("decimals()"), abi.encode(decimals));
    }

    function test_DeploysRouterAndAllowsBothTokens() public {
        CyncRouter router = script.deploy(feeWallet, 100);
        assertEq(router.feeRecipient(), feeWallet);
        assertEq(router.feeBps(), 100);
        assertTrue(router.allowedTokens(ussd));
        assertTrue(router.allowedTokens(usdc));
        assertTrue(router.owner() != feeWallet);
    }

    function test_RefusesOtherChains() public {
        vm.chainId(14601);
        vm.expectRevert("Sonic mainnet only");
        script.deploy(feeWallet, 100);
    }

    function test_RefusesFeeAboveCap() public {
        vm.expectRevert("FEE_BPS must be 0-100 (max 1%)");
        script.checkedFeeBps(101);
    }

    function test_RefusesFeeThatWouldWrap() public {
        vm.expectRevert("FEE_BPS must be 0-100 (max 1%)");
        script.checkedFeeBps(65636);
    }

    function test_RefusesOwnerAsFeeWallet() public {
        vm.expectRevert("FEE_RECIPIENT must not be the owner wallet");
        script.deploy(DEFAULT_SENDER, 100);
    }

    function test_RefusesWrongDecimals() public {
        mockToken(ussd, 6);
        vm.expectRevert("USSD decimals changed");
        script.deploy(feeWallet, 100);
    }
}
