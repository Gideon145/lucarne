# lucarne-polybot

FastAPI sidecar wrapping the polybot signal pipeline for LUCARNE.

## Endpoints

- `GET /odds/{country}` — rolling odds time-series for a country
- `GET /signal/{country}` — gated signal output (0/1 edge detection) from 10-gate filter stack
- `GET /markets/worldcup` — all active World Cup Polymarket markets
- `POST /mm/order` — market-maker order intent for Lucarne Perp

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --port 8001 --reload
```

## Status

Polybot vendored from `C:\Users\vergio\Dev\polybot`.
`core/discovery.py` needs widening for World Cup slugs (Phase 1.4).
