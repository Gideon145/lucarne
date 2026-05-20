import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { PREDICTIONS_CONTRACT } from "@/lib/constants";

export const runtime = "edge";

const XLAYER_RPC = "https://rpc.xlayer.tech";

const ABI = [
  {
    name: "getCounts",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "bytes32" }],
    outputs: [
      { name: "home", type: "uint256" },
      { name: "draw", type: "uint256" },
      { name: "away", type: "uint256" },
    ],
  },
  {
    name: "getMyPrediction",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "gameId", type: "bytes32" },
      { name: "wallet", type: "address" },
    ],
    outputs: [
      { name: "predicted", type: "bool" },
      { name: "outcome",   type: "uint8" },
    ],
  },
  {
    name: "totalPredictions",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const xlayer = {
  id:   196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [XLAYER_RPC] } },
} as const;

export async function GET(req: NextRequest) {
  const slug   = req.nextUrl.searchParams.get("slug") ?? "";
  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";

  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const gameId = keccak256(toBytes(slug)) as `0x${string}`;

  const client = createPublicClient({ chain: xlayer, transport: http(XLAYER_RPC) });

  try {
    const baseArgs = { address: PREDICTIONS_CONTRACT, abi: ABI } as const;

    const [countsResult, totalResult] = await Promise.all([
      client.readContract({ ...baseArgs, functionName: "getCounts", args: [gameId] }),
      client.readContract({ ...baseArgs, functionName: "totalPredictions" }),
    ]);

    const [home, draw, away] = countsResult as [bigint, bigint, bigint];
    const total = totalResult as bigint;

    let myPrediction: [boolean, number] | null = null;
    if (wallet && wallet.startsWith("0x")) {
      const r = await client.readContract({
        ...baseArgs,
        functionName: "getMyPrediction",
        args: [gameId, wallet as `0x${string}`],
      });
      myPrediction = r as [boolean, number];
    }

    return NextResponse.json({
      home:  Number(home),
      draw:  Number(draw),
      away:  Number(away),
      total: Number(total),
      mine:  myPrediction ? { predicted: myPrediction[0], outcome: myPrediction[1] } : null,
    });
  } catch (e) {
    console.error("predictions route error:", e);
    return NextResponse.json({ home: 0, draw: 0, away: 0, total: 0, mine: null });
  }
}
