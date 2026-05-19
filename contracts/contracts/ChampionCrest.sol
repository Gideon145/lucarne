// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SignalAttestor.sol";

/**
 * @title ChampionCrest
 * @notice NFT prediction market — mint a Crest for your chosen World Cup champion.
 *         After the tournament ends (owner calls resolve()), Crests for the
 *         winning nation can be redeemed for a share of the prize pool.
 *
 * Mechanics:
 *   - Mint cost: 0.005 OKB per Crest (max 3 per wallet)
 *   - Crest metadata encodes the chosen country (bytes3)
 *   - Owner resolves with the champion country after the tournament
 *   - Winners split the entire mint revenue (minus 5% protocol fee)
 */
contract ChampionCrest is ERC721, Ownable {
    SignalAttestor public immutable attestor;

    uint256 public constant MINT_PRICE   = 0.005 ether;
    uint256 public constant MAX_PER_WALLET = 3;
    uint256 public constant PROTOCOL_FEE_BPS = 500;

    uint256 public nextTokenId;
    bytes3  public champion;        // set after tournament
    bool    public resolved;
    bool    public redemptionOpen;

    uint256 public totalMintRevenue;
    uint256 public prizePool;
    uint256 public winnerCount;

    mapping(uint256 => bytes3) public tokenCountry;  // tokenId → country
    mapping(address => uint256) public mintedCount;
    mapping(uint256 => bool)    public redeemed;

    event Minted(address indexed to, uint256 tokenId, bytes3 country);
    event Resolved(bytes3 champion, uint256 prizePool, uint256 winners);
    event Redeemed(address indexed holder, uint256 tokenId, uint256 payout);

    constructor(address _attestor) ERC721("ChampionCrest", "CREST") Ownable(msg.sender) {
        attestor = SignalAttestor(_attestor);
    }

    // ── Mint ──────────────────────────────────────────────────────────────────

    function mint(bytes3 country) external payable {
        require(!resolved, "tournament resolved");
        require(msg.value == MINT_PRICE, "wrong price");
        require(mintedCount[msg.sender] < MAX_PER_WALLET, "max 3 per wallet");

        SignalAttestor.Attestation memory sig = attestor.getLatest(country);
        require(sig.ts > 0, "unknown country");

        uint256 id = nextTokenId++;
        _mint(msg.sender, id);
        tokenCountry[id] = country;
        mintedCount[msg.sender]++;
        totalMintRevenue += msg.value;

        emit Minted(msg.sender, id, country);
    }

    // ── Resolve (owner) ───────────────────────────────────────────────────────

    function resolve(bytes3 _champion) external onlyOwner {
        require(!resolved, "already resolved");
        champion = _champion;
        resolved = true;

        // Count winners
        uint256 count = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (tokenCountry[i] == _champion) count++;
        }
        winnerCount = count;

        // Build prize pool
        uint256 fee = totalMintRevenue * PROTOCOL_FEE_BPS / 10_000;
        prizePool = totalMintRevenue - fee;
        redemptionOpen = true;

        (bool ok,) = owner().call{value: fee}("");
        require(ok, "fee transfer failed");

        emit Resolved(_champion, prizePool, count);
    }

    // ── Redeem ────────────────────────────────────────────────────────────────

    function redeem(uint256 tokenId) external {
        require(redemptionOpen, "not open");
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(tokenCountry[tokenId] == champion, "wrong country");
        require(!redeemed[tokenId], "already redeemed");
        require(winnerCount > 0, "no winners");

        redeemed[tokenId] = true;
        uint256 payout = prizePool / winnerCount;

        (bool ok,) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Redeemed(msg.sender, tokenId, payout);
    }

    receive() external payable {}
}
