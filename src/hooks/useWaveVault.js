import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { WaveVaultContract } from '../lib/contracts/waveVault';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';

export const useWaveVault = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    vaultBalance: '0',
    totalUsers: '0',
    baseRewardRate: '0',
    maxRewardPerClaim: '0',
    minRewardThreshold: '0'
  });

  // Contract reads
  const { data: owner } = useReadContract({
    ...WaveVaultContract,
    functionName: 'owner',
  });

  const { data: paused } = useReadContract({
    ...WaveVaultContract,
    functionName: 'paused',
  });

  const { data: vaultStats, refetch: refetchStats } = useReadContract({
    ...WaveVaultContract,
    functionName: 'getVaultStats',
  });

  const { data: baseRewardRate } = useReadContract({
    ...WaveVaultContract,
    functionName: 'baseRewardRate',
  });

  const { data: maxRewardPerClaim } = useReadContract({
    ...WaveVaultContract,
    functionName: 'maxRewardPerClaim',
  });

  const { data: minRewardThreshold } = useReadContract({
    ...WaveVaultContract,
    functionName: 'minRewardThreshold',
  });

  // Contract writes
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Update stats when data changes
  useEffect(() => {
    if (vaultStats && baseRewardRate && maxRewardPerClaim && minRewardThreshold) {
      setStats({
        vaultBalance: formatUnits(vaultStats[0] || 0n, 6), // USDT has 6 decimals
        totalUsers: vaultStats[1]?.toString() || '0',
        baseRewardRate: formatUnits(baseRewardRate || 0n, 6),
        maxRewardPerClaim: formatUnits(maxRewardPerClaim || 0n, 6),
        minRewardThreshold: formatUnits(minRewardThreshold || 0n, 6)
      });
    }
  }, [vaultStats, baseRewardRate, maxRewardPerClaim, minRewardThreshold]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      toast.success('Transaction confirmed!');
      refetchStats();
      setLoading(false);
    }
  }, [isConfirmed, refetchStats]);

  // Handle transaction error
  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Transaction failed');
      setLoading(false);
    }
  }, [error]);

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Contract functions
  const setAuthorizedCaller = async (caller, authorized) => {
    if (!isOwner) {
      toast.error('Only owner can perform this action');
      return;
    }
    
    setLoading(true);
    try {
      await writeContract({
        ...WaveVaultContract,
        functionName: 'setAuthorizedCaller',
        args: [caller, authorized],
      });
    } catch (err) {
      toast.error('Failed to set authorized caller');
      setLoading(false);
    }
  };

  const setRewardParameters = async (baseRate, maxReward, minThreshold) => {
    if (!isOwner) {
      toast.error('Only owner can perform this action');
      return;
    }

    setLoading(true);
    try {
      const baseRateWei = parseUnits(baseRate.toString(), 6);
      const maxRewardWei = parseUnits(maxReward.toString(), 6);
      const minThresholdWei = parseUnits(minThreshold.toString(), 6);

      await writeContract({
        ...WaveVaultContract,
        functionName: 'setRewardParameters',
        args: [baseRateWei, maxRewardWei, minThresholdWei],
      });
    } catch (err) {
      toast.error('Failed to set reward parameters');
      setLoading(false);
    }
  };

  const emergencyWithdraw = async (token, amount, to) => {
    if (!isOwner) {
      toast.error('Only owner can perform this action');
      return;
    }

    setLoading(true);
    try {
      const amountWei = token === '0x0000000000000000000000000000000000000000' 
        ? parseUnits(amount.toString(), 18) // ETH
        : parseUnits(amount.toString(), 6); // USDT

      await writeContract({
        ...WaveVaultContract,
        functionName: 'emergencyWithdraw',
        args: [token, amountWei, to],
      });
    } catch (err) {
      toast.error('Failed to emergency withdraw');
      setLoading(false);
    }
  };

  const pauseContract = async () => {
    if (!isOwner) {
      toast.error('Only owner can perform this action');
      return;
    }

    setLoading(true);
    try {
      await writeContract({
        ...WaveVaultContract,
        functionName: 'pause',
      });
    } catch (err) {
      toast.error('Failed to pause contract');
      setLoading(false);
    }
  };

  const unpauseContract = async () => {
    if (!isOwner) {
      toast.error('Only owner can perform this action');
      return;
    }

    setLoading(true);
    try {
      await writeContract({
        ...WaveVaultContract,
        functionName: 'unpause',
      });
    } catch (err) {
      toast.error('Failed to unpause contract');
      setLoading(false);
    }
  };

  const depositUSDT = async (amount) => {
    setLoading(true);
    try {
      const amountWei = parseUnits(amount.toString(), 6);
      await writeContract({
        ...WaveVaultContract,
        functionName: 'depositUSDT',
        args: [amountWei],
      });
    } catch (err) {
      toast.error('Failed to deposit USDT');
      setLoading(false);
    }
  };

  const calculateReward = async (xpAmount) => {
    try {
      const xpAmountWei = parseUnits(xpAmount.toString(), 18);
      // Note: This would need to be implemented with a separate read call
      // For now, we'll calculate it manually based on the current parameters
      const baseRate = parseFloat(stats.baseRewardRate);
      const maxReward = parseFloat(stats.maxRewardPerClaim);
      const xpFloat = parseFloat(xpAmount);
      
      let reward = (xpFloat * baseRate) / 1e18;
      if (reward > maxReward) {
        reward = maxReward;
      }
      
      return reward.toFixed(6);
    } catch (err) {
      console.error('Failed to calculate reward:', err);
      return '0';
    }
  };

  return {
    // State
    stats,
    loading: loading || isPending || isConfirming,
    isOwner,
    isConnected,
    isPaused: paused || false,
    contractAddress: WaveVaultContract.address,
    
    // Functions
    setAuthorizedCaller,
    setRewardParameters,
    emergencyWithdraw,
    pauseContract,
    unpauseContract,
    depositUSDT,
    calculateReward,
    refetchStats,
  };
};
