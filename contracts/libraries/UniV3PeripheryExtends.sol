// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/uniswap-v3/INonfungiblePositionManager.sol";
import "../interfaces/uniswap-v3/ISwapRouter.sol";
import "../interfaces/uniswap-v3/IUniswapV3Factory.sol";
import "../interfaces/uniswap-v3/IUniswapV3Pool.sol";
import "../interfaces/uniswap-v3/Path.sol";
import "../interfaces/uniswap-v3/TickMath.sol";
import "../interfaces/uniswap-v3/LiquidityAmounts.sol";

import "./SafeMathExtends.sol";

pragma abicoder v2;
/// @title UniV3 extends libraries
/// @notice libraries
library UniV3PeripheryExtends {

    using SafeERC20 for IERC20;
    using Path for bytes;
    using SafeMath for uint256;
    using SafeMathExtends for uint256;

    //x96
    uint256 constant internal x96 = 2 ** 96;

    //fee denominator
    uint256 constant internal denominator=1000000;

    //Nonfungible Position Manager
    INonfungiblePositionManager constant private positionManager = INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
    //Swap Router
    ISwapRouter constant private swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    //Uniswap V3 Factory
    IUniswapV3Factory constant private factory = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);

    /// @notice Nonfungible Position Manager
    /// @dev Nonfungible Position Manager
    /// @return Nonfungible Position Manager
    function PM() public pure returns (INonfungiblePositionManager){
        return positionManager;
    }

    /// @notice Swap Router
    /// @dev Swap Router
    /// @return Swap Router
    function SRT() public pure returns (ISwapRouter){
        return swapRouter;
    }

    /// @notice Uniswap V3 Factory
    /// @dev Uniswap V3 Factory
    /// @return Uniswap V3 Factory
    function F() public pure returns (IUniswapV3Factory){
        return factory;
    }

    /// @notice Position id
    /// @dev Position ID
    /// @param pool Position pool address
    /// @param tickLower Tick lower price bound
    /// @param tickUpper Tick upper price bound
    /// @return ABI encode
    function positionKey(
        address pool,
        int24 tickLower,
        int24 tickUpper
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(pool, tickLower, tickUpper));
    }

    /// @notice Calculate the number of redeemable tokens based on the amount of liquidity
    /// @dev Used when redeeming liquidity
    /// @param tokenId Position ID
    /// @return amount0 Token 0 amount
    /// @return amount1 Token 1 amount
    function getAmountsForAllLiquidity(
        uint256 tokenId
    ) internal view returns (uint256 amount0, uint256 amount1) {
        (
        ,
        ,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        ,
        ,
        ,
        ) = PM().positions(tokenId);
        return getAmountsForLiquidity(token0, token1, fee, tickLower, tickUpper, liquidity);
    }

    /// @notice Calculate the number of redeemable tokens based on the amount of liquidity
    /// @dev Used when redeeming liquidity
    /// @param token0 Token 0 address
    /// @param token1 Token 1 address
    /// @param fee Fee rate
    /// @param tickLower Tick lower price bound
    /// @param tickUpper Tick upper price bound
    /// @param liquidity Liquidity amount
    /// @return amount0 Token 0 amount
    /// @return amount1 Token 1 amount
    function getAmountsForLiquidity(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256 amount0, uint256 amount1) {
        address pool = F().getPool(token0, token1, fee);
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        (amount0, amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            liquidity
        );
    }
    /// @notice Estimated to obtain the target token amount
    /// @dev Only allow the asset transaction path that has been set to be estimated
    /// @param self Mapping path
    /// @param from Source token address
    /// @param to Target token address
    /// @param amountIn Source token amount
    /// @return amountOut Target token amount
    function estimateAmountOut(
        mapping(address => mapping(address => bytes)) storage self,
        address from,
        address to,
        uint256 amountIn
    ) internal view returns (uint256 amountOut){
        if (amountIn == 0) {return 0;}
        bytes memory path = self[from][to];
        amountOut = amountIn;
        while (true) {
            (address fromToken, address toToken, uint24 fee) = path.getFirstPool().decodeFirstPool();
            address _pool = F().getPool(fromToken, toToken, fee);
            (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(_pool).slot0();
            address token0 = fromToken < toToken ? fromToken : toToken;
            amountOut=amountOut.mul(denominator.sub(uint256(fee))).div(denominator);
            if (token0 == toToken) {
                amountOut = amountOut.sqrt().mul(x96).div(sqrtPriceX96) ** 2;
            } else {
                amountOut = amountOut.sqrt().mul(sqrtPriceX96).div(x96) ** 2;
            }
            bool hasMultiplePools = path.hasMultiplePools();
            if (hasMultiplePools) {
                path = path.skipToken();
            } else {
                break;
            }
        }
    }

    /// @notice Estimate the amount of source tokens that need to be provided
    /// @dev Only allow the governance identity to set the underlying asset token address
    /// @param self Mapping path
    /// @param from Source token address
    /// @param to Target token address
    /// @param amountOut Expected target token amount
    /// @return amountIn Source token amount
    function estimateAmountIn(
        mapping(address => mapping(address => bytes)) storage self,
        address from,
        address to,
        uint256 amountOut
    ) internal view returns (uint256 amountIn){
        if (amountOut == 0) {return 0;}
        bytes memory path = self[from][to];
        amountIn = amountOut;
        while (true) {
            (address fromToken, address toToken, uint24 fee) = path.getFirstPool().decodeFirstPool();
            address _pool = F().getPool(fromToken, toToken, fee);
            (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(_pool).slot0();
            address token0 = fromToken < toToken ? fromToken : toToken;
            if (token0 == toToken) {
                amountIn = amountIn.sqrt().mul(sqrtPriceX96).div(x96) ** 2;
            } else {
                amountIn = amountIn.sqrt().mul(x96).div(sqrtPriceX96) ** 2;
            }
            amountIn=amountIn.mul(denominator).div(denominator.sub(uint256(fee)));
            bool hasMultiplePools = path.hasMultiplePools();
            if (hasMultiplePools) {
                path = path.skipToken();
            } else {
                break;
            }
        }
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @dev Initiate a transaction with a known input amount and return the output amount
    /// @param self Mapping path
    /// @param from Input token address
    /// @param to Output token address
    /// @param amountIn Token in amount
    /// @param recipient Recipient address
    /// @param amountOutMinimum Expected to get minimum token out amount
    /// @return Token out amount
    function exactInput(
        mapping(address => mapping(address => bytes)) storage self,
        address from,
        address to,
        uint256 amountIn,
        address recipient,
        uint256 amountOutMinimum
    ) internal returns (uint256){
        bytes memory path = self[from][to];
        return swapRouter.exactInput(
            ISwapRouter.ExactInputParams({
        path : path,
        recipient : recipient,
        deadline : block.timestamp,
        amountIn : amountIn,
        amountOutMinimum : amountOutMinimum
        }));
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @dev Initiate a transaction with a known output amount and return the input amount
    /// @param self Mapping path
    /// @param from Input token address
    /// @param to Output token address
    /// @param recipient Recipient address
    /// @param amountOut Token out amount
    /// @param amountInMaximum Expect to input the maximum amount of tokens
    /// @return Token in amount
    function exactOutput(
        mapping(address => mapping(address => bytes)) storage self,
        address from,
        address to,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum
    ) internal returns (uint256){
        bytes memory path = self[to][from];
        return swapRouter.exactOutput(
            ISwapRouter.ExactOutputParams({
        path : path,
        recipient : recipient,
        deadline : block.timestamp,
        amountOut : amountOut,
        amountInMaximum : amountInMaximum
        }));
    }

    /// @notice Create position
    /// @dev Repeated creation of the same position will cause an error, you need to change tickLower Or tickUpper
    /// @param token0 Liquidity pool token 0 contract address
    /// @param token1 Liquidity pool token 1 contract address
    /// @param fee Target liquidity pool rate
    /// @param tickLower Expect to place the lower price boundary of the target liquidity pool
    /// @param tickUpper Expect to place the upper price boundary of the target liquidity pool
    /// @param amount0Desired Desired token 0 amount
    /// @param amount1Desired Desired token 1 amount
    /// @param recipient Recipient address
    /// @return tokenId Position ID
    /// @return liquidity Liquidity amount
    /// @return amount0 Token0 amount
    /// @return amount1 Token1 amount
    function mint(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        address recipient
    ) internal returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ){
        return positionManager.mint(INonfungiblePositionManager.MintParams({
        token0 : token0,
        token1 : token1,
        fee : fee,
        tickLower : tickLower,
        tickUpper : tickUpper,
        amount0Desired : amount0Desired,
        amount1Desired : amount1Desired,
        amount0Min : 0,
        amount1Min : 0,
        recipient : recipient,
        deadline : block.timestamp
        }));
    }

    /// @notice Increase liquidity
    /// @dev Use checkPos to check the position ID
    /// @param tokenId Position ID
    /// @param amount0 Desired Desired token 0 amount
    /// @param amount1 Desired Desired token 1 amount
    /// @param amount0Min Minimum token 0 amount
    /// @param amount1Min Minimum token 1 amount
    /// @return liquidity The amount of liquidity
    /// @return amount0 Actual token 0 amount being added
    /// @return amount1 Actual token 1 amount being added
    function increaseLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    )
    internal
    returns (
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ){
        return positionManager.increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams({
        tokenId : tokenId,
        amount0Desired : amount0Desired,
        amount1Desired : amount1Desired,
        amount0Min : amount0Min,
        amount1Min : amount1Min,
        deadline : block.timestamp
        }));
    }

    /// @notice Decrease liquidity
    /// @dev Use checkPos to query the position ID
    /// @param tokenId Position ID
    /// @param liquidity Expected reduction amount of liquidity
    /// @param amount0Min Minimum amount of token 0 to be reduced
    /// @param amount1Min Minimum amount of token 1 to be reduced
    /// @return amount0 Actual amount of token 0 being reduced
    /// @return amount1 Actual amount of token 1 being reduced
    function decreaseLiquidity(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    )
    internal
    returns (uint256 amount0, uint256 amount1){
        return positionManager.decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams({
        tokenId : tokenId,
        liquidity : liquidity,
        amount0Min : amount0Min,
        amount1Min : amount1Min,
        deadline : block.timestamp
        }));
    }

    /// @notice Collect position asset
    /// @dev Use checkPos to check the position ID
    /// @param tokenId Position ID
    /// @param amount0Max Maximum amount of token 0 to be collected
    /// @param amount1Max Maximum amount of token 1 to be collected
    /// @return amount0 Actual amount of token 0 being collected
    /// @return amount1 Actual amount of token 1 being collected
    function collect(
        uint256 tokenId,
        address recipient,
        uint128 amount0Max,
        uint128 amount1Max
    ) internal returns (uint256 amount0, uint256 amount1){
        return positionManager.collect(INonfungiblePositionManager.CollectParams({
        tokenId : tokenId,
        recipient : recipient,
        amount0Max : amount0Max,
        amount1Max : amount1Max
        }));
    }
}
