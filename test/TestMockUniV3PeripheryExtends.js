const {BN, ether, constants, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const TestHelper = require("../scripts/TestHelper");
const Path = require("../scripts/Path");

const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20');
const IWETH = artifacts.require('interfaces/weth/IWETH');

const INonfungiblePositionManager = artifacts.require('interfaces/uniswap-v3/INonfungiblePositionManager');

const UniV3PeripheryExtends = artifacts.require('libraries/UniV3PeripheryExtends');
const MockUniV3PeripheryExtends = artifacts.require('mock/MockUniV3PeripheryExtends');

contract('MockUniV3PeripheryExtends', (accounts) => {

    let mockUniV3PeripheryExtends;
    let pm;


    let positionManager = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

    let USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    let WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    let WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
    let DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

    let iusdt;
    let iweth;
    let iwbtc;

    let mintBeforeAmount0;
    let mintBeforeAmount1;

    before(async () => {
        let uniV3PeripheryExtends = await UniV3PeripheryExtends.new();
        await MockUniV3PeripheryExtends.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
        mockUniV3PeripheryExtends = await MockUniV3PeripheryExtends.new();
        pm = await INonfungiblePositionManager.at(positionManager);
        iusdt = await IERC20.at(USDT);
        iweth = await IWETH.at(WETH);
        iwbtc = await IERC20.at(WBTC);
        let wethAmount = new ether('10');
        await iweth.deposit({value: wethAmount});
        await iweth.transfer(mockUniV3PeripheryExtends.address, wethAmount);
    });

    describe('MockUniV3PeripheryExtends.test', async () => {

        it('Call settingSwapPath should work', async () => {
            let paths = [
                [[WETH, WBTC], [3000]],
                [[WBTC, WETH], [3000]],
                [[WETH, USDT], [3000]],
                [[USDT, WETH], [3000]],
                [[USDT, WETH, WBTC], [3000, 3000]],
                [[USDT, WETH, DAI], [3000, 3000]]
            ];
            for (var i = 0; i < paths.length; i++) {
                let ep = Path.encodePath(paths[i][0], paths[i][1]);
                await mockUniV3PeripheryExtends.settingSwapRoute(ep);
                let sp = await mockUniV3PeripheryExtends.swapRoute(paths[i][0][0], paths[i][0][paths[i][0].length - 1]);
                assert.equal(ep, sp, 'sp fail');
            }
        });

        it('Call estimateAmountOut should work', async () => {
            let amountOut = await mockUniV3PeripheryExtends.estimateAmountOut(WETH, WBTC, 0);
            assert.equal(amountOut, 0, 'estimateAmountOut fail');
            let amountIn = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            amountOut = await mockUniV3PeripheryExtends.estimateAmountOut(WETH, WBTC, amountIn);
            assert.equal(amountOut > 0, true, 'estimateAmountOut fail');
            assert.notEqual(amountIn, amountOut, 'estimateAmountOut fail');
        });

        it('Call estimateAmountIn should work', async () => {
            let amountIn = await mockUniV3PeripheryExtends.estimateAmountIn(WETH, WBTC, 0);
            assert.equal(amountIn, 0, 'estimateAmountIn fail');
            let amountOut = new BN(1e8);
            amountIn = await mockUniV3PeripheryExtends.estimateAmountIn(WETH, WBTC, amountOut);
            assert.equal(amountIn > 0, true, 'estimateAmountIn fail');
            assert.notEqual(amountIn, amountOut, 'estimateAmountIn fail');
        });

        it('Call exactInput should work', async () => {
            let wethBefore = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let wbtcBefore = await iwbtc.balanceOf(mockUniV3PeripheryExtends.address);
            let weth_wbtc = await mockUniV3PeripheryExtends.exactInput(WETH, WBTC, wethBefore, mockUniV3PeripheryExtends.address, 0);
            let wethAfter0 = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let wbtcAfter0 = await iwbtc.balanceOf(mockUniV3PeripheryExtends.address);
            expectEvent(weth_wbtc, 'Swap', {
                amountIn: wethBefore.sub(wethAfter0),
                amountOut: wbtcAfter0.sub(wbtcBefore)
            });

            let wbtc_weth = await mockUniV3PeripheryExtends.exactInput(WBTC, WETH, wbtcAfter0, mockUniV3PeripheryExtends.address, 0);
            let wethAfter1 = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let wbtcAfter1 = await iwbtc.balanceOf(mockUniV3PeripheryExtends.address);
            expectEvent(wbtc_weth, 'Swap', {
                amountIn: wbtcAfter0.sub(wbtcAfter1),
                amountOut: wethAfter1.sub(wethAfter0)
            });
        });

        it('Call exactOutput should work', async () => {
            let wethBefore = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let usdtBefore = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            let usdtAmountOut = new BN(100e6);
            let weth_usdt = await mockUniV3PeripheryExtends.exactOutput(WETH, USDT, mockUniV3PeripheryExtends.address, usdtAmountOut, wethBefore);
            let wethAfter0 = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let usdtAfter0 = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            assert.equal(usdtAmountOut.toString(), usdtAfter0.sub(usdtBefore), 'usdtAmountOut fail');
            expectEvent(weth_usdt, 'Swap', {
                amountIn: wethBefore.sub(wethAfter0),
                amountOut: usdtAmountOut
            });
            let wethAmountOut = new ether('0.00001');
            let usdt_weth = await mockUniV3PeripheryExtends.exactOutput(USDT, WETH, mockUniV3PeripheryExtends.address, wethAmountOut, usdtAfter0);
            let wethAfter1 = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let usdtAfter1 = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            assert.equal(wethAmountOut, wethAfter1.sub(wethAfter0).toString(), 'wethAmountOut fail');
            expectEvent(usdt_weth, 'Swap', {
                amountIn: usdtAfter0.sub(usdtAfter1),
                amountOut: wethAmountOut
            });
        });


        it('Call mint should work', async () => {
            mintBeforeAmount0 = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            mintBeforeAmount1 = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            let curTokenId = await mockUniV3PeripheryExtends.curTokenId();
            let tickLower = TestHelper.calcTickLower(1.0001, 2300 * 1e6 / 1e18, 60);
            let tickUpper = TestHelper.calcTickUpper(1.0001, 2720 * 1e6 / 1e18, 60);
            if (curTokenId > 0) {
                let pos = await pm.positions(curTokenId);
                tickLower = pos.tickLower.add(new BN(60));
                tickUpper = pos.tickUpper.add(new BN(60));
            }
            let amount0Desired = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let amount1Desired = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            let mint = await mockUniV3PeripheryExtends.mint(WETH, USDT, 3000, tickLower, tickUpper, amount0Desired, amount1Desired, mockUniV3PeripheryExtends.address);

            expectEvent(mint, 'Mint');
        });

        it('Call getAmountsForLiquidity should work', async () => {
            let curTokenId = await mockUniV3PeripheryExtends.curTokenId();
            let amount0 = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let amount1 = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            let getAmountsForAllLiquidity = await mockUniV3PeripheryExtends.getAmountsForAllLiquidity(curTokenId);
            // console.log(JSON.stringify(getAmountsForAllLiquidity));
            // console.log(mintBeforeAmount0.toString());
            // console.log(mintBeforeAmount1.toString());
            // console.log(amount0.toString());
            // console.log(amount1.toString());
            // let cp1 = getAmountsForAllLiquidity.amount0.toString() == mintBeforeAmount0.sub(amount0).toString();
            // let cp2 = getAmountsForAllLiquidity.amount0.add(new BN(1)).toString() == mintBeforeAmount0.sub(amount0).toString();
            // assert.equal(cp1 || cp2, true, 'amount0 fail');
            // let cp3 = getAmountsForAllLiquidity.amount1.toString() == mintBeforeAmount1.sub(amount1).toString();
            // let cp4 = getAmountsForAllLiquidity.amount1.toString() == mintBeforeAmount1.sub(amount1).add(new BN(1)).toString();
            // console.log("==="+getAmountsForAllLiquidity.amount1.toString());
            // console.log("==="+mintBeforeAmount1.sub(amount1).add(new BN(1)).toString());
            // assert.equal(cp3 || cp4, true,'amount1 fail');
        });

        it('Call decreaseLiquidity should work', async () => {
            let curTokenId = await mockUniV3PeripheryExtends.curTokenId();
            let pos = await pm.positions(curTokenId);
            let liquidity = pos.liquidity;
            let decreaseLiquidity = await mockUniV3PeripheryExtends.decreaseLiquidity(curTokenId, liquidity, 0, 0);
            expectEvent(decreaseLiquidity, 'DecreaseLiquidity');
        });

        it('Call collect should work', async () => {
            let curTokenId = await mockUniV3PeripheryExtends.curTokenId();
            let pos = await pm.positions(curTokenId);
            let collect = await mockUniV3PeripheryExtends.collect(curTokenId, mockUniV3PeripheryExtends.address, pos.tokensOwed0, pos.tokensOwed1);
            expectEvent(collect, 'Collect');
        });


        it('Call increaseLiquidity should work', async () => {
            let curTokenId = await mockUniV3PeripheryExtends.curTokenId();
            let amount0Desired = await iweth.balanceOf(mockUniV3PeripheryExtends.address);
            let amount1Desired = await iusdt.balanceOf(mockUniV3PeripheryExtends.address);
            let increaseLiquidity = await mockUniV3PeripheryExtends.increaseLiquidity(curTokenId, amount0Desired, amount1Desired, 0, 0);
            expectEvent(increaseLiquidity, 'IncreaseLiquidity');
        });


    });
});
