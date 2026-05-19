// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SignalAttestor.sol";

/**
 * @title TifosiBond
 * @notice Fan loyalty bonds — stake OKB behind a nation.
 *         Bond yield accrues when the nation's momentum score is TRENDING+ (≥45).
 *         Withdraw principal + yield at any time.
 *         Named for "tifosi" — the ultra-passionate fans.
 *
 * Yield mechanics:
 *   - 1 basis point per second when score ≥ 45 (TRENDING)
 *   - 2 basis points per second when score ≥ 75 (BREAKOUT)
 *   - 0 when score < 45 (CALM)
 */
contract TifosiBond is Ownable {
    SignalAttestor public immutable attestor;

    uint256 public constant BPS_PER_SEC_TRENDING  = 1;   // 0.0001% / sec
    uint256 public constant BPS_PER_SEC_BREAKOUT  = 2;
    uint256 public constant TRENDING_THRESHOLD    = 45;
    uint256 public constant BREAKOUT_THRESHOLD    = 75;
    uint256 public constant BPS_DENOM             = 10_000;

    struct Bond {
        bytes3  country;
        uint256 principal;    // wei staked
        uint256 stakedAt;
        uint256 yieldClaimed; // wei already claimed
    }

    mapping(address => Bond[]) public bonds;
    uint256 public totalStaked;
    uint256 public rewardReserve; // funded by owner

    event Staked(address indexed user, bytes3 country, uint256 amount, uint256 bondIndex);
    event Withdrawn(address indexed user, uint256 bondIndex, uint256 principal, uint256 yield);
    event ReserveDeposited(uint256 amount);

    constructor(address _attestor) Ownable(msg.sender) {
        attestor = SignalAttestor(_attestor);
    }

    // ── Stake ─────────────────────────────────────────────────────────────────

    function stake(bytes3 country) external payable {
        require(msg.value > 0, "stake required");
        SignalAttestor.Attestation memory sig = attestor.getLatest(country);
        require(sig.ts > 0, "unknown country");

        bonds[msg.sender].push(Bond({
            country:      country,
            principal:    msg.value,
            stakedAt:     block.timestamp,
            yieldClaimed: 0
        }));
        totalStaked += msg.value;

        emit Staked(msg.sender, country, msg.value, bonds[msg.sender].length - 1);
    }

    // ── Preview yield ─────────────────────────────────────────────────────────

    function pendingYield(address user, uint256 index) public view returns (uint256) {
        Bond storage b = bonds[user][index];
        SignalAttestor.Attestation memory sig = attestor.getLatest(b.country);

        uint256 elapsed = block.timestamp - b.stakedAt;
        uint256 bps;
        if (sig.score >= BREAKOUT_THRESHOLD)       bps = BPS_PER_SEC_BREAKOUT;
        else if (sig.score >= TRENDING_THRESHOLD)  bps = BPS_PER_SEC_TRENDING;
        else                                        return 0;

        uint256 gross = b.principal * bps * elapsed / BPS_DENOM;
        return gross > b.yieldClaimed ? gross - b.yieldClaimed : 0;
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    function withdraw(uint256 index) external {
        Bond storage b = bonds[msg.sender][index];
        require(b.principal > 0, "nothing to withdraw");

        uint256 yield = pendingYield(msg.sender, index);
        uint256 principal = b.principal;

        b.principal = 0;
        b.yieldClaimed += yield;
        totalStaked -= principal;

        uint256 payout = principal;
        if (yield > 0 && rewardReserve >= yield) {
            rewardReserve -= yield;
            payout += yield;
        }

        (bool ok,) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, index, principal, yield);
    }

    // ── Funding ───────────────────────────────────────────────────────────────

    function depositReserve() external payable onlyOwner {
        rewardReserve += msg.value;
        emit ReserveDeposited(msg.value);
    }

    function getBonds(address user) external view returns (Bond[] memory) {
        return bonds[user];
    }

    receive() external payable {}
}
