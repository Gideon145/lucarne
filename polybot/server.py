"""
lucarne-polybot FastAPI server
Wraps polybot's core signal pipeline and exposes HTTP endpoints
consumed by the LUCARNE TypeScript agent.

TODO (Phase 1.4):
  1. Copy polybot source files from C:\\Users\\vergio\\Dev\\polybot into this directory
  2. Widen core/discovery.py for World Cup slugs
  3. Wire /mm/order to clob_api.py for real CLOB placement
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="lucarne-polybot", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WORLD_CUP_COUNTRIES = [
    "ARG","BRA","FRA","ENG","ESP","GER","POR","NED",
    "BEL","ITA","URU","CRO","COL","MEX","USA","CAN",
    "MAR","SEN","JPN","KOR","AUS","ECU","POL","DEN",
    "CHE","WAL","SRB","TUN","CRC","GHA","CMR","IRN",
]


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/markets/worldcup")
def get_worldcup_markets():
    """
    Returns active World Cup Polymarket markets.
    TODO: wire to polybot core/discovery.py widened for World Cup slugs.
    """
    return {"markets": [], "note": "TODO: wire discovery.py"}


@app.get("/odds/{country}")
def get_odds(country: str):
    """
    Returns rolling odds time-series for a country.
    TODO: wire to polybot core/polymarket.py.
    """
    country = country.upper()
    if country not in WORLD_CUP_COUNTRIES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")
    # Stub — returns empty series until polybot is wired
    return {"country": country, "odds": [], "note": "TODO: wire polymarket.py"}


@app.get("/signal/{country}")
def get_signal(country: str):
    """
    Returns gated signal output (0/1 edge detected) from polybot 10-gate filter.
    TODO: wire to polybot strategy.py ConservativeStrategy.
    """
    country = country.upper()
    if country not in WORLD_CUP_COUNTRIES:
        raise HTTPException(status_code=404, detail=f"Unknown country: {country}")
    return {"country": country, "signal": 0, "note": "TODO: wire strategy.py"}


class MMOrderRequest(BaseModel):
    country: str
    side: str     # "BUY" | "SELL"
    size: float
    price: float


@app.post("/mm/order")
def post_mm_order(req: MMOrderRequest):
    """
    Market-maker order intent for Lucarne Perp.
    TODO: wire to polybot clob_api.py for real CLOB placement.
    """
    return {"status": "queued", "order": req.dict(), "note": "TODO: wire clob_api.py"}


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
