// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import "../storage/GovIdentityStorage.sol";

contract GovIdentity {

    constructor() {
        _init();
    }

    function _init() internal{
        GovIdentityStorage.Identity storage identity= GovIdentityStorage.load();
        identity.governance = msg.sender;
        identity.strategist = msg.sender;
        identity.rewards = msg.sender;
    }

    modifier onlyStrategist() {
        GovIdentityStorage.Identity memory identity= GovIdentityStorage.load();
        require(msg.sender == identity.strategist, "GovIdentity.onlyStrategist: !strategist");
        _;
    }

    modifier onlyGovernance() {
        GovIdentityStorage.Identity memory identity= GovIdentityStorage.load();
        require(msg.sender == identity.governance, "GovIdentity.onlyGovernance: !governance");
        _;
    }

    modifier onlyStrategistOrGovernance() {
        GovIdentityStorage.Identity memory identity= GovIdentityStorage.load();
        require(msg.sender == identity.strategist || msg.sender == identity.governance, "GovIdentity.onlyGovernance: !governance and !strategist");
        _;
    }

    function setRewards(address _rewards) public onlyGovernance{
        GovIdentityStorage.Identity storage identity= GovIdentityStorage.load();
        identity.rewards = _rewards;
    }

    function setStrategist(address _strategist) public onlyGovernance{
        GovIdentityStorage.Identity storage identity= GovIdentityStorage.load();
        identity.strategist = _strategist;
    }

    function setGovernance(address _governance) public onlyGovernance{
        GovIdentityStorage.Identity storage identity= GovIdentityStorage.load();
        identity.governance = _governance;
    }

    function getRewards() public pure returns(address){
        GovIdentityStorage.Identity memory identity= GovIdentityStorage.load();
        return identity.rewards ;
    }

    function getStrategist() public pure returns(address){
        GovIdentityStorage.Identity memory identity= GovIdentityStorage.load();
        return identity.strategist;
    }

    function getGovernance() public pure returns(address){
        GovIdentityStorage.Identity memory identity= GovIdentityStorage.load();
        return identity.governance;
    }

}
