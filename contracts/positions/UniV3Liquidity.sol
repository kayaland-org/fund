// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


import "../base/GovIdentity.sol";
import "../interfaces/uniswap-v3/Path.sol";
import "../libraries/ERC20Extends.sol";
import "../libraries/UniV3PeripheryExtends.sol";

pragma abicoder v2;
/// @title Position Management
/// @notice Provide asset operation functions, allow authorized identities to perform asset operations, and achieve the purpose of increasing the net value of the fund
contract UniV3Liquidity is GovIdentity {

    using Path for bytes;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using UniV3PeripheryExtends for mapping(address => mapping(address => bytes));

    //Contract binding status
    bool bound;
    //Fund purchase and redemption token
    IERC20 public ioToken;
    //Fund contract address
    address public fund;
    //Swap route
    mapping(address => mapping(address => bytes)) public swapRoute;
    //Position list
    mapping(bytes32 => uint256) public history;
    //Working positions
    EnumerableSet.UintSet private works;
    //Underlying asset
    EnumerableSet.AddressSet private underlyings;


    //Swap
    event Swap(uint256 amountIn, uint256 amountOut);
    //Create positoin
    event Mint(uint256 tokenId, uint128 liquidity);
    //Increase liquidity
    event IncreaseLiquidity(uint256 tokenId, uint128 liquidity);
    //Decrease liquidity
    event DecreaseLiquidity(uint256 tokenId, uint128 liquidity);
    //Collect asset
    event Collect(uint256 tokenId, uint256 amount0, uint256 amount1);

    /// @notice Binding funds and subscription redemption token
    /// @dev Only bind once and cannot be modified
    /// @param _fund Fund address
    /// @param _ioToken Subscription and redemption token
    function bind(address _fund, address _ioToken) external onlyGovernance {
        require(!bound, "UniV3Liquidity.bind: already bind");
        fund = _fund;
        ioToken = IERC20(_ioToken);
        bound = true;
    }

    //Only allow fund contract access
    modifier onlyFund() {
        require(msg.sender == fund, "UniV3Liquidity.onlyFund: !fund");
        _;
    }

    //Only allow governance, strategy, fund contract access
    modifier onlyAuthorize() {
        require(msg.sender == getGovernance()
        || msg.sender == getStrategist()
            || msg.sender == fund, "UniV3Liquidity.onlyAuthorize: !authorize");
        _;
    }

    /// @notice Check current position
    /// @dev Check the current UniV3 position by pool token ID.
    /// @param pool liquidity pool
    /// @param tickLower Tick lower bound
    /// @param tickUpper Tick upper bound
    /// @return atWork Position status
    /// @return has Check if the position ID exist
    /// @return tokenId Position ID
    function checkPos(
        address pool,
        int24 tickLower,
        int24 tickUpper
    ) public view returns (bool atWork, bool has, uint256 tokenId){
        bytes32 pk = UniV3PeripheryExtends.positionKey(pool, tickLower, tickUpper);
        tokenId = history[pk];
        atWork = works.contains(tokenId);
        has = tokenId > 0 ? true : false;
    }

    /// @notice in work tokenId array
    /// @dev read in works NFT array
    /// @return tokenIds NFT array
    function worksPos() public view returns (uint256[] memory tokenIds){
        uint256 length = works.length();
        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            tokenIds[i] = works.at(i);
        }
    }

    /// @notice in underlyings token address array
    /// @dev read in underlyings token address array
    /// @return tokens address array
    function getUnderlyings() public view returns (address[] memory tokens){
        uint256 length = underlyings.length();
        tokens = new address[](length);
        for (uint256 i = 0; i < underlyings.length(); i++) {
            tokens[i] = underlyings.at(i);
        }
    }

    /// @notice Authorize UniV3 contract to move fund asset
    /// @dev Only allow governance and strategist identities to execute authorized functions to reduce miner fee consumption
    /// @param token Authorized target token
    function safeApproveAll(address token) public virtual onlyStrategistOrGovernance {
        ERC20Extends.safeApprove(token, address(UniV3PeripheryExtends.PM()), type(uint256).max);
        ERC20Extends.safeApprove(token, address(UniV3PeripheryExtends.SRT()), type(uint256).max);
    }

    /// @notice Multiple functions of the contract can be executed at the same time
    /// @dev Only the governance and strategist identities are allowed to execute multiple function calls,
    /// and the execution of multiple functions can ensure the consistency of the execution results
    /// @param data Encode data of multiple execution functions
    /// @return results Execution result
    function multicall(bytes[] calldata data) external onlyStrategistOrGovernance returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            if (!success) {
                if (result.length < 68) revert();
                assembly {
                    result := add(result, 0x04)
                }
                revert(abi.decode(result, (string)));
            }
            results[i] = result;
        }
    }


    /// @notice Set asset swap route
    /// @dev Only the governance identity is allowed to set the asset swap path, and the firstToken and lastToken contained in the path will be used as the underlying asset token address by default
    /// @param path Swap path byte code
    function settingSwapRoute(bytes memory path) external onlyGovernance {
        require(path.valid(), 'UniV3Liquidity.settingSwapRoute: path is not valid');
        address fromToken = path.getFirstAddress();
        address toToken = path.getLastAddress();
        swapRoute[fromToken][toToken] = path;
        if (!underlyings.contains(fromToken)) underlyings.add(fromToken);
        if (!underlyings.contains(toToken)) underlyings.add(toToken);
    }

    /// @notice Set the underlying asset token address
    /// @dev Only allow the governance identity to set the underlying asset token address
    /// @param ts The underlying asset token address array to be added
    function setUnderlyings(address[] memory ts) public onlyGovernance {
        for (uint256 i = 0; i < ts.length; i++) {
            if (!underlyings.contains(ts[i])) {
                underlyings.add(ts[i]);
            }
        }
    }

    /// @notice Delete the underlying asset token address
    /// @dev Only allow the governance identity to delete the underlying asset token address
    /// @param ts The underlying asset token address array to be deleted
    function removeUnderlyings(address[] memory ts) public onlyGovernance {
        for (uint256 i = 0; i < ts.length; i++) {
            if (underlyings.contains(ts[i])) {
                underlyings.remove(ts[i]);
            }
        }
    }

    /// @notice Estimated to obtain the target token amount
    /// @dev Only allow the asset transaction path that has been set to be estimated
    /// @param from Source token address
    /// @param to Target token address
    /// @param amountIn Source token amount
    /// @return amountOut Target token amount
    function estimateAmountOut(
        address from,
        address to,
        uint256 amountIn
    ) public view returns (uint256 amountOut){
        return swapRoute.estimateAmountOut(from, to, amountIn);
    }

    /// @notice Estimate the amount of source tokens that need to be provided
    /// @dev Only allow the governance identity to set the underlying asset token address
    /// @param from Source token address
    /// @param to Target token address
    /// @param amountOut Expect to get the target token amount
    /// @return amountIn Source token amount
    function estimateAmountIn(
        address from,
        address to,
        uint256 amountOut
    ) public view returns (uint256 amountIn){
        return swapRoute.estimateAmountIn(from, to, amountOut);
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @dev Initiate a transaction with a known input amount and return the output amount
    /// @param tokenIn Token in address
    /// @param tokenOut Token out address
    /// @param amountIn Token in amount
    /// @param amountOutMinimum Expected to get minimum token out amount
    /// @return amountOut Token out amount
    function exactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) public onlyAuthorize returns (uint256 amountOut) {
        amountOut = swapRoute.exactInput(tokenIn, tokenOut, amountIn, address(this), amountOutMinimum);
        emit Swap(amountIn, amountOut);
    }

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// @dev Initiate a transaction with a known output amount and return the input amount
    /// @param tokenIn Token in address
    /// @param tokenOut Token out address
    /// @param amountOut Token out amount
    /// @param amountInMaximum Expect to input the maximum amount of tokens
    /// @return amountIn Token in amount
    function exactOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 amountInMaximum
    ) public onlyAuthorize returns (uint256 amountIn) {
        amountIn = swapRoute.exactOutput(tokenIn, tokenOut, address(this), amountOut, amountInMaximum);
        emit Swap(amountIn, amountOut);
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
    function mint(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) public onlyAuthorize
    {
        (uint256 tokenId, uint128 liquidity,,) = UniV3PeripheryExtends.mint(token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, address(this));
        address pool = UniV3PeripheryExtends.F().getPool(token0, token1, fee);
        bytes32 pk = UniV3PeripheryExtends.positionKey(pool, tickLower, tickUpper);
        history[pk] = tokenId;
        works.add(tokenId);
        emit Mint(tokenId, liquidity);
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
    ) public onlyAuthorize returns (
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ){
        (liquidity, amount0, amount1) = UniV3PeripheryExtends.increaseLiquidity(tokenId, amount0Desired, amount1Desired, amount0Min, amount1Min);

        if (!works.contains(tokenId)) {
            works.add(tokenId);
        }
        emit IncreaseLiquidity(tokenId, liquidity);
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
    ) public onlyAuthorize returns (uint256 amount0, uint256 amount1){
        (amount0, amount1) = UniV3PeripheryExtends.decreaseLiquidity(tokenId, liquidity, amount0Min, amount1Min);
        emit DecreaseLiquidity(tokenId, liquidity);
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
        uint128 amount0Max,
        uint128 amount1Max
    ) public onlyAuthorize returns (uint256 amount0, uint256 amount1){
        (amount0, amount1) = UniV3PeripheryExtends.collect(tokenId, address(this), amount0Max, amount1Max);
        (
        ,
        ,
        ,
        ,
        ,
        ,
        ,
        uint128 liquidity,
        ,
        ,
        ,
        ) = UniV3PeripheryExtends.PM().positions(tokenId);
        if (liquidity == 0) {
            works.remove(tokenId);
        }
        emit Collect(tokenId, amount0, amount1);
    }

    /// @notice Withdraw asset
    /// @dev Only fund contract can withdraw asset
    /// @param to Withdraw address
    /// @param amount Withdraw amount
    /// @param scale Withdraw percentage
    function withdraw(address to, uint256 amount, uint256 scale) external onlyFund {
        uint256 surplusAmount = ioToken.balanceOf(address(this));
        if (surplusAmount < amount) {
            _decreaseLiquidityByScale(scale);
            for (uint256 i = 0; i < underlyings.length(); i++) {
                address token = underlyings.at(i);
                //todo Optimise swap
                if (token != address(ioToken)) {
                    uint256 balance = IERC20(token).balanceOf(address(this));
                    exactInput(token, address(ioToken), balance, 0);
                }
            }
        }
        surplusAmount = ioToken.balanceOf(address(this));
        if (surplusAmount < amount) {
            amount = surplusAmount;
        }
        ioToken.safeTransfer(to, amount);
    }

    /// @notice Withdraw underlying asset
    /// @dev Only fund contract can withdraw underlying asset
    /// @param to Withdraw address
    /// @param scale Withdraw percentage
    function withdrawOfUnderlying(address to, uint256 scale) external onlyFund {
        uint256 length=underlyings.length();
        uint256[] memory balances = new uint256[](length);
        uint256[] memory withdrawAmounts = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            address token = underlyings.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));
            balances[i] = balance;
            withdrawAmounts[i] = balance.mul(scale).div(1e18);
        }
        _decreaseLiquidityByScale(scale);
        for (uint256 i = 0; i < length; i++) {
            address token = underlyings.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));
            uint256 decreaseAmount = balance.sub(balances[i]);
            uint256 addAmount=decreaseAmount.mul(scale).div(1e18);
            uint256 transferAmount = withdrawAmounts[i].add(addAmount);
            IERC20(token).safeTransfer(to, transferAmount);
        }
    }

    /// @notice Decrease liquidity by scale
    /// @dev Decrease liquidity by provided scale
    /// @param scale Scale of the liquidity
    function _decreaseLiquidityByScale(uint256 scale) internal {
        uint256 length = works.length();
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = works.at(i);
            (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint128 liquidity,
            ,
            ,
            ,
            ) = UniV3PeripheryExtends.PM().positions(tokenId);
            if (liquidity > 0) {
                uint256 _decreaseLiquidity = uint256(liquidity).mul(scale).div(1e18);
                (uint256 amount0, uint256 amount1) = decreaseLiquidity(tokenId, uint128(_decreaseLiquidity), 0, 0);
                collect(tokenId, uint128(amount0), uint128(amount1));
            }
        }
    }

    /// @notice Total asset
    /// @dev This function calculates the net worth or AUM
    /// @return Total asset
    function assets() public view returns (uint256){
        uint256 total = idleAssets();
        total = total.add(liquidityAssets());
        return total;
    }

    /// @notice idle asset
    /// @dev This function calculates idle asset
    /// @return idle asset
    function idleAssets() public view returns (uint256){
        uint256 total;
        for (uint256 i = 0; i < underlyings.length(); i++) {
            address token = underlyings.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (token == address(ioToken)) {
                total = total.add(balance);
            } else {
                uint256 _estimateAmountOut = estimateAmountOut(token, address(ioToken), balance);
                total = total.add(_estimateAmountOut);
            }
        }
        return total;
    }

    /// @notice at work liquidity asset
    /// @dev This function calculates liquidity asset
    /// @return liquidity asset
    function liquidityAssets() public view returns (uint256){
        uint256 total;
        uint256 length = works.length();
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = works.at(i);
            total = total.add(caclLiquidityAssets(tokenId));
        }
        return total;
    }

    /// @notice calc tokenId asset
    /// @dev This function calc tokenId asset
    /// @return tokenId asset
    function caclLiquidityAssets(uint256 tokenId) public view returns (uint256) {
        uint256 total;
        address ioTokenAddr = address(ioToken);

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
        ) = UniV3PeripheryExtends.PM().positions(tokenId);
        (uint256 amount0, uint256 amount1) = UniV3PeripheryExtends.getAmountsForLiquidity(
            token0, token1, fee, tickLower, tickUpper, liquidity);
        //todo Optimise calculation
        if (token0 == ioTokenAddr) {
            total = total.add(amount0);
        } else {
            uint256 _estimateAmountOut = estimateAmountOut(token0, ioTokenAddr, amount0);
            total = total.add(_estimateAmountOut);
        }
        if (token1 == ioTokenAddr) {
            total = total.add(amount1);
        } else {
            uint256 _estimateAmountOut = estimateAmountOut(token1, ioTokenAddr, amount1);
            total = total.add(_estimateAmountOut);
        }
        return total;
    }
}
