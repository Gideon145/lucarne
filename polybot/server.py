"""
lucarne-polybot FastAPI server
Fetches World Cup Polymarket odds and exposes signal endpoints
consumed by the LUCARNE TypeScript agent.
"""

import asyncio
import base64
import hashlib
import httpx
import json
import os
import time
from collections import defaultdict, deque
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import anthropic

app = FastAPI(title="lucarne-polybot", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Payment-Required"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

GAMMA_API = "https://gamma-api.polymarket.com"
ODDS_HISTORY_LEN = 60   # keep last 60 data points per country

# ─────────────────────────────────────────────────────────────────────────────
# x402 Payment Gate — OKX Onchain OS / X Layer
# ─────────────────────────────────────────────────────────────────────────────

X402_PRICE      = "10000"   # 0.01 USDC (6 decimals)
X402_ASSET      = "0x74b7f16337b8972027f6196a17a631ac6de26d22"  # USDC on X Layer mainnet
X402_NETWORK    = "xlayer-mainnet"
X402_SCHEME     = "exact"
LUCARNE_WALLET  = os.getenv("LUCARNE_WALLET_ADDRESS", "0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81")
_paid_nonces: set[str] = set()  # replay prevention


def make_402_payload(resource_url: str, description: str) -> dict:
    return {
        "x402Version": 1,
        "error": "Payment required",
        "accepts": [{
            "scheme": X402_SCHEME,
            "network": X402_NETWORK,
            "maxAmountRequired": X402_PRICE,
            "resource": resource_url,
            "description": description,
            "mimeType": "application/json",
            "payTo": LUCARNE_WALLET,
            "maxTimeoutSeconds": 300,
            "asset": X402_ASSET,
            "extra": {"name": "USD Coin", "version": "2"},
        }],
    }


def verify_x402_payment(header: str | None) -> tuple[bool, str]:
    """Decode and validate an X-Payment header.
    Returns (is_valid, nonce_or_reason).  Checks x402 envelope shape,
    network, payTo (must match our wallet), value (must be >= price),
    asset (must be USDC on X Layer), and replay-protects the nonce.
    EIP-3009 signature recovery is intentionally deferred to the
    settlement layer (okx-onchain-gateway / facilitator) — this gate
    blocks malformed / wrong-payee / underpaid / replayed claims.
    """
    if not header:
        return False, "missing"
    try:
        raw = base64.b64decode(header + "==")
        payload = json.loads(raw)
    except Exception:
        return False, "malformed"
    if payload.get("x402Version") != 1:
        return False, "wrong version"
    if payload.get("scheme") != X402_SCHEME:
        return False, "unsupported scheme"
    if payload.get("network") != X402_NETWORK:
        return False, f"wrong network: {payload.get('network')}"
    # EIP-3009 authorization sub-payload
    auth = payload.get("payload", {}).get("authorization", {}) or {}
    to_addr = (auth.get("to") or "").lower()
    if to_addr != LUCARNE_WALLET.lower():
        return False, f"wrong payTo: {to_addr}"
    # value is a decimal string in token base units (6dp for USDC)
    try:
        value_paid = int(auth.get("value") or "0")
    except (TypeError, ValueError):
        return False, "bad value"
    if value_paid < int(X402_PRICE):
        return False, f"underpaid: {value_paid} < {X402_PRICE}"
    asset = (payload.get("payload", {}).get("asset") or payload.get("asset") or "").lower()
    if asset and asset != X402_ASSET.lower():
        return False, f"wrong asset: {asset}"
    nonce = auth.get("nonce") or hashlib.sha256(raw).hexdigest()
    if nonce in _paid_nonces:
        return False, "payment already used"
    _paid_nonces.add(nonce)
    return True, nonce

# ─────────────────────────────────────────────────────────────────────────────
# World Cup 2026 country → Polymarket search slug
# ─────────────────────────────────────────────────────────────────────────────

COUNTRY_NAMES: dict[str, str] = {
    # CONMEBOL
    "ARG": "Argentina",     "BRA": "Brazil",        "URU": "Uruguay",       "COL": "Colombia",
    "ECU": "Ecuador",       "PAR": "Paraguay",
    # UEFA
    "FRA": "France",        "ENG": "England",       "ESP": "Spain",         "GER": "Germany",
    "POR": "Portugal",      "NED": "Netherlands",   "BEL": "Belgium",       "CRO": "Croatia",
    "CHE": "Switzerland",   "NOR": "Norway",        "AUT": "Austria",       "SWE": "Sweden",
    "SCO": "Scotland",      "CZE": "Czechia",       "BIH": "Bosnia-Herzegovina", "TUR": "Türkiye",
    # CONCACAF
    "USA": "United States", "MEX": "Mexico",        "CAN": "Canada",        "PAN": "Panama",
    "HAI": "Haiti",         "CUW": "Curaçao",
    # CAF
    "MAR": "Morocco",       "SEN": "Senegal",       "GHA": "Ghana",         "TUN": "Tunisia",
    "EGY": "Egypt",         "CIV": "Ivory Coast",   "ALG": "Algeria",       "CPV": "Cape Verde",
    "RSA": "South Africa",  "COD": "Congo DR",
    # AFC
    "JPN": "Japan",         "KOR": "South Korea",   "AUS": "Australia",     "IRN": "Iran",
    "KSA": "Saudi Arabia",  "QAT": "Qatar",         "IRQ": "Iraq",          "JOR": "Jordan",
    "UZB": "Uzbekistan",
    # OFC
    "NZL": "New Zealand",
}

# ─────────────────────────────────────────────────────────────────────────────
# Hardcoded Polymarket WC 2026 winner market IDs
# Derived from gamma-api.polymarket.com/markets bulk listing
# ─────────────────────────────────────────────────────────────────────────────

POLYMARKET_IDS: dict[str, str] = {
    # Top contenders (from prior session)
    "ARG": "558938", "BRA": "558937", "FRA": "558936", "ENG": "558935",
    "ESP": "558934", "GER": "558939", "POR": "558940", "NED": "558941",
    "BEL": "558946", "URU": "558944", "CRO": "558976", "COL": "558947",
    "MEX": "558945", "USA": "558943", "CAN": "558952", "MAR": "558963",
    "SEN": "558965", "JPN": "558949", "KOR": "558961", "AUS": "558958",
    "ECU": "558955", "CHE": "558974", "TUN": "558954", "GHA": "558967",
    "IRN": "558959",
    # New additions (confirmed from gamma-api.polymarket.com bulk scan)
    "NOR": "558951", "PAR": "558956", "NZL": "558957", "UZB": "558960",
    "JOR": "558962", "RSA": "558964", "CIV": "558966", "EGY": "558968",
    "ALG": "558969", "CPV": "558970", "QAT": "558971", "KSA": "558972",
    "SCO": "558973", "AUT": "558975", "HAI": "558977", "CUW": "558978",
    "PAN": "558979", "SWE": "558980", "COD": "558981", "IRQ": "558982",
    "BIH": "558983", "CZE": "558984", "TUR": "558985",
}

# ─────────────────────────────────────────────────────────────────────────────
# WC 2026 Group Stage Fixtures (ESPN confirmed schedule)
# home=True means this team is the designated "home" side in ESPN's listing
# ─────────────────────────────────────────────────────────────────────────────

WC_FIXTURES: dict[str, list[dict]] = {
    "ARG": [
        {"opponent": "ALG", "opp_name": "Algeria",      "date": "Jun 17", "home": True},
        {"opponent": "AUT", "opp_name": "Austria",      "date": "Jun 22", "home": True},
        {"opponent": "JOR", "opp_name": "Jordan",       "date": "Jun 28", "home": False},
    ],
    "BRA": [
        {"opponent": "MAR", "opp_name": "Morocco",      "date": "Jun 13", "home": True},
        {"opponent": "HAI", "opp_name": "Haiti",        "date": "Jun 20", "home": True},
        {"opponent": "SCO", "opp_name": "Scotland",     "date": "Jun 24", "home": False},
    ],
    "FRA": [
        {"opponent": "SEN", "opp_name": "Senegal",      "date": "Jun 16", "home": True},
        {"opponent": "IRQ", "opp_name": "Iraq",         "date": "Jun 22", "home": True},
        {"opponent": "NOR", "opp_name": "Norway",       "date": "Jun 26", "home": False},
    ],
    "ENG": [
        {"opponent": "CRO", "opp_name": "Croatia",      "date": "Jun 17", "home": True},
        {"opponent": "GHA", "opp_name": "Ghana",        "date": "Jun 23", "home": True},
        {"opponent": "PAN", "opp_name": "Panama",       "date": "Jun 27", "home": False},
    ],
    "ESP": [
        {"opponent": "CPV", "opp_name": "Cape Verde",   "date": "Jun 15", "home": True},
        {"opponent": "KSA", "opp_name": "Saudi Arabia", "date": "Jun 21", "home": True},
        {"opponent": "URU", "opp_name": "Uruguay",      "date": "Jun 27", "home": False},
    ],
    "GER": [
        {"opponent": "CUW", "opp_name": "Curaçao",      "date": "Jun 14", "home": True},
        {"opponent": "CIV", "opp_name": "Ivory Coast",  "date": "Jun 20", "home": True},
        {"opponent": "ECU", "opp_name": "Ecuador",      "date": "Jun 25", "home": False},
    ],
    "POR": [
        {"opponent": "COD", "opp_name": "Congo DR",     "date": "Jun 17", "home": True},
        {"opponent": "UZB", "opp_name": "Uzbekistan",   "date": "Jun 23", "home": True},
        {"opponent": "COL", "opp_name": "Colombia",     "date": "Jun 27", "home": False},
    ],
    "NED": [
        {"opponent": "JPN", "opp_name": "Japan",        "date": "Jun 14", "home": True},
        {"opponent": "SWE", "opp_name": "Sweden",       "date": "Jun 20", "home": True},
        {"opponent": "TUN", "opp_name": "Tunisia",      "date": "Jun 25", "home": False},
    ],
    "BEL": [
        {"opponent": "EGY", "opp_name": "Egypt",        "date": "Jun 15", "home": True},
        {"opponent": "IRN", "opp_name": "Iran",         "date": "Jun 21", "home": True},
        {"opponent": "NZL", "opp_name": "New Zealand",  "date": "Jun 27", "home": False},
    ],
    "URU": [
        {"opponent": "KSA", "opp_name": "Saudi Arabia", "date": "Jun 15", "home": False},
        {"opponent": "CPV", "opp_name": "Cape Verde",   "date": "Jun 21", "home": True},
        {"opponent": "ESP", "opp_name": "Spain",        "date": "Jun 27", "home": True},
    ],
    "CRO": [
        {"opponent": "ENG", "opp_name": "England",      "date": "Jun 17", "home": False},
        {"opponent": "PAN", "opp_name": "Panama",       "date": "Jun 23", "home": False},
        {"opponent": "GHA", "opp_name": "Ghana",        "date": "Jun 27", "home": True},
    ],
    "COL": [
        {"opponent": "UZB", "opp_name": "Uzbekistan",   "date": "Jun 18", "home": False},
        {"opponent": "COD", "opp_name": "Congo DR",     "date": "Jun 24", "home": True},
        {"opponent": "POR", "opp_name": "Portugal",     "date": "Jun 27", "home": True},
    ],
    "MEX": [
        {"opponent": "RSA", "opp_name": "South Africa", "date": "Jun 11", "home": True},
        {"opponent": "KOR", "opp_name": "South Korea",  "date": "Jun 19", "home": True},
        {"opponent": "CZE", "opp_name": "Czechia",      "date": "Jun 25", "home": False},
    ],
    "USA": [
        {"opponent": "PAR", "opp_name": "Paraguay",     "date": "Jun 13", "home": True},
        {"opponent": "AUS", "opp_name": "Australia",    "date": "Jun 19", "home": True},
        {"opponent": "TUR", "opp_name": "Türkiye",      "date": "Jun 26", "home": False},
    ],
    "CAN": [
        {"opponent": "BIH", "opp_name": "Bosnia-Herz.", "date": "Jun 12", "home": True},
        {"opponent": "QAT", "opp_name": "Qatar",        "date": "Jun 18", "home": True},
        {"opponent": "CHE", "opp_name": "Switzerland",  "date": "Jun 24", "home": False},
    ],
    "MAR": [
        {"opponent": "BRA", "opp_name": "Brazil",       "date": "Jun 13", "home": False},
        {"opponent": "SCO", "opp_name": "Scotland",     "date": "Jun 19", "home": False},
        {"opponent": "HAI", "opp_name": "Haiti",        "date": "Jun 24", "home": True},
    ],
    "SEN": [
        {"opponent": "FRA", "opp_name": "France",       "date": "Jun 16", "home": False},
        {"opponent": "NOR", "opp_name": "Norway",       "date": "Jun 23", "home": False},
        {"opponent": "IRQ", "opp_name": "Iraq",         "date": "Jun 26", "home": True},
    ],
    "JPN": [
        {"opponent": "NED", "opp_name": "Netherlands",  "date": "Jun 14", "home": False},
        {"opponent": "TUN", "opp_name": "Tunisia",      "date": "Jun 21", "home": False},
        {"opponent": "SWE", "opp_name": "Sweden",       "date": "Jun 25", "home": True},
    ],
    "KOR": [
        {"opponent": "CZE", "opp_name": "Czechia",      "date": "Jun 12", "home": True},
        {"opponent": "MEX", "opp_name": "Mexico",       "date": "Jun 19", "home": False},
        {"opponent": "RSA", "opp_name": "South Africa", "date": "Jun 25", "home": False},
    ],
    "AUS": [
        {"opponent": "TUR", "opp_name": "Türkiye",      "date": "Jun 14", "home": True},
        {"opponent": "USA", "opp_name": "United States","date": "Jun 19", "home": False},
        {"opponent": "PAR", "opp_name": "Paraguay",     "date": "Jun 26", "home": False},
    ],
    "ECU": [
        {"opponent": "CIV", "opp_name": "Ivory Coast",  "date": "Jun 14", "home": False},
        {"opponent": "CUW", "opp_name": "Curaçao",      "date": "Jun 21", "home": True},
        {"opponent": "GER", "opp_name": "Germany",      "date": "Jun 25", "home": True},
    ],
    "CHE": [
        {"opponent": "QAT", "opp_name": "Qatar",        "date": "Jun 13", "home": False},
        {"opponent": "BIH", "opp_name": "Bosnia-Herz.", "date": "Jun 18", "home": True},
        {"opponent": "CAN", "opp_name": "Canada",       "date": "Jun 24", "home": True},
    ],
    "TUN": [
        {"opponent": "SWE", "opp_name": "Sweden",       "date": "Jun 15", "home": False},
        {"opponent": "JPN", "opp_name": "Japan",        "date": "Jun 21", "home": True},
        {"opponent": "NED", "opp_name": "Netherlands",  "date": "Jun 25", "home": True},
    ],
    "GHA": [
        {"opponent": "PAN", "opp_name": "Panama",       "date": "Jun 17", "home": True},
        {"opponent": "ENG", "opp_name": "England",      "date": "Jun 23", "home": False},
        {"opponent": "CRO", "opp_name": "Croatia",      "date": "Jun 27", "home": False},
    ],
    "IRN": [
        {"opponent": "NZL", "opp_name": "New Zealand",  "date": "Jun 16", "home": True},
        {"opponent": "BEL", "opp_name": "Belgium",      "date": "Jun 21", "home": False},
        {"opponent": "EGY", "opp_name": "Egypt",        "date": "Jun 27", "home": False},
    ],
    # ── New WC 2026 qualifiers ───────────────────────────────────────────────
    "RSA": [
        {"opponent": "MEX", "opp_name": "Mexico",       "date": "Jun 11", "home": False},
        {"opponent": "CZE", "opp_name": "Czechia",      "date": "Jun 18", "home": False},
        {"opponent": "KOR", "opp_name": "South Korea",  "date": "Jun 25", "home": True},
    ],
    "BIH": [
        {"opponent": "CAN", "opp_name": "Canada",       "date": "Jun 12", "home": False},
        {"opponent": "CHE", "opp_name": "Switzerland",  "date": "Jun 18", "home": False},
        {"opponent": "QAT", "opp_name": "Qatar",        "date": "Jun 24", "home": True},
    ],
    "SCO": [
        {"opponent": "HAI", "opp_name": "Haiti",        "date": "Jun 14", "home": False},
        {"opponent": "MAR", "opp_name": "Morocco",      "date": "Jun 19", "home": False},
        {"opponent": "BRA", "opp_name": "Brazil",       "date": "Jun 24", "home": True},
    ],
    "HAI": [
        {"opponent": "SCO", "opp_name": "Scotland",     "date": "Jun 14", "home": True},
        {"opponent": "BRA", "opp_name": "Brazil",       "date": "Jun 20", "home": False},
        {"opponent": "MAR", "opp_name": "Morocco",      "date": "Jun 24", "home": False},
    ],
    "CUW": [
        {"opponent": "GER", "opp_name": "Germany",      "date": "Jun 14", "home": False},
        {"opponent": "ECU", "opp_name": "Ecuador",      "date": "Jun 21", "home": False},
        {"opponent": "CIV", "opp_name": "Ivory Coast",  "date": "Jun 25", "home": True},
    ],
    "PAR": [
        {"opponent": "USA", "opp_name": "United States","date": "Jun 13", "home": False},
        {"opponent": "TUR", "opp_name": "Türkiye",      "date": "Jun 20", "home": False},
        {"opponent": "AUS", "opp_name": "Australia",    "date": "Jun 26", "home": True},
    ],
    "TUR": [
        {"opponent": "AUS", "opp_name": "Australia",    "date": "Jun 14", "home": False},
        {"opponent": "PAR", "opp_name": "Paraguay",     "date": "Jun 20", "home": True},
        {"opponent": "USA", "opp_name": "United States","date": "Jun 26", "home": True},
    ],
    "CPV": [
        {"opponent": "ESP", "opp_name": "Spain",        "date": "Jun 15", "home": False},
        {"opponent": "URU", "opp_name": "Uruguay",      "date": "Jun 21", "home": False},
        {"opponent": "KSA", "opp_name": "Saudi Arabia", "date": "Jun 27", "home": True},
    ],
    "NOR": [
        {"opponent": "IRQ", "opp_name": "Iraq",         "date": "Jun 16", "home": False},
        {"opponent": "SEN", "opp_name": "Senegal",      "date": "Jun 23", "home": True},
        {"opponent": "FRA", "opp_name": "France",       "date": "Jun 26", "home": True},
    ],
    "IRQ": [
        {"opponent": "NOR", "opp_name": "Norway",       "date": "Jun 16", "home": True},
        {"opponent": "FRA", "opp_name": "France",       "date": "Jun 22", "home": False},
        {"opponent": "SEN", "opp_name": "Senegal",      "date": "Jun 26", "home": False},
    ],
    "NZL": [
        {"opponent": "IRN", "opp_name": "Iran",         "date": "Jun 16", "home": False},
        {"opponent": "EGY", "opp_name": "Egypt",        "date": "Jun 22", "home": True},
        {"opponent": "BEL", "opp_name": "Belgium",      "date": "Jun 27", "home": True},
    ],
    "COD": [
        {"opponent": "POR", "opp_name": "Portugal",     "date": "Jun 17", "home": False},
        {"opponent": "COL", "opp_name": "Colombia",     "date": "Jun 24", "home": False},
        {"opponent": "UZB", "opp_name": "Uzbekistan",   "date": "Jun 27", "home": True},
    ],
    "UZB": [
        {"opponent": "COL", "opp_name": "Colombia",     "date": "Jun 18", "home": True},
        {"opponent": "POR", "opp_name": "Portugal",     "date": "Jun 23", "home": False},
        {"opponent": "COD", "opp_name": "Congo DR",     "date": "Jun 27", "home": False},
    ],
    "KSA": [
        {"opponent": "URU", "opp_name": "Uruguay",      "date": "Jun 15", "home": True},
        {"opponent": "ESP", "opp_name": "Spain",        "date": "Jun 21", "home": False},
        {"opponent": "CPV", "opp_name": "Cape Verde",   "date": "Jun 27", "home": False},
    ],
    "QAT": [
        {"opponent": "CHE", "opp_name": "Switzerland",  "date": "Jun 13", "home": True},
        {"opponent": "CAN", "opp_name": "Canada",       "date": "Jun 18", "home": False},
        {"opponent": "BIH", "opp_name": "Bosnia-Herz.", "date": "Jun 24", "home": False},
    ],
    "CZE": [
        {"opponent": "KOR", "opp_name": "South Korea",  "date": "Jun 12", "home": False},
        {"opponent": "RSA", "opp_name": "South Africa", "date": "Jun 18", "home": True},
        {"opponent": "MEX", "opp_name": "Mexico",       "date": "Jun 25", "home": True},
    ],
    "SWE": [
        {"opponent": "TUN", "opp_name": "Tunisia",      "date": "Jun 15", "home": True},
        {"opponent": "NED", "opp_name": "Netherlands",  "date": "Jun 20", "home": False},
        {"opponent": "JPN", "opp_name": "Japan",        "date": "Jun 25", "home": False},
    ],
    "CIV": [
        {"opponent": "ECU", "opp_name": "Ecuador",      "date": "Jun 14", "home": True},
        {"opponent": "GER", "opp_name": "Germany",      "date": "Jun 20", "home": False},
        {"opponent": "CUW", "opp_name": "Curaçao",      "date": "Jun 25", "home": False},
    ],
    "EGY": [
        {"opponent": "BEL", "opp_name": "Belgium",      "date": "Jun 15", "home": False},
        {"opponent": "NZL", "opp_name": "New Zealand",  "date": "Jun 22", "home": False},
        {"opponent": "IRN", "opp_name": "Iran",         "date": "Jun 27", "home": True},
    ],
    "PAN": [
        {"opponent": "GHA", "opp_name": "Ghana",        "date": "Jun 17", "home": False},
        {"opponent": "CRO", "opp_name": "Croatia",      "date": "Jun 23", "home": False},
        {"opponent": "ENG", "opp_name": "England",      "date": "Jun 27", "home": True},
    ],
    "ALG": [
        {"opponent": "ARG", "opp_name": "Argentina",    "date": "Jun 17", "home": False},
        {"opponent": "JOR", "opp_name": "Jordan",       "date": "Jun 23", "home": False},
        {"opponent": "AUT", "opp_name": "Austria",      "date": "Jun 28", "home": True},
    ],
    "JOR": [
        {"opponent": "AUT", "opp_name": "Austria",      "date": "Jun 17", "home": False},
        {"opponent": "ALG", "opp_name": "Algeria",      "date": "Jun 23", "home": True},
        {"opponent": "ARG", "opp_name": "Argentina",    "date": "Jun 28", "home": True},
    ],
    "AUT": [
        {"opponent": "JOR", "opp_name": "Jordan",       "date": "Jun 17", "home": True},
        {"opponent": "ARG", "opp_name": "Argentina",    "date": "Jun 22", "home": False},
        {"opponent": "ALG", "opp_name": "Algeria",      "date": "Jun 28", "home": False},
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# In-memory odds store (deque per country)
# ─────────────────────────────────────────────────────────────────────────────

odds_store: dict[str, deque] = defaultdict(lambda: deque(maxlen=ODDS_HISTORY_LEN))
market_cache: list[dict] = []
cache_ttl = 0  # unix timestamp of last fetch


# ─────────────────────────────────────────────────────────────────────────────
# Polymarket fetcher
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_worldcup_markets() -> list[dict]:
    """Fetch WC 2026 market listing (used only for /markets/worldcup debug endpoint)."""
    global market_cache, cache_ttl
    if time.time() - cache_ttl < 300:
        return market_cache
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GAMMA_API}/markets",
                params={"q": "World Cup 2026", "active": "true", "limit": 100},
            )
            resp.raise_for_status()
            data = resp.json()
            markets = data if isinstance(data, list) else data.get("markets", [])
            market_cache = markets
            cache_ttl = time.time()
            return markets
    except Exception:
        return market_cache


async def fetch_country_odds(country: str) -> float | None:
    """
    Fetch YES price (win probability) directly from Polymarket individual market API.
    Uses hardcoded market IDs to avoid relying on bulk listing which lacks price data.
    Returns float 0.0-1.0, or None if no market / fetch fails.
    """
    market_id = POLYMARKET_IDS.get(country)
    if not market_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{GAMMA_API}/markets/{market_id}")
            resp.raise_for_status()
            m = resp.json()

        # outcomePrices and outcomes are JSON-encoded strings in the response
        prices_raw = m.get("outcomePrices", "[]")
        outcomes_raw = m.get("outcomes", "[]")
        prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw
        outcomes = json.loads(outcomes_raw) if isinstance(outcomes_raw, str) else outcomes_raw

        for i, o in enumerate(outcomes):
            if str(o).strip('"').lower() == "yes" and i < len(prices):
                return float(prices[i])

        # Fallback: return first price if outcomes parsing is unexpected
        if prices:
            return float(prices[0])
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Background poller — refreshes odds every 60s
# ─────────────────────────────────────────────────────────────────────────────

async def poll_loop():
    import time
    while True:
        for country in COUNTRY_NAMES:
            try:
                price = await fetch_country_odds(country)
                if price is not None:
                    odds_store[country].append(price)
            except Exception:
                pass
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup():
    asyncio.create_task(poll_loop())


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0", "tracked": len(odds_store)}


# ─── RPC proxy (solves CORS: browser → polybot → rpc.xlayer.tech) ────────────
XLAYER_RPC_ENDPOINTS = [
    "https://xlayerrpc.okx.com",
    "https://rpc.xlayer.tech",
    "https://xlayer-rpc.publicnode.com",
]

@app.post("/rpc")
async def rpc_proxy(request: Request):
    """Transparent JSON-RPC proxy to X Layer — allows browser clients to read
    the chain without hitting rpc.xlayer.tech directly (CORS blocked).
    Tries multiple RPC endpoints in order until one succeeds."""
    raw_body = await request.body()
    last_error = "no endpoints tried"
    async with httpx.AsyncClient(timeout=8.0) as client:
        for rpc_url in XLAYER_RPC_ENDPOINTS:
            try:
                resp = await client.post(
                    rpc_url,
                    content=raw_body,
                    headers={"Content-Type": "application/json"},
                )
                # Only accept if response looks like JSON-RPC
                if resp.status_code == 200 and resp.content.startswith(b"{"):
                    return Response(content=resp.content, media_type="application/json")
                last_error = f"{rpc_url} returned status={resp.status_code} non-JSON"
            except Exception as e:
                last_error = f"{rpc_url}: {e}"
                continue
    return JSONResponse(
        content={"jsonrpc": "2.0", "error": {"code": -32603, "message": f"All RPC endpoints failed: {last_error}"}, "id": None},
        status_code=502,
    )


@app.get("/debug/players/{country}")
async def debug_players(country: str):
    """Debug: call generate_key_players directly and return raw Claude output."""
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")
    name = COUNTRY_NAMES[country]
    result = await generate_key_players(country, name, debug=True)
    return result


@app.get("/markets/worldcup")
async def get_worldcup_markets():
    markets = await fetch_worldcup_markets()
    return {"count": len(markets), "markets": [
        {"id": m.get("id"), "title": m.get("question") or m.get("title")}
        for m in markets
    ]}


@app.get("/odds/{country}")
async def get_odds(country: str):
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")

    # Return cached history, or fetch fresh if empty
    history = list(odds_store[country])
    if not history:
        price = await fetch_country_odds(country)
        if price is not None:
            odds_store[country].append(price)
            history = [price]

    return {"country": country, "name": COUNTRY_NAMES[country], "odds": history}


@app.get("/signal/{country}")
async def get_signal(country: str):
    """
    Returns signal strength 0.0-1.0 based on Polymarket win probability level.
    Top contenders (15%+ odds) → near 1.0; no-hopers (<0.2%) → near 0.
    Also adds a momentum boost if odds moved >3% across 5 readings.
    """
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")

    history = list(odds_store[country])
    if not history:
        price = await fetch_country_odds(country)
        if price is not None:
            odds_store[country].append(price)
            history = [price]

    if not history:
        return {"country": country, "signal": 0.0, "reason": "no odds data"}

    latest = history[-1]

    # Level-based signal: top favorites → high signal, weak teams → low signal
    if latest >= 0.12:
        signal = 1.0
    elif latest >= 0.06:
        signal = 0.5 + (latest - 0.06) / 0.06 * 0.5
    elif latest >= 0.02:
        signal = 0.2 + (latest - 0.02) / 0.04 * 0.3
    else:
        signal = (latest / 0.02) * 0.2

    # Momentum boost: odds moved >3% across last 5 readings
    if len(history) >= 5:
        delta = history[-1] - history[-5]
        if abs(delta) > 0.03:
            signal = min(1.0, signal + 0.15)

    return {
        "country": country,
        "signal": round(signal, 4),
        "latest_odds": round(latest, 4),
        "readings": len(history),
    }


class MMOrderRequest(BaseModel):
    country: str
    side: str
    size: float
    price: float


@app.post("/mm/order")
def post_mm_order(req: MMOrderRequest):
    return {"status": "queued", "order": req.dict(), "note": "CLOB wiring TODO"}


# ─────────────────────────────────────────────────────────────────────────────
# Intel endpoint — Sofascore + OpenAI signal brief
# ─────────────────────────────────────────────────────────────────────────────

_intel_cache: dict[str, dict] = {}
_intel_cache_ts: dict[str, float] = {}
INTEL_TTL = 3600  # 1 hour

SOFASCORE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.sofascore.com/",
    "Accept": "application/json",
}

# Sofascore team IDs for 32 World Cup 2026 nations
SOFASCORE_TEAM_IDS: dict[str, int] = {
    "ARG": 6141, "BRA": 6159, "FRA": 6573, "ENG": 4709,
    "ESP": 6832, "GER": 6480, "POR": 7188, "NED": 6811,
    "BEL": 6011, "ITA": 6700, "URU": 7085, "CRO": 6380,
    "COL": 6343, "MEX": 6748, "USA": 6970, "CAN": 6221,
    "MAR": 6749, "SEN": 6801, "JPN": 6704, "KOR": 6730,
    "AUS": 6156, "ECU": 6431, "POL": 7178, "DEN": 6417,
    "CHE": 6855, "WAL": 6985, "SRB": 6820, "TUN": 6975,
    "CRC": 6375, "GHA": 6495, "CMR": 6237, "IRN": 6680,
}

# Regime description mapping
REGIME_DESC = {
    0: "calm — minimal movement, low signal confidence",
    1: "trending — steady upward momentum detected",
    2: "volatile — sharp odds fluctuation, unstable signal",
    3: "breakout — strong bullish breakout, high-conviction signal",
}


async def fetch_sofascore_squad(team_id: int) -> list[dict]:
    """Fetch top players for a team from Sofascore."""
    url = f"https://api.sofascore.com/api/v1/team/{team_id}/players"
    try:
        async with httpx.AsyncClient(timeout=8, headers=SOFASCORE_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
            players = data.get("players", [])
            # Return top 8 by position priority: attackers > midfielders > defenders
            position_order = {"F": 0, "M": 1, "D": 2, "G": 3}
            sorted_players = sorted(
                players,
                key=lambda p: position_order.get(
                    (p.get("player", {}).get("position") or "G")[0].upper(), 4
                )
            )
            result = []
            for item in sorted_players[:8]:
                p = item.get("player", {})
                result.append({
                    "name": p.get("name") or p.get("shortName", ""),
                    "position": p.get("position", "?"),
                    "nationality": p.get("nationality", {}).get("name", ""),
                    "age": p.get("age"),
                })
            return result
    except Exception:
        return []


async def fetch_sofascore_form(team_id: int) -> list[dict]:
    """Fetch last 5 match results for a team (raw event list)."""
    url = f"https://api.sofascore.com/api/v1/team/{team_id}/events/last/0"
    try:
        async with httpx.AsyncClient(timeout=8, headers=SOFASCORE_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
            events = data.get("events", [])[-5:]
            results = []
            for e in events:
                home = e.get("homeTeam", {}).get("name", "?")
                away = e.get("awayTeam", {}).get("name", "?")
                hs = (e.get("homeScore") or {}).get("current")
                as_ = (e.get("awayScore") or {}).get("current")
                results.append({
                    "home": home,
                    "away": away,
                    "score": f"{hs}–{as_}" if hs is not None else "?",
                    "status": e.get("status", {}).get("description", ""),
                })
            return results
    except Exception:
        return []


async def fetch_form_signal(team_id: int, team_name: str) -> dict:
    """
    Parse last 5 results into a W/D/L sequence and a numeric form score 0–100.
    - WIN=W, DRAW=D, LOSS=L
    - formScore: W=+20pts, D=+5pts, L=-20pts, anchored at 50, clamped 0-100
    """
    url = f"https://api.sofascore.com/api/v1/team/{team_id}/events/last/0"
    try:
        async with httpx.AsyncClient(timeout=8, headers=SOFASCORE_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {"sequence": [], "formScore": 50, "played": 0}
            data = resp.json()
            events = data.get("events", [])[-5:]

        sequence = []
        for e in events:
            status_type = (e.get("status") or {}).get("type", "")
            if status_type not in ("finished",):
                continue  # skip live/upcoming

            home_team = (e.get("homeTeam") or {}).get("name", "")
            hs = (e.get("homeScore") or {}).get("current")
            as_ = (e.get("awayScore") or {}).get("current")
            if hs is None or as_ is None:
                continue

            is_home = team_name.lower() in home_team.lower()
            gf = hs if is_home else as_
            ga = as_ if is_home else hs
            if gf > ga:
                sequence.append("W")
            elif gf < ga:
                sequence.append("L")
            else:
                sequence.append("D")

        wins   = sequence.count("W")
        draws  = sequence.count("D")
        losses = sequence.count("L")
        raw    = 50 + wins * 20 + draws * 5 - losses * 20
        form_score = max(0, min(100, raw))

        return {"sequence": sequence, "formScore": form_score, "played": len(sequence)}
    except Exception:
        return {"sequence": [], "formScore": 50, "played": 0}


# ── Form cache (15 min TTL — Sofascore rate-limit conscious) ─────────────────
_form_cache: dict[str, dict] = {}
_form_cache_ts: dict[str, float] = {}
FORM_TTL = 900  # 15 minutes


@app.get("/form/{country}")
async def get_form(country: str):
    """
    Returns the recent form (W/D/L sequence) and a numeric form score for a country.
    formScore: 0-100 anchored at 50 (neutral). Higher = recent wins, lower = recent losses.
    Used by the agent to add a form component to the momentum score.
    """
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")

    now = time.time()
    if country in _form_cache and (now - _form_cache_ts.get(country, 0)) < FORM_TTL:
        return _form_cache[country]

    team_id = SOFASCORE_TEAM_IDS.get(country)
    if not team_id:
        result = {"country": country, "sequence": [], "formScore": 50, "played": 0, "source": "no_id"}
        _form_cache[country] = result
        _form_cache_ts[country] = now
        return result

    form = await fetch_form_signal(team_id, COUNTRY_NAMES[country])
    result = {
        "country": country,
        "name": COUNTRY_NAMES[country],
        "sequence": form["sequence"],
        "formScore": form["formScore"],
        "played": form["played"],
        "source": "sofascore",
    }
    _form_cache[country] = result
    _form_cache_ts[country] = now
    return result


async def generate_key_players(country: str, name: str, debug: bool = False):
    """Use Claude to identify 5 key star players for a WC 2026 nation.

    Returns list of players (or, when debug=True, a dict with raw response details).
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print(f"[key_players] {country}: no ANTHROPIC_API_KEY")
        return {"error": "no_api_key"} if debug else []

    client = anthropic.AsyncAnthropic(api_key=api_key)
    prompt = (
        f"Return a JSON array of 5 key players for {name} at the 2026 World Cup. "
        f"Each object MUST have these exact keys: name, position, club, why. "
        f"position is one of: FWD, MID, DEF, GK. "
        f"why is one short sentence about their WC 2026 impact. "
        f"Include variety (mix of attackers, midfielders, defenders). "
        f"Respond with ONLY the JSON array — no prose, no markdown, no code fences."
    )

    raw = ""
    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown fences if present
        text = raw
        if "```" in text:
            import re
            m = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text)
            if m:
                text = m.group(1)
        # Extract first array
        start = text.find("[")
        end = text.rfind("]") + 1
        if start != -1 and end > start:
            text = text[start:end]
        players = json.loads(text)
        if not isinstance(players, list):
            print(f"[key_players] {country}: not a list, got {type(players)}")
            return {"error": "not_a_list", "raw": raw} if debug else []
        print(f"[key_players] {country}: parsed {len(players)} players")
        result = players[:5]
        return {"players": result, "raw": raw} if debug else result
    except Exception as e:
        print(f"[key_players] {country}: FAILED — {type(e).__name__}: {e}")
        print(f"[key_players] raw response: {raw[:500]}")
        return {"error": f"{type(e).__name__}: {e}", "raw": raw} if debug else []


async def generate_intel_brief(
    country: str,
    name: str,
    score: int,
    regime: int,
    odds: float | None,
    players: list[dict],
    fixtures: list[dict],
) -> str:
    """Use Anthropic Claude to generate a concise signal intelligence brief."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "No Anthropic key configured. Set ANTHROPIC_API_KEY in Railway env vars."

    client = anthropic.AsyncAnthropic(api_key=api_key)

    players_text = "\n".join(
        f"  - {p['name']} ({p.get('position', '?')}, {p.get('club', '?')}) — {p.get('why', '')}"
        for p in players
    ) or "  Squad data unavailable"

    fixtures_text = "\n".join(
        f"  - {name} {'vs' if f['home'] else '@'} {f['opp_name']} ({f['date']})"
        for f in fixtures
    ) or "  Fixture data unavailable (team may not have qualified)"

    odds_str = f"{round(odds * 100, 1)}%" if odds is not None else "N/A"
    regime_str = REGIME_DESC.get(regime, "unknown")

    prompt = f"""You are LUCARNE, an AI signal intelligence system for the 2026 World Cup.
Write a sharp, concise tactical intel brief (3 paragraphs) for {name} ({country}).

Current LUCARNE Signal Data:
- Score: {score}/100
- Regime: {regime_str}
- Polymarket Win Odds: {odds_str}

Key Players:
{players_text}

WC 2026 Group Stage Fixtures:
{fixtures_text}

Write about:
1. Why the signal is reading {regime_str} right now — what does that mean tactically/statistically
2. Their group stage draw — toughest opponent, path to the Round of 32
3. Overall tournament outlook and what would shift the signal

Tone: authoritative, data-driven, like a sports intelligence analyst. Use football terminology.
Do NOT use bullet points — flowing paragraphs only. Keep it under 200 words total."""

    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        return f"Intel generation failed: {str(e)[:120]}"


async def generate_match_brief(
    team1: str, name1: str,
    team2: str, name2: str,
    win_a: float, draw: float, win_b: float,
    odds_a: float | None, odds_b: float | None,
) -> str:
    """Generate AI match preview brief for H2H matchup."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "No Anthropic key configured."

    client = anthropic.AsyncAnthropic(api_key=api_key)

    odds_a_str = f"{round(odds_a * 100, 1)}%" if odds_a else "N/A"
    odds_b_str = f"{round(odds_b * 100, 1)}%" if odds_b else "N/A"

    prompt = f"""You are LUCARNE, an AI signal intelligence system for the 2026 World Cup.
Write a sharp match preview (3 paragraphs) for: {name1} vs {name2}

LUCARNE Match Probability Model:
- {name1} win: {round(win_a * 100, 1)}%
- Draw: {round(draw * 100, 1)}%
- {name2} win: {round(win_b * 100, 1)}%

Polymarket Tournament Win Odds:
- {name1}: {odds_a_str}
- {name2}: {odds_b_str}

Write about:
1. What the odds imply about this matchup and which team has the edge
2. Key tactical factors — playing styles, strengths/weaknesses to exploit
3. Prediction and what conditions would flip the result

Tone: sharp, analytical, like a premium football intelligence brief.
Do NOT use bullet points — flowing paragraphs only. Keep it under 200 words total."""

    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=350,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        return f"Match brief failed: {str(e)[:120]}"


@app.get("/intel/{country}")
async def get_intel(request: Request, country: str, score: int = 0, regime: int = 0):
    """
    Returns AI-generated signal intelligence brief for a country.
    Requires x402 micropayment (0.01 USDC on X Layer) via X-Payment header.
    Query params: score (0-100), regime (0-3) — passed from frontend card state.
    Results are cached for 1 hour per country+score combination.
    """
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")

    # ── x402 payment gate ────────────────────────────────────────────────────
    payment_header = request.headers.get("X-Payment")
    valid, _ = verify_x402_payment(payment_header)
    if not valid:
        name_for_pmt = COUNTRY_NAMES[country]
        pmt = make_402_payload(
            resource_url=str(request.url),
            description=f"LUCARNE Signal Intel Brief — {name_for_pmt} (WC 2026)",
        )
        encoded = base64.b64encode(json.dumps(pmt).encode()).decode()
        return JSONResponse(
            status_code=402,
            content={"error": "Payment required", "x402": pmt},
            headers={"X-Payment-Required": encoded},
        )
    # ─────────────────────────────────────────────────────────────────────────

    cache_key = f"{country}_{score}_{regime}"
    if cache_key in _intel_cache and (time.time() - _intel_cache_ts.get(cache_key, 0)) < INTEL_TTL:
        return _intel_cache[cache_key]

    name = COUNTRY_NAMES[country]
    team_id = SOFASCORE_TEAM_IDS.get(country)
    fixtures = WC_FIXTURES.get(country, [])

    # Fetch key players (Claude-generated) + current odds in parallel
    key_players, odds = await asyncio.gather(
        generate_key_players(country, name),
        fetch_country_odds(country),
    )

    brief = await generate_intel_brief(country, name, score, regime, odds, key_players, fixtures)

    result = {
        "country": country,
        "name": name,
        "score": score,
        "regime": regime,
        "odds": round(odds * 100, 2) if odds is not None else None,
        "brief": brief,
        "players": key_players,
        "fixtures": fixtures,
    }
    _intel_cache[cache_key] = result
    _intel_cache_ts[cache_key] = time.time()
    return result


@app.get("/fixtures/{country}")
async def get_fixtures(country: str):
    """Returns WC 2026 group stage fixtures for a country."""
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")
    return {
        "country": country,
        "name": COUNTRY_NAMES[country],
        "fixtures": WC_FIXTURES.get(country, []),
    }


@app.get("/match/{team1}/{team2}")
async def get_match_odds(request: Request, team1: str, team2: str):
    """
    Returns H2H win/draw/loss probabilities and AI brief for a matchup.
    Derives match probabilities from Polymarket tournament winner odds.
    Requires x402 micropayment (0.01 USDC on X Layer) via X-Payment header.
    """
    team1 = team1.upper()
    team2 = team2.upper()

    if team1 not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {team1}")
    if team2 not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {team2}")

    # ── x402 payment gate ────────────────────────────────────────────────────
    payment_header = request.headers.get("X-Payment")
    valid, _ = verify_x402_payment(payment_header)
    if not valid:
        name1 = COUNTRY_NAMES.get(team1, team1)
        name2 = COUNTRY_NAMES.get(team2, team2)
        pmt = make_402_payload(
            resource_url=str(request.url),
            description=f"LUCARNE Match Intel Brief — {name1} vs {name2} (WC 2026)",
        )
        encoded = base64.b64encode(json.dumps(pmt).encode()).decode()
        return JSONResponse(
            status_code=402,
            content={"error": "Payment required", "x402": pmt},
            headers={"X-Payment-Required": encoded},
        )
    # ─────────────────────────────────────────────────────────────────────────

    cache_key = f"match_{team1}_{team2}"
    alt_key   = f"match_{team2}_{team1}"
    if cache_key in _intel_cache and (time.time() - _intel_cache_ts.get(cache_key, 0)) < 1800:
        return _intel_cache[cache_key]
    if alt_key in _intel_cache and (time.time() - _intel_cache_ts.get(alt_key, 0)) < 1800:
        return _intel_cache[alt_key]

    # Fetch both teams' Polymarket odds in parallel
    odds_a, odds_b = await asyncio.gather(
        fetch_country_odds(team1),
        fetch_country_odds(team2),
    )

    # Derive H2H win/draw/loss from relative tournament strength
    if odds_a and odds_b:
        r = odds_a / (odds_a + odds_b)
    elif odds_a:
        r = 0.70  # mild favorite if only one team has odds
    elif odds_b:
        r = 0.30
    else:
        r = 0.50  # no data — 50/50

    # Draw probability: higher when teams are evenly matched
    draw_prob = 0.25 + 0.12 * (1.0 - abs(r - 0.5) * 2)
    win_a = (1.0 - draw_prob) * r
    win_b = (1.0 - draw_prob) * (1.0 - r)

    name1 = COUNTRY_NAMES[team1]
    name2 = COUNTRY_NAMES[team2]
    brief = await generate_match_brief(team1, name1, team2, name2, win_a, draw_prob, win_b, odds_a, odds_b)

    result = {
        "teamA": team1, "nameA": name1,
        "teamB": team2, "nameB": name2,
        "oddsA": round(odds_a * 100, 2) if odds_a else None,
        "oddsB": round(odds_b * 100, 2) if odds_b else None,
        "winA":  round(win_a * 100, 1),
        "draw":  round(draw_prob * 100, 1),
        "winB":  round(win_b * 100, 1),
        "brief": brief,
    }
    _intel_cache[cache_key] = result
    _intel_cache_ts[cache_key] = time.time()
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Calibration — reads OutcomeAttestor on-chain data via /rpc proxy
# POST /calibration  body: { "outcomes": [{country, opponent, gf, ga, preScore, ts}] }
# Also exposes GET /calibration/summary (queries chain via internal rpc call)
# ─────────────────────────────────────────────────────────────────────────────

# In-memory outcome store — populated by the agent's outcome writer via POST
# Shape: { country: [{opponent, gf, ga, result("W"|"D"|"L"), preScore, ts}] }
_outcome_store: dict[str, list[dict]] = defaultdict(list)


class OutcomeRecord(BaseModel):
    country:  str
    opponent: str
    gf:       int
    ga:       int
    preScore: int
    ts:       int  # unix timestamp of match


@app.post("/outcomes/record")
def record_outcome(rec: OutcomeRecord):
    """
    Called by the agent after it writes an outcome on-chain.
    Stores a local copy for fast calibration queries without hitting the chain.
    """
    country = rec.country.upper()
    result  = "W" if rec.gf > rec.ga else ("L" if rec.gf < rec.ga else "D")
    _outcome_store[country].append({
        "opponent": rec.opponent.upper(),
        "gf":       rec.gf,
        "ga":       rec.ga,
        "result":   result,
        "preScore": rec.preScore,
        "ts":       rec.ts,
    })
    return {"ok": True, "country": country, "result": result}


@app.get("/calibration")
def get_calibration():
    """
    Returns calibration stats across all countries with recorded outcomes.
    Shows whether the LUCARNE signal has alpha vs pure market odds.

    Key metric: avgWinScore >> avgLossScore → signal has directional edge.
    """
    if not _outcome_store:
        return {
            "status": "no_data",
            "message": "No match outcomes recorded yet. First WC 2026 match: Jun 12.",
            "countries": {},
        }

    global_wins = global_draws = global_losses = 0
    global_win_scores: list[int] = []
    global_loss_scores: list[int] = []
    country_stats = {}

    for country, outcomes in _outcome_store.items():
        wins = draws = losses = 0
        win_scores:  list[int] = []
        draw_scores: list[int] = []
        loss_scores: list[int] = []

        for o in outcomes:
            s = o["preScore"]
            if o["result"] == "W":
                wins  += 1; win_scores.append(s)
            elif o["result"] == "D":
                draws += 1; draw_scores.append(s)
            else:
                losses += 1; loss_scores.append(s)

        global_wins   += wins
        global_draws  += draws
        global_losses += losses
        global_win_scores.extend(win_scores)
        global_loss_scores.extend(loss_scores)

        def avg(lst): return round(sum(lst) / len(lst), 1) if lst else None

        country_stats[country] = {
            "played":       wins + draws + losses,
            "wins":         wins,
            "draws":        draws,
            "losses":       losses,
            "avgWinScore":  avg(win_scores),
            "avgDrawScore": avg(draw_scores),
            "avgLossScore": avg(loss_scores),
            "alpha":        round(avg(win_scores) - avg(loss_scores), 1)
                            if win_scores and loss_scores else None,
        }

    def avg(lst): return round(sum(lst) / len(lst), 1) if lst else None
    global_alpha = round(avg(global_win_scores) - avg(global_loss_scores), 1) \
                   if global_win_scores and global_loss_scores else None

    return {
        "status": "ok",
        "global": {
            "played":       global_wins + global_draws + global_losses,
            "wins":         global_wins,
            "draws":        global_draws,
            "losses":       global_losses,
            "avgWinScore":  avg(global_win_scores),
            "avgLossScore": avg(global_loss_scores),
            "alpha":        global_alpha,
            "interpretation": (
                f"Signal scores before wins averaged {avg(global_win_scores)} vs "
                f"{avg(global_loss_scores)} before losses — "
                + ("positive alpha detected" if global_alpha and global_alpha > 5
                   else "no significant alpha yet")
            ) if global_alpha is not None else "insufficient data",
        },
        "countries": country_stats,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Live Match Panel — fetches featured match odds from Polymarket by slug
# GET /live-match         returns current featured match data + brief
# GET /live-match/{slug}  override slug (admin use)
# ─────────────────────────────────────────────────────────────────────────────

_live_match_cache: dict = {}
_live_match_cache_ts: float = 0
LIVE_MATCH_TTL = 30  # seconds — refresh every 30s for live data

LIVE_MATCH_SLUG = os.getenv("LIVE_MATCH_SLUG", "uel-scf-ast-2026-05-20")


async def fetch_live_match_data(slug: str) -> dict | None:
    """Fetch match event + odds from Polymarket Gamma API by slug."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GAMMA_API}/events",
                params={"slug": slug},
                headers={"User-Agent": "lucarne-polybot/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()

        if not data:
            return None

        ev = data[0]
        markets = ev.get("markets", [])

        # Parse outcomes from negRisk markets (home win / draw / away win)
        outcomes_parsed: list[dict] = []
        for m in markets:
            prices_raw   = m.get("outcomePrices", "[]")
            outcomes_raw = m.get("outcomes", "[]")
            prices   = json.loads(prices_raw)   if isinstance(prices_raw, str)   else prices_raw
            outcomes = json.loads(outcomes_raw) if isinstance(outcomes_raw, str) else outcomes_raw

            yes_idx = next(
                (i for i, o in enumerate(outcomes) if str(o).lower() == "yes"),
                0
            )
            prob = float(prices[yes_idx]) if yes_idx < len(prices) else None
            if prob is not None:
                outcomes_parsed.append({
                    "question": m.get("question", ""),
                    "slug":     m.get("slug", ""),
                    "prob":     round(prob * 100, 1),
                    "marketId": m.get("id"),
                })

        return {
            "slug":        slug,
            "eventId":     ev.get("id"),
            "title":       ev.get("title", ""),
            "description": ev.get("description", ""),
            "endDate":     ev.get("endDate", ""),
            "active":      ev.get("active", False),
            "closed":      ev.get("closed", False),
            "volume":      round(ev.get("volume", 0)),
            "liquidity":   round(ev.get("liquidity", 0)),
            "volume24hr":  round(ev.get("volume24hr", 0)),
            "competitive": round(ev.get("competitive", 0), 3),
            "markets":     outcomes_parsed,
            "polymarketUrl": f"https://polymarket.com/sports/{slug.split('-')[0]}/{slug}",
        }
    except Exception as e:
        print(f"[live-match] fetch error: {e}")
        return None


async def generate_live_match_brief(title: str, markets: list[dict]) -> str:
    """Generate a punchy tactical analysis for a live club match."""
    if not markets:
        return ""

    outcomes_str = "\n".join(
        f"- {m['question'].replace('Will ', '').replace('?', '')}: {m['prob']}%"
        for m in markets
    )

    prompt = f"""You are a sharp sports intelligence analyst. Write a 3-sentence pre-match analysis for:

{title}

Market-implied probabilities:
{outcomes_str}

Focus on: what the odds say about the balance of power, one key tactical edge, and what to watch for.
No bullet points. Under 80 words. Authoritative tone."""

    try:
        client_ai = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        msg = client_ai.messages.create(
            model="claude-haiku-4-5",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as e:
        print(f"[live-match] claude error: {e}")
        return ""


@app.get("/live-match")
@app.get("/live-match/{slug}")
async def get_live_match(slug: str | None = None):
    """
    Returns live match data for the featured match of the day.
    Refreshes every 30s from Polymarket. Override slug via LIVE_MATCH_SLUG env var
    or pass it directly as a path param.
    """
    global _live_match_cache, _live_match_cache_ts

    target_slug = slug or LIVE_MATCH_SLUG
    cache_key = f"lm_{target_slug}"

    cached = _live_match_cache.get(cache_key)
    if cached and (time.time() - _live_match_cache_ts) < LIVE_MATCH_TTL:
        return cached

    match_data = await fetch_live_match_data(target_slug)
    if not match_data:
        raise HTTPException(status_code=404, detail=f"Match not found: {target_slug}")

    # Generate brief (cached independently — only regenerate every 15 min)
    brief_key = f"brief_{target_slug}"
    brief_ts  = _intel_cache_ts.get(brief_key, 0)
    if brief_key not in _intel_cache or (time.time() - brief_ts) > 900:
        brief = await generate_live_match_brief(match_data["title"], match_data["markets"])
        _intel_cache[brief_key]    = brief
        _intel_cache_ts[brief_key] = time.time()
    else:
        brief = _intel_cache[brief_key]

    match_data["brief"] = brief
    _live_match_cache[cache_key] = match_data
    _live_match_cache_ts = time.time()
    return match_data


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

