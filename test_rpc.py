import urllib.request
import json

body = json.dumps({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}).encode()
rpcs = [
    "https://xlayer.drpc.org",
    "https://rpc.ankr.com/xlayer",
    "https://1rpc.io/xlayer",
    "https://xlayer-rpc.publicnode.com",
    "https://rpc.xlayer.tech",
]
for rpc in rpcs:
    try:
        req = urllib.request.Request(rpc, body, {"Content-Type": "application/json"})
        res = urllib.request.urlopen(req, timeout=7)
        print(f"OK  {rpc}: {res.read()[:80]}")
    except Exception as e:
        print(f"ERR {rpc}: {str(e)[:60]}")
