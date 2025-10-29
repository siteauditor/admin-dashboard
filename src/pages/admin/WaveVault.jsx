import { useState, useEffect } from 'react';
import { useWaveVault } from '../../hooks/useWaveVault';
import ContractStatusCard from '../../components/admin/ContractStatusCard';
import WaveVaultActions from '../../components/admin/WaveVaultActions';
import Header from '../../components/Header';
import { 
  BanknotesIcon, 
  UsersIcon, 
  CurrencyDollarIcon, 
  ChartBarIcon,
  CalculatorIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

export default function WaveVault() {
  const {
    stats,
    loading,
    isOwner,
    isConnected,
    isPaused,
    contractAddress,
    setAuthorizedCaller,
    setRewardParameters,
    emergencyWithdraw,
    pauseContract,
    unpauseContract,
    depositUSDT,
    calculateReward,
    refetchStats
  } = useWaveVault();

  const [calculatorForm, setCalculatorForm] = useState({
    xpAmount: '',
    calculatedReward: '0'
  });

  // Auto-refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchStats]);

  const handleCalculateReward = async () => {
    if (!calculatorForm.xpAmount) return;
    
    try {
      const reward = await calculateReward(calculatorForm.xpAmount);
      setCalculatorForm(prev => ({ ...prev, calculatedReward: reward }));
    } catch (error) {
      console.error('Failed to calculate reward:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (loading && !stats.vaultBalance) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  WaveVault Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Manage USDT reward distribution vault for prize pool winners
                </p>
              </div>
              <button
                onClick={refetchStats}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Contract Info */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Contract Address</h3>
                  <p className="text-lg font-mono text-gray-900 dark:text-white">{contractAddress}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(contractAddress)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Copy address"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg mr-4">
                  <BanknotesIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vault Balance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {parseFloat(stats.vaultBalance).toFixed(2)} USDT
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg mr-4">
                  <CurrencyDollarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Base Reward Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {parseFloat(stats.baseRewardRate).toFixed(6)} USDT/XP
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg mr-4">
                  <ChartBarIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Reward/Claim</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {parseFloat(stats.maxRewardPerClaim).toFixed(2)} USDT
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg mr-4">
                  <UsersIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Min Threshold</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {parseFloat(stats.minRewardThreshold).toFixed(2)} USDT
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ContractStatusCard
              contractName="WaveVault"
              isPaused={isPaused}
              isOwner={isOwner}
              isConnected={isConnected}
              loading={loading}
              stats={{
                'Vault Balance': `${parseFloat(stats.vaultBalance).toFixed(2)} USDT`,
                'Total Users': stats.totalUsers,
                'Base Rate': `${parseFloat(stats.baseRewardRate).toFixed(6)} USDT/XP`,
                'Max Reward': `${parseFloat(stats.maxRewardPerClaim).toFixed(2)} USDT`
              }}
            />

            {/* Reward Calculator */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg mr-3">
                  <CalculatorIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Reward Calculator
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    XP Amount
                  </label>
                  <input
                    type="number"
                    step="0.000000000000000001"
                    value={calculatorForm.xpAmount}
                    onChange={(e) => setCalculatorForm(prev => ({ ...prev, xpAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter XP amount (e.g., 1000000000000000000 for 1 XP)"
                  />
                </div>
                
                <button
                  onClick={handleCalculateReward}
                  disabled={!calculatorForm.xpAmount || loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Calculate Reward
                </button>
                
                {calculatorForm.calculatedReward !== '0' && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Calculated USDT Reward:</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {parseFloat(calculatorForm.calculatedReward).toFixed(6)} USDT
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Owner Actions */}
          <WaveVaultActions
            isOwner={isOwner}
            isPaused={isPaused}
            loading={loading}
            onSetAuthorizedCaller={setAuthorizedCaller}
            onSetRewardParameters={setRewardParameters}
            onEmergencyWithdraw={emergencyWithdraw}
            onPause={pauseContract}
            onUnpause={unpauseContract}
            onDepositUSDT={depositUSDT}
            stats={stats}
          />
        </div>
      </main>
    </div>
  );
}
