// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../libraries/UniV3PeripheryExtends.sol";
import "../libraries/ERC20Extends.sol";

contract MockUniV3PeripheryExtends {

    using Path for bytes;
    using UniV3PeripheryExtends for mapping(address => mapping(address => bytes));


    uint256 public curTokenId;

    mapping(address => mapping(address => bytes)) public swapRoute;

    event Swap(uint256 amountIn, uint256 amountOut);
    event Mint(uint256 tokenId, uint128 liquidity);
    event IncreaseLiquidity(uint256 tokenId, uint128 liquidity);
    event DecreaseLiquidity(uint256 tokenId, uint128 liquidity);
    event Collect(uint256 tokenId, uint256 amount0, uint256 amount1);

    function settingSwapRoute(bytes memory path) external {
        require(path.valid(), 'MockUniV3PeripheryExtends.settingSwapRoute: path is not valid');
        address fromToken = path.getFirstAddress();
        address toToken = path.getLastAddress();
        swapRoute[fromToken][toToken] = path;
    }


    function decodeFirstPool(bytes memory path) external pure returns (address fromToken, address toToken, uint24 fee){
        return path.getFirstPool().decodeFirstPool();
    }

    function estimateAmountOut(
        address from,
        address to,
        uint256 amountIn
    ) external view returns (uint256){
        return swapRoute.estimateAmountOut(from, to, amountIn);
    }

    function estimateAmountIn(
        address from,
        address to,
        uint256 amountOut
    ) external view returns (uint256){
        return swapRoute.estimateAmountIn(from, to, amountOut);
    }

    function exactInput(
        address from,
        address to,
        uint256 amountIn,
        address recipient,
        uint256 amountOutMinimum
    ) external returns (uint256){
        ERC20Extends.safeApprove(from, address( UniV3PeripheryExtends.PM()), type(uint256).max);
        ERC20Extends.safeApprove(from, address( UniV3PeripheryExtends.SRT()), type(uint256).max);
        uint256 amountOut = swapRoute.exactInput(from, to, amountIn, recipient, amountOutMinimum);
        emit Swap(amountIn, amountOut);
        return amountOut;
    }

    function exactOutput(
        address from,
        address to,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external returns (uint256){
        ERC20Extends.safeApprove(from, address( UniV3PeripheryExtends.PM()), type(uint256).max);
        ERC20Extends.safeApprove(from, address( UniV3PeripheryExtends.SRT()), type(uint256).max);
        uint256 amountIn = swapRoute.exactOutput(from, to, recipient, amountOut, amountInMaximum);
        emit Swap(amountIn, amountOut);
        return amountIn;
    }

    function mint(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        address recipient
    ) public {
        (uint256 tokenId,uint128 liquidity,,) = UniV3PeripheryExtends.mint(token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, recipient);
        curTokenId = tokenId;
        emit Mint(tokenId, liquidity);
    }

    function increaseLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) public {
        (uint128 liquidity,,) = UniV3PeripheryExtends.increaseLiquidity(tokenId, amount0Desired, amount1Desired, amount0Min, amount1Min);
        emit IncreaseLiquidity(tokenId, liquidity);
    }

    function decreaseLiquidity(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) public {
        UniV3PeripheryExtends.decreaseLiquidity(tokenId, liquidity, amount0Min, amount1Min);
        emit DecreaseLiquidity(tokenId,liquidity);
    }

    function collect(
        uint256 tokenId,
        address recipient,
        uint128 amount0Max,
        uint128 amount1Max
    ) public {
        (uint256 amount0, uint256 amount1) = UniV3PeripheryExtends.collect(tokenId, recipient, amount0Max, amount1Max);
        emit Collect(tokenId,amount0, amount1);
    }

    function getAmountsForAllLiquidity(uint256 tokenId) public view returns (uint256 amount0, uint256 amount1) {
        return UniV3PeripheryExtends.getAmountsForAllLiquidity(tokenId);
    }
}
