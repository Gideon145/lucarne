// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ICalledItNFT
 * @notice Free-mint NFT for anyone who staked on the correct outcome in a SignalPool.
 *
 * Flow:
 *   1. Anyone who has a stake in a settled pool on the winning outcome can call mint().
 *   2. One NFT per address per game — non-transferable (soulbound).
 *   3. Wrong-call holders (agent minted to itself on wrong prediction) can call burn().
 *      In practice, agent mints one per game immediately after agentStake — the NFT
 *      becomes a "receipt" that is either a trophy (signal correct) or a public record
 *      of failure (signal wrong).
 *
 * Token URI is fully on-chain SVG — no IPFS, no external dependency.
 * The SVG shows the game slug, outcome called, and CORRECT/WRONG verdict once settled.
 */
contract ICalledItNFT is ERC721 {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct TokenData {
        bytes32 gameId;
        string  gameSlug;   // human-readable, e.g. "uecl-cpa-ray-2026-05-27"
        uint8   outcome;    // 0=HOME · 1=DRAW · 2=AWAY
        address holder;
        bool    verified;   // true once settle() confirms outcome is correct
        bool    wrong;      // true once settle() confirms outcome is wrong
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public immutable owner;
    address public immutable signalPool;   // only SignalPool can verify tokens

    uint256 private _nextTokenId;

    mapping(uint256 => TokenData) private _tokenData;

    /// gameId + address → tokenId (prevents double-mint per game per address)
    mapping(bytes32 => mapping(address => uint256)) public mintedToken;

    // ── Events ────────────────────────────────────────────────────────────────

    event Minted(uint256 indexed tokenId, bytes32 indexed gameId, address indexed holder, uint8 outcome);
    event Verified(uint256 indexed tokenId, bool correct);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner, address _signalPool) ERC721("ICalledIt", "ICIT") {
        require(_owner      != address(0), "Zero owner");
        require(_signalPool != address(0), "Zero pool");
        owner      = _owner;
        signalPool = _signalPool;
        _nextTokenId = 1;
    }

    // ── Mint ──────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a free "I Called It" NFT for staking on any outcome pre-kickoff.
     *         One per address per game. Soulbound — non-transferable.
     * @param gameId    must match an open SignalPool
     * @param gameSlug  human-readable slug for display (e.g. "uecl-cpa-ray-2026-05-27")
     * @param outcome   outcome you staked on (must match your actual stake)
     */
    function mint(bytes32 gameId, string calldata gameSlug, uint8 outcome) external returns (uint256 tokenId) {
        require(outcome <= 2,                               "Bad outcome");
        require(mintedToken[gameId][msg.sender] == 0,       "Already minted for this game");

        tokenId = _nextTokenId++;
        mintedToken[gameId][msg.sender] = tokenId;

        _tokenData[tokenId] = TokenData({
            gameId:   gameId,
            gameSlug: gameSlug,
            outcome:  outcome,
            holder:   msg.sender,
            verified: false,
            wrong:    false
        });

        _safeMint(msg.sender, tokenId);
        emit Minted(tokenId, gameId, msg.sender, outcome);
    }

    // ── Verify (called by SignalPool after settlement) ───────────────────────

    /**
     * @notice Mark a token as correct or wrong after pool settlement.
     *         Only SignalPool can call this — called inside settle() or separately.
     */
    function verify(uint256 tokenId, bool correct) external {
        require(msg.sender == signalPool, "Only SignalPool");
        TokenData storage d = _tokenData[tokenId];
        require(!d.verified && !d.wrong, "Already verified");
        if (correct) {
            d.verified = true;
        } else {
            d.wrong = true;
        }
        emit Verified(tokenId, correct);
    }

    // ── Burn ──────────────────────────────────────────────────────────────────

    /**
     * @notice Token holder can burn their NFT at any time.
     */
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _burn(tokenId);
    }

    // ── Soulbound: block transfers ────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow mint (from == address(0)) and burn (to == address(0)) only
        require(from == address(0) || to == address(0), "Soulbound: non-transferable");
        return super._update(to, tokenId, auth);
    }

    // ── On-chain SVG tokenURI ─────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        TokenData memory d = _tokenData[tokenId];

        string memory outcomeStr = d.outcome == 0 ? "HOME" : d.outcome == 1 ? "DRAW" : "AWAY";

        string memory statusColor;
        string memory statusText;
        if (d.verified) {
            statusColor = "#00ff88";
            statusText  = "SIGNAL CORRECT";
        } else if (d.wrong) {
            statusColor = "#ff4444";
            statusText  = "SIGNAL WRONG";
        } else {
            statusColor = "#888888";
            statusText  = "PENDING";
        }

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" style="background:#0a0a0a;font-family:monospace">',
            '<rect width="400" height="220" rx="12" fill="#0a0a0a" stroke="#1a1a2e" stroke-width="2"/>',
            '<text x="20" y="40" fill="#ffffff" font-size="18" font-weight="bold">LUCARNE</text>',
            '<text x="20" y="65" fill="#888" font-size="11">I CALLED IT</text>',
            '<text x="20" y="105" fill="#cccccc" font-size="13">', d.gameSlug, '</text>',
            '<text x="20" y="135" fill="#aaaaaa" font-size="12">CALLED: <tspan fill="#ffffff">', outcomeStr, '</tspan></text>',
            '<rect x="20" y="155" width="360" height="32" rx="6" fill="', statusColor, '" opacity="0.15"/>',
            '<text x="30" y="176" fill="', statusColor, '" font-size="13" font-weight="bold">', statusText, '</text>',
            '<text x="20" y="210" fill="#444" font-size="9">on X Layer \u2022 Signal by Lucarne</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"I Called It: ', d.gameSlug, '",',
            '"description":"Pre-kickoff signal stake receipt. Issued by Lucarne on X Layer.",',
            '"attributes":[{"trait_type":"Outcome Called","value":"', outcomeStr, '"},',
            '{"trait_type":"Status","value":"', statusText, '"}],',
            '"image":"data:image/svg+xml;base64,', _toBase64(bytes(svg)), '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", _toBase64(bytes(json))));
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        return _tokenData[tokenId];
    }

    // ── Base64 (minimal on-chain) ─────────────────────────────────────────────

    string private constant _B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function _toBase64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        bytes memory b64 = bytes(_B64_CHARS);
        uint256 i;
        uint256 j;
        for (i = 0; i + 3 <= data.length; i += 3) {
            uint256 a = uint8(data[i]);
            uint256 b = uint8(data[i + 1]);
            uint256 c = uint8(data[i + 2]);
            result[j++] = b64[(a >> 2) & 0x3F];
            result[j++] = b64[((a & 3) << 4) | ((b >> 4) & 0xF)];
            result[j++] = b64[((b & 0xF) << 2) | ((c >> 6) & 3)];
            result[j++] = b64[c & 0x3F];
        }
        if (i + 1 == data.length) {
            uint256 a = uint8(data[i]);
            result[j++] = b64[(a >> 2) & 0x3F];
            result[j++] = b64[(a & 3) << 4];
            result[j++] = 0x3D;
            result[j++] = 0x3D;
        } else if (i + 2 == data.length) {
            uint256 a = uint8(data[i]);
            uint256 b = uint8(data[i + 1]);
            result[j++] = b64[(a >> 2) & 0x3F];
            result[j++] = b64[((a & 3) << 4) | ((b >> 4) & 0xF)];
            result[j++] = b64[(b & 0xF) << 2];
            result[j++] = 0x3D;
        }
        return string(result);
    }
}
