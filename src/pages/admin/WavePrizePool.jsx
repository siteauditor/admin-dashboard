import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { parseEther, formatEther } from 'viem';
import { toast } from 'react-hot-toast';
import Header from '../../components/Header';
import ContractStatusCard from '../../components/admin/ContractStatusCard';
import OwnerActions from '../../components/admin/OwnerActions';
import Table from '../../components/Table';
import { wavePrizePoolConfig } from '../../lib/contracts/wavePrizePool';
import { config } from "../../config.jsx";
import { 
  CurrencyDollarIcon, 
  TrophyIcon,
  PlusIcon,
  MinusIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowPathIcon,
  CogIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

export default function WavePrizePool() {
  const chainId = config.chains[0].id;
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [pools, setPools] = useState([]);
  const [pagination, setPagination] = useState({
    pools: { offset: 0, limit: 20, hasMore: true, totalCount: 0 }
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [prizeAmount, setPrizeAmount] = useState('');
  const [poolForm, setPoolForm] = useState({
    baseToken: import.meta.env.VITE_BASE_TOKEN || '',
    burnFee: '',
    treasuryFee: '',
    limitAmount: '',
    ticketPrice: '',
    poolType: true // true for daily, false for weekly
  });
  const [editingPool, setEditingPool] = useState(null);
  const [editForm, setEditForm] = useState({
    burnFee: '',
    treasuryFee: '',
    limitAmount: '',
    ticketPrice: ''
  });
  
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Contract reads
  const { data: owner } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'owner',
  });

  const { data: isPaused } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'paused',
  });

  const { data: poolCount } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'getPoolCount',
  });

  const { data: poolStats } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'getPoolStats',
  });

  const { data: currentPrize } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'currentPrizeAmount',
  });

  const { data: totalDeposits } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'totalDeposits',
  });

  const { data: totalWithdrawn } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'totalWithdrawn',
  });

  const { data: treasury } = useReadContract({
    ...wavePrizePoolConfig,
    functionName: 'treasury',
  });

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Set default base token from environment variable
  useEffect(() => {
    if (import.meta.env.VITE_BASE_TOKEN && !poolForm.baseToken) {
      setPoolForm(prev => ({ ...prev, baseToken: import.meta.env.VITE_BASE_TOKEN }));
      // console.log('Base token set from environment variable:', import.meta.env.VITE_BASE_TOKEN);
    }
    // console.log('WavePrizePool component mounted with base token:', poolForm.baseToken);
  }, []);

  // Fetch pools data with pagination
  const fetchPools = async (offset = 0, limit = 20, append = false) => {
    if (append) {
      setLoading(prev => ({ ...prev, loadMorePools: true }));
    }
    try {
      const poolIdsResult = await readContract(config, {
        ...wavePrizePoolConfig,
        functionName: 'getAllPoolIds',
        args: [offset, limit],
        chainId: chainId
      });
      
      if (!poolIdsResult || poolIdsResult[1]?.length === 0) {
        if (!append) setPools([]);
        return;
      }
      
      const poolsData = [];
      for (const poolId of poolIdsResult[1]) {
        try {
          const poolState = await readContract(config, {
            ...wavePrizePoolConfig,
            functionName: 'getPoolState',
            args: [poolId],
            chainId: chainId
          });
          
          poolsData.push({
            poolId,
            totalXpAmount: poolState[0],
            users: poolState[1],
            winner: poolState[2],
            isActive: poolState[2].user === '0x0000000000000000000000000000000000000000'
          });
        } catch (error) {
          console.error('Error fetching pool state:', error);
        }
      }
      
      if (append) {
        setPools(prev => [...prev, ...poolsData]);
      } else {
        setPools(poolsData);
      }
      
      setPagination(prev => ({
        ...prev,
        pools: {
          offset: offset + limit,
          limit,
          hasMore: poolIdsResult[2],
          totalCount: poolIdsResult[0]
        }
      }));
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      if (append) {
        setLoading(prev => ({ ...prev, loadMorePools: false }));
      }
    }
  };

  useEffect(() => {
    fetchPools();
  }, []);

  useEffect(() => {
    if (isSuccess) {
      toast.success('Transaction completed successfully!');
      setLoading({});
      setDepositAmount('');
      setPrizeAmount('');
      setPoolForm({
        ...poolForm,
        burnFee: '',
        treasuryFee: '',
        limitAmount: '',
        ticketPrice: '',
        poolType: true
      });
    }
  }, [isSuccess]);

  const handlePause = async () => {
    try {
      setLoading(prev => ({ ...prev, pause: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'pause',
      });
    } catch (error) {
      toast.error('Failed to pause contract');
      setLoading(prev => ({ ...prev, pause: false }));
    }
  };

  const handleUnpause = async () => {
    try {
      setLoading(prev => ({ ...prev, pause: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'unpause',
      });
    } catch (error) {
      toast.error('Failed to unpause contract');
      setLoading(prev => ({ ...prev, pause: false }));
    }
  };

  const handleWithdraw = async () => {
    try {
      setLoading(prev => ({ ...prev, withdraw: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'withdraw',
        args: [poolForm.baseToken, parseEther(poolForm.ticketPrice)],
      });
    } catch (error) {
      toast.error('Failed to withdraw prize pool');
      setLoading(prev => ({ ...prev, withdraw: false }));
    }
  };

  const handleCreatePool = async () => {
    const { baseToken, burnFee, treasuryFee, limitAmount, ticketPrice, poolType } = poolForm;
    
    if (!baseToken || !burnFee || !treasuryFee || !ticketPrice) {
      toast.error('Please fill all required pool creation fields');
      return;
    }

    if (parseInt(burnFee) + parseInt(treasuryFee) > 100) {
      toast.error('Total fees cannot exceed 100%');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, createPool: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'createPool',
        args: [
          baseToken,
          parseInt(burnFee),
          parseInt(treasuryFee),
          limitAmount ? parseEther(limitAmount) : 0,
          parseEther(ticketPrice),
          poolType
        ],
      });
    } catch (error) {
      toast.error('Failed to create pool');
      setLoading(prev => ({ ...prev, createPool: false }));
    }
  };

  const handleDrawWinner = async (poolId) => {
    try {
      setLoading(prev => ({ ...prev, [`draw_${poolId}`]: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'drawWinner',
        args: [poolId],
      });
    } catch (error) {
      toast.error('Failed to draw winner');
      setLoading(prev => ({ ...prev, [`draw_${poolId}`]: false }));
    }
  };

  const handleDepositXP = async () => {
    if (!depositAmount || isNaN(depositAmount) || Number(depositAmount) <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, deposit: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'depositXP',
        args: [parseEther(depositAmount)],
      });
    } catch (error) {
      toast.error('Failed to deposit XP');
      setLoading(prev => ({ ...prev, deposit: false }));
    }
  };

  const handleSetPrizeAmount = async () => {
    if (!prizeAmount || isNaN(prizeAmount) || Number(prizeAmount) <= 0) {
      toast.error('Please enter a valid prize amount');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, config: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'setPrizeAmount',
        args: [parseEther(prizeAmount)],
      });
    } catch (error) {
      toast.error('Failed to set prize amount');
      setLoading(prev => ({ ...prev, config: false }));
    }
  };

  const handleEditPool = (pool) => {
    setEditingPool(pool);
    setEditForm({
      burnFee: pool.burnFee?.toString() || '',
      treasuryFee: pool.treasuryFee?.toString() || '',
      limitAmount: pool.limitAmount ? formatEther(pool.limitAmount) : '',
      ticketPrice: pool.ticketPrice ? formatEther(pool.ticketPrice) : ''
    });
  };

  const handleUpdatePoolData = async () => {
    const { burnFee, treasuryFee, limitAmount, ticketPrice } = editForm;
    
    if (!burnFee || !treasuryFee || !ticketPrice) {
      toast.error('Please fill all required fields');
      return;
    }

    if (parseInt(burnFee) + parseInt(treasuryFee) > 100) {
      toast.error('Total fees cannot exceed 100%');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, editPool: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'setPoolData',
        args: [
          editingPool.poolId,
          parseInt(burnFee),
          parseInt(treasuryFee),
          limitAmount ? parseEther(limitAmount) : 0,
          parseEther(ticketPrice)
        ],
      });
    } catch (error) {
      toast.error('Failed to update pool data');
      setLoading(prev => ({ ...prev, editPool: false }));
    }
  };

  const handleRefreshStartTime = async (poolId) => {
    try {
      setLoading(prev => ({ ...prev, [`refresh_${poolId}`]: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'refreshStartTime',
        args: [poolId],
      });
    } catch (error) {
      toast.error('Failed to refresh start time');
      setLoading(prev => ({ ...prev, [`refresh_${poolId}`]: false }));
    }
  };

  const handleRefreshAllStartTimes = async () => {
    try {
      setLoading(prev => ({ ...prev, refreshAll: true }));
      writeContract({
        ...wavePrizePoolConfig,
        functionName: 'refreshStartTimes',
      });
    } catch (error) {
      toast.error('Failed to refresh all start times');
      setLoading(prev => ({ ...prev, refreshAll: false }));
    }
  };

  const closeEditModal = () => {
    setEditingPool(null);
    setEditForm({ burnFee: '', treasuryFee: '', limitAmount: '', ticketPrice: '' });
  };

  const poolColumns = [
    {
      key: 'poolId',
      label: 'Pool ID',
      render: (value) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {value.slice(0, 8)}...{value.slice(-6)}
        </span>
      ),
    },
    {
      key: 'totalXpAmount',
      label: 'Total XP',
      render: (value) => `${(Number(value) / 1e18).toFixed(2)} XP`,
    },
    {
      key: 'users',
      label: 'Participants',
      render: (value) => value.length,
    },
    {
      key: 'winner',
      label: 'Winner',
      render: (value) => (
        value.user !== '0x0000000000000000000000000000000000000000' ? (
          <span className="font-mono text-xs text-green-600 dark:text-green-400">
            {value.user.slice(0, 6)}...{value.user.slice(-4)}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">Not drawn</span>
        )
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          }`}
        >
          {value ? 'Active' : 'Completed'}
        </span>
      ),
    },
  ];

  const poolActions = (pool) => (
    isOwner ? (
      <div className="flex space-x-2">
        <button
          onClick={() => handleEditPool(pool)}
          disabled={isPending || isConfirming}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CogIcon className="w-3 h-3 mr-1" />
          Edit
        </button>
        <button
          onClick={() => handleRefreshStartTime(pool.poolId)}
          disabled={loading[`refresh_${pool.poolId}`] || isPending || isConfirming}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowPathIcon className="w-3 h-3 mr-1" />
          {loading[`refresh_${pool.poolId}`] ? 'Refreshing...' : 'Refresh'}
        </button>
        {pool.isActive && (
          <button
            onClick={() => handleDrawWinner(pool.poolId)}
            disabled={loading[`draw_${pool.poolId}`] || isPending || isConfirming}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrophyIcon className="w-3 h-3 mr-1" />
            {loading[`draw_${pool.poolId}`] ? 'Drawing...' : 'Draw'}
          </button>
        )}
      </div>
    ) : null
  );

  const stats = {
    totalPools: pools.length,
    activePools: pools.filter(p => p.isActive).length,
    currentPrize: currentPrize || 0,
    totalDeposits: totalDeposits || 0,
    totalWithdrawn: totalWithdrawn || 0,
    poolBalance: (totalDeposits || 0) - (totalWithdrawn || 0),
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Wave Prize Pool Admin
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage prize pools, participants, and smart contract operations
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: ChartBarIcon },
                { id: 'pools', name: 'Prize Pools', icon: TrophyIcon },
                { id: 'create', name: 'Create Pool', icon: PlusIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ContractStatusCard
                  contractName="Wave Prize Pool"
                  isPaused={isPaused}
                  isOwner={isOwner}
                  isConnected={isConnected}
                  loading={isPending || isConfirming}
                  stats={stats}
                />

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Contract Information
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Treasury</span>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                        {treasury?.slice(0, 6)}...{treasury?.slice(-4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center">
                        <TrophyIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Total Pools</span>
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {stats.totalPools}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="flex items-center">
                        <ClockIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Active Pools</span>
                      </div>
                      <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                        {stats.activePools}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <OwnerActions
                isOwner={isOwner}
                isPaused={isPaused}
                onPause={handlePause}
                onUnpause={handleUnpause}
                onWithdraw={handleWithdraw}
                loading={{ 
                  pause: loading.pause || isPending || isConfirming,
                  withdraw: loading.withdraw || isPending || isConfirming 
                }}
              >
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                    Pool Management
                  </h4>
                  
                  <button
                    onClick={handleRefreshAllStartTimes}
                    disabled={loading.refreshAll || isPending || isConfirming}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowPathIcon className="w-5 h-5 mr-2" />
                    {loading.refreshAll ? 'Refreshing All...' : 'Refresh All Start Times'}
                  </button>
                </div>
              </OwnerActions>
            </div>
          )}

          {/* Pools Tab */}
          {activeTab === 'pools' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Prize Pools ({pagination.pools.totalCount || pools.length})
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {pools.length} of {pagination.pools.totalCount || pools.length}
                  </div>
                </div>
                <Table columns={poolColumns} data={pools} actions={poolActions} />
                {pagination.pools.hasMore && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => fetchPools(pagination.pools.offset, pagination.pools.limit, true)}
                      disabled={loading.loadMorePools}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading.loadMorePools ? 'Loading...' : 'Load More Pools'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create Pool Tab */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Create New Prize Pool
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Base Token Address *
                    </label>
                    <input
                      type="text"
                      value={poolForm.baseToken}
                      onChange={(e) => setPoolForm(prev => ({ ...prev, baseToken: e.target.value }))}
                      placeholder="0x..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Burn Fee (%) *
                      </label>
                      <input
                        type="number"
                        value={poolForm.burnFee}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, burnFee: e.target.value }))}
                        placeholder="5"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Treasury Fee (%) *
                      </label>
                      <input
                        type="number"
                        value={poolForm.treasuryFee}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, treasuryFee: e.target.value }))}
                        placeholder="5"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Limit Amount (XP)
                      </label>
                      <input
                        type="number"
                        value={poolForm.limitAmount}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, limitAmount: e.target.value }))}
                        placeholder="0 (no limit)"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ticket Price (XP) *
                      </label>
                      <input
                        type="number"
                        value={poolForm.ticketPrice}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, ticketPrice: e.target.value }))}
                        placeholder="10.0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pool Type
                    </label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setPoolForm(prev => ({ ...prev, poolType: true }))}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          poolForm.poolType
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        Daily Pool
                      </button>
                      <button
                        onClick={() => setPoolForm(prev => ({ ...prev, poolType: false }))}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          !poolForm.poolType
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        Monthly Pool
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleCreatePool}
                      disabled={loading.createPool || isPending || isConfirming || !isOwner}
                      className="w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlusIcon className="w-5 h-5 mr-2" />
                      {loading.createPool ? 'Creating Pool...' : 'Create Prize Pool'}
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      * Required fields. Total fees (burn + treasury) cannot exceed 100%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Pool Modal */}
        {editingPool && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Prize Pool
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pool ID
                  </label>
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {editingPool.poolId.slice(0, 8)}...{editingPool.poolId.slice(-6)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Burn Fee (%) *
                    </label>
                    <input
                      type="number"
                      value={editForm.burnFee}
                      onChange={(e) => setEditForm(prev => ({ ...prev, burnFee: e.target.value }))}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Treasury Fee (%) *
                    </label>
                    <input
                      type="number"
                      value={editForm.treasuryFee}
                      onChange={(e) => setEditForm(prev => ({ ...prev, treasuryFee: e.target.value }))}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Limit Amount (XP)
                    </label>
                    <input
                      type="number"
                      value={editForm.limitAmount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, limitAmount: e.target.value }))}
                      placeholder="0 (no limit)"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ticket Price (XP) *
                    </label>
                    <input
                      type="number"
                      value={editForm.ticketPrice}
                      onChange={(e) => setEditForm(prev => ({ ...prev, ticketPrice: e.target.value }))}
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleUpdatePoolData}
                    disabled={loading.editPool || isPending || isConfirming}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.editPool ? 'Updating...' : 'Update Pool'}
                  </button>
                  <button
                    onClick={closeEditModal}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}