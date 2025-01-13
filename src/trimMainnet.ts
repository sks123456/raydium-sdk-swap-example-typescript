import fs from 'fs';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';

import { swapConfig } from './swapConfig';

interface PoolInfo {
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  withdrawQueue: string;
  lpVault: string;
  marketVersion: number;
  marketProgramId: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
}

async function trimMainnetJson() {
  const { tokenAAddress, tokenBAddress } = swapConfig;

  const relevantPools: PoolInfo[] = [];
  const pipeline = chain([
    fs.createReadStream("../mainnet.json"),
    parser(),
    pick({ filter: /^(official|unOfficial)$/ }), // Matches both "official" and "unOfficial"
    streamArray(),
  ]);

  console.log("Processing large mainnet.json file...");
  let processedCount = 0; // Counter for processed items

  pipeline.on("data", (data) => {
    processedCount += 1;
    console.log(`Processing pool #${processedCount}:`, data.value);

    const pool: PoolInfo = data.value;
    if (
      (pool.baseMint === tokenAAddress && pool.quoteMint === tokenBAddress) ||
      (pool.baseMint === tokenBAddress && pool.quoteMint === tokenAAddress)
    ) {
      console.log("Found matching pool:", pool);
      relevantPools.push(pool);
    }
  });

  pipeline.on("end", () => {
    console.log("Finished processing the mainnet.json file.");
    console.log(`Total pools processed: ${processedCount}`);
    console.log(`Total matching pools found: ${relevantPools.length}`);

    if (relevantPools.length === 0) {
      console.error("No matching pool found for the given token pair");
      return;
    }

    const trimmedData = {
      official: relevantPools,
    };

    fs.writeFileSync(
      "trimmed_mainnet.json",
      JSON.stringify(trimmedData, null, 2)
    );
    console.log(
      "Trimmed mainnet.json file has been created as trimmed_mainnet.json"
    );
  });

  pipeline.on("error", (err) => {
    console.error("Error processing the file:", err);
  });
}

trimMainnetJson();
