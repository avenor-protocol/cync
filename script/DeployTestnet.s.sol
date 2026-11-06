// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CyncRouter} from "../contracts/CyncRouter.sol";
import {TestToken} from "../contracts/testnet/TestToken.sol";

/// @notice Deploys the demo on Sonic testnet: CyncRouter plus test USSD / USDC, both allowlisted.
///         The broadcasting wallet becomes the router owner.
///
///   FEE_RECIPIENT=0x... forge script script/DeployTestnet.s.sol --rpc-url sonic_testnet --broadcast --interactive
contract DeployTestnet is Script {
    uint256 constant SONIC_TESTNET = 14601;
    uint256 constant MAX_FEE_BPS = 100; // same cap as CyncRouter.MAX_FEE_BPS

    function run() external returns (CyncRouter router, TestToken ussd, TestToken usdc) {
        require(block.chainid == SONIC_TESTNET, "Sonic testnet only: the test tokens are freely mintable");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint16 feeBps = checkedFeeBps(vm.envOr("FEE_BPS", uint256(100)));

        vm.startBroadcast();
        router = new CyncRouter(feeRecipient, feeBps);
        ussd = new TestToken("Cync Test USSD", "USSD", 18);
        usdc = new TestToken("Cync Test USDC", "USDC", 6);
        router.setTokenAllowed(address(ussd), true);
        router.setTokenAllowed(address(usdc), true);
        vm.stopBroadcast();

        console.log("Owner:", router.owner());
        console.log("Fee: %s bps to %s", feeBps, feeRecipient);
        console.log("");
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=%s", address(router));
        console.log("NEXT_PUBLIC_USSD_ADDRESS=%s", address(ussd));
        console.log("NEXT_PUBLIC_USDC_ADDRESS=%s", address(usdc));
        console.log("NEXT_PUBLIC_TEST_TOKENS=1");
    }

    /// @dev Checked before narrowing: uint16() alone would silently wrap a typo like 65636 into 100.
    function checkedFeeBps(uint256 raw) public pure returns (uint16) {
        require(raw <= MAX_FEE_BPS, "FEE_BPS must be 0-100 (max 1%)");
        return uint16(raw);
    }
}
