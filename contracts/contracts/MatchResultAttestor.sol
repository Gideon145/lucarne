// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MatchResultAttestor
 * @notice Closes the signal loop. After a match ends, the owner calls resolve()
 *         with the actual outcome. The contract reads the pre-match signal from
 *         MatchSignalAttestor and determines on-chain whether the signal was correct.
 *
 * Each resolution stores:
 *   - actualOutcome : 0=HOME · 1=DRAW · 2=AWAY
 *   - signalCall    : what the pre-match signal predicted (read from MatchSignalAttestor)
 *   - signalCorrect : true if signalCall == actualOutcome (computed on-chain, immutable)
 *   - resolvedAt    : block.timestamp — proves when the result was posted
 *
 * Global accuracy tracking:
 *   - totalResolved : total games resolved so far
 *   - totalCorrect  : total signals that matched the result
 *   Read these to display "X/Y signals correct" in the frontend.
 *
 * Write is one-time-only per gameId.
 * Only the designated owner can call resolve().
 */

interface IMatchSignalAttestor {
    enum Call { HOME, DRAW, AWAY }

    struct MatchSignal {
        uint8   homeProb;
        uint8   drawProb;
        uint8   awayProb;
        uint8   signalScore;
        Call    signalCall;
        bytes32 dataHash;
        uint40  attestedAt;
        address attester;
    }

    function getSignal(bytes32 gameId) external view returns (MatchSignal memory);
    function hasSignal(bytes32 gameId) external view returns (bool);
}

contract MatchResultAttestor {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct MatchResult {
        uint8   actualOutcome; // 0=HOME · 1=DRAW · 2=AWAY
        uint8   signalCall;    // what MatchSignalAttestor predicted
        bool    signalCorrect; // computed on-chain: signalCall == actualOutcome
        uint40  resolvedAt;    // block.timestamp at resolution
        address resolver;      // who called resolve()
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public immutable owner;
    IMatchSignalAttestor public immutable signalAttestor;

    mapping(bytes32 => MatchResult) private _results;

    /// Global accuracy counters — readable by frontend
    uint256 public totalResolved;
    uint256 public totalCorrect;

    // ── Events ────────────────────────────────────────────────────────────────

    event MatchResolved(
        bytes32 indexed gameId,
        uint8   actualOutcome,
        uint8   signalCall,
        bool    signalCorrect,
        uint40  resolvedAt
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner, address _signalAttestor) {
        require(_owner          != address(0), "Zero owner");
        require(_signalAttestor != address(0), "Zero signal attestor");
        owner          = _owner;
        signalAttestor = IMatchSignalAttestor(_signalAttestor);
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * @notice Record the actual result and close the signal loop.
     * @param gameId        keccak256(abi.encodePacked(slug)) — must match MatchSignalAttestor
     * @param actualOutcome 0=HOME · 1=DRAW · 2=AWAY
     */
    function resolve(bytes32 gameId, uint8 actualOutcome) external {
        require(msg.sender == owner,                    "Not resolver");
        require(_results[gameId].resolvedAt == 0,       "Already resolved");
        require(actualOutcome <= 2,                     "Invalid outcome");

        // Read the pre-match signal — must exist before resolving
        require(signalAttestor.hasSignal(gameId),       "No signal attested for this game");
        IMatchSignalAttestor.MatchSignal memory sig = signalAttestor.getSignal(gameId);

        uint8 signalCall    = uint8(sig.signalCall);
        bool  signalCorrect = (signalCall == actualOutcome);

        _results[gameId] = MatchResult({
            actualOutcome: actualOutcome,
            signalCall:    signalCall,
            signalCorrect: signalCorrect,
            resolvedAt:    uint40(block.timestamp),
            resolver:      msg.sender
        });

        totalResolved++;
        if (signalCorrect) totalCorrect++;

        emit MatchResolved(gameId, actualOutcome, signalCall, signalCorrect, uint40(block.timestamp));
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    function getResult(bytes32 gameId) external view returns (MatchResult memory) {
        return _results[gameId];
    }

    function isResolved(bytes32 gameId) external view returns (bool) {
        return _results[gameId].resolvedAt != 0;
    }

    /// @notice Returns accuracy as (correct, total) — frontend computes the %.
    function accuracy() external view returns (uint256 correct, uint256 total) {
        return (totalCorrect, totalResolved);
    }
}
