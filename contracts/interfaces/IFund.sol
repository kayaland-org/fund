// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

/// @title Fund - the fund interface
/// @notice This contract extends ERC20, defines basic fund functions and rewrites ERC20 transferFrom function
interface IFund {

    /// @notice Fund cap
    /// @dev The max number of fund to be issued
    /// @return Max fund cap
    function getCap() external view returns (uint256);

    /// @notice The net worth of the fund from the time the last fee collected
    /// @dev This is used to calculate the performance fee
    /// @param account Account address
    /// @return The net worth of the fund
    function accountNetValue(address account) external view returns (uint256);

    /// @notice The current fund net worth
    /// @dev This is used to update and calculate account net worth
    /// @return The net worth of the fund
    function globalNetValue() external view returns (uint256);

    /// @notice Convert fund amount to cash amount
    /// @dev This converts the user fund amount to cash amount when a user redeems the fund
    /// @param fundAmount Redeem fund amount
    /// @return Cash amount
    function convertToCash(uint256 fundAmount) external view returns (uint256);

    /// @notice Convert cash amount to fund amount
    /// @dev This converts cash amount to fund amount when a user buys the fund
    /// @param cashAmount Join cash amount
    /// @return Fund amount
    function convertToFund(uint256 cashAmount) external view returns (uint256);

    /// @notice Fund token address for joining and redeeming
    /// @dev This is address is created when the fund is first created.
    /// @return Fund token address
    function ioToken() external view returns (address);

    /// @notice Fund mangement contract address
    /// @dev The fund management contract address is bind to the fund when the fund is created
    /// @return Fund management contract address
    function PM() external view returns (address);

    /// @notice Fund total asset
    /// @dev This calculates fund net worth or AUM
    /// @return Fund total asset
    function assets()external view returns(uint256);

}
