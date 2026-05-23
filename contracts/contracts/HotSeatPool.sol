// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SignalAttestor.sol";

/**
 * @title HotSeatPool
 * @notice Survivor-style pool for World Cup 2026.
 *
 * Each round the owner calls nextRound(). The contract reads all registered
 * nations' latest momentum scores from SignalAttestor and eliminates every
 * player who picked the nation with the LOWEST score that round — the "hot seat".
 *
 * Unlike SurvivorPool's fixed threshold, there is ALWAYS a hot seat nation,
 * so the game progressively thins the field every round.
 *
 * Entry: 0.001 OKB.  Protocol fee: 5%.  Last survivor(s) split the pot.
 */
contract HotSeatPool is Ownable, ReentrancyGuard {
    SignalAttestor public immutable attestor;

    uint256 public constant ENTRY_FEE        = 0.001 ether;
    uint256 public constant PROTOCOL_FEE_BPS = 500;   // 5%
    uint256 public constant MAX_ROUNDS       = 12;

    struct Player {
        bytes3 pick;
        bool   alive;
        bool   entered;
    }

    uint256   public round;
    uint256   public pot;
    bool      public gameOver;
    address[] public survivors;
    bytes3    public lastHotSeat;   // nation eliminated in the most recent round
    uint8     public lastHotScore;  // its score that round

    mapping(address => Player)  public players;
    address[] public playerList;
    bytes3[]  public nations;       // all tracked nations (set at construction)

    event Entered(address indexed player, bytes3 pick);
    event HotSeat(uint256 indexed round, bytes3 nation, uint8 score, uint256 eliminated);
    event GameOver(address[] survivors, uint256 prize);

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _attestor, bytes3[] memory _nations) Ownable(msg.sender) {
        attestor = SignalAttestor(_attestor);
        round    = 1;
        nations  = _nations;
    }

    // ── Enter ──────────────────────────────────────────────────────────────────

    function enter(bytes3 pick) external payable nonReentrant {
        require(!gameOver,                        "game over");
        require(round == 1,                       "entry closed after round 1");
        require(msg.value == ENTRY_FEE,           "wrong entry fee");
        require(!players[msg.sender].entered,     "already entered");

        // Verify the nation is tracked
        SignalAttestor.Attestation memory sig = attestor.getLatest(pick);
        require(sig.ts > 0, "nation not in signal system");

        players[msg.sender] = Player({ pick: pick, alive: true, entered: true });
        playerList.push(msg.sender);
        pot += msg.value;

        emit Entered(msg.sender, pick);
    }

    // ── Change pick (anytime while alive, before owner closes the round) ───────

    function changePick(bytes3 newPick) external {
        require(!gameOver,                     "game over");
        require(players[msg.sender].alive,     "eliminated");

        SignalAttestor.Attestation memory sig = attestor.getLatest(newPick);
        require(sig.ts > 0, "nation not in signal system");

        players[msg.sender].pick = newPick;
    }

    // ── Advance round (owner-only) ─────────────────────────────────────────────

    function nextRound() external onlyOwner nonReentrant {
        require(!gameOver, "game over");

        // 1. Find the nation with the LOWEST current momentum score
        bytes3 hotSeat;
        uint8  lowestScore = 101; // sentinel — scores are 0-100

        for (uint256 i = 0; i < nations.length; i++) {
            SignalAttestor.Attestation memory sig = attestor.getLatest(nations[i]);
            if (sig.ts == 0) continue; // no data yet, skip
            if (sig.score < lowestScore) {
                lowestScore = sig.score;
                hotSeat     = nations[i];
            }
        }

        require(hotSeat != bytes3(0), "no nation data available");

        lastHotSeat  = hotSeat;
        lastHotScore = lowestScore;

        // 2. Eliminate all players who picked the hot seat nation
        uint256 eliminated = 0;
        delete survivors;

        for (uint256 i = 0; i < playerList.length; i++) {
            address addr = playerList[i];
            Player storage p = players[addr];
            if (!p.alive) continue;

            if (p.pick == hotSeat) {
                p.alive = false;
                eliminated++;
            } else {
                survivors.push(addr);
            }
        }

        round++;
        emit HotSeat(round, hotSeat, lowestScore, eliminated);

        // End game: one or zero survivors, or round cap
        if (survivors.length <= 1 || round > MAX_ROUNDS) {
            _endGame();
        }
    }

    // ── View helpers ───────────────────────────────────────────────────────────

    function getSurvivors() external view returns (address[] memory) {
        return survivors;
    }

    function getNations() external view returns (bytes3[] memory) {
        return nations;
    }

    function playerCount() external view returns (uint256) {
        return playerList.length;
    }

    // ── Internal: distribute pot ───────────────────────────────────────────────

    function _endGame() internal {
        gameOver = true;

        // Edge case: everyone eliminated simultaneously → refund all
        if (survivors.length == 0) {
            survivors = playerList;
        }

        uint256 fee   = (pot * PROTOCOL_FEE_BPS) / 10_000;
        uint256 prize = (pot - fee) / survivors.length;

        (bool ok,) = owner().call{value: fee}("");
        require(ok, "fee transfer failed");

        for (uint256 i = 0; i < survivors.length; i++) {
            (bool sent,) = survivors[i].call{value: prize}("");
            require(sent, "payout failed");
        }

        emit GameOver(survivors, prize);
    }
}
