const {BN} = require('@openzeppelin/test-helpers');

const IWETH = artifacts.require('interfaces/weth/IWETH');
const MockUniV3PeripheryExtends = artifacts.require('mock/MockUniV3PeripheryExtends');
const UniV3PeripheryExtends = artifacts.require('libraries/UniV3PeripheryExtends');
const Path = require("./Path");

let WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

function calcTickLower(x,y,tp){
    let log= Math.log(y) / Math.log(x);
   return Math.floor(log/tp)*tp;
}

function calcTickUpper(x,y,tp){
    let log= Math.log(y) / Math.log(x);
    return Math.ceil(log/tp)*tp;
}

function calcTickPrice(tick,d0,d1){
    return 1.0001**(tick)*10**(d0-d1);
}

async function calcManagementFee(fund,totalSupply,startTime,endTime){
    let fee = await fund.getFee(2);
    let denominator = new BN(fee.denominator.toString() === '0' ? 1000 : fee.denominator.toString());
    if (startTime === 0) return 0;
    let diff = new BN(endTime.toString()).sub(new BN(startTime.toString()));
    return totalSupply.mul(diff).mul(new BN(fee.ratio.toString())).div(denominator.mul(new BN('31557600')));
}

async function calcPerformanceFee(fund, balance, oldNet,newNet) {
    if (newNet.toString() === '0') return new BN();
    let diff = newNet > oldNet ? newNet.sub(oldNet) : 0;
    let fee = await fund.getFee(3);
    let denominator = new BN(fee.denominator.toString() === '0' ? 1000 : fee.denominator.toString());
    let cash = diff.mul(balance).mul(new BN(fee.ratio.toString())).div(denominator);
    return cash.div(newNet);
}

async function calcRatioFee(fund, feeType, fundAmount) {
    let fee = await fund.getFee(feeType);
    let denominator = new BN(fee.denominator.toString() === '0' ? 1000 : fee.denominator.toString());
    let amountRatio = fundAmount.div(denominator);
    return amountRatio.mul(new BN(fee.ratio.toString()));
}


async function convertWeth(amount){
    let iweth = await IWETH.at(WETH);
    await iweth.deposit({value: amount});
}

// async function exactInputSingle(fromToken,toToken,fee,amountIn,to){
//     let uniV3PeripheryExtends = await UniV3PeripheryExtends.new();
//     MockUniV3PeripheryExtends.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
//     let mockUniV3PeripheryExtends = await MockUniV3PeripheryExtends.new();
//     let erc20 = await IWETH.at(fromToken);
//     await erc20.transfer(mockUniV3PeripheryExtends.address, amountIn);
//     await mockUniV3PeripheryExtends.exactInputSingle(fromToken, toToken, fee, to, amountIn, 0);
// }

async function exactInput(fromToken,toToken,fee,amountIn,to){
    let uniV3PeripheryExtends = await UniV3PeripheryExtends.new();
    MockUniV3PeripheryExtends.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
    let mockUniV3PeripheryExtends = await MockUniV3PeripheryExtends.new();
    let ep = Path.encodePath([fromToken, toToken], [fee]);
    await mockUniV3PeripheryExtends.settingSwapRoute(ep);
    let erc20 = await IWETH.at(fromToken);
    await erc20.transfer(mockUniV3PeripheryExtends.address, amountIn);
    await mockUniV3PeripheryExtends.exactInput(fromToken, toToken,amountIn, to, 0);
}


module.exports = {
    calcTickLower,
    calcTickUpper,
    calcTickPrice,
    calcManagementFee,
    calcPerformanceFee,
    calcRatioFee,
    convertWeth,
    exactInput
};







