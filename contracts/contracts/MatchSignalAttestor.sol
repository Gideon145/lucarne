// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MatchSignalAttestor
 * @notice Writes one immutable pre-kickoff signal per club match.
 *
 * Each attestation encodes the full set of inputs used to compute the signal:
 *   - homeProb / drawProb / awayProb : market-implied win probabilities (0-100)
 *   - signalScore                    : composite weighted score for the favoured outcome
 *   - signalCall                     : 0=HOME · 1=DRAW · 2=AWAY
 *   - dataHash                       : keccak256(abi.encode(slug, homeProb, drawProb,
 *                                        awayProb, homeFormScore, awayFormScore))
 *                                        — lets anyone independently verify the inputs
 *   - attestedAt                     : block.timestamp — proves the signal was written
 *                                        before the match kicked off
 *
 * Write is one-time-only per gameId (no overwrites after kickoff).
 * Only the designated attester wallet can write.
 */
contract MatchSignalAttestor {

    // ── Enums ─────────────────────────────────────────────────────────────────

    /// @dev Which outcome the composite signal favours.
    enum Call { HOME, DRAW, AWAY }

    // ── Structs ───────────────────────────────────────────────────────────────

    struct MatchSignal {
        uint8   homeProb;    // market % for home win  (0-100)
        uint8   drawProb;    // market % for draw      (0-100)
        uint8   awayProb;    // market % for away win  (0-100)
        uint8   signalScore; // composite signal score (0-100)
        Call    signalCall;  // signal's favoured outcome
        bytes32 dataHash;    // provenance anchor — keccak256 of all raw inputs
        uint40  attestedAt;  // block.timestamp at write
        address attester;    // who called attest()
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public immutable owner;

    /// gameId → MatchSignal  (gameId = keccak256(abi.encodePacked(slug)))
    mapping(bytes32 => MatchSignal) private _signals;

    // ── Events ────────────────────────────────────────────────────────────────

    event MatchSignalAttested(
        bytes32 indexed gameId,
        uint8   homeProb,
        uint8   drawProb,
        uint8   awayProb,
        uint8   signalScore,
        Call    signalCall,
        bytes32 dataHash,
        uint40  attestedAt
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) {
        require(_owner != address(0), "Zero owner");
        owner = _owner;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * @notice Attest the pre-kickoff signal for a club match.
     * @param gameId      keccak256(abi.encodePacked(slug))
     * @param homeProb    market-implied home-win probability 0-100
     * @param drawProb    market-implied draw probability 0-100
     * @param awayProb    market-implied away-win probability 0-100
     * @param signalScore composite weighted score for the favoured outcome 0-100
     * @param signalCall  which outcome the signal favours (0=HOME, 1=DRAW, 2=AWAY)
     * @param dataHash    keccak256(abi.encode(slug, homeProb, drawProb, awayProb,
     *                       homeFormScore, awayFormScore)) — reproducible off-chain
     */
    function attest(
        bytes32 gameId,
        uint8   homeProb,
        uint8   drawProb,
        uint8   awayProb,
        uint8   signalScore,
        uint8   signalCall,
        bytes32 dataHash
    ) external {
        require(msg.sender == owner,                         "Not attester");
        require(_signals[gameId].attestedAt == 0,           "Already attested");
        require(homeProb + drawProb + awayProb <= 101,      "Probs overflow"); // allow 101 for rounding
        require(signalCall <= 2,                             "Invalid call");

        Call call = Call(signalCall);

        _signals[gameId] = MatchSignal({
            homeProb:    homeProb,
            drawProb:    drawProb,
            awayProb:    awayProb,
            signalScore: signalScore,
            signalCall:  call,
            dataHash:    dataHash,
            attestedAt:  uint40(block.timestamp),
            attester:    msg.sender
        });

        emit MatchSignalAttested(
            gameId, homeProb, drawProb, awayProb,
            signalScore, call, dataHash, uint40(block.timestamp)
        );
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    function getSignal(bytes32 gameId) external view returns (MatchSignal memory) {
        return _signals[gameId];
    }

    function hasSignal(bytes32 gameId) external view returns (bool) {
        return _signals[gameId].attestedAt != 0;
    }
}
