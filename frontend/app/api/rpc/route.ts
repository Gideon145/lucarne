import { NextRequest, NextResponse } from "next/server";

/**
 * RPC proxy — forwards JSON-RPC requests to X Layer mainnet.
 * Running on Vercel avoids Railway IP blocks and browser CORS restrictions.
 * rpc.xlayer.tech accepts Vercel's egress IPs.
 */

const XLAYER_RPCS = [
  "https://rpc.xlayer.tech",
  "https://xlayerrpc.okx.com",
];

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer();

  let lastError = "no endpoints tried";

  for (const rpc of XLAYER_RPCS) {
    try {
      const upstream = await fetch(rpc, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const text = await upstream.text();
      if (text.trimStart().startsWith("{")) {
        return new NextResponse(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      lastError = `${rpc} returned non-JSON (status ${upstream.status})`;
    } catch (err) {
      lastError = `${rpc}: ${String(err).slice(0, 80)}`;
    }
  }

  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32603, message: `All RPCs failed: ${lastError}` }, id: null },
    { status: 502 }
  );
}
