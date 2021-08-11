const IWETH = artifacts.require('interfaces/weth/IWETH');
const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20');
const UniV3PeripheryExtends = artifacts.require('libraries/UniV3PeripheryExtends');
const UniV3Liquidity = artifacts.require('positions/UniV3Liquidity');

contract('UniV3Liquidity', (accounts) => {

    let uniV3Liquidity;

    let USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    let WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

    let uniV3 = "0x3A732dAB1A9995035f79956c29a5F4396a510391";

    before(async () => {
        //create PM
        // let uniV3PeripheryExtends = await UniV3PeripheryExtends.new();
        // await UniV3Liquidity.link('UniV3PeripheryExtends', uniV3PeripheryExtends.address);
        // uniV3Liquidity = await UniV3Liquidity.at(uniV3);
    });


    describe('UniV3Liquidity Test', async () => {
        // it('Call swapRoute should work', async () => {
        //     let path = await uniV3Liquidity.swapRoute(WETH, USDT);
        //     console.log("path:" + path);
        //     let iusdt = await IERC20.at(USDT);
        //     let usdtBal = await iusdt.balanceOf(uniV3);
        //     console.log("usdtBal:" + usdtBal);
        //     let iweth = await IWETH.at(WETH);
        //     let wethBal = await iweth.balanceOf(uniV3);
        //     console.log("wethBal:" + wethBal);
        // });

        it('Call decode should work', async () => {

            let data = "0x000000000000000000000000a38021d5e7af13fca8f3f7af64d7cbba93e7e9e1000000000000000000000000e3cbc4ba237c47994fe78162ae52db8618f22e030000000000000000000000000000000000000000000000000000000000000bb8fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf4f0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf658000000000000000000000000000000000000000000000000061f1656b93e20e800000000000000000000000000000000000000000000000000000003ee9736ec";
            let result=web3.eth.abi.decodeParameters(
                ["address","address","uint24","int24","int24","uint256","uint256"], data
            );
            console.log(JSON.stringify(result));
        });
    });
});

