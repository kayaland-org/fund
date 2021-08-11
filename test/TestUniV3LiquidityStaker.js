const {BN, ether, constants, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const TestHelper = require("../scripts/TestHelper");
const ChainHelper = require("../scripts/ChainHelper");
const Path = require("../scripts/Path");

const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20');
const INonfungiblePositionManager = artifacts.require('interfaces/uniswap-v3/INonfungiblePositionManager');
const IUniswapV3Factory = artifacts.require('interfaces/uniswap-v3/IUniswapV3Factory');
const IWETH = artifacts.require('interfaces/weth/IWETH');
const UniV3PeripheryExtends = artifacts.require('libraries/UniV3PeripheryExtends');
const UniV3LiquidityStaker = artifacts.require('positions/UniV3LiquidityStaker');

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
        await UniV3LiquidityStaker.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
        uniV3Liquidity = await UniV3LiquidityStaker.new();

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

    describe('UniV3Liquidity Position Init Test', async () => {

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
    });


    describe('UniV3Liquidity Staker Test', async () => {

        let staker = "0x1f98407aaB862CdDeF78Ed252D6f557aA5b0f00d";
        let checkPos;
        let incentveKey;
        before(async () => {
            //convert eth->weth
            let wethAmount = new ether('10');
            await iweth.deposit({value: wethAmount});
            await iweth.transfer(uniV3Liquidity.address, wethAmount);
            checkPos = await uniV3Liquidity.checkPos(pool, tickLower, tickUpper);
            let currentTime = Math.floor(Date.now() / 1000);
            incentveKey = [WETH, pool, currentTime + 60, currentTime + 600, uniV3Liquidity.address];
        });

        it('Call createIncentive should work', async () => {
            await uniV3Liquidity.createIncentive(incentveKey[0], incentveKey[1], incentveKey[2], incentveKey[3], 1000000);
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, false, 'checkStakers fail');
            let owner = await uniV3PM.ownerOf(checkPos.tokenId);
            assert.equal(uniV3Liquidity.address, owner, 'createIncentive fail');
            await ChainHelper.increaseBlockTime(60);
        });

        it('Call stakerNFT should work', async () => {
            let stakerNFT = await uniV3Liquidity.stakerNFT(checkPos.tokenId);
            expectEvent(stakerNFT, 'Staker');
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, true, 'checkStakers fail');
            let owner = await uniV3PM.ownerOf(checkPos.tokenId);
            assert.equal(staker, owner, 'stakerNFT fail');
        });

        it('Call stakeToken should work', async () => {
            await uniV3Liquidity.stakeToken(incentveKey[0], incentveKey[1], incentveKey[2], incentveKey[3], checkPos.tokenId);
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, true, 'checkStakers fail');
        });

        it('Call unStakeToken should work', async () => {
            await uniV3Liquidity.unStakeToken(incentveKey[0], incentveKey[1], incentveKey[2], incentveKey[3], checkPos.tokenId);
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, true, 'checkStakers fail');
        });

        it('Call claimReward should work', async () => {
            await uniV3Liquidity.claimReward(USDT);
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, true, 'checkStakers fail');
        });

        it('Call withdrawToken should work', async () => {
            let data = web3.eth.abi.encodeParameters([], []);
            let stakerCall = await uniV3Liquidity.withdrawToken(checkPos.tokenId, data);
            let owner = await uniV3PM.ownerOf(checkPos.tokenId);
            assert.equal(uniV3Liquidity.address, owner, 'withdrawToken fail');
            expectEvent(stakerCall, 'UnStaker');
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, false, 'checkStakers fail');
        });

        it('Call endIncentive should work', async () => {
            await ChainHelper.increaseBlockTime(600);
            await uniV3Liquidity.endIncentive(incentveKey[0], incentveKey[1], incentveKey[2], incentveKey[3]);
            let isStaker = await uniV3Liquidity.checkStakers(checkPos.tokenId);
            assert.equal(isStaker, false, 'checkStakers fail');
            let owner = await uniV3PM.ownerOf(checkPos.tokenId);
            assert.equal(uniV3Liquidity.address, owner, 'createIncentive fail');
        });
    });
});

