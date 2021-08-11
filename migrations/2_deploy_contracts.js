const {BN, ether} = require('@openzeppelin/test-helpers');
const TestHelper = require("../scripts/TestHelper");
const Path = require("../scripts/Path");

const Fund = artifacts.require('./Fund');
const UniV3Liquidity = artifacts.require('./positions/UniV3Liquidity');
const UniV3PeripheryExtends = artifacts.require('libraries/UniV3PeripheryExtends');

const IWETH = artifacts.require('interfaces/weth/IWETH');
const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20');

//MAIN
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
//KOVAN
// const USDT = '0xE3CbC4BA237c47994fe78162Ae52db8618f22e03';
// const WETH = '0xA38021D5e7Af13fCA8f3f7Af64d7CbBA93E7E9e1';
// const WBTC = '0x80120a46f83dcbA6598A09Db866e3330C091ADBC';

const ioToken = USDT;
const underlying = [ioToken, WETH, WBTC];

const name = 'KF Uniswap Liquidity Fund';
const symbol = 'KFUNLF';

module.exports = async function (deployer, network, accounts) {
    // let fundInstance;
    // await deployer.deploy(Fund, name, symbol).then(function (instance) {
    //     fundInstance = instance;
    // });
    // let uniV3PeripheryExtends;
    // await deployer.deploy(UniV3PeripheryExtends).then(function (instance) {
    //     uniV3PeripheryExtends = instance;
    // });
    // await UniV3Liquidity.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
    // let uniV3LiquidityInstance;
    // await deployer.deploy(UniV3Liquidity).then(function (instance) {
    //     uniV3LiquidityInstance = instance;
    // });
    // await fundInstance.bind(ioToken, uniV3LiquidityInstance.address);
    // await uniV3LiquidityInstance.bind(fundInstance.address, ioToken);
    //
    // await uniV3LiquidityInstance.safeApproveAll(USDT);
    // await uniV3LiquidityInstance.safeApproveAll(WETH);
    // await uniV3LiquidityInstance.safeApproveAll(WBTC);
    //
    // let weth_usdt = Path.encodePath([WETH, USDT], [3000]);
    // console.log("weth_usdt:"+weth_usdt);
    // await uniV3LiquidityInstance.settingSwapRoute(weth_usdt);
    // let usdt_weth = Path.encodePath([USDT, WETH], [3000]);
    // console.log("usdt_weth:"+usdt_weth);
    // await uniV3LiquidityInstance.settingSwapRoute(usdt_weth);
    //
    // let weth_wbtc = Path.encodePath([WETH, WBTC], [3000]);
    // console.log("weth_wbtc:"+weth_wbtc);
    // await uniV3LiquidityInstance.settingSwapRoute(weth_wbtc);
    // let wbtc_weth = Path.encodePath([WBTC, WETH], [3000]);
    // console.log("wbtc_weth:"+wbtc_weth);
    // await uniV3LiquidityInstance.settingSwapRoute(wbtc_weth);
    //
    // await uniV3LiquidityInstance.setUnderlyings(underlying);
    // console.log("Fund:" + fundInstance.address);
    // console.log("UniV3Liquidity:" + uniV3LiquidityInstance.address);

    // await TestHelper.convertWeth(new ether('1'));
    // await TestHelper.exactInput(WETH, USDT, 3000, new ether('1'), uniV3LiquidityInstance.address);
    // let iusdt=await IERC20.at(USDT);
    // let usdtBal=await iusdt.balanceOf(uniV3LiquidityInstance.address);
    // console.log("usdtBal:"+usdtBal);
    // await uniV3LiquidityInstance.exactInput(USDT, WETH, usdtBal.div(new BN("2")), 0);
    // let iweth=await IWETH.at(WETH);
    // let wethBal =await iweth.balanceOf(uniV3LiquidityInstance.address);
    // console.log("wethBal:"+wethBal);
};
