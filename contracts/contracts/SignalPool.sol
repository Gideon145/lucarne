// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SignalPool
 * @notice Parimutuel prediction pool where the Lucarne agent puts skin in the game.
 *
 * Flow:
 *   1. Agent calls agentStake(gameId, outcome, kickoffTimestamp) with native token —
 *      locks its stake on the outcome its signal predicts. Pool opens for bets.
 *   2. Anyone calls bet(gameId, outcome) with native token before kickoff.
 *   3. After MatchResultAttestor has resolved the game, anyone calls settle(gameId).
 *   4. All stakers on the winning outcome split the entire pot proportionally via claim().
 *
 * Key property: the agent is a participant, not a house. If Lucarne's signal is wrong,
 * its stake goes to the winning bettors. The signal's confidence is bonded by real value.
 */

interface IMatchResultAttestor {
    struct MatchResult {
        uint8   actualOutcome; // 0=HOME · 1=DRAW · 2=AWAY
        uint8   signalCall;
        bool    signalCorrect;
        uint40  resolvedAt;
        address resolver;
    }
    function getResult(bytes32 gameId) external view returns (MatchResult memory);
    function isResolved(bytes32 gameId) external view returns (bool);
}

contract SignalPool {

    // ── Constants ─────────────────────────────────────────────────────────────

    uint8 public constant HOME = 0;
    uint8 public constant DRAW = 1;
    uint8 public constant AWAY = 2;

    // ── State ─────────────────────────────────────────────────────────────────

    address public immutable owner;
    address public immutable agent;          // Lucarne agent wallet
    IMatchResultAttestor public immutable resultAttestor;

    struct Pool {
        uint256[3] buckets;    // buckets[outcome] = total staked on that outcome
        uint256 agentStake;    // agent's original locked amount (for UI)
        uint8   agentCall;     // outcome the agent staked on (mirrors its signal)
        bool    open;          // pool is accepting bets
        bool    settled;       // settle() has been called
        uint8   winOutcome;    // set on settle()
    }

    mapping(bytes32 => Pool) private _pools;

    /// stakes[gameId][outcome][user] = amount staked
    mapping(bytes32 => mapping(uint8 => mapping(address => uint256))) private _stakes;

    /// kickoff timestamp per game — no bets accepted at or after this
    mapping(bytes32 => uint256) public deadlines;

    // ── Events ────────────────────────────────────────────────────────────────

    event AgentStaked(
        bytes32 indexed gameId,
        uint8   outcome,
        uint256 amount,
        uint256 kickoffTimestamp
    );

    event BetPlaced(
        bytes32 indexed gameId,
        address indexed user,
        uint8   outcome,
        uint256 amount
    );

    event PoolSettled(
        bytes32 indexed gameId,
        uint8   winOutcome,
        uint256 totalPot,
        bool    agentCorrect
    );

    event Claimed(
        bytes32 indexed gameId,
        address indexed user,
        uint256 payout
    );

    event NoWinnerReclaimed(
        bytes32 indexed gameId,
        address indexed claimant,
        uint8   outcome,
        uint256 amount
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner, address _agent, address _resultAttestor) {
        require(_owner          != address(0), "Zero owner");
        require(_agent          != address(0), "Zero agent");
        require(_resultAttestor != address(0), "Zero attestor");
        owner         = _owner;
        agent         = _agent;
        resultAttestor = IMatchResultAttestor(_resultAttestor);
    }

    // ── Agent ─────────────────────────────────────────────────────────────────

    /**
     * @notice Agent opens the pool by staking native token on the outcome its signal predicts.
     *         Must be called before kickoff — kickoffTimestamp is the hard deadline for bets.
     * @param gameId            keccak256(abi.encodePacked(slug)) — same as signal attestors
     * @param outcome           0=HOME · 1=DRAW · 2=AWAY (must match signal's signalCall)
     * @param kickoffTimestamp  Unix timestamp of match kickoff — pool closes at this time
     */
    function agentStake(bytes32 gameId, uint8 outcome, uint256 kickoffTimestamp) external payable {
        require(msg.sender == agent,                  "Only agent");
        require(outcome <= 2,                         "Bad outcome");
        require(msg.value > 0,                        "Zero stake");
        require(!_pools[gameId].open,                 "Already open");
        require(kickoffTimestamp > block.timestamp,   "Kickoff already past");

        deadlines[gameId] = kickoffTimestamp;

        Pool storage p = _pools[gameId];
        p.open        = true;
        p.agentStake  = msg.value;
        p.agentCall   = outcome;
        p.buckets[outcome] += msg.value;
        _stakes[gameId][outcome][msg.sender] += msg.value;

        emit AgentStaked(gameId, outcome, msg.value, kickoffTimestamp);
    }

    // ── Bettors ───────────────────────────────────────────────────────────────

    /**
     * @notice Stake native token on any outcome before kickoff.
     *         You are betting against (or with) the Lucarne signal.
     * @param gameId   must match an open pool opened by the agent
     * @param outcome  0=HOME · 1=DRAW · 2=AWAY
     */
    function bet(bytes32 gameId, uint8 outcome) external payable {
        require(outcome <= 2,                           "Bad outcome");
        require(msg.value > 0,                          "Zero bet");
        Pool storage p = _pools[gameId];
        require(p.open,                                 "Pool not open");
        require(!p.settled,                             "Already settled");
        require(block.timestamp < deadlines[gameId],    "Kickoff passed");

        p.buckets[outcome] += msg.value;
        _stakes[gameId][outcome][msg.sender] += msg.value;

        emit BetPlaced(gameId, msg.sender, outcome, msg.value);
    }

    // ── Settlement ────────────────────────────────────────────────────────────

    /**
     * @notice Settle the pool once MatchResultAttestor has recorded the result.
     *         Callable by anyone — trustless settlement.
     */
    function settle(bytes32 gameId) external {
        Pool storage p = _pools[gameId];
        require(p.open,                          "Pool not open");
        require(!p.settled,                      "Already settled");
        require(resultAttestor.isResolved(gameId), "No result on-chain yet");

        IMatchResultAttestor.MatchResult memory r = resultAttestor.getResult(gameId);

        p.settled    = true;
        p.winOutcome = r.actualOutcome;

        uint256 total = p.buckets[0] + p.buckets[1] + p.buckets[2];

        emit PoolSettled(gameId, r.actualOutcome, total, r.signalCorrect);
    }

    // ── Claims ────────────────────────────────────────────────────────────────

    /**
     * @notice Claim proportional share of the entire pot if you staked on the winning outcome.
     *         Uses CEI — safe against reentrancy.
     */
    function claim(bytes32 gameId) external {
        Pool storage p = _pools[gameId];
        require(p.settled, "Not settled yet");

        uint8   win       = p.winOutcome;
        uint256 userStake = _stakes[gameId][win][msg.sender];
        require(userStake > 0, "Nothing to claim");

        // CEI: zero out before transfer
        _stakes[gameId][win][msg.sender] = 0;

        uint256 total  = p.buckets[0] + p.buckets[1] + p.buckets[2];
        uint256 payout = (userStake * total) / p.buckets[win];

        (bool ok, ) = payable(msg.sender).call{value: payout}("");
        require(ok, "Transfer failed");

        emit Claimed(gameId, msg.sender, payout);
    }

    /**
     * @notice Reclaim your stake when the pool has settled but the winning bucket is empty
     *         (no one staked on the actual outcome — common when agent is wrong and no
     *         counterparty exists). Anyone can reclaim their own stake from any losing bucket.
     * @param gameId  keccak256(slug) — same id used when staking
     * @param outcome The outcome bucket you originally staked on
     */
    function reclaimNoWinner(bytes32 gameId, uint8 outcome) external {
        Pool storage p = _pools[gameId];
        require(p.settled,                        "Not settled yet");
        require(p.buckets[p.winOutcome] == 0,     "Winners exist - use claim()");

        uint256 stake = _stakes[gameId][outcome][msg.sender];
        require(stake > 0,                        "Nothing to reclaim");

        // CEI: zero out before transfer
        _stakes[gameId][outcome][msg.sender] = 0;
        p.buckets[outcome] -= stake;

        (bool ok, ) = payable(msg.sender).call{value: stake}("");
        require(ok, "Transfer failed");

        emit NoWinnerReclaimed(gameId, msg.sender, outcome, stake);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /**
     * @notice Full pool state for a game.
     */
    function getPool(bytes32 gameId) external view returns (
        uint256 homeBucket,
        uint256 drawBucket,
        uint256 awayBucket,
        uint256 agentStakeAmount,
        uint8   agentCall,
        bool    open,
        bool    settled,
        uint8   winOutcome
    ) {
        Pool storage p = _pools[gameId];
        return (
            p.buckets[0],
            p.buckets[1],
            p.buckets[2],
            p.agentStake,
            p.agentCall,
            p.open,
            p.settled,
            p.winOutcome
        );
    }

    /**
     * @notice How much a specific address staked on a specific outcome.
     */
    function getUserStake(bytes32 gameId, uint8 outcome, address user) external view returns (uint256) {
        return _stakes[gameId][outcome][user];
    }

    /**
     * @notice Whether the pool is currently accepting bets.
     */
    function isAcceptingBets(bytes32 gameId) external view returns (bool) {
        Pool storage p = _pools[gameId];
        return p.open && !p.settled && block.timestamp < deadlines[gameId];
    }

    /**
     * @notice Total pot size for a game.
     */
    function totalPot(bytes32 gameId) external view returns (uint256) {
        Pool storage p = _pools[gameId];
        return p.buckets[0] + p.buckets[1] + p.buckets[2];
    }
}
