import { useState } from 'react';
import { 
  CogIcon, 
  PauseIcon, 
  PlayIcon, 
  BanknotesIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  UserMinusIcon
} from '@heroicons/react/24/outline';

export default function WaveVaultActions({ 
  isOwner, 
  isPaused, 
  loading,
  onSetAuthorizedCaller,
  onSetRewardParameters,
  onEmergencyWithdraw,
  onPause,
  onUnpause,
  onDepositUSDT,
  stats
}) {
  const [activeTab, setActiveTab] = useState('parameters');
  const [forms, setForms] = useState({
    authorizedCaller: { address: '', authorized: true },
    rewardParams: { 
      baseRate: stats.baseRewardRate || '1', 
      maxReward: stats.maxRewardPerClaim || '1000', 
      minThreshold: stats.minRewardThreshold || '1' 
    },
    emergencyWithdraw: { token: '', amount: '', to: '' },
    deposit: { amount: '' }
  });

  const handleFormChange = (formName, field, value) => {
    setForms(prev => ({
      ...prev,
      [formName]: { ...prev[formName], [field]: value }
    }));
  };

  const handleSubmit = async (action, formName) => {
    const form = forms[formName];
    
    switch (action) {
      case 'setAuthorizedCaller':
        await onSetAuthorizedCaller(form.address, form.authorized);
        setForms(prev => ({ ...prev, authorizedCaller: { address: '', authorized: true } }));
        break;
      case 'setRewardParameters':
        await onSetRewardParameters(form.baseRate, form.maxReward, form.minThreshold);
        break;
      case 'emergencyWithdraw':
        await onEmergencyWithdraw(form.token, form.amount, form.to);
        setForms(prev => ({ ...prev, emergencyWithdraw: { token: '', amount: '', to: '' } }));
        break;
      case 'deposit':
        await onDepositUSDT(form.amount);
        setForms(prev => ({ ...prev, deposit: { amount: '' } }));
        break;
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-8">
          <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Owner Access Required
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect with the contract owner wallet to access administrative functions.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'parameters', name: 'Reward Parameters', icon: CogIcon },
    { id: 'authorized', name: 'Authorized Callers', icon: UserPlusIcon },
    { id: 'deposit', name: 'Deposit USDT', icon: BanknotesIcon },
    { id: 'emergency', name: 'Emergency Actions', icon: ExclamationTriangleIcon },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header with Pause/Unpause */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Owner Actions
          </h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={isPaused ? onUnpause : onPause}
              disabled={loading}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                isPaused
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isPaused ? (
                <>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  Unpause Contract
                </>
              ) : (
                <>
                  <PauseIcon className="w-4 h-4 mr-2" />
                  Pause Contract
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'parameters' && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Update Reward Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Base Reward Rate (USDT per XP)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={forms.rewardParams.baseRate}
                  onChange={(e) => handleFormChange('rewardParams', 'baseRate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Reward Per Claim (USDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={forms.rewardParams.maxReward}
                  onChange={(e) => handleFormChange('rewardParams', 'maxReward', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Min Reward Threshold (USDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={forms.rewardParams.minThreshold}
                  onChange={(e) => handleFormChange('rewardParams', 'minThreshold', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="1"
                />
              </div>
            </div>
            <button
              onClick={() => handleSubmit('setRewardParameters', 'rewardParams')}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Parameters'}
            </button>
          </div>
        )}

        {activeTab === 'authorized' && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Manage Authorized Callers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contract Address
                </label>
                <input
                  type="text"
                  value={forms.authorizedCaller.address}
                  onChange={(e) => handleFormChange('authorizedCaller', 'address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Authorization Status
                </label>
                <select
                  value={forms.authorizedCaller.authorized}
                  onChange={(e) => handleFormChange('authorizedCaller', 'authorized', e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={true}>Authorize</option>
                  <option value={false}>Revoke</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => handleSubmit('setAuthorizedCaller', 'authorizedCaller')}
              disabled={loading || !forms.authorizedCaller.address}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Update Authorization'}
            </button>
          </div>
        )}

        {activeTab === 'deposit' && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Deposit USDT to Vault
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount (USDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={forms.deposit.amount}
                onChange={(e) => handleFormChange('deposit', 'amount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="100.00"
              />
            </div>
            <button
              onClick={() => handleSubmit('deposit', 'deposit')}
              disabled={loading || !forms.deposit.amount}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Depositing...' : 'Deposit USDT'}
            </button>
          </div>
        )}

        {activeTab === 'emergency' && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-red-800 dark:text-red-400">
                    Emergency Withdrawal
                  </h5>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Use this function only in emergency situations. This will withdraw tokens from the vault.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Address (0x0 for ETH)
                </label>
                <input
                  type="text"
                  value={forms.emergencyWithdraw.token}
                  onChange={(e) => handleFormChange('emergencyWithdraw', 'token', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0x0000000000000000000000000000000000000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={forms.emergencyWithdraw.amount}
                  onChange={(e) => handleFormChange('emergencyWithdraw', 'amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={forms.emergencyWithdraw.to}
                  onChange={(e) => handleFormChange('emergencyWithdraw', 'to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0x..."
                />
              </div>
            </div>
            <button
              onClick={() => handleSubmit('emergencyWithdraw', 'emergencyWithdraw')}
              disabled={loading || !forms.emergencyWithdraw.token || !forms.emergencyWithdraw.amount || !forms.emergencyWithdraw.to}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Emergency Withdraw'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
