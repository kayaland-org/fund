const {BN, ether, constants, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const ChainHelper = require("../scripts/ChainHelper");
const TestHelper = require("../scripts/TestHelper");

const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20');
const ProxyPausable = artifacts.require('migrate/ProxyPausable');
const ISmartPool = artifacts.require('migrate/ISmartPool');
const Fund = artifacts.require('Fund');
const MockAssetManager = artifacts.require('mock/MockAssetManager');


contract('Fund', (accounts) => {

    let USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    let WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    let ioToken = USDT;

    let ioTokenInterface;

    before(async () => {
        //test before ready
        ioTokenInterface = await IERC20.at(USDT);
        await TestHelper.convertWeth(new ether('100'));
    });


    describe('Fund V2 Test', async () => {

        let name = 'KF Uniswap Liquidity Fund';
        let symbol = 'KFUNLF';

        let fund;
        let mockAM;

        before(async () => {
            fund = await Fund.new(name, symbol);
            mockAM = await MockAssetManager.new(ioToken);
            await ioTokenInterface.approve(fund.address, 0, {from: accounts[1]});
            await ioTokenInterface.approve(fund.address, new ether('100'), {from: accounts[1]});
        });

        it('Call bind should work', async () => {
            await expectRevert(fund.bind(ioToken, mockAM.address,{from:accounts[1]}),'GovIdentity.onlyGovernance: !governance');
            await fund.bind(ioToken, mockAM.address);
            assert.equal(await fund.ioToken(), ioToken, 'ioToken fail');
            assert.equal(await fund.AM(), mockAM.address, 'PM fail');
            await expectRevert(fund.bind(ioToken, mockAM.address),'Fund.bind: already bind');
        });

        it('Call setCap should work', async () => {
            let preCap = new ether('1');
            await expectRevert(fund.setCap(preCap, {from: accounts[1]}),
                'GovIdentity.onlyGovernance: !governance and !strategist');
            let tx = await fund.setCap(preCap);
            let cap = await fund.getCap();
            assert.equal(cap.toString(), preCap.toString(), 'cap fail');
            expectEvent(tx, 'CapChanged', {setter: accounts[0], oldCap: new BN('0'), newCap: preCap});
        });

        it('Call setFee should work', async () => {
            await expectRevert(fund.setFee(0, 1, 1000, 0, {from: accounts[1]}), 'GovIdentity.onlyGovernance: !governance');
            await expectRevert(fund.setFee(0, 1001, 1000, 0), 'BasicFund.setFee: ratio<=denominator');
            await fund.setFee(0, 1, 1000, 0);
            await fund.setFee(1, 2, 1000, 0);
            await fund.setFee(2, 2, 100, 0);
            let fee4Before = await fund.getFee(3);
            let tx4 = await fund.setFee(3, 20, 100, 0);
            let fee4After = await fund.getFee(3);
            assert.equal(fee4After.ratio.toString(), '20', 'ratio fail');
            assert.equal(fee4After.denominator.toString(), '100', 'denominator fail');
            assert.equal(fee4After.lastTimestamp > 0, true, 'lastTimestamp fail');
            expectEvent(tx4, 'FeeChanged', {
                setter: accounts[0], oldRatio: fee4Before.ratio, oldDenominator: fee4Before.denominator,
                newRatio: fee4After.ratio, newDenominator: fee4After.denominator
            });
            // await expectRevert(fund.setFee(0, 1, 1000, 0), 'BasicFund.setFee: already set fee');
        });

        describe('Fund V2 Test Join/Exit', async () => {

            let fundTotalSupplyBefore;
            let expectJXFee;
            let expectPFee;
            let mFeeSetting;
            let tx;
            let userFundBal0Before;
            let userFundBal1Before;
            let globalNetValueBefore;
            let userNetValue0Before;
            let userNetValue1Before;

            beforeEach(async () => {
                userFundBal0Before = await fund.balanceOf(accounts[0]);
                userFundBal1Before = await fund.balanceOf(accounts[1]);
                mFeeSetting = await fund.getFee(2);
                fundTotalSupplyBefore=await fund.totalSupply();
                // console.log('fundTotalSupplyBefore:'+fundTotalSupplyBefore);
                // let assets=await fund.assets();
                // console.log('assets:'+assets);

                //change netValue
                if(fundTotalSupplyBefore!=0){
                    await TestHelper.exactInput(WETH, USDT, 3000, new ether('1'), accounts[0]);
                    let depAmount=new BN(10e6);
                    await ioTokenInterface.transfer(mockAM.address,depAmount);
                }

                globalNetValueBefore=await fund.globalNetValue();
                // console.log('globalNetValueBefore:'+globalNetValueBefore);
                userNetValue0Before=await fund.accountNetValue(accounts[0]);
                // console.log('userNetValue0Before:'+userNetValue0Before);
                userNetValue1Before=await fund.accountNetValue(accounts[1]);
                // console.log('userNetValue1Before:'+userNetValue1Before);
            });

            it('Call joinPool should work', async () => {
                await TestHelper.exactInput(WETH, USDT, 3000, new ether('1'), accounts[1]);
                let uBalOfPMBefore = await ioTokenInterface.balanceOf(mockAM.address);
                let useAmount = await ioTokenInterface.balanceOf(accounts[1]);
                tx = await fund.joinPool(useAmount, {from: accounts[1]});
                let fundBalAfter = await fund.balanceOf(accounts[1]);
                let uBalOfPMAfter = await ioTokenInterface.balanceOf(mockAM.address);
                assert.equal(useAmount.toString(), uBalOfPMAfter.sub(uBalOfPMBefore).toString(), 'uBalOfPMAfter fail');
                expectEvent(tx, 'PoolJoined', {
                    investor: accounts[1],
                    amount: fundBalAfter.sub(userFundBal1Before)
                });
                let netValue = await fund.accountNetValue(accounts[1]);
                assert.equal(netValue.toString(), new ether('1').toString(), 'netValue fail');
                expectJXFee = await TestHelper.calcRatioFee(fund, 0, useAmount);
            });

            it('Call exitPool should work', async () => {
                let fundAmount = userFundBal1Before.div(new BN(2));
                tx= await fund.exitPool(fundAmount, {from: accounts[1]});
                let fundBalAfter = await fund.balanceOf(accounts[1]);
                expectEvent(tx, 'PoolExited', {
                    investor: accounts[1],
                    amount: userFundBal1Before.sub(fundBalAfter)
                });
                let netValue = await fund.accountNetValue(accounts[1]);
                assert.equal(netValue.toString(), globalNetValueBefore.toString(), 'netValue fail');
                expectJXFee = await TestHelper.calcRatioFee(fund, 1, fundAmount);
            });

            it('Call exitPoolOfUnderlying should work', async () => {
                tx = await fund.exitPoolOfUnderlying(userFundBal1Before, {from: accounts[1]});
                let fundBalAfter = await fund.balanceOf(accounts[1]);
                expectEvent(tx, 'PoolExited', {
                    investor: accounts[1],
                    amount: userFundBal1Before.sub(fundBalAfter)
                });
                let netValue = await fund.accountNetValue(accounts[1]);
                assert.equal(netValue.toString(), '0', 'netValue fail');
                expectJXFee = await TestHelper.calcRatioFee(fund, 1, userFundBal1Before);
            });

            afterEach(async () => {
                // console.log('expectJXFee:'+expectJXFee);
                let userFundBal0After = await fund.balanceOf(accounts[0]);
                let blockTime=await ChainHelper.getBlockTime(tx.receipt.blockNumber);
                let expectMFee = await TestHelper.calcManagementFee(fund,fundTotalSupplyBefore, mFeeSetting.lastTimestamp, blockTime);
                // console.log('expectMFee:'+expectMFee);
                expectPFee = await TestHelper.calcPerformanceFee(fund,userFundBal1Before.sub(expectJXFee),userNetValue1Before,globalNetValueBefore);
                // console.log('expectPFee:'+expectPFee);
                assert.equal(expectJXFee.add(expectMFee).add(expectPFee).toString(), userFundBal0After.sub(userFundBal0Before).toString(), 'take fee fail');
            });

        });
    });

    // describe('Fund V2 Test Upgrade', async () => {
    //
    //     //KF Uniswap Liquidity Fund
    //     let oldFund = '0x2Ac64f23D5546248F54c48F8E4BCAA94b32De708';
    //     let oldImpl = "0xbb927Ac36050a29F75C57cEDC2C22f5578bF1e87";
    //     let oldHasFundAccount = '0x8f229613A60FaE024E09172Fb4fD70Df8abDCfda';
    //
    //     let name_before;
    //     let symbol_before;
    //     let decimals_before;
    //     let totalSupply_before;
    //     let balanceOf_before;
    //     let governance_before;
    //     let strategist_before;
    //     let rewards_before;
    //     let cap_before;
    //     let fee0_before;
    //     let fee1_before;
    //     let fee2_before;
    //     let fee3_before;
    //     let net_before;
    //     let token_before;
    //
    //     before(async () => {
    //
    //         let fundProxy = await ProxyPausable.at(oldFund);
    //         let proxyOwner=await fundProxy.getProxyOwner();
    //         await fundProxy.setImplementation(oldImpl, {from: proxyOwner});
    //
    //         let oldFundLogic = await ISmartPool.at(oldFund);
    //         name_before = await oldFundLogic.name();
    //         symbol_before = await oldFundLogic.symbol();
    //         decimals_before = await oldFundLogic.decimals();
    //         totalSupply_before = await oldFundLogic.totalSupply();
    //         balanceOf_before = await oldFundLogic.balanceOf(oldHasFundAccount);
    //         governance_before = await oldFundLogic.getGovernance();
    //         strategist_before = await oldFundLogic.getStrategist();
    //         rewards_before = await oldFundLogic.getRewards();
    //         cap_before = await oldFundLogic.getCap();
    //         fee0_before = await oldFundLogic.getFee(0);
    //         fee1_before = await oldFundLogic.getFee(1);
    //         fee2_before = await oldFundLogic.getFee(2);
    //         fee3_before = await oldFundLogic.getFee(3);
    //         net_before = await oldFundLogic.getNet(oldHasFundAccount);
    //         token_before=await oldFundLogic.token();
    //     });
    //
    //     it('Call bind should work', async () => {
    //         let fundProxy = await ProxyPausable.at(oldFund);
    //         let proxyOwner=await fundProxy.getProxyOwner();
    //         let fund = await Fund.new('A', 'B');
    //         await fundProxy.setImplementation(fund.address, {from: proxyOwner});
    //         let mockAM = await MockAssetManager.new(oldFund);
    //         let newFundLogic = await Fund.at(oldFund);
    //
    //         let ioTokenBefore=await newFundLogic.ioToken();
    //         if(ioTokenBefore!=ioToken){
    //             await expectRevert(fund.bind(ioToken, mockAM.address,{from:accounts[1]}),'GovIdentity.onlyGovernance: !governance');
    //             await newFundLogic.bind(ioToken, mockAM.address,{from: proxyOwner});
    //             assert.equal(await newFundLogic.ioToken(), ioToken, 'ioToken fail');
    //             assert.equal(await newFundLogic.AM(), mockAM.address, 'PM fail');
    //         }
    //         await expectRevert(newFundLogic.bind(ioToken, mockAM.address,{from: proxyOwner}),'Fund.bind: already bind');
    //     });
    //
    //     after(async () => {
    //         let newFundLogic = await Fund.at(oldFund);
    //         let name_after = await newFundLogic.name();
    //         // console.log("name:" + name_after);
    //         assert.equal(name_before, name_after, 'Check name fail');
    //         let symbol_after = await newFundLogic.symbol();
    //         // console.log("symbol:" + symbol_after);
    //         assert.equal(symbol_before, symbol_after, 'Check symbol fail');
    //         let decimals_after = await newFundLogic.decimals();
    //         // console.log("decimals:" + decimals_after);
    //         assert.equal(decimals_before.toString(), decimals_after.toString(), 'decimals fail');
    //         let totalSupply_after = await newFundLogic.totalSupply();
    //         // console.log("totalSupply:" + totalSupply_after);
    //         assert.equal(totalSupply_before.toString(), totalSupply_after.toString(), 'totalSupply fail');
    //         let balanceOf_after = await newFundLogic.balanceOf(oldHasFundAccount);
    //         // console.log("balanceOf:" + balanceOf_after);
    //         assert.equal(balanceOf_before.toString(), balanceOf_after.toString(), 'balanceOf fail');
    //         let governance_after = await newFundLogic.getGovernance();
    //         // console.log("governance:" + governance_after);
    //         assert.equal(governance_before.toString(), governance_after.toString(), 'governance fail');
    //         let strategist_after = await newFundLogic.getStrategist();
    //         // console.log("strategist:" + strategist_after);
    //         assert.equal(strategist_before.toString(), strategist_after.toString(), 'strategist fail');
    //         let rewards_after = await newFundLogic.getRewards();
    //         // console.log("rewards:" + rewards_after);
    //         assert.equal(rewards_before.toString(), rewards_after.toString(), 'rewards fail');
    //         let cap_after = await newFundLogic.getCap();
    //         // console.log("cap:" + cap_after);
    //         assert.equal(cap_before.toString(), cap_after.toString(), 'cap fail');
    //         let fee0_after = await newFundLogic.getFee(0);
    //         // console.log("fee0:" + fee0_after);
    //         assert.equal(fee0_before.toString(), fee0_after.toString(), 'fee0 fail');
    //         let fee1_after = await newFundLogic.getFee(1);
    //         // console.log("fee1:" + fee1_after);
    //         assert.equal(fee1_before.toString(), fee1_after.toString(), 'fee1 fail');
    //         let fee2_after = await newFundLogic.getFee(2);
    //         // console.log("fee2:" + fee2_after);
    //         assert.equal(fee2_before.toString(), fee2_after.toString(), 'fee2 fail');
    //         let fee3_after = await newFundLogic.getFee(3);
    //         // console.log("fee3:" + fee3_after);
    //         assert.equal(fee3_before.toString(), fee3_after.toString(), 'fee3 fail');
    //         let net_after = await newFundLogic.accountNetValue(oldHasFundAccount);
    //         // console.log("net:" + net_after);
    //         assert.equal(net_before.toString(), net_after.toString(), 'net fail');
    //         let token_after = await newFundLogic.ioToken();
    //     });
    // });

});
