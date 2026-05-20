// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LucarnePredictions
 * @notice Lets any wallet submit one prediction per game before kickoff.
 *         No stakes. No rewards. Pure on-chain attestation of crowd wisdom —
 *         compared against LUCARNE's signal engine post-match.
 *
 * Outcome enum:
 *   0 = HOME win
 *   1 = DRAW
 *   2 = AWAY win
 *
 * gameId = keccak256(abi.encodePacked(slug))
 *   e.g. keccak256("uel-scf-ast-2026-05-20")
 */
contract LucarnePredictions {

    // ── Enums ────────────────────────────────────────────────────────────────

    enum Outcome { HOME, DRAW, AWAY }

    // ── State ────────────────────────────────────────────────────────────────

    // gameId => outcome => count
    mapping(bytes32 => uint256[3]) private _counts;

    // gameId => wallet => outcome + 1 (0 means not predicted)
    mapping(bytes32 => mapping(address => uint8)) private _walletOutcome;

    // Total predictions ever submitted
    uint256 public totalPredictions;

    // ── Events ───────────────────────────────────────────────────────────────

    event PredictionSubmitted(
        bytes32 indexed gameId,
        address indexed predictor,
        Outcome outcome,
        uint64  ts
    );

    // ── Write ────────────────────────────────────────────────────────────────

    /**
     * @notice Submit a prediction for a game. One per wallet per game.
     * @param gameId  keccak256(abi.encodePacked(matchSlug))
     * @param outcome 0=HOME, 1=DRAW, 2=AWAY
     */
    function submitPrediction(bytes32 gameId, Outcome outcome) external {
        require(
            _walletOutcome[gameId][msg.sender] == 0,
            "Already predicted for this game"
        );
        uint8 stored = uint8(outcome) + 1; // shift: 1=HOME, 2=DRAW, 3=AWAY
        _walletOutcome[gameId][msg.sender] = stored;
        _counts[gameId][uint8(outcome)]++;
        totalPredictions++;
        emit PredictionSubmitted(gameId, msg.sender, outcome, uint64(block.timestamp));
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    /**
     * @notice Returns prediction counts for a game.
     * @return home  Number of HOME predictions
     * @return draw  Number of DRAW predictions
     * @return away  Number of AWAY predictions
     */
    function getCounts(bytes32 gameId)
        external
        view
        returns (uint256 home, uint256 draw, uint256 away)
    {
        uint256[3] storage c = _counts[gameId];
        return (c[0], c[1], c[2]);
    }

    /**
     * @notice Returns a wallet's prediction for a game.
     * @return predicted Whether the wallet has submitted a prediction
     * @return outcome   The predicted outcome (only valid if predicted=true)
     */
    function getMyPrediction(bytes32 gameId, address wallet)
        external
        view
        returns (bool predicted, Outcome outcome)
    {
        uint8 stored = _walletOutcome[gameId][wallet];
        if (stored == 0) return (false, Outcome.HOME);
        return (true, Outcome(stored - 1));
    }
}
