// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WaveVault
 * @notice Vault contract that distributes USDT rewards to prize pool winners
 * @dev Called by authorized prize pool contracts when winners claim XP tokens
 */
contract WaveVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ----------- Storage -----------
    IERC20 public immutable usdt;
    
    // Authorized contracts that can trigger distributions
    mapping(address => bool) public authorizedCallers;
    
    // Distribution tracking
    mapping(address => uint256) public totalDistributed;
    mapping(bytes32 => bool) public processedClaims;
    
    // Reward calculation parameters
    uint256 public baseRewardRate = 1e6; // 1 USDT per 1e18 XP (6 decimals for USDT)
    uint256 public maxRewardPerClaim = 1000e6; // Max 1000 USDT per claim
    uint256 public minRewardThreshold = 1e6; // Min 1 USDT to trigger distribution
    
    // ----------- Events -----------
    event RewardDistributed(
        bytes32 indexed poolId,
        address indexed winner,
        uint256 xpAmount,
        uint256 usdtAmount,
        address caller
    );
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event RewardParametersUpdated(uint256 baseRate, uint256 maxReward, uint256 minThreshold);
    event EmergencyWithdraw(address indexed token, uint256 amount, address to);
    event USDTDeposited(address indexed depositor, uint256 amount);

    // ----------- Errors -----------
    error UnauthorizedCaller();
    error InvalidRewardParameters();
    error ClaimAlreadyProcessed();
    error InsufficientVaultBalance();
    error ZeroAmount();
    error InvalidAddress();

    // ----------- Constructor -----------
    constructor(address _usdt, address _owner) Ownable(_owner) {
        if (_usdt == address(0)) revert InvalidAddress();
        usdt = IERC20(_usdt);
    }

    // ----------- Modifiers -----------
    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    // ----------- External Functions -----------

    /**
     * @notice Distribute USDT rewards to winner when they claim XP tokens
     * @param poolId Unique identifier for the prize pool claim
     * @param winner Address of the winner receiving rewards
     * @param xpAmount Amount of XP tokens being claimed
     * @dev Can only be called by authorized prize pool contracts
     */
    function distributeReward(
        bytes32 poolId,
        address winner,
        uint256 xpAmount
    ) external onlyAuthorized whenNotPaused nonReentrant {
        if (winner == address(0)) revert InvalidAddress();
        if (xpAmount == 0) revert ZeroAmount();
        if (processedClaims[poolId]) revert ClaimAlreadyProcessed();

        // Calculate USDT reward based on XP amount
        uint256 usdtReward = _calculateReward(xpAmount);
        
        // Skip distribution if below minimum threshold
        if (usdtReward < minRewardThreshold) {
            processedClaims[poolId] = true;
            return;
        }

        // Check vault has sufficient balance
        uint256 vaultBalance = usdt.balanceOf(address(this));
        if (vaultBalance < usdtReward) revert InsufficientVaultBalance();

        // Mark claim as processed
        processedClaims[poolId] = true;
        
        // Update tracking
        totalDistributed[winner] += usdtReward;

        // Transfer USDT to winner
        usdt.safeTransfer(winner, usdtReward);

        emit RewardDistributed(poolId, winner, xpAmount, usdtReward, msg.sender);
    }

    /**
     * @notice Deposit USDT into the vault for distribution
     * @param amount Amount of USDT to deposit
     */
    function depositUSDT(uint256 amount) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        
        emit USDTDeposited(msg.sender, amount);
    }

    // ----------- Admin Functions -----------

    /**
     * @notice Set authorization status for prize pool contracts
     * @param caller Address of the contract to authorize/deauthorize
     * @param authorized Whether the contract is authorized
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert InvalidAddress();
        
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /**
     * @notice Update reward calculation parameters
     * @param _baseRewardRate USDT per XP token (scaled for USDT decimals)
     * @param _maxRewardPerClaim Maximum USDT reward per single claim
     * @param _minRewardThreshold Minimum USDT amount to trigger distribution
     */
    function setRewardParameters(
        uint256 _baseRewardRate,
        uint256 _maxRewardPerClaim,
        uint256 _minRewardThreshold
    ) external onlyOwner {
        if (_baseRewardRate == 0 || _maxRewardPerClaim == 0) revert InvalidRewardParameters();
        if (_minRewardThreshold > _maxRewardPerClaim) revert InvalidRewardParameters();
        
        baseRewardRate = _baseRewardRate;
        maxRewardPerClaim = _maxRewardPerClaim;
        minRewardThreshold = _minRewardThreshold;
        
        emit RewardParametersUpdated(_baseRewardRate, _maxRewardPerClaim, _minRewardThreshold);
    }

    /**
     * @notice Emergency withdraw function for any ERC20 token
     * @param token Address of token to withdraw (address(0) for ETH)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            // Withdraw ETH
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // Withdraw ERC20
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, amount, to);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ----------- View Functions -----------

    /**
     * @notice Calculate USDT reward for given XP amount
     * @param xpAmount Amount of XP tokens
     * @return usdtAmount Calculated USDT reward
     */
    function calculateReward(uint256 xpAmount) external view returns (uint256 usdtAmount) {
        return _calculateReward(xpAmount);
    }

    /**
     * @notice Get vault balance and distribution stats
     * @return vaultBalance Current USDT balance in vault
     * @return totalUsers Number of users who received distributions
     */
    function getVaultStats() external view returns (uint256 vaultBalance, uint256 totalUsers) {
        vaultBalance = usdt.balanceOf(address(this));
        // Note: totalUsers would need additional tracking if required
        totalUsers = 0; // Placeholder - implement if needed
    }

    /**
     * @notice Check if a claim has been processed
     * @param poolId Pool identifier to check
     * @return processed Whether the claim has been processed
     */
    function isClaimProcessed(bytes32 poolId) external view returns (bool processed) {
        return processedClaims[poolId];
    }

    // ----------- Internal Functions -----------

    /**
     * @notice Internal function to calculate USDT reward
     * @param xpAmount Amount of XP tokens
     * @return usdtAmount Calculated USDT reward (capped at maximum)
     */
    function _calculateReward(uint256 xpAmount) internal view returns (uint256 usdtAmount) {
        // Prevent overflow: check if xpAmount * baseRewardRate would overflow
        if (xpAmount > type(uint256).max / baseRewardRate) {
            usdtAmount = maxRewardPerClaim;
        } else {
            // Calculate base reward: xpAmount * baseRewardRate / 1e18
            // This converts from 18-decimal XP to 6-decimal USDT
            usdtAmount = (xpAmount * baseRewardRate) / 1e18;
            
            // Cap at maximum reward per claim
            if (usdtAmount > maxRewardPerClaim) {
                usdtAmount = maxRewardPerClaim;
            }
        }
        
        return usdtAmount;
    }

    // ----------- Receive Function -----------
    receive() external payable {}
}
