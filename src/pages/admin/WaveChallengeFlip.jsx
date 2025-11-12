import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from '@wagmi/core';
import { parseEther, formatEther } from 'viem';
import { toast } from 'react-hot-toast';
import Header from '../../components/Header';
import ContractStatusCard from '../../components/admin/ContractStatusCard';
import OwnerActions from '../../components/admin/OwnerActions';
import Table from '../../components/Table';
import { waveChallengeFlipConfig } from '../../lib/contracts/waveChallengeFlip';
import { 
  CurrencyDollarIcon, 
  LinkIcon, 
  ArrowPathIcon,
  ChartBarIcon,
  PlusIcon,
  TrophyIcon,
  ClockIcon,
  UserGroupIcon,
  XMarkIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { config } from "../../config.jsx";

export default function WaveChallengeFlip() {
  const chainId = config.chains[0].id;
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [gamePools, setGamePools] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [pagination, setPagination] = useState({
    games: { offset: 0, limit: 20, hasMore: true, totalCount: 0 },
    challenges: { offset: 0, limit: 20, hasMore: true, totalCount: 0 }
  });
  const [gameForm, setGameForm] = useState({
    baseToken: '',
    burnFee: '',
    treasuryFee: '',
    minTokenAmount: ''
  });
  const [challengeForm, setChallengeForm] = useState({
    gameId: '',
    xpAmount: '',
    side: true
  });
  const [editingGame, setEditingGame] = useState(null);
  const [editForm, setEditForm] = useState({
    burnFee: '',
    treasuryFee: '',
    minTokenAmount: ''
  });
  
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Contract reads
  const { data: owner } = useReadContract({
    ...waveChallengeFlipConfig,
    functionName: 'owner',
  });

  const { data: isPaused } = useReadContract({
    ...waveChallengeFlipConfig,
    functionName: 'paused',
  });

  const { data: arrayLengths } = useReadContract({
    ...waveChallengeFlipConfig,
    functionName: 'getArrayLengths',
  });

  const { data: treasury } = useReadContract({
    ...waveChallengeFlipConfig,
    functionName: 'treasury',
  });

  const { data: linkBalance } = useReadContract({
    ...waveChallengeFlipConfig,
    functionName: 'getLinkBalance',
  });

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();
  // const isOwner = address && treasury && address.toLowerCase() === treasury.toLowerCase();

  // Set default base token from environment variable
  useEffect(() => {
    if (import.meta.env.VITE_BASE_TOKEN && !gameForm.baseToken) {
      setGameForm(prev => ({ ...prev, baseToken: import.meta.env.VITE_BASE_TOKEN }));
      // console.log('Base token set from environment variable:', import.meta.env.VITE_BASE_TOKEN);
    }
    // console.log('WaveChallengeFlip component mounted with base token:', gameForm.baseToken);
  }, []);

  // Fetch game pools data with pagination
  const fetchGamePools = async (offset = 0, limit = 20, append = false) => {
    if (append) {
      setLoading(prev => ({ ...prev, loadMoreGames: true }));
    }
    try {
      const gameIdsResult = await readContract(config, {
        ...waveChallengeFlipConfig,
        functionName: 'getGameIds',
        args: [offset, limit],
        chainId: chainId
      });
      
      if (!gameIdsResult || gameIdsResult[1]?.length === 0) {
        if (!append) setGamePools([]);
        return;
      }
      
      const poolsData = [];
      for (const gameId of gameIdsResult[1]) {
        try {
          const gameInfo = await readContract(config, {
            ...waveChallengeFlipConfig,
            functionName: 'getGameInfo',
            args: [gameId],
            chainId: chainId
          });
          
          poolsData.push({
            gameId,
            baseToken: gameInfo[0],
            burnFee: gameInfo[1],
            treasuryFee: gameInfo[2],
            totalXpAmount: gameInfo[3],
            challengeIds: gameInfo[4],
            minTokenAmount: gameInfo[5],
            isActive: gameInfo[6]
          });
        } catch (error) {
          console.error('Error fetching game info:', error);
        }
      }
      
      if (append) {
        setGamePools(prev => [...prev, ...poolsData]);
      } else {
        setGamePools(poolsData);
      }
      
      setPagination(prev => ({
        ...prev,
        games: {
          offset: offset + limit,
          limit,
          hasMore: gameIdsResult[2],
          totalCount: gameIdsResult[0]
        }
      }));
    } catch (error) {
      console.error('Error fetching game pools:', error);
    } finally {
      if (append) {
        setLoading(prev => ({ ...prev, loadMoreGames: false }));
      }
    }
  };

  useEffect(() => {
    fetchGamePools();
  }, []);

  // Fetch challenges data with pagination
  const fetchChallenges = async (offset = 0, limit = 20, append = false) => {
    if (append) {
      setLoading(prev => ({ ...prev, loadMoreChallenges: true }));
    }
    try {
      const challengeIdsResult = await readContract(config, {
        ...waveChallengeFlipConfig,
        functionName: 'getChallengeIds',
        args: [offset, limit],
        chainId: chainId
      });
      
      if (!challengeIdsResult || challengeIdsResult[1]?.length === 0) {
        if (!append) setChallenges([]);
        return;
      }
      
      const challengesData = [];
      for (const challengeId of challengeIdsResult[1]) {
        try {
          const challengeInfo = await readContract(config, {
            ...waveChallengeFlipConfig,
            functionName: 'getChallengeInfo',
            args: [challengeId],
            chainId: chainId
          });
          
          challengesData.push({
            challengeId,
            gameId: challengeInfo[0],
            creator: challengeInfo[1],
            challenger: challengeInfo[2],
            isActive: challengeInfo[3],
            result: challengeInfo[4],
            createTime: challengeInfo[5],
            drawTime: challengeInfo[6],
            xpAmount: challengeInfo[7]
          });
        } catch (error) {
          console.error('Error fetching challenge info:', error);
        }
      }
      
      if (append) {
        setChallenges(prev => [...prev, ...challengesData]);
      } else {
        setChallenges(challengesData);
      }
      
      setPagination(prev => ({
        ...prev,
        challenges: {
          offset: offset + limit,
          limit,
          hasMore: challengeIdsResult[2],
          totalCount: challengeIdsResult[0]
        }
      }));
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      if (append) {
        setLoading(prev => ({ ...prev, loadMoreChallenges: false }));
      }
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  useEffect(() => {
    if (isSuccess) {
      toast.success('Transaction completed successfully!');
      setLoading({});
      setGameForm({ ...gameForm, burnFee: '', treasuryFee: '', minTokenAmount: '' });
      setChallengeForm({ gameId: '', xpAmount: '', side: true });
    }
  }, [isSuccess]);

  const handlePause = async () => {
    try {
      setLoading(prev => ({ ...prev, pause: true }));
      writeContract({
        ...waveChallengeFlipConfig,
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
        ...waveChallengeFlipConfig,
        functionName: 'unpause',
      });
    } catch (error) {
      toast.error('Failed to unpause contract');
      setLoading(prev => ({ ...prev, pause: false }));
    }
  };

  const handleWithdraw = async () => {
    if (!gameForm.baseToken || !gameForm.minTokenAmount) {
      toast.error('Please specify token address and amount');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, withdraw: true }));
      writeContract({
        ...waveChallengeFlipConfig,
        functionName: 'withdraw',
        args: [gameForm.baseToken, parseEther(gameForm.minTokenAmount)],
      });
    } catch (error) {
      toast.error('Failed to withdraw tokens');
      setLoading(prev => ({ ...prev, withdraw: false }));
    }
  };

  const handleCreateGame = async () => {
    const { baseToken, burnFee, treasuryFee, minTokenAmount } = gameForm;
    
    if (!baseToken || !burnFee || !treasuryFee || !minTokenAmount) {
      toast.error('Please fill all game creation fields');
      return;
    }

    if (parseInt(burnFee) + parseInt(treasuryFee) > 100) {
      toast.error('Total fees cannot exceed 100%');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, createGame: true }));
      writeContract({
        ...waveChallengeFlipConfig,
        functionName: 'createGame',
        args: [
          baseToken,
          parseInt(burnFee),
          parseInt(treasuryFee),
          parseEther(minTokenAmount)
        ],
      });
    } catch (error) {
      toast.error('Failed to create game');
      setLoading(prev => ({ ...prev, createGame: false }));
    }
  };

  const handleCreateChallenge = async () => {
    const { gameId, xpAmount, side } = challengeForm;
    
    if (!gameId || !xpAmount) {
      toast.error('Please fill all challenge creation fields');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, createChallenge: true }));
      writeContract({
        ...waveChallengeFlipConfig,
        functionName: 'createChallenge',
        args: [gameId, parseEther(xpAmount), side],
      });
    } catch (error) {
      toast.error('Failed to create challenge');
      setLoading(prev => ({ ...prev, createChallenge: false }));
    }
  };

  const handleCancelChallenge = async (challengeId) => {
    try {
      setLoading(prev => ({ ...prev, [`cancel_${challengeId}`]: true }));
      writeContract({
        ...waveChallengeFlipConfig,
        functionName: 'cancelChallenge',
        args: [challengeId],
      });
    } catch (error) {
      toast.error('Failed to cancel challenge');
      setLoading(prev => ({ ...prev, [`cancel_${challengeId}`]: false }));
    }
  };

  const handleEditGame = (game) => {
    setEditingGame(game);
    setEditForm({
      burnFee: game.burnFee.toString(),
      treasuryFee: game.treasuryFee.toString(),
      minTokenAmount: formatEther(game.minTokenAmount)
    });
  };

  const handleUpdateGameData = async () => {
    const { burnFee, treasuryFee, minTokenAmount } = editForm;
    
    if (!burnFee || !treasuryFee || !minTokenAmount) {
      toast.error('Please fill all fields');
      return;
    }

    if (parseInt(burnFee) + parseInt(treasuryFee) > 100) {
      toast.error('Total fees cannot exceed 100%');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, editGame: true }));
      writeContract({
        ...waveChallengeFlipConfig,
        functionName: 'setGameData',
        args: [
          editingGame.gameId,
          parseInt(burnFee),
          parseInt(treasuryFee),
          parseEther(minTokenAmount)
        ],
      });
    } catch (error) {
      toast.error('Failed to update game data');
      setLoading(prev => ({ ...prev, editGame: false }));
    }
  };

  const closeEditModal = () => {
    setEditingGame(null);
    setEditForm({ burnFee: '', treasuryFee: '', minTokenAmount: '' });
  };

  const gamePoolColumns = [
    {
      key: 'gameId',
      label: 'Game ID',
      render: (value) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {value.slice(0, 8)}...{value.slice(-6)}
        </span>
      ),
    },
    {
      key: 'baseToken',
      label: 'Base Token',
      render: (value) => (
        <span className="font-mono text-xs">
          {value.slice(0, 6)}...{value.slice(-4)}
        </span>
      ),
    },
    {
      key: 'minTokenAmount',
      label: 'Min Amount',
      render: (value) => `${formatEther(value)} XP`,
    },
    {
      key: 'burnFee',
      label: 'Burn Fee',
      render: (value) => `${value}%`,
    },
    {
      key: 'treasuryFee',
      label: 'Treasury Fee',
      render: (value) => `${value}%`,
    },
    {
      key: 'totalXpAmount',
      label: 'Total Volume',
      render: (value) => `${formatEther(value)} XP`,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const gamePoolActions = (game) => (
    isOwner ? (
      <button
        onClick={() => handleEditGame(game)}
        disabled={isPending || isConfirming}
        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CogIcon className="w-4 h-4 mr-1" />
        Edit
      </button>
    ) : null
  );

  const challengeColumns = [
    {
      key: 'challengeId',
      label: 'Challenge ID',
      render: (value) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {value.slice(0, 8)}...{value.slice(-6)}
        </span>
      ),
    },
    {
      key: 'creator',
      label: 'Creator',
      render: (value) => (
        <div className="flex items-center">
          <span className="font-mono text-xs">
            {value.userAddress.slice(0, 6)}...{value.userAddress.slice(-4)}
          </span>
          <span className={`ml-2 px-2 py-1 text-xs rounded ${
            value.side ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 
            'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {value.side ? 'Heads' : 'Tails'}
          </span>
        </div>
      ),
    },
    {
      key: 'challenger',
      label: 'Challenger',
      render: (value) => (
        value.userAddress !== '0x0000000000000000000000000000000000000000' ? (
          <div className="flex items-center">
            <span className="font-mono text-xs">
              {value.userAddress.slice(0, 6)}...{value.userAddress.slice(-4)}
            </span>
            <span className={`ml-2 px-2 py-1 text-xs rounded ${
              value.side ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 
              'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {value.side ? 'Heads' : 'Tails'}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Waiting...</span>
        )
      ),
    },
    {
      key: 'xpAmount',
      label: 'Amount',
      render: (value) => `${formatEther(value)} XP`,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value, row) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : row.result !== undefined
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          }`}
        >
          {value ? 'Active' : row.result !== undefined ? 'Completed' : 'Cancelled'}
        </span>
      ),
    },
  ];

  const challengeActions = (challenge) => (
    challenge.isActive && challenge.challenger.userAddress === '0x0000000000000000000000000000000000000000' && 
    challenge.creator.userAddress.toLowerCase() === address?.toLowerCase() ? (
      <button
        onClick={() => handleCancelChallenge(challenge.challengeId)}
        disabled={loading[`cancel_${challenge.challengeId}`] || isPending || isConfirming}
        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <XMarkIcon className="w-4 h-4 mr-1" />
        {loading[`cancel_${challenge.challengeId}`] ? 'Cancelling...' : 'Cancel'}
      </button>
    ) : null
  );

  const stats = {
    totalGames: gamePools.length,
    activeChallenges: challenges.filter(c => c.isActive).length,
    totalVolume: gamePools.reduce((sum, pool) => sum + Number(formatEther(pool.totalXpAmount)), 0),
    linkBalance: linkBalance || 0,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Wave Challenge Flip Admin
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage game pools, challenges, and smart contract operations
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: ChartBarIcon },
                { id: 'games', name: 'Game Pools', icon: UserGroupIcon },
                { id: 'challenges', name: 'Challenges', icon: TrophyIcon },
                { id: 'create', name: 'Create', icon: PlusIcon },
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
                  contractName="Wave Challenge Flip"
                  isPaused={isPaused}
                  isOwner={isOwner}
                  isConnected={isConnected}
                  loading={isPending || isConfirming}
                  stats={stats}
                />

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Contract Balances
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="flex items-center">
                        <LinkIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">LINK Balance</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        {formatEther(stats.linkBalance)} LINK
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Treasury</span>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                        {treasury?.slice(0, 6)}...{treasury?.slice(-4)}
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
              />
            </div>
          )}

          {/* Game Pools Tab */}
          {activeTab === 'games' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Game Pools ({pagination.games.totalCount || gamePools.length})
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {gamePools.length} of {pagination.games.totalCount || gamePools.length}
                  </div>
                </div>
                <Table columns={gamePoolColumns} data={gamePools} actions={gamePoolActions} />
                {pagination.games.hasMore && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => fetchGamePools(pagination.games.offset, pagination.games.limit, true)}
                      disabled={loading.loadMoreGames}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading.loadMoreGames ? 'Loading...' : 'Load More Games'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Challenges Tab */}
          {activeTab === 'challenges' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Challenges ({pagination.challenges.totalCount || challenges.length})
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {challenges.length} of {pagination.challenges.totalCount || challenges.length}
                  </div>
                </div>
                <Table columns={challengeColumns} data={challenges} actions={challengeActions} />
                {pagination.challenges.hasMore && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => fetchChallenges(pagination.challenges.offset, pagination.challenges.limit, true)}
                      disabled={loading.loadMoreChallenges}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading.loadMoreChallenges ? 'Loading...' : 'Load More Challenges'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Game Pool */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create Game Pool
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Base Token Address
                    </label>
                    <input
                      type="text"
                      value={gameForm.baseToken}
                      onChange={(e) => setGameForm(prev => ({ ...prev, baseToken: e.target.value }))}
                      placeholder="0x..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Burn Fee (%)
                      </label>
                      <input
                        type="number"
                        value={gameForm.burnFee}
                        onChange={(e) => setGameForm(prev => ({ ...prev, burnFee: e.target.value }))}
                        placeholder="5"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Treasury Fee (%)
                      </label>
                      <input
                        type="number"
                        value={gameForm.treasuryFee}
                        onChange={(e) => setGameForm(prev => ({ ...prev, treasuryFee: e.target.value }))}
                        placeholder="5"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Minimum Token Amount
                    </label>
                    <input
                      type="number"
                      value={gameForm.minTokenAmount}
                      onChange={(e) => setGameForm(prev => ({ ...prev, minTokenAmount: e.target.value }))}
                      placeholder="1.0"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleCreateGame}
                    disabled={loading.createGame || isPending || isConfirming || !isOwner}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    {loading.createGame ? 'Creating...' : 'Create Game Pool'}
                  </button>
                </div>
              </div>

              {/* Create Challenge */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create Challenge
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Game Pool
                    </label>
                    <select
                      value={challengeForm.gameId}
                      onChange={(e) => setChallengeForm(prev => ({ ...prev, gameId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a game pool</option>
                      {gamePools.filter(pool => pool.isActive).map((pool) => (
                        <option key={pool.gameId} value={pool.gameId}>
                          {pool.gameId.slice(0, 8)}...{pool.gameId.slice(-6)} - Min: {formatEther(pool.minTokenAmount)} XP
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      XP Amount
                    </label>
                    <input
                      type="number"
                      value={challengeForm.xpAmount}
                      onChange={(e) => setChallengeForm(prev => ({ ...prev, xpAmount: e.target.value }))}
                      placeholder="10.0"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Choose Side
                    </label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setChallengeForm(prev => ({ ...prev, side: true }))}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          challengeForm.side
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        Heads
                      </button>
                      <button
                        onClick={() => setChallengeForm(prev => ({ ...prev, side: false }))}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          !challengeForm.side
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        Tails
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateChallenge}
                    disabled={loading.createChallenge || isPending || isConfirming}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TrophyIcon className="w-5 h-5 mr-2" />
                    {loading.createChallenge ? 'Creating...' : 'Create Challenge'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Game Modal */}
        {editingGame && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Game Pool
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
                    Game ID
                  </label>
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {editingGame.gameId.slice(0, 8)}...{editingGame.gameId.slice(-6)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Burn Fee (%)
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
                      Treasury Fee (%)
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum Token Amount (XP)
                  </label>
                  <input
                    type="number"
                    value={editForm.minTokenAmount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, minTokenAmount: e.target.value }))}
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleUpdateGameData}
                    disabled={loading.editGame || isPending || isConfirming}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.editGame ? 'Updating...' : 'Update Game'}
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