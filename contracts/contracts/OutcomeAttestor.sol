// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OutcomeAttestor
 * @notice Closes the prediction loop for LUCARNE.
 *
 * After each WC 2026 match the agent:
 *   1. Reads the pre-match signal score from SignalAttestor (off-chain read)
 *   2. Fetches the final score from Sofascore
 *   3. Calls recordOutcome() — writes W/D/L + goals + pre-match signal score
 *
 * This creates an immutable, tamper-proof track record that anyone can query
 * to verify whether the LUCARNE signal had alpha vs pure market odds.
 *
 * Calibration view:
 *   getCalibration(country) returns (wins, draws, losses, avgWinScore, avgLossScore)
 *   A real signal shows avgWinScore >> avgLossScore.
 */
contract OutcomeAttestor {

    // ── Enums ────────────────────────────────────────────────────────────────

    enum Result { WIN, DRAW, LOSS }

    // ── Structs ──────────────────────────────────────────────────────────────

    struct MatchOutcome {
        bytes3  opponent;       // ISO 3166-1 alpha-3 of the opposing nation
        uint8   goalsFor;
        uint8   goalsAgainst;
        Result  result;         // derived from goalsFor/Against
        uint32  matchDate;      // unix date (truncated to day boundary)
        uint64  ts;             // block.timestamp when outcome was recorded
        uint8   preMatchScore;  // LUCARNE signal score in 24h window before kickoff
    }

    // ── State ────────────────────────────────────────────────────────────────

    address public immutable attester;

    // country ISO3 → all match outcomes
    mapping(bytes3 => MatchOutcome[]) private _outcomes;

    // Total outcomes recorded (shown in frontend)
    uint256 public totalOutcomes;

    // ── Events ───────────────────────────────────────────────────────────────

    event OutcomeRecorded(
        bytes3  indexed country,
        bytes3  indexed opponent,
        uint8   goalsFor,
        uint8   goalsAgainst,
        Result  result,
        uint8   preMatchScore,
        uint64  ts
    );

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(address _attester) {
        attester = _attester;
    }

    // ── Write ────────────────────────────────────────────────────────────────

    /**
     * @notice Record the outcome of a completed match.
     * @param country       ISO3 of the team we track (e.g. bytes3("FRA"))
     * @param opponent      ISO3 of the opponent
     * @param goalsFor      Goals scored by `country`
     * @param goalsAgainst  Goals scored by `opponent`
     * @param matchDate     Unix timestamp of match kick-off (truncated to day)
     * @param preMatchScore LUCARNE signal score attested before this match
     */
    function recordOutcome(
        bytes3  country,
        bytes3  opponent,
        uint8   goalsFor,
        uint8   goalsAgainst,
        uint32  matchDate,
        uint8   preMatchScore
    ) external {
        require(msg.sender == attester, "not attester");

        Result r;
        if      (goalsFor > goalsAgainst) r = Result.WIN;
        else if (goalsFor < goalsAgainst) r = Result.LOSS;
        else                               r = Result.DRAW;

        _outcomes[country].push(MatchOutcome({
            opponent:       opponent,
            goalsFor:       goalsFor,
            goalsAgainst:   goalsAgainst,
            result:         r,
            matchDate:      matchDate,
            ts:             uint64(block.timestamp),
            preMatchScore:  preMatchScore
        }));

        totalOutcomes++;

        emit OutcomeRecorded(country, opponent, goalsFor, goalsAgainst, r, preMatchScore, uint64(block.timestamp));
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    function getOutcomes(bytes3 country) external view returns (MatchOutcome[] memory) {
        return _outcomes[country];
    }

    function getOutcomeCount(bytes3 country) external view returns (uint256) {
        return _outcomes[country].length;
    }

    /**
     * @notice Compute calibration stats for a country.
     * Returns how many W/D/L and the average pre-match LUCARNE score for each
     * outcome bucket.  If avgWinScore >> avgLossScore, the signal has alpha.
     */
    function getCalibration(bytes3 country) external view returns (
        uint256 wins,
        uint256 draws,
        uint256 losses,
        uint256 avgWinScore,   // average pre-match score on wins
        uint256 avgDrawScore,
        uint256 avgLossScore   // average pre-match score on losses
    ) {
        MatchOutcome[] storage outcomes = _outcomes[country];
        uint256 winScoreSum;
        uint256 drawScoreSum;
        uint256 lossScoreSum;

        for (uint256 i = 0; i < outcomes.length; i++) {
            MatchOutcome storage o = outcomes[i];
            if (o.result == Result.WIN) {
                wins++;
                winScoreSum += o.preMatchScore;
            } else if (o.result == Result.DRAW) {
                draws++;
                drawScoreSum += o.preMatchScore;
            } else {
                losses++;
                lossScoreSum += o.preMatchScore;
            }
        }

        avgWinScore  = wins   > 0 ? winScoreSum  / wins   : 0;
        avgDrawScore = draws  > 0 ? drawScoreSum / draws  : 0;
        avgLossScore = losses > 0 ? lossScoreSum / losses : 0;
    }

    /**
     * @notice Global calibration across ALL tracked countries.
     * Returns raw arrays: for each outcome recorded globally, its pre-match score.
     * Useful off-chain to compute Brier scores, calibration curves, etc.
     */
    function getGlobalCalibration(bytes3[] calldata countries) external view returns (
        uint8[] memory preScores,
        uint8[] memory results   // 0=WIN 1=DRAW 2=LOSS
    ) {
        uint256 total;
        for (uint256 i = 0; i < countries.length; i++) {
            total += _outcomes[countries[i]].length;
        }

        preScores = new uint8[](total);
        results   = new uint8[](total);
        uint256 idx;

        for (uint256 i = 0; i < countries.length; i++) {
            MatchOutcome[] storage outcomes = _outcomes[countries[i]];
            for (uint256 j = 0; j < outcomes.length; j++) {
                preScores[idx] = outcomes[j].preMatchScore;
                results[idx]   = uint8(outcomes[j].result);
                idx++;
            }
        }
    }
}
