// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ---------- Chainlink VRF v2.5 (Plus) ----------
import {VRFConsumerBaseV2Plus} from "chainlink-evm/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "chainlink-evm/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

// ---------- OpenZeppelin (v5) ----------
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

// ---------- Wave Vault Interface ----------
interface IWaveVault {
    function distributeReward(bytes32 poolId, address winner, uint256 xpAmount) external;
}

contract WavePrizePool is ReentrancyGuard, VRFConsumerBaseV2Plus, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ----------- Types -----------
    struct User {
        address user;
        uint256 xpAmount;
        uint256 betTime;
        uint256 rewardAmount; // filled for winner
    }

    struct PrizePool {
        bytes32  id;              // keccak256 unique ID
        address  baseToken;       // ERC-20 token used
        uint8    burnFee;         // /100
        uint8    treasuryFee;     // /100
        bool     isActive;        // open for entries
        bool     drawRequested;   // VRF already requested
        bool     drawn;           // winner already drawn
        bool     payoutClaimed;   // payout already claimed
        uint256  totalXpAmount;   // total staked amount
        uint256  limitAmount;     // cap (0 = no cap)
        uint256  ticketPrice;     // per-entry minimum (>=)
        uint256  startTime;       // pool creation time
        uint256  limitDuration;   // duration in seconds (0 = no time limit)
        User     winner;          // winner snapshot
        User[]   users;           // participants
        bool     poolType;        // 0 = monthly, 1 = daily
    }

    // ----------- Storage -----------
    uint256 public constant BASE_DIVIDER = 100;
    address public treasury;
    address public constant BURN_ADDRESS = address(0xdead);
    
    // Vault integration
    IWaveVault public waveVault;

    // pool registry
    bytes32[] public poolIds;                 // list of ids
    mapping(bytes32 => uint256) public poolIndex; // id -> index
    PrizePool[] internal prizePools;          // parallel to poolIds by index

    // user history
    mapping(address => User[]) public userHistory;

    // ----------- Chainlink VRF -----------
    // Sepolia defaults (adjust per network if needed)
    bytes32 public keyHash = 0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26;
    uint32  public callbackGasLimit = 300_000;
    uint16  public requestConfirmations = 3;
    uint32  public numWords = 1;

    uint256 public s_subscriptionId;
    bool public isVRF = true;

    struct RequestStatus {
        bool fulfilled;
        bool exists;
        uint256[] randomWords;
    }
    mapping(uint256 => RequestStatus) public s_requests;
    mapping(uint256 => bytes32) public requestIdToPoolId;
    mapping(bytes32 => uint256) public poolIdToRequestId;
    uint256[] public requestIds;

    // ----------- Errors -----------
    error PoolNotFound();
    error PoolInactive();
    error PoolTimeClosed();
    error AmountTooSmall();
    error CapExceeded();
    error DrawAlreadyRequested();
    error DrawNotRequested();
    error AlreadyDrawn();
    error NoParticipants();
    error BadTreasury();
    error IndexOutOfBounds();
    error NotTimeOut();
    error NotEmptyPool();
    error AlreadyPayoutClaimed();
    error PayoutNotClaimed();
    error CleanupNotAllowed();
    error NotEnoughBalance();
    error ZeroAddressToken();

    // ----------- Events -----------
    event PoolCreated(bytes32 indexed poolId, address baseToken, uint256 limitAmount, uint256 ticketPrice, bool _poolType);
    event EnteredPool(bytes32 indexed poolId, address indexed user, uint256 xpAmount);
    event PoolDrawRequested(uint256 indexed requestId, bytes32 indexed poolId);
    event WinnerDrawn(bytes32 indexed poolId, address indexed winner, uint256 rewardAmount, bool poolType);
    event PoolEnded(bytes32 indexed poolId);
    event PoolDataUpdated(bytes32 indexed poolId, uint8 burnFee, uint8 treasuryFee, uint256 limitAmount, uint256 ticketPrice, bool _poolType);
    event TreasuryUpdated(address newTreasury);
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);
    event PlayStarted(bytes32 indexed _poolId);
    event FallbackRandomUsed(bytes32 indexed _poolId);
    event PayoutClaimed(bytes32 indexed poolId, address indexed winner, uint256 amount, bool poolType);
    event StartTimeUpdated(bytes32 indexed poolId, uint256 oldStartTime, uint256 newStartTime);
    event Withdraw(address token_, address sender, uint256 amount);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event VaultRewardTriggered(bytes32 indexed poolId, address indexed winner, uint256 xpAmount);

    // ----------- Constructor -----------
    constructor(address _treasury, uint256 _subscriptionId)
        VRFConsumerBaseV2Plus(0xDA3b641D438362C440Ac5458c57e00a712b66700) // VRFCoordinator v2.5+
        Ownable(msg.sender)
    {
        if (_treasury == address(0) || _treasury == BURN_ADDRESS) revert BadTreasury();
        treasury = _treasury;
        s_subscriptionId = _subscriptionId;
    }

    // ========= Views / Getters =========

    function getAllPoolIds() external view returns (bytes32[] memory) {
        return poolIds;
    }

    /// @notice Split summary into two smaller getters to avoid "stack too deep"

    function getPoolConfig(bytes32 _poolId)
        external
        view
        returns (
            address baseToken,
            uint8 burnFee,
            uint8 treasuryFee,
            uint256 limitAmount,
            uint256 ticketPrice,
            uint256 startTime,
            uint256 limitDuration,
            bool isActive,
            bool drawn,
            bool poolType,
            bool payoutClaimed,
            address winnerAddress
        )
    {
        (PrizePool storage p, ) = _getPool(_poolId);
        return (
            p.baseToken,
            p.burnFee,
            p.treasuryFee,
            p.limitAmount,
            p.ticketPrice,
            p.startTime,
            p.limitDuration,
            p.isActive,
            p.drawn,
            p.poolType,
            p.payoutClaimed,
            p.winner.user // winner address
        );
    }

    function getPoolState(bytes32 _poolId)
        external
        view
        returns (
            uint256 totalXpAmount,
            User[] memory users,
            User memory winner
        )
    {
        (PrizePool storage p, ) = _getPool(_poolId);
        return (p.totalXpAmount, p.users, p.winner);
    }

    // ========= Admin =========

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setVRF() external onlyOwner { isVRF = true; }
    function unsetVRF() external onlyOwner { isVRF = false; }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0) || _treasury == BURN_ADDRESS) revert BadTreasury();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setWaveVault(address _vault) external onlyOwner {
        address oldVault = address(waveVault);
        waveVault = IWaveVault(_vault);
        emit VaultUpdated(oldVault, _vault);
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

    function startPlay(bytes32 _poolId) external onlyOwner {
        (PrizePool storage p, ) = _getPool(_poolId);
        if(p.users.length == 0) revert NoParticipants();
        if(p.drawRequested) revert DrawAlreadyRequested();
        bool timeHit = (p.limitDuration != 0 && block.timestamp >= p.startTime + p.limitDuration);
        if(!timeHit) revert NotTimeOut();
            p.drawRequested = true;
            p.isActive = false; // lock pool immediately
                
            if (isVRF == false) {
                uint256 fallbackRandom = uint256(keccak256(abi.encodePacked(
                    blockhash(block.number - 1),
                    block.prevrandao,
                    block.timestamp,
                    address(this),
                    msg.sender
                )));
                emit FallbackRandomUsed(_poolId);
                _safeDraw(_poolId, fallbackRandom);
            } else {
                uint256 requestId = _requestRandomWords(false);
                requestIdToPoolId[requestId] = _poolId;
                poolIdToRequestId[_poolId]   = requestId;
                emit PoolDrawRequested(requestId, _poolId);
            }
            
        emit PlayStarted(_poolId);
    }

    function setCallbackGasLimit(uint32 _limit) external onlyOwner {
        callbackGasLimit = _limit;
    }

    function setVrfParams(bytes32 _keyHash, uint16 _confirmations, uint32 _numWords) external onlyOwner {
        keyHash = _keyHash;
        requestConfirmations = _confirmations;
        numWords = _numWords;
    }

    /// @notice Update mutable pool fields
    /// @dev _limitDuration is a DURATION in seconds (difference from now), NOT an absolute timestamp
    function setPoolData(
        bytes32 _poolId,
        address _baseToken,
        uint8 _burnFee,
        uint8 _treasuryFee,
        uint256 _limitAmount,
        uint256 _ticketPrice,
        bool _poolType
    ) external onlyOwner {
        (PrizePool storage p, ) = _getPool(_poolId);
        if(p.users.length != 0) revert NotEmptyPool();
        if (_burnFee + _treasuryFee > BASE_DIVIDER) revert BadTreasury(); // (keep same error)
        if (_baseToken == address(0)) revert BadTreasury(); // (keep same error)
        p.baseToken     = _baseToken;
        p.burnFee       = _burnFee;
        p.treasuryFee   = _treasuryFee;
        p.limitAmount   = _limitAmount;
        p.poolType      = _poolType;
        p.ticketPrice   = _ticketPrice;
        p.startTime     = block.timestamp;
        p.isActive      = true;

        emit PoolDataUpdated(_poolId, _burnFee, _treasuryFee, _limitAmount, _ticketPrice, _poolType);
    }

    // ========= Time management =========
    function _isTimeExpired(PrizePool storage p) internal view returns (bool) {
        return (p.limitDuration != 0 && block.timestamp >= p.startTime + p.limitDuration);
    }

    function refreshStartTime(bytes32 _poolId) external onlyOwner {
        (PrizePool storage p, ) = _getPool(_poolId);
        if (!p.isActive) revert PoolInactive();
        if (_isTimeExpired(p)) revert PoolTimeClosed(); // already expired → don’t refresh

        uint256 old = p.startTime;
        p.startTime = block.timestamp;
        emit StartTimeUpdated(_poolId, old, p.startTime);
    }

    function refreshStartTimes(uint256 max) external onlyOwner {
        uint256 updated = 0;
        for (uint256 i = prizePools.length; i > 0 && updated < max; ) {
            unchecked { i--; }
            PrizePool storage p = prizePools[i];

            if (p.isActive && !_isTimeExpired(p)) {
                uint256 old = p.startTime;
                p.startTime = block.timestamp;
                emit StartTimeUpdated(p.id, old, p.startTime);
                updated++;
            }
        }
    }
    /// @notice Clean up expired pools that have no participants
    function cleanExpiredEmptyPools(uint256 max) external onlyOwner {
        uint256 cleaned = 0;
        for (uint256 i = prizePools.length; i > 0 && cleaned < max; ) {
            unchecked { i--; } // safe: i>0
            PrizePool storage p = prizePools[i];

            bool timeExpired = (p.limitDuration != 0 && block.timestamp >= p.startTime + p.limitDuration);
            if (timeExpired && p.users.length == 0) {
                bytes32 pid = p.id;
                _unlinkRequestForPool(pid);
                // nothing to pay out; still free any slots
                delete p.users;
                delete p.winner;
                _removePoolAtIndex(i);
                cleaned++;
            }
        }
    }

    // ========= Pool lifecycle =========

    function createPool(
        address _baseToken,
        uint8 _burnFee,
        uint8 _treasuryFee,
        uint256 _limitAmount,
        uint256 _ticketPrice,
        bool _poolType
    ) public onlyOwner returns (bytes32 poolId) {
        poolId = _createPoolFromConfig(
            _baseToken, _burnFee, _treasuryFee, _limitAmount, _ticketPrice, _poolType
        );
    }

    // 2) Internal helper used by both `createPool` and `claimPayout`
    function _createPoolFromConfig(
        address _baseToken,
        uint8 _burnFee,
        uint8 _treasuryFee,
        uint256 _limitAmount,
        uint256 _ticketPrice,
        bool _poolType
    ) internal returns (bytes32 poolId) {
        if (_burnFee + _treasuryFee > BASE_DIVIDER) revert BadTreasury();
        if (_baseToken == address(0)) revert BadTreasury();

        poolId = keccak256(abi.encodePacked(
            _baseToken,
            _ticketPrice,
            _limitAmount,
            address(this),           // ensure uniqueness is contract-local
            block.timestamp,
            poolIds.length,
            _poolType
        ));
        if (_exists(poolId)) revert DrawAlreadyRequested();

        prizePools.push();
        PrizePool storage p = prizePools[prizePools.length - 1];

        p.id            = poolId;
        p.baseToken     = _baseToken;
        p.burnFee       = _burnFee;
        p.treasuryFee   = _treasuryFee;
        p.isActive      = true;
        p.limitAmount   = _limitAmount;
        p.poolType      = _poolType;
        p.ticketPrice   = _ticketPrice;
        p.startTime     = block.timestamp;
        // keep your original rule
        p.limitDuration = _poolType ? 1 days : 30 days;

        poolIndex[poolId] = prizePools.length - 1;
        poolIds.push(poolId);

        emit PoolCreated(poolId, _baseToken, _limitAmount, _ticketPrice, _poolType);
    }

    /// @notice Enter a pool with `_xpAmount` tokens (must approve first)
    function enterPool(bytes32 _poolId, uint256 _xpAmount)
        external
        whenNotPaused
        nonReentrant
    {
        (PrizePool storage p, ) = _getPool(_poolId);

        if (!p.isActive) revert PoolInactive();
        if (_xpAmount < p.ticketPrice) revert AmountTooSmall();

        if (p.limitDuration != 0 && block.timestamp >= p.startTime + p.limitDuration) {
            revert PoolTimeClosed();
        }

        p.users.push(User({
            user: msg.sender,
            xpAmount: _xpAmount,
            betTime: block.timestamp,
            rewardAmount: 0
        }));
        userHistory[msg.sender].push(p.users[p.users.length - 1]);
        p.totalXpAmount += _xpAmount;

        IERC20(p.baseToken).safeTransferFrom(msg.sender, address(this), _xpAmount);

        emit EnteredPool(_poolId, msg.sender, _xpAmount);

        if (!p.drawRequested) {
            bool capHit  = (p.limitAmount != 0 && p.totalXpAmount >= p.limitAmount);
            bool timeHit = (p.limitDuration != 0 && block.timestamp >= p.startTime + p.limitDuration);
            if (capHit || timeHit) {
                p.drawRequested = true;
                p.isActive = false; // lock pool immediately
                
                if (isVRF == false) {
                    uint256 fallbackRandom = uint256(keccak256(abi.encodePacked(
                        blockhash(block.number - 1),
                        block.prevrandao,
                        block.timestamp,
                        address(this),
                        msg.sender
                    )));
                    emit FallbackRandomUsed(_poolId);
                    _safeDraw(_poolId, fallbackRandom);
                } else {
                    uint256 requestId = _requestRandomWords(false);
                    requestIdToPoolId[requestId] = _poolId;
                    poolIdToRequestId[_poolId]   = requestId;
                    emit PoolDrawRequested(requestId, _poolId);
                }
            }
        }
    }

    // ========= Draw / Payout =========

    function _safeDraw(bytes32 _poolId, uint256 _randomWord) internal {
        (PrizePool storage p, ) = _getPool(_poolId);

        if (!p.drawRequested) revert DrawNotRequested();
        if (p.drawn) revert AlreadyDrawn();
        if (p.users.length == 0) revert NoParticipants();

        uint256 idx = _randomWord % p.users.length;
        uint256 burnAmount     = (p.totalXpAmount * p.burnFee) / BASE_DIVIDER;
        uint256 treasuryAmount = (p.totalXpAmount * p.treasuryFee) / BASE_DIVIDER;
        uint256 winnerAmount   = p.totalXpAmount - burnAmount - treasuryAmount;

        p.winner = p.users[idx];
        p.winner.rewardAmount = winnerAmount;
        p.drawn = true;

        emit WinnerDrawn(_poolId, p.winner.user, winnerAmount, p.poolType);
        // Transfers will be done by claimPayout
    }

    // ========= Chainlink VRF =========

    function _requestRandomWords(bool enableNativePayment) internal returns (uint256 requestId) {
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
            fulfilled: false,
            exists: true,
            randomWords: new uint256[](0)
        });
        requestIds.push(requestId);

        emit RequestSent(requestId, numWords);
    }

    function fulfillRandomWords(uint256 _requestId, uint256[] calldata _randomWords) internal override {
        if (!s_requests[_requestId].exists) revert DrawNotRequested();
        s_requests[_requestId].fulfilled = true;
        s_requests[_requestId].randomWords = _randomWords;

        emit RequestFulfilled(_requestId, _randomWords);

        bytes32 pid = requestIdToPoolId[_requestId];
        (PrizePool storage p, ) = _getPool(pid);

        if (!p.drawRequested || p.drawn || p.users.length == 0) return;

        uint256 idx = _randomWords[0] % p.users.length;
        uint256 burnAmount     = (p.totalXpAmount * p.burnFee) / BASE_DIVIDER;
        uint256 treasuryAmount = (p.totalXpAmount * p.treasuryFee) / BASE_DIVIDER;
        uint256 winnerAmount   = p.totalXpAmount - burnAmount - treasuryAmount;

        p.winner = p.users[idx];
        p.winner.rewardAmount = winnerAmount;
        p.drawn = true;

        emit WinnerDrawn(pid, p.winner.user, winnerAmount, p.poolType);
        // Transfers happen in claimPayout
    }

    function claimPayout(bytes32 _poolId) external nonReentrant {
        (PrizePool storage p, uint256 idx) = _getPool(_poolId);
        if (!p.drawn) revert DrawNotRequested();
        if (p.payoutClaimed) revert AlreadyPayoutClaimed();

        address  _baseToken   = p.baseToken;
        uint8    _burnFee     = p.burnFee;
        uint8    _treasuryFee = p.treasuryFee;
        uint256  _limitAmount = p.limitAmount;
        uint256  _ticketPrice = p.ticketPrice;
        bool     _poolType    = p.poolType;

        uint256 burnAmount     = (p.totalXpAmount * p.burnFee) / BASE_DIVIDER;
        uint256 treasuryAmount = (p.totalXpAmount * p.treasuryFee) / BASE_DIVIDER;
        uint256 winnerAmount   = p.totalXpAmount - burnAmount - treasuryAmount;

        p.payoutClaimed = true;

        // Transfer XP tokens to winner
        IERC20(p.baseToken).safeTransfer(p.winner.user, winnerAmount);
        if (burnAmount > 0)     IERC20(p.baseToken).safeTransfer(BURN_ADDRESS, burnAmount);
        if (treasuryAmount > 0) IERC20(p.baseToken).safeTransfer(treasury, treasuryAmount);

        // Trigger vault USDT distribution if vault is set
        if (address(waveVault) != address(0)) {
            try waveVault.distributeReward(_poolId, p.winner.user, winnerAmount) {
                emit VaultRewardTriggered(_poolId, p.winner.user, winnerAmount);
            } catch {
                // Vault distribution failed, but XP payout still succeeded
                // This ensures the main functionality continues even if vault fails
            }
        }

        emit PayoutClaimed(_poolId, p.winner.user, winnerAmount, _poolType);

        //delete current claimed pool
        _unlinkRequestForPool(_poolId);
        delete p.users;
        delete p.winner;
        _removePoolAtIndex(idx);
        
        emit PoolEnded(_poolId);

        //_createPoolFromConfig(_baseToken, _burnFee, _treasuryFee, _limitAmount, _ticketPrice, _poolType);
    }

    //------------------------Cleanup Helper Functions------------------------//
    function _removeRequestIdFromArray(uint256 _rid) internal {
        uint256 len = requestIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (requestIds[i] == _rid) {
                if (i != len - 1) {
                    requestIds[i] = requestIds[len - 1];
                }
                requestIds.pop();
                break;
            }
        }
    }

    function _unlinkRequestForPool(bytes32 _poolId) internal {
        uint256 rid = poolIdToRequestId[_poolId];
        if (rid != 0) {
            delete s_requests[rid];
            delete requestIdToPoolId[rid];
            _removeRequestIdFromArray(rid);
            delete poolIdToRequestId[_poolId];
        }
    }

    function _removePoolAtIndex(uint256 idx) internal {
        bytes32 pidToRemove = poolIds[idx];
        uint256 last = prizePools.length - 1;

        if (idx != last) {
            // move last entries into idx
            prizePools[idx] = prizePools[last];
            bytes32 movedPid = prizePools[idx].id;

            poolIds[idx] = movedPid;
            poolIndex[movedPid] = idx;
        }

        prizePools.pop();
        poolIds.pop();
        delete poolIndex[pidToRemove];
    }
    
    // ========= Internals =========

    function _exists(bytes32 _poolId) internal view returns (bool) {
        if (poolIds.length == 0) return false;
        uint256 idx = poolIndex[_poolId];
        if (idx >= poolIds.length) return false;
        return poolIds[idx] == _poolId;
    }

    function _getPool(bytes32 _poolId) internal view returns (PrizePool storage p, uint256 idx) {
        if (!_exists(_poolId)) revert PoolNotFound();
        idx = poolIndex[_poolId];
        p = prizePools[idx];
    }

    function getRequestStatus(uint256 _requestId) external view returns (bool fulfilled, uint256[] memory randomWords) {
        if (!s_requests[_requestId].exists) revert DrawNotRequested(); // or RequestNotFound
        RequestStatus memory r = s_requests[_requestId];
        return (r.fulfilled, r.randomWords);
    }
}
