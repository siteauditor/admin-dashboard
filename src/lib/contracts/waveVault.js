import WaveVaultABI from '../../abi/WaveVault.json';

export const VITE_WAVE_VAULT_ADDRESS = import.meta.env.VITE_WAVE_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000";

// Add missing functions to the ABI if they're not included
const additionalFunctions = [
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{"name": "", "type": "address", "internalType": "address"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{"name": "", "type": "bool", "internalType": "bool"}],
    "stateMutability": "view"
  }
];

// Merge ABIs
export const WaveVaultContractABI = [
  ...WaveVaultABI.abi,
  ...additionalFunctions.filter(func => 
    !WaveVaultABI.abi.some(existing => existing.name === func.name)
  )
];

export const WaveVaultContract = {
  address: VITE_WAVE_VAULT_ADDRESS,
  abi: WaveVaultContractABI,
};
