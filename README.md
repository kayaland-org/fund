#Fund Introduction

#Fund Contracts
|Function|Desc|
|:------------------------------------------ |:-------------------|
| BasicFund| 基金基础合约，定义基本功能与属性 |
| Fund| 基金主合约，提供申购赎回 |
| UniV3Liquidity| 向Uniswap V3 提供流动性| 
| UniV3LiquidityStaker| 向Uniswap V3 提供流动性升级版,增加流动性挖矿功能| 
| ProxyPausable| 代理合约| 



# Fund Develop

## Init
```
npm install
```

## Build
```
truffle compile
```

## Test
```
truffle test --network dev
```