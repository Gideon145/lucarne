"""
lucarne-polybot FastAPI server
Fetches World Cup Polymarket odds and exposes signal endpoints
consumed by the LUCARNE TypeScript agent.
"""

import asyncio
import httpx
import os
import time
from collections import defaultdict, deque
from fastapi import FastAPI, HTTPException
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
    """Fetch last 5 match results for a team."""
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


async def generate_intel_brief(
    country: str,
    name: str,
    score: int,
    regime: int,
    odds: float | None,
    players: list[dict],
    form: list[dict],
) -> str:
    """Use Anthropic Claude to generate a concise signal intelligence brief."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "No Anthropic key configured. Set ANTHROPIC_API_KEY in Railway env vars."

    client = anthropic.AsyncAnthropic(api_key=api_key)

    players_text = "\n".join(
        f"  - {p['name']} ({p['position']}, age {p['age'] or '?'})"
        for p in players
    ) or "  Squad data unavailable"

    form_text = "\n".join(
        f"  - {r['home']} {r['score']} {r['away']}"
        for r in form
    ) or "  Recent form unavailable"

    odds_str = f"{round(odds * 100, 1)}%" if odds is not None else "N/A"
    regime_str = REGIME_DESC.get(regime, "unknown")

    prompt = f"""You are LUCARNE, an AI signal intelligence system for the 2026 World Cup.
Write a sharp, concise tactical intel brief (3-4 paragraphs) for {name} ({country}).

Current LUCARNE Signal Data:
- Score: {score}/100
- Regime: {regime_str}
- Polymarket Win Odds: {odds_str}

Key Players:
{players_text}

Recent Form (last 5 matches):
{form_text}

Write about:
1. Why the signal is reading {regime_str} right now — what does that mean tactically/statistically
2. Key players to watch and their potential impact
3. Their last World Cup run — how far they went, memorable moments
4. Overall tournament outlook and what would shift the signal

Tone: authoritative, data-driven, like a sports intelligence analyst. Use football terminology.
Do NOT use bullet points — flowing paragraphs only. Keep it under 250 words total."""

    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        return f"Intel generation failed: {str(e)[:120]}"


@app.get("/intel/{country}")
async def get_intel(country: str, score: int = 0, regime: int = 0):
    """
    Returns AI-generated signal intelligence brief for a country.
    Query params: score (0-100), regime (0-3) — passed from frontend card state.
    Results are cached for 1 hour per country+score combination.
    """
    country = country.upper()
    if country not in COUNTRY_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")

    cache_key = f"{country}_{score}_{regime}"
    if cache_key in _intel_cache and (time.time() - _intel_cache_ts.get(cache_key, 0)) < INTEL_TTL:
        return _intel_cache[cache_key]

    name = COUNTRY_NAMES[country]
    team_id = SOFASCORE_TEAM_IDS.get(country)

    # Fetch Sofascore data + current odds in parallel
    players, form, odds = await asyncio.gather(
        fetch_sofascore_squad(team_id) if team_id else asyncio.sleep(0, result=[]),
        fetch_sofascore_form(team_id) if team_id else asyncio.sleep(0, result=[]),
        fetch_country_odds(country),
    )

    brief = await generate_intel_brief(country, name, score, regime, odds, players, form)

    result = {
        "country": country,
        "name": name,
        "score": score,
        "regime": regime,
        "odds": round(odds * 100, 2) if odds is not None else None,
        "brief": brief,
        "players": players,
        "form": form,
    }
    _intel_cache[cache_key] = result
    _intel_cache_ts[cache_key] = time.time()
    return result


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

