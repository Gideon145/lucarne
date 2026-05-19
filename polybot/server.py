"""
lucarne-polybot FastAPI server
Fetches World Cup Polymarket odds and exposes signal endpoints
consumed by the LUCARNE TypeScript agent.
"""

import asyncio
import httpx
import os
from collections import defaultdict, deque
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="lucarne-polybot", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

GAMMA_API = "https://gamma-api.polymarket.com"
ODDS_HISTORY_LEN = 60   # keep last 60 data points per country

# ─────────────────────────────────────────────────────────────────────────────
# World Cup 2026 country → Polymarket search slug
# ─────────────────────────────────────────────────────────────────────────────

COUNTRY_NAMES: dict[str, str] = {
    "ARG": "Argentina", "BRA": "Brazil",   "FRA": "France",   "ENG": "England",
    "ESP": "Spain",     "GER": "Germany",  "POR": "Portugal", "NED": "Netherlands",
    "BEL": "Belgium",   "ITA": "Italy",    "URU": "Uruguay",  "CRO": "Croatia",
    "COL": "Colombia",  "MEX": "Mexico",   "USA": "United States", "CAN": "Canada",
    "MAR": "Morocco",   "SEN": "Senegal",  "JPN": "Japan",    "KOR": "South Korea",
    "AUS": "Australia", "ECU": "Ecuador",  "POL": "Poland",   "DEN": "Denmark",
    "CHE": "Switzerland","WAL": "Wales",   "SRB": "Serbia",   "TUN": "Tunisia",
    "CRC": "Costa Rica","GHA": "Ghana",    "CMR": "Cameroon", "IRN": "Iran",
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
    """Search Polymarket Gamma API for World Cup 2026 markets."""
    global market_cache, cache_ttl
    import time
    if time.time() - cache_ttl < 300:  # 5-minute cache
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
    except Exception as e:
        return market_cache  # return stale cache on error


async def fetch_country_odds(country: str) -> float | None:
    """
    Fetch the YES price (probability) for a country winning the World Cup.
    Returns a float 0.0-1.0, or None if no market found.
    """
    name = COUNTRY_NAMES.get(country)
    if not name:
        return None

    markets = await fetch_worldcup_markets()

    # Find the most relevant market for this country
    target = None
    for m in markets:
        title = (m.get("question") or m.get("title") or "").lower()
        if name.lower() in title and ("win" in title or "champion" in title or "world cup" in title):
            target = m
            break

    if not target:
        # Fallback: any market mentioning the country
        for m in markets:
            title = (m.get("question") or m.get("title") or "").lower()
            if name.lower() in title:
                target = m
                break

    if not target:
        return None

    # Extract best YES price from outcomes
    outcomes = target.get("outcomes") or []
    tokens = target.get("tokens") or []

    # Try tokens first (CLOB format)
    for token in tokens:
        if str(token.get("outcome", "")).upper() == "YES":
            price = token.get("price")
            if price is not None:
                return float(price)

    # Try outcomes array
    for o in outcomes:
        if isinstance(o, dict) and str(o.get("name", "")).upper() == "YES":
            price = o.get("price") or o.get("probability")
            if price is not None:
                return float(price)

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
    Returns gated signal: 0 = no edge, 1 = edge detected.
    Edge = odds moved >10% in last 5 readings (momentum spike).
    """
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")

    history = list(odds_store[country])
    if len(history) < 2:
        return {"country": country, "signal": 0, "reason": "insufficient data"}

    recent = history[-5:] if len(history) >= 5 else history
    delta = recent[-1] - recent[0]
    signal = 1 if abs(delta) > 0.10 else 0

    return {
        "country": country,
        "signal": signal,
        "delta": round(delta, 4),
        "latest_odds": round(recent[-1], 4),
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


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

