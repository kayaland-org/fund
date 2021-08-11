const {BN, ether, constants, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const TestHelper = require("../scripts/TestHelper");
const Path = require("../scripts/Path");

const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20');
const INonfungiblePositionManager = artifacts.require('interfaces/uniswap-v3/INonfungiblePositionManager');
const IUniswapV3Factory = artifacts.require('interfaces/uniswap-v3/IUniswapV3Factory');
const IWETH = artifacts.require('interfaces/weth/IWETH');
const UniV3PeripheryExtends = artifacts.require('libraries/UniV3PeripheryExtends');
const UniV3Liquidity = artifacts.require('positions/UniV3Liquidity');

contract('UniV3Liquidity', (accounts) => {

    let uniV3Liquidity;
    let uniV3PM;

    let USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    let WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

    let ioToken = USDT;
    let positionManager = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
    let factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
    let pool;


    let iusdt;
    let iweth;

    let ioTokenInterface;
    let underlying;

    let tickLower = TestHelper.calcTickLower(1.0001, 2300 * 1e6 / 1e18, 60);
    let tickUpper = TestHelper.calcTickUpper(1.0001, 2720 * 1e6 / 1e18, 60);

    before(async () => {
        //create PM
        let uniV3PeripheryExtends = await UniV3PeripheryExtends.new();
        await UniV3Liquidity.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
        uniV3Liquidity = await UniV3Liquidity.new();

        //test before ready
        ioTokenInterface = await IERC20.at(ioToken);
        underlying = [ioToken, WETH];

        //other
        iusdt = await IERC20.at(USDT);
        iweth = await IWETH.at(WETH);
        uniV3PM = await INonfungiblePositionManager.at(positionManager);
        let iUniswapV3Factory = await IUniswapV3Factory.at(factory);
        pool = await iUniswapV3Factory.getPool(WETH, USDT, 3000);
    });

    async function exactInput(fromToken, toToken, amountIn) {
        let iToToken = await IERC20.at(toToken);
        let toTokenBalBefore = await iToToken.balanceOf(uniV3Liquidity.address);
        await expectRevert(uniV3Liquidity.exactInput(fromToken, toToken, amountIn, 0, {from: accounts[1]}),
            'UniV3Liquidity.onlyAuthorize: !authorize');
        let tx = await uniV3Liquidity.exactInput(fromToken, toToken, amountIn, 0);
        let toTokenBalAfter = await iToToken.balanceOf(uniV3Liquidity.address);
        expectEvent(tx, 'Swap', {amountIn: amountIn, amountOut: toTokenBalAfter.sub(toTokenBalBefore)});
    }

    async function exactOutput(fromToken, toToken, amountOut) {
        let iFromToken = await IERC20.at(fromToken);
        let fromTokenBalBefore = await iFromToken.balanceOf(uniV3Liquidity.address);
        let iToToken = await IERC20.at(toToken);
        let toTokenBalBefore = await iToToken.balanceOf(uniV3Liquidity.address);
        await expectRevert(uniV3Liquidity.exactOutput(fromToken, toToken, amountOut, fromTokenBalBefore, {from: accounts[1]}),
            'UniV3Liquidity.onlyAuthorize: !authorize');
        let tx = await uniV3Liquidity.exactOutput(fromToken, toToken, amountOut, fromTokenBalBefore);
        let fromTokenBalAfter = await iFromToken.balanceOf(uniV3Liquidity.address);
        let toTokenBalAfter = await iToToken.balanceOf(uniV3Liquidity.address);
        assert.equal(amountOut.toString(), toTokenBalAfter.sub(toTokenBalBefore).toString(), 'amountOut fail');
        expectEvent(tx, 'Swap', {amountIn: fromTokenBalBefore.sub(fromTokenBalAfter), amountOut: amountOut});
    }

    describe('UniV3Liquidity Setting Test', async () => {

        it('Call bind should work', async () => {
            await expectRevert(uniV3Liquidity.bind(accounts[0], ioToken, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance');
            await uniV3Liquidity.bind(accounts[0], ioToken);
            await expectRevert(uniV3Liquidity.bind(accounts[0], ioToken),
                'UniV3Liquidity.bind: already bind');
        });

        it('Call safeApproveAll should work', async () => {
            await expectRevert(uniV3Liquidity.safeApproveAll(USDT, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance and !strategist');
            await uniV3Liquidity.safeApproveAll(USDT);
            await uniV3Liquidity.safeApproveAll(WETH);

        });

        it('Call settingSwapRoute should work', async () => {
            let weth_usdt_before = Path.encodePath([WETH, USDT], [3000]);
            await expectRevert(uniV3Liquidity.settingSwapRoute(weth_usdt_before, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance');
            await uniV3Liquidity.settingSwapRoute(weth_usdt_before);
            let weth_usdt_after = await uniV3Liquidity.swapRoute(WETH, USDT);
            assert.equal(weth_usdt_before, weth_usdt_after, 'weth_usdt fail');

            let usdt_weth_before = Path.encodePath([USDT, WETH], [3000]);
            await uniV3Liquidity.settingSwapRoute(usdt_weth_before);
            let usdt_weth_after = await uniV3Liquidity.swapRoute(USDT, WETH);
            assert.equal(usdt_weth_before, usdt_weth_after, 'usdt_weth fail');
        });

        it('Call setUnderlyings should work', async () => {
            await expectRevert(uniV3Liquidity.setUnderlyings(underlying, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance');
            await uniV3Liquidity.setUnderlyings(underlying);
        });
        it('Call removeUnderlyings should work', async () => {
            await expectRevert(uniV3Liquidity.removeUnderlyings(underlying, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance');
            await uniV3Liquidity.removeUnderlyings(underlying);
            await uniV3Liquidity.setUnderlyings(underlying);
        });
    });

    describe('UniV3Liquidity Position Test', async () => {

        it('Call exactInput should work', async () => {

            //convert eth->weth
            let wethAmount = new ether('10');
            await iweth.deposit({value: wethAmount});
            await iweth.transfer(uniV3Liquidity.address, wethAmount);

            //WETH->USDT
            let iFromToken0 = await IERC20.at(WETH);
            let balance0 = await iFromToken0.balanceOf(uniV3Liquidity.address);
            await exactInput(WETH, USDT, balance0);

            //USDT->WETH
            let iFromToken1 = await IERC20.at(USDT);
            let balance1 = await iFromToken1.balanceOf(uniV3Liquidity.address);
            await exactInput(USDT, WETH, balance1.div(new BN(2)));
        });

        it('Call exactOutput should work', async () => {
            //convert eth->weth
            let wethAmount = new ether('10');
            await iweth.deposit({value: wethAmount});
            await iweth.transfer(uniV3Liquidity.address, wethAmount);

            //WETH->USDT
            await exactOutput(WETH, USDT, new BN(1000e6));

            //USDT->WETH
            await exactOutput(USDT, WETH, new ether('0.1'));
        });

        it('Call mint should work', async () => {
            let amount0Desired = await iweth.balanceOf(uniV3Liquidity.address);
            let amount1Desired = await iusdt.balanceOf(uniV3Liquidity.address);
            await expectRevert(uniV3Liquidity.mint(WETH, USDT, 3000, tickLower, tickUpper, amount0Desired, amount1Desired, {from: accounts[1]}),
                'UniV3Liquidity.onlyAuthorize: !authorize');
            let mint = await uniV3Liquidity.mint(WETH, USDT, 3000, tickLower, tickUpper, amount0Desired, amount1Desired);
            expectEvent(mint, 'Mint');
            let checkPos = await uniV3Liquidity.checkPos(pool, tickLower, tickUpper);
            let pos = await uniV3PM.positions(checkPos.tokenId);
            assert.equal(pos.liquidity > 0, true, 'liquidity fail');
            let worksPos = await uniV3Liquidity.worksPos();
            assert.equal(worksPos.length, 1, 'mint fail')
        });

        it('Call decreaseLiquidity should work', async () => {
            let checkPos = await uniV3Liquidity.checkPos(pool, tickLower, tickUpper);
            let curTokenId = checkPos.tokenId;
            let pos = await uniV3PM.positions(curTokenId);
            let liquidity = pos.liquidity;
            await expectRevert(uniV3Liquidity.decreaseLiquidity(curTokenId, liquidity, 0, 0, {from: accounts[1]}),
                'UniV3Liquidity.onlyAuthorize: !authorize');
            let decreaseLiquidity = await uniV3Liquidity.decreaseLiquidity(curTokenId, liquidity, 0, 0);
            expectEvent(decreaseLiquidity, 'DecreaseLiquidity');
        });

        it('Call collect should work', async () => {
            let checkPos = await uniV3Liquidity.checkPos(pool, tickLower, tickUpper);
            let curTokenId = checkPos.tokenId;
            let pos = await uniV3PM.positions(curTokenId);
            await expectRevert(uniV3Liquidity.collect(curTokenId, pos.tokensOwed0, pos.tokensOwed1, {from: accounts[1]}),
                'UniV3Liquidity.onlyAuthorize: !authorize');
            let collect = await uniV3Liquidity.collect(curTokenId, pos.tokensOwed0, pos.tokensOwed1);
            expectEvent(collect, 'Collect');
            pos = await uniV3PM.positions(curTokenId);
            assert.equal(pos.liquidity.toString(), '0', 'liquidity fail');
        });
    });

    describe('UniV3Liquidity Assets Test', async () => {

        let checkPos;
        let posBefore;
        let assetsBefore;
        let cashBefore;

        beforeEach(async () => {

            //convert eth->weth
            let wethAmount = new ether('10');
            await iweth.deposit({value: wethAmount});
            await iweth.transfer(uniV3Liquidity.address, wethAmount);

            //WETH->USDT
            let iFromToken0 = await IERC20.at(WETH);
            let balance0 = await iFromToken0.balanceOf(uniV3Liquidity.address);
            await exactInput(WETH, USDT, balance0);

            //USDT->WETH
            let iFromToken1 = await IERC20.at(USDT);
            let balance1 = await iFromToken1.balanceOf(uniV3Liquidity.address);
            await exactInput(USDT, WETH, balance1.div(new BN(2)));

            checkPos = await uniV3Liquidity.checkPos(pool, tickLower, tickUpper);
            let amount0Desired = await iweth.balanceOf(uniV3Liquidity.address);
            let amount1Desired = await iusdt.balanceOf(uniV3Liquidity.address);
            let increaseLiquidity = await uniV3Liquidity.increaseLiquidity(checkPos.tokenId, amount0Desired, amount1Desired, 0, 0);
            expectEvent(increaseLiquidity, 'IncreaseLiquidity');
            posBefore = await uniV3PM.positions(checkPos.tokenId);
            assert.equal(posBefore.liquidity > 0, true, 'liquidity fail');

            assetsBefore = await uniV3Liquidity.assets();
            cashBefore = await iusdt.balanceOf(uniV3Liquidity.address);

        });

        it('Call assets should work', async () => {
            let assets = await uniV3Liquidity.assets();
            assert.notEqual(assets.toString(), '0', 'assets fail');
            let idleAssets = await uniV3Liquidity.idleAssets();
            assert.notEqual(idleAssets.toString(), '0', 'idleAssets fail');
            let liquidityAssets = await uniV3Liquidity.liquidityAssets();
            assert.notEqual(liquidityAssets.toString(), '0', 'liquidityAssets fail');
        });

        it('Call withdraw with ioToken is adequate should work', async () => {
            let scale = cashBefore.mul(new ether('1')).div(assetsBefore);
            await expectRevert(uniV3Liquidity.withdraw(accounts[0], cashBefore, scale, {from: accounts[1]}),
                'UniV3Liquidity.onlyFund: !fund');
            await uniV3Liquidity.withdraw(accounts[0], cashBefore, scale);
            let cashAfter = await iusdt.balanceOf(uniV3Liquidity.address);
            assert.equal(cashBefore.sub(cashAfter).toString(), cashBefore, 'uBalAfter fail');
            let posAfter = await uniV3PM.positions(checkPos.tokenId);
            assert.equal(posBefore.liquidity.toString(), posAfter.liquidity.toString(), 'liquidity fail');
        });

        it('Call withdraw with ioToken is not adequate should work', async () => {

            let uBalBefore = await iusdt.balanceOf(accounts[0]);
            let wBalBefore = await iweth.balanceOf(accounts[0]);

            let withdrawAmount = cashBefore.mul(new BN(2));
            let scale = withdrawAmount.mul(new ether('1')).div(assetsBefore)
            await uniV3Liquidity.withdraw(accounts[0], withdrawAmount, scale);

            let uBalAfter = await iusdt.balanceOf(accounts[0]);
            let wBalAfter = await iweth.balanceOf(accounts[0]);

            assert.equal(uBalAfter.sub(uBalBefore).toString(), withdrawAmount.toString(), 'uBalAfter fail');
            assert.equal(wBalBefore.toString(), wBalAfter.toString(), 'wBalAfter fail');
        });

        it('Call multicall should work', async () => {
            let functions = [{
                abiItem: {
                    name: 'decreaseLiquidity',
                    type: 'function',
                    inputs: [{
                        type: 'uint256',
                        name: 'tokenId'
                    }, {
                        type: 'uint128',
                        name: 'liquidity'
                    }, {
                        type: 'uint256',
                        name: 'amount0Min'
                    }, {
                        type: 'uint256',
                        name: 'amount1Min'
                    }]
                },
                params: [checkPos.tokenId, posBefore.liquidity, 0, 0]
            }];
            let calldatas = [];
            for (var i = 0; i < functions.length; i++) {
                let calldata = web3.eth.abi.encodeFunctionCall(functions[i].abiItem, functions[i].params);
                calldatas[i] = calldata;
            }
            await expectRevert(uniV3Liquidity.multicall(calldatas, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance and !strategist');
            await uniV3Liquidity.multicall(calldatas);
            let posAfter = await uniV3PM.positions(checkPos.tokenId);
            assert.equal(posAfter.tokensOwed0 > 0 || posAfter.tokensOwed1 > 0, true, 'multicall fail');
        });
    });

});

