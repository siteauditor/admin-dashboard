import WaveChallengeFlipABI from '../../abi/WaveChallengeFlip.json';

export const VITE_WAVE_CHALLENGE_FLIP_ADDRESS = import.meta.env.VITE_WAVE_CHALLENGE_FLIP_ADDRESS || "0x303b1f680b379fe3f3604c779c2f0a80326cddb6";

// Add missing functions to the ABI if they're not included
const additionalFunctions = [
  {
    name: 'createGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_baseToken', type: 'address' },
      { name: '_burnFee', type: 'uint8' },
      { name: '_treasuryFee', type: 'uint8' },
      { name: '_minTokenAmount', type: 'uint256' }
    ],
    outputs: [],
  },
  {
    name: 'createChallenge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_gameId', type: 'bytes32' },
      { name: '_xpAmount', type: 'uint256' },
      { name: '_side', type: 'bool' }
    ],
    outputs: [],
  },
  {
    name: 'cancelChallenge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_challengeId', type: 'bytes32' }
    ],
    outputs: [],
  },
  {
    name: 'getGameIds',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [
      { name: 'totalCount', type: 'uint256' },
      { name: 'ids', type: 'bytes32[]' },
      { name: 'hasMore', type: 'bool' }
    ],
  },
  {
    name: 'getChallengeIds',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [
      { name: 'totalCount', type: 'uint256' },
      { name: 'ids', type: 'bytes32[]' },
      { name: 'hasMore', type: 'bool' }
    ],
  },
  {
    name: 'getAllUserAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [
      { name: 'totalCount', type: 'uint256' },
      { name: 'addrs', type: 'address[]' },
      { name: 'hasMore', type: 'bool' }
    ],
  },
  {
    name: 'getUserHistory',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'userAddress', type: 'address' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [
      { name: 'totalCount', type: 'uint256' },
      { name: 'challengeIds', type: 'bytes32[]' },
      { name: 'hasMore', type: 'bool' }
    ],
  },
  {
    name: 'getArrayLengths',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'gameCount', type: 'uint256' },
      { name: 'challengeCount', type: 'uint256' },
      { name: 'userCount', type: 'uint256' }
    ],
  },
  {
    name: 'getUserHistoryLength',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'userAddress', type: 'address' }
    ],
    outputs: [
      { name: 'count', type: 'uint256' }
    ],
  },
  {
    name: 'getGameInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_gameId', type: 'bytes32' }
    ],
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint8' },
      { name: '', type: 'uint8' },
      { name: '', type: 'uint256' },
      { name: '', type: 'bytes32[]' },
      { name: '', type: 'uint256' },
      { name: '', type: 'bool' }
    ],
  },
  {
    name: 'getChallengeInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_challengeId', type: 'bytes32' }
    ],
    outputs: [
      { name: '', type: 'bytes32' },
      { name: '', type: 'tuple', components: [
        { name: 'userAddress', type: 'address' },
        { name: 'isCreator', type: 'bool' },
        { name: 'side', type: 'bool' },
        { name: 'challengeId', type: 'bytes32' },
        { name: 'xpAmount', type: 'uint256' },
        { name: 'betTime', type: 'uint256' },
        { name: 'rewardAmount', type: 'uint256' }
      ]},
      { name: '', type: 'tuple', components: [
        { name: 'userAddress', type: 'address' },
        { name: 'isCreator', type: 'bool' },
        { name: 'side', type: 'bool' },
        { name: 'challengeId', type: 'bytes32' },
        { name: 'xpAmount', type: 'uint256' },
        { name: 'betTime', type: 'uint256' },
        { name: 'rewardAmount', type: 'uint256' }
      ]},
      { name: '', type: 'bool' },
      { name: '', type: 'bool' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' }
    ],
  },
  {
    name: 'treasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getLinkBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'setGameData',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_gameId', type: 'bytes32' },
      { name: '_burnFee', type: 'uint8' },
      { name: '_treasuryFee', type: 'uint8' },
      { name: '_minTokenAmount', type: 'uint256' }
    ],
    outputs: [],
  }
];

export const waveChallengeFlipConfig = {
  address: VITE_WAVE_CHALLENGE_FLIP_ADDRESS,
  abi: [...(WaveChallengeFlipABI.abi || WaveChallengeFlipABI), ...additionalFunctions],
};

export const waveChallengeFlipABI = [...(WaveChallengeFlipABI.abi || WaveChallengeFlipABI), ...additionalFunctions];