// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFConsumerBaseV2Plus} from "chainlink-evm/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "chainlink-evm/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract WaveChallengeFlip is Pausable, ReentrancyGuard, VRFConsumerBaseV2Plus, Ownable {
    // ==== Claim Payout Events & Errors (added) ====
    event PayoutReady(
        bytes32 indexed challengeId,
        address indexed winner,
        address token,
        uint256 winnerAmount,
        uint256 burnAmount,
        uint256 treasuryAmount
    );

    event PayoutClaimed(
        bytes32 indexed challengeId,
        address indexed winner,
        uint256 winnerAmount,
        uint256 burnAmount,
        uint256 treasuryAmount
    );

    error PayoutNotReady();
    error AlreadyClaimed();
    error NotWinner();

    using SafeERC20 for IERC20;

    struct User {
        address userAddress;
        bool isCreator;
        bool side;
        bytes32 challengeId;
        uint256 xpAmount;
        uint256 betTime;
        uint256 rewardAmount;
    }

    struct Challenge {
        bytes32 challengeId;
        bytes32 gameId;
        bool isActive;
        bool result;
        uint256 xpAmount;
        uint256 createTime;
        uint256 drawTime;
        User creator;
        User challenger;
    }

    struct GamePool {
        address baseToken;
        bool isActive;
        uint8 burnFee;
        uint8 treasuryFee;
        bytes32 gameId;
        uint256 totalXpAmount;
        uint256 minTokenAmount;
        bytes32[] challengeIds;
    }

    struct RequestStatus {
        bool fulfilled;
        bool exists;
        uint256[] randomWords;
    }

    // --- Chainlink VRF ---
    bytes32 public constant keyHash = 0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26;
    uint256 public immutable s_subscriptionId;
    uint32 public constant callbackGasLimit = 300_000;
    uint16 public constant requestConfirmations = 3;
    uint32 public constant numWords = 1;
    IERC20 public immutable linktoken;

    
    struct Payout {
        address token;
        address winner;
        bool claimed;
        uint256 winnerAmount;
        uint256 burnAmount;
        uint256 treasuryAmount;
        
    }
    mapping(bytes32 => Payout) public payouts;
    mapping(uint256 => RequestStatus) private s_requests;
    mapping(uint256 => bytes32) private pendingChallenges;

    // --- Core Storage ---
    mapping(bytes32 => GamePool) public gamePools;
    mapping(bytes32 => Challenge) public challenges;
    mapping(address => bytes32[]) public userHistory;
    mapping(bytes32 => bool) public isActiveChallengeId;
    bytes32[] public allGameIds;
    bytes32[] public allChallengeIds;
    address[] public allUserAddresses;

    // --- Admin ---
    address public treasury;
    address public constant burnAddress = address(0xdead);
    uint256 public constant baseDivider = 100;
    bool public isVRF = true;

    // --- Events ---
    event GameCreated(bytes32 indexed gameId, address indexed baseToken, uint256 minTokenAmount);
    event ChallengeCreated(bytes32 indexed challengeId, address indexed creator, uint256 xpAmount);
    event EnteredChallenge(bytes32 indexed challengeId, address indexed user, uint256 xpAmount);
    event ChallengeDrawRequested(uint256 indexed requestId, bytes32 indexed challengeId);
    event RequestSent(uint256 indexed requestId, uint32 numWords);
    event RequestFulfilled(uint256 indexed requestId, uint256[] randomWords);
    event WinnerDrawn(bytes32 indexed challengeId, address player1, address player2, uint256 wager, bool result, address winner, uint256 time, uint256 reward);
    event PoolEnded(bytes32 indexed gameId);
    event TreasuryUpdated(address newTreasury);
    event GameDataUpdated(bytes32 indexed gameId, uint8 burnFee, uint8 treasuryFee, uint256 minTokenAmount);
    event FallbackRandomUsed(bytes32 indexed challengeId);
    event ChallengeCancelled(bytes32 indexed challengeId, address indexed creator);
    event Withdraw(address token_, address sender, uint256 amount);


    // --- Errors ---
    error InvalidTreasury();
    error InvalidFeeConfig();
    error GameInactive();
    error AmountTooLow();
    error ChallengeInactive();
    error SelfChallenge();
    error AmountMismatch();
    error SameSideSelected();
    error ChallengeEnded();
    error RequestNotFound();
    error NotCreator();
    error AlreadyUsed();
    error NotEnoughBalance();
    error ZeroAddressToken();

    constructor(address _treasury, uint256 subscriptionId)
        VRFConsumerBaseV2Plus(0xDA3b641D438362C440Ac5458c57e00a712b66700)
        Ownable(msg.sender)
    {
        if (_treasury == burnAddress) revert InvalidTreasury();
        treasury = _treasury;
        s_subscriptionId = subscriptionId;
        linktoken = IERC20(0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06);
    }

    function createGame(
        address _baseToken,
        uint8 _burnFee,
        uint8 _treasuryFee,
        uint256 _minTokenAmount
    ) external onlyOwner {
        if (_burnFee + _treasuryFee > baseDivider) revert InvalidFeeConfig();
        bytes32 gameId = keccak256(abi.encodePacked("GamePool", msg.sender, block.timestamp));
        GamePool storage gamePool = gamePools[gameId];
        gamePool.baseToken = _baseToken;
        gamePool.gameId = gameId;
        gamePool.burnFee = _burnFee;
        gamePool.treasuryFee = _treasuryFee;
        gamePool.minTokenAmount = _minTokenAmount;
        gamePool.isActive = true;
        allGameIds.push(gameId);
        emit GameCreated(gameId, _baseToken, _minTokenAmount);
    }

    function createChallenge(bytes32 _gameId, uint256 _xpAmount, bool _side) external whenNotPaused nonReentrant {
        GamePool storage gamePool = gamePools[_gameId];
        if (!gamePool.isActive) revert GameInactive();
        if (_xpAmount < gamePool.minTokenAmount) revert AmountTooLow();

        bytes32 challengeId = keccak256(abi.encodePacked("Challenge", msg.sender, block.timestamp));
        challenges[challengeId].challengeId = challengeId;
        challenges[challengeId].gameId = _gameId;
        challenges[challengeId].isActive = true;
        challenges[challengeId].xpAmount = _xpAmount;
        challenges[challengeId].createTime = block.timestamp;

        challenges[challengeId].creator = User({
            userAddress: msg.sender,
            xpAmount: _xpAmount,
            betTime: block.timestamp,
            rewardAmount: 0,
            challengeId: challengeId,
            isCreator: true,
            side: _side
        });

        isActiveChallengeId[challengeId] = true;
        allChallengeIds.push(challengeId);
        gamePools[_gameId].challengeIds.push(challengeId);
        IERC20(gamePool.baseToken).safeTransferFrom(msg.sender, address(this), _xpAmount);
        emit ChallengeCreated(challengeId, msg.sender, _xpAmount);
    }

    function enterChallenge(bytes32 _challengeId, uint256 _xpAmount, bool _side) external whenNotPaused nonReentrant {
        Challenge storage challenge = challenges[_challengeId];
        if (!challenge.isActive) revert ChallengeInactive();
        if (challenge.creator.userAddress == msg.sender) revert SelfChallenge();
        if (_xpAmount != challenge.xpAmount) revert AmountMismatch();
        if (_side == challenge.creator.side) revert SameSideSelected();

        GamePool storage gamePool = gamePools[challenge.gameId];
        challenge.challenger = User({
            userAddress: msg.sender,
            xpAmount: _xpAmount,
            betTime: block.timestamp,
            rewardAmount: 0,
            challengeId: _challengeId,
            isCreator: false,
            side: _side
        });

        isActiveChallengeId[_challengeId] = false;
        IERC20(gamePool.baseToken).safeTransferFrom(msg.sender, address(this), _xpAmount);

        if (isVRF == false) {
            uint256 fallbackRandom = uint256(keccak256(abi.encodePacked(
                blockhash(block.number - 1),
                block.prevrandao,
                block.timestamp,
                address(this),
                msg.sender
            )));
            emit FallbackRandomUsed(_challengeId);
            _resolveOutcome(_challengeId, fallbackRandom, _side);
        } else {
            uint256 requestId = requestRandomWords(false);
            pendingChallenges[requestId] = _challengeId;
            emit ChallengeDrawRequested(requestId, _challengeId);
        }

        emit EnteredChallenge(_challengeId, msg.sender, _xpAmount);
    }

    function requestRandomWords(bool enableNativePayment) internal returns (uint256 requestId) {
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: s_subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: enableNativePayment })
                )
            })
        );
        s_requests[requestId] = RequestStatus({
            randomWords: new uint256[](0) ,
            exists: true,
            fulfilled: false
        });
        emit RequestSent(requestId, numWords);
    }

    function fulfillRandomWords(uint256 _requestId, uint256[] calldata _randomWords)
        internal override nonReentrant
    {
        if (!s_requests[_requestId].exists) revert RequestNotFound();
        s_requests[_requestId].fulfilled = true;
        s_requests[_requestId].randomWords = _randomWords;
        emit RequestFulfilled(_requestId, _randomWords);

        bytes32 challengeId = pendingChallenges[_requestId];
        _resolveOutcome(challengeId, _randomWords[0], challenges[challengeId].challenger.side);
        delete pendingChallenges[_requestId];
        delete s_requests[_requestId];
    }

    function cancelChallenge(bytes32 _challengeId) external nonReentrant whenNotPaused {
        Challenge storage challenge = challenges[_challengeId];

        // Checks
        if (!challenge.isActive) revert ChallengeInactive();
        if (challenge.creator.userAddress != msg.sender) revert NotCreator();
        if (challenge.challenger.userAddress != address(0)) revert AlreadyUsed(); // Already has a challenger

        // Refund first
        GamePool storage gamePool = gamePools[challenge.gameId];
        IERC20(gamePool.baseToken).safeTransfer(challenge.creator.userAddress, challenge.xpAmount);

        // Mark challenge as inactive (or delete it if you want)
        challenge.isActive = false;
        isActiveChallengeId[_challengeId] = false;

        // Remove from allChallengeIds
        _removeBytes32FromArray(allChallengeIds, _challengeId);

        // Remove from gamePool.challengeIds
        _removeBytes32FromArray(gamePools[challenge.gameId].challengeIds, _challengeId);

        emit ChallengeCancelled(_challengeId, msg.sender);
    }

    /// Helper to remove a bytes32 value from an array (gas-efficient, but changes order)
    function _removeBytes32FromArray(bytes32[] storage array, bytes32 value) internal {
        uint256 len = array.length;
        for (uint256 i = 0; i < len; i++) {
            if (array[i] == value) {
                array[i] = array[len - 1]; // Move last to slot i
                array.pop(); // Remove last
                break;
            }
        }
    }


    function withdraw(address token_, uint256 amount) external onlyOwner whenNotPaused
    {
        if (token_ == address(0)) revert ZeroAddressToken();

        IERC20 token = IERC20(token_);
        uint256 bal = token.balanceOf(address(this));
        if (amount > bal) revert NotEnoughBalance();

        token.safeTransfer(msg.sender, amount);

        emit Withdraw(token_, msg.sender, amount);
    }

    function setTreasury(address _treasury) external onlyOwner whenNotPaused {
        if (_treasury == burnAddress) revert InvalidTreasury();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setGameData(
        bytes32 _gameId,
        uint8 _burnFee,
        uint8 _treasuryFee,
        uint256 _minTokenAmount
    ) external onlyOwner whenNotPaused {
        if (_burnFee + _treasuryFee > baseDivider) revert InvalidFeeConfig();
        GamePool storage pool = gamePools[_gameId];
        pool.burnFee = _burnFee;
        pool.treasuryFee = _treasuryFee;
        pool.minTokenAmount = _minTokenAmount;
        emit GameDataUpdated(_gameId, _burnFee, _treasuryFee, _minTokenAmount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setVRF() external onlyOwner { isVRF = true; }
    function unsetVRF() external onlyOwner { isVRF = false; }

    // --- View Functions ---
    function getGameInfo(bytes32 _gameId) external view returns (
        address, uint8, uint8, uint256, bytes32[] memory, uint256, bool
    ) {
        GamePool storage gamePool = gamePools[_gameId];
        return (
            gamePool.baseToken,
            gamePool.burnFee,
            gamePool.treasuryFee,
            gamePool.totalXpAmount,
            gamePool.challengeIds,
            gamePool.minTokenAmount,
            gamePool.isActive
        );
    }

    function getChallengeInfo(bytes32 _challengeId) external view returns (
        bytes32, User memory, User memory, bool, bool, uint256, uint256, uint256
    ) {
        Challenge storage challenge = challenges[_challengeId];
        return (
            challenge.gameId,
            challenge.creator,
            challenge.challenger,
            challenge.isActive,
            challenge.result,
            challenge.createTime,
            challenge.drawTime,
            challenge.xpAmount
        );
    }



    function getGameIds() external view returns (uint256 len, bytes32[] memory ids) {
        len = allGameIds.length;
        ids = new bytes32[](len);
        for (uint256 i = 0; i < len; ++i) {
            ids[i] = allGameIds[i];
        }
    }

    function getChallengeIds() external view returns (uint256 len, bytes32[] memory ids) {
        len = allChallengeIds.length;
        ids = new bytes32[](len);
        for (uint256 i = 0; i < len; ++i) {
            ids[i] = allChallengeIds[i];
        }
    }

    function getAllUserAddress() external view returns (uint256 len, address[] memory addrs) {
        len = allUserAddresses.length;
        addrs = new address[](len);
        for (uint256 i = 0; i < len; ++i) {
            addrs[i] = allUserAddresses[i];
        }
    }

    function getUserHistory(address _user) external view returns (bytes32[] memory) {
        return userHistory[_user];
    }


    // ==== Minimal outcome resolver (no transfers) ====
    function _resolveOutcome(bytes32 _challengeId, uint256 _result, bool _side) internal {
        Challenge storage challenge = challenges[_challengeId];
        if (!challenge.isActive) revert ChallengeEnded();
        challenge.isActive = false;

        GamePool storage gamePool = gamePools[challenge.gameId];
        uint256 _xpAmount = challenge.xpAmount;

        uint256 _burnAmount     = (_xpAmount * gamePool.burnFee)     / baseDivider;
        uint256 _treasuryAmount = (_xpAmount * gamePool.treasuryFee) / baseDivider;
        uint256 _winnerAmount   = _xpAmount * 2 - _burnAmount - _treasuryAmount;

        bool winnerSide = (_result & 1 == 1);
        bool challengerWins = (winnerSide == _side);

        address winner = challengerWins
            ? challenge.challenger.userAddress
            : challenge.creator.userAddress;

        // Keep semantics: result=true when creator wins; false when challenger wins
        challenge.result = !challengerWins;
        challenge.drawTime = block.timestamp;

        payouts[_challengeId] = Payout({
            token: gamePool.baseToken,
            winner: winner,
            winnerAmount: _winnerAmount,
            burnAmount: _burnAmount,
            treasuryAmount: _treasuryAmount,
            claimed: false
        });

        emit WinnerDrawn(
            _challengeId,
            challenge.creator.userAddress,
            challenge.challenger.userAddress,
            _xpAmount,
            winnerSide,
            winner,
            challenge.drawTime,
            _winnerAmount
        );
        emit PayoutReady(_challengeId, winner, gamePool.baseToken, _winnerAmount, _burnAmount, _treasuryAmount);
    }

    // ==== Winner claims funds and cleanup ====
    function claimPayout(bytes32 _challengeId) external nonReentrant whenNotPaused {
        Challenge storage challenge = challenges[_challengeId];
        Payout storage p = payouts[_challengeId];

        if (challenge.isActive) revert ChallengeInactive();
        if (p.winner == address(0)) revert PayoutNotReady();
        if (p.claimed) revert AlreadyClaimed();
        if (msg.sender != p.winner) revert NotWinner();

        IERC20 token = IERC20(p.token);
        token.safeTransfer(burnAddress, p.burnAmount);
        token.safeTransfer(treasury,    p.treasuryAmount);
        token.safeTransfer(p.winner,    p.winnerAmount);

        p.claimed = true;

        gamePools[challenge.gameId].totalXpAmount += challenge.xpAmount * 2; // Both players' stakes

        if (userHistory[challenge.creator.userAddress].length == 0) {
            allUserAddresses.push(challenge.creator.userAddress);
        }
        if (userHistory[challenge.challenger.userAddress].length == 0) {
            allUserAddresses.push(challenge.challenger.userAddress);
        }

        userHistory[p.winner].push(_challengeId);

        _removeBytes32FromArray(allChallengeIds, _challengeId);
        _removeBytes32FromArray(gamePools[challenge.gameId].challengeIds, _challengeId);

        isActiveChallengeId[_challengeId] = false;
        delete challenges[_challengeId];
        delete payouts[_challengeId];

        emit PayoutClaimed(_challengeId, p.winner, p.winnerAmount, p.burnAmount, p.treasuryAmount);
    }
}