// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CyncRouter} from "../contracts/CyncRouter.sol";

interface IDecimals {
    function decimals() external view returns (uint8);
}

/// @notice Deploys CyncRouter on Sonic mainnet and allowlists USSD and USDC.
///         The broadcasting wallet becomes the router owner; the fee wallet must be a different one.
///
///   FEE_RECIPIENT=0x... FEE_BPS=100 forge script script/DeployMainnet.s.sol --rpc-url sonic --broadcast --interactive
contract DeployMainnet is Script {
    uint256 constant SONIC_MAINNET = 146;
    uint256 constant MAX_FEE_BPS = 100; // same cap as CyncRouter.MAX_FEE_BPS

    address public constant USSD = 0x000000000eCcFf26B795F73fb0A70d48da657fEf;
    address public constant USDC = 0x29219dd400f2Bf60E5a23d13Be72B486D4038894;

    function run() external returns (CyncRouter) {
        // FEE_BPS has no default: the mainnet fee is a deliberate choice
        return deploy(vm.envAddress("FEE_RECIPIENT"), checkedFeeBps(vm.envUint("FEE_BPS")));
    }

    function deploy(address feeRecipient, uint16 feeBps) public returns (CyncRouter router) {
        require(block.chainid == SONIC_MAINNET, "Sonic mainnet only");
        require(IDecimals(USSD).decimals() == 18, "USSD decimals changed");
        require(IDecimals(USDC).decimals() == 6, "USDC decimals changed");

        vm.startBroadcast();
        router = new CyncRouter(feeRecipient, feeBps);
        router.setTokenAllowed(USSD, true);
        router.setTokenAllowed(USDC, true);
        vm.stopBroadcast();

        // forge simulates the whole script first, so a failure here stops it before anything is sent
        require(router.owner() != feeRecipient, "FEE_RECIPIENT must not be the owner wallet");

        console.log("Owner:", router.owner());
        console.log("Fee: %s bps to %s", feeBps, feeRecipient);
        console.log("");
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=%s", address(router));
    }

    /// @dev Checked before narrowing: uint16() alone would silently wrap a typo like 65636 into 100.
    function checkedFeeBps(uint256 raw) public pure returns (uint16) {
        require(raw <= MAX_FEE_BPS, "FEE_BPS must be 0-100 (max 1%)");
        return uint16(raw);
    }
}
