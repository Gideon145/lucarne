// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SignalAttestor.sol";

/**
 * @title SurvivorPool
 * @notice Bracket prediction pool — pick one nation per round.
 *         If their momentum stays TRENDING or above, you survive.
 *         Last survivor(s) split the pot.
 *
 * Rounds advance when the owner calls nextRound().
 * Each round, anyone whose picked nation has score < ELIMINATE_THRESHOLD is eliminated.
 */
contract SurvivorPool is Ownable, ReentrancyGuard {
    SignalAttestor public immutable attestor;

    uint256 public constant ENTRY_FEE          = 0.001 ether;
    uint8   public constant ELIMINATE_THRESHOLD = 30; // score below this = eliminated
    uint256 public constant PROTOCOL_FEE_BPS   = 500; // 5%

    struct Player {
        bytes3  pick;        // country picked this round
        bool    alive;
        bool    entered;
    }

    uint256 public round;
    uint256 public pot;
    bool    public gameOver;
    address[] public survivors;

    mapping(address => Player) public players;
    address[] public playerList;

    event Entered(address indexed player, bytes3 pick);
    event RoundAdvanced(uint256 round, uint256 eliminated);
    event GameOver(address[] survivors, uint256 prize);

    constructor(address _attestor) Ownable(msg.sender) {
        attestor = SignalAttestor(_attestor);
        round = 1;
    }

    // ── Enter ─────────────────────────────────────────────────────────────────

    function enter(bytes3 pick) external payable nonReentrant {
        require(!gameOver, "game over");
        require(round == 1, "entry closed");
        require(msg.value == ENTRY_FEE, "wrong entry fee");
        require(!players[msg.sender].entered, "already entered");

        SignalAttestor.Attestation memory sig = attestor.getLatest(pick);
        require(sig.ts > 0, "unknown country");

        players[msg.sender] = Player({ pick: pick, alive: true, entered: true });
        playerList.push(msg.sender);
        pot += msg.value;

        emit Entered(msg.sender, pick);
    }

    // ── Change pick (before round ends) ──────────────────────────────────────

    function changePick(bytes3 newPick) external {
        require(!gameOver, "game over");
        require(players[msg.sender].alive, "eliminated");
        SignalAttestor.Attestation memory sig = attestor.getLatest(newPick);
        require(sig.ts > 0, "unknown country");
        players[msg.sender].pick = newPick;
    }

    // ── Advance round ─────────────────────────────────────────────────────────

    function nextRound() external onlyOwner nonReentrant {
        require(!gameOver, "game over");

        uint256 eliminated = 0;
        delete survivors;

        for (uint256 i = 0; i < playerList.length; i++) {
            address addr = playerList[i];
            Player storage p = players[addr];
            if (!p.alive) continue;

            SignalAttestor.Attestation memory sig = attestor.getLatest(p.pick);
            if (sig.score < ELIMINATE_THRESHOLD) {
                p.alive = false;
                eliminated++;
            } else {
                survivors.push(addr);
            }
        }

        round++;
        emit RoundAdvanced(round, eliminated);

        if (survivors.length <= 1 || round > 7) {
            _endGame();
        }
    }

    // ── End game ──────────────────────────────────────────────────────────────

    function _endGame() internal {
        gameOver = true;
        if (survivors.length == 0) {
            survivors = playerList; // edge case: everyone eliminated, refund all
        }

        uint256 fee = pot * PROTOCOL_FEE_BPS / 10_000;
        uint256 prize = (pot - fee) / survivors.length;

        (bool ok,) = owner().call{value: fee}("");
        require(ok, "fee transfer failed");

        for (uint256 i = 0; i < survivors.length; i++) {
            (bool sent,) = survivors[i].call{value: prize}("");
            require(sent, "prize transfer failed");
        }

        emit GameOver(survivors, prize);
    }

    function getSurvivors() external view returns (address[] memory) {
        return survivors;
    }

    receive() external payable {}
}
