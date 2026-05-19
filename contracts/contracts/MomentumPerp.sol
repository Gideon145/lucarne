// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SignalAttestor.sol";

/**
 * @title MomentumPerp
 * @notice Perpetual long/short positions on nation momentum scores.
 *         Settlement uses on-chain SignalAttestor data.
 *
 * Flow:
 *   1. User opens a position (LONG or SELL) on a country with OKB collateral
 *   2. After `minDuration`, user can settle against the latest attested score
 *   3. PnL = score delta * leverage * collateral / 100
 *   4. Protocol takes a 0.3% fee on settlement
 */
contract MomentumPerp is Ownable, ReentrancyGuard {
    SignalAttestor public immutable attestor;

    uint256 public constant FEE_BPS       = 30;   // 0.30%
    uint256 public constant BPS_DENOM     = 10_000;
    uint256 public constant MIN_DURATION  = 5 minutes;
    uint256 public constant MAX_LEVERAGE  = 5;

    enum Side { LONG, SHORT }

    struct Position {
        address owner;
        bytes3  country;
        Side    side;
        uint8   entryScore;    // score at open
        uint256 collateral;    // wei
        uint8   leverage;      // 1–5x
        uint256 openedAt;
        bool    settled;
    }

    uint256 public nextId;
    mapping(uint256 => Position) public positions;
    uint256 public accruedFees;

    event Opened(uint256 indexed id, address indexed owner, bytes3 country, Side side, uint8 entryScore, uint256 collateral, uint8 leverage);
    event Settled(uint256 indexed id, address indexed owner, int256 pnl, uint256 payout);

    constructor(address _attestor) Ownable(msg.sender) {
        attestor = SignalAttestor(_attestor);
    }

    // ── Open ─────────────────────────────────────────────────────────────────

    function open(bytes3 country, Side side, uint8 leverage) external payable nonReentrant {
        require(msg.value > 0, "collateral required");
        require(leverage >= 1 && leverage <= MAX_LEVERAGE, "leverage 1-5");

        SignalAttestor.Attestation memory sig = attestor.getLatest(country);
        require(sig.ts > 0, "no attestation for country");

        uint256 id = nextId++;
        positions[id] = Position({
            owner:       msg.sender,
            country:     country,
            side:        side,
            entryScore:  sig.score,
            collateral:  msg.value,
            leverage:    leverage,
            openedAt:    block.timestamp,
            settled:     false
        });

        emit Opened(id, msg.sender, country, side, sig.score, msg.value, leverage);
    }

    // ── Settle ────────────────────────────────────────────────────────────────

    function settle(uint256 id) external nonReentrant {
        Position storage p = positions[id];
        require(!p.settled, "already settled");
        require(p.owner == msg.sender, "not owner");
        require(block.timestamp >= p.openedAt + MIN_DURATION, "too early");

        SignalAttestor.Attestation memory current = attestor.getLatest(p.country);
        require(current.ts > 0, "no attestation");

        int256 delta = int256(uint256(current.score)) - int256(uint256(p.entryScore));
        if (p.side == Side.SHORT) delta = -delta;

        // PnL = delta * leverage * collateral / 100
        int256 rawPnl = delta * int256(uint256(p.leverage)) * int256(p.collateral) / 100;

        uint256 payout;
        if (rawPnl >= 0) {
            uint256 profit = uint256(rawPnl);
            uint256 fee = profit * FEE_BPS / BPS_DENOM;
            accruedFees += fee;
            payout = p.collateral + profit - fee;
        } else {
            uint256 loss = uint256(-rawPnl);
            payout = loss >= p.collateral ? 0 : p.collateral - loss;
        }

        p.settled = true;
        if (payout > 0 && address(this).balance >= payout) {
            (bool ok,) = p.owner.call{value: payout}("");
            require(ok, "transfer failed");
        }

        emit Settled(id, p.owner, rawPnl, payout);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function withdrawFees() external onlyOwner {
        uint256 amount = accruedFees;
        accruedFees = 0;
        (bool ok,) = owner().call{value: amount}("");
        require(ok, "transfer failed");
    }

    function fund() external payable {}

    receive() external payable {}
}
