// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SignalAttestor
 * @notice Core spine of LUCARNE. Attests verifiable momentum signals for 32 World Cup
 *         nations on-chain every 60s (signal-gated: only writes when score changes meaningfully).
 *
 * Fields per attestation:
 *   - country:    ISO 3166-1 alpha-3 code (e.g. "ARG", "BRA")
 *   - score:      momentum score 0-100
 *   - regime:     market regime (0=calm, 1=trending, 2=volatile, 3=breakout)
 *   - signalHash: keccak256 of all off-chain inputs (provenance anchor)
 *   - ts:         block.timestamp at write
 *
 * Write gate (enforced off-chain by agent):
 *   - TX fires when |Δscore| > 3 OR regime changes OR 4h heartbeat
 *   - Hard cap: MAX_TX_PER_DAY=6000 in agent config
 */
contract SignalAttestor {
    // ── Enums ────────────────────────────────────────────────────────────────

    enum Regime { CALM, TRENDING, VOLATILE, BREAKOUT }

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Attestation {
        uint8   score;      // 0–100 momentum score
        Regime  regime;
        bytes32 signalHash; // keccak256(polymarketOdds, yangZhangVol, xG, sentimentDelta)
        uint64  ts;         // block.timestamp
    }

    // ── State ────────────────────────────────────────────────────────────────

    address public immutable attester;

    // country ISO3 → latest attestation
    mapping(bytes3 => Attestation) public latest;

    // country ISO3 → history (last 500 attestations)
    mapping(bytes3 => Attestation[]) private _history;
    uint256 public constant MAX_HISTORY = 500;

    // Total on-chain attestations (TX firehose counter — shown in frontend TX badge)
    uint256 public totalAttestations;

    // ── Events ───────────────────────────────────────────────────────────────

    event Attested(
        bytes3 indexed country,
        uint8  score,
        Regime regime,
        bytes32 signalHash,
        uint64  ts
    );

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(address _attester) {
        attester = _attester;
    }

    // ── Write ────────────────────────────────────────────────────────────────

    /**
     * @notice Called by the LUCARNE agent wallet once per signal-triggered cycle.
     * @param country  ISO 3166-1 alpha-3, packed as bytes3 (e.g. bytes3("ARG"))
     * @param score    Momentum score 0–100
     * @param regime   Market regime enum
     * @param signalHash keccak256 of all off-chain signal inputs
     */
    function attest(
        bytes3  country,
        uint8   score,
        Regime  regime,
        bytes32 signalHash
    ) external {
        require(msg.sender == attester, "not attester");
        require(score <= 100, "score out of range");

        Attestation memory a = Attestation({
            score:      score,
            regime:     regime,
            signalHash: signalHash,
            ts:         uint64(block.timestamp)
        });

        latest[country] = a;

        Attestation[] storage hist = _history[country];
        if (hist.length == MAX_HISTORY) {
            // Ring-buffer: shift out oldest
            for (uint256 i = 0; i < MAX_HISTORY - 1; i++) {
                hist[i] = hist[i + 1];
            }
            hist[MAX_HISTORY - 1] = a;
        } else {
            hist.push(a);
        }

        totalAttestations++;

        emit Attested(country, score, regime, signalHash, uint64(block.timestamp));
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    function getLatest(bytes3 country) external view returns (Attestation memory) {
        return latest[country];
    }

    function getHistory(bytes3 country) external view returns (Attestation[] memory) {
        return _history[country];
    }
}
