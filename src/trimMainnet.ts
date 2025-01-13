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

  // Use a Set for faster lookup of token pairs
  const tokenPairs = new Set([
    `${tokenAAddress}:${tokenBAddress}`,
    `${tokenBAddress}:${tokenAAddress}`,
  ]);

  let relevantPoolFound = false; // Early exit flag
  let processedCount = 0; // Counter for processed items

  const outputStream = fs.createWriteStream("trimmed_mainnet.json");
  outputStream.write('{"official":['); // Start of JSON array

  const pipeline = chain([
    fs.createReadStream("../mainnet.json", { highWaterMark: 64 * 1024 }), // Larger chunk size
    parser(),
    pick({ filter: /^(official|unOfficial)$/ }), // Matches both "official" and "unOfficial"
    streamArray(),
  ]);

  console.log("Processing large mainnet.json file...");

  pipeline.on("data", (data) => {
    processedCount++;

    const pool: PoolInfo = data.value;
    const tokenPairKey = `${pool.baseMint}:${pool.quoteMint}`;

    if (tokenPairs.has(tokenPairKey)) {
      console.log("Found matching pool:", pool);

      // Write to the output file incrementally
      if (relevantPoolFound) {
        outputStream.write(","); // Separate array items
      }
      outputStream.write(JSON.stringify(pool));

      relevantPoolFound = true;

      // Early exit if only one match is needed
      // Uncomment below to stop processing after the first match
      pipeline.destroy();
      outputStream.write("]}"); // End of JSON array
    }
  });

  pipeline.on("end", () => {
    console.log("Finished processing the mainnet.json file.");
    console.log(`Total pools processed: ${processedCount}`);

    outputStream.write("]}"); // End of JSON array
    outputStream.end();

    if (!relevantPoolFound) {
      console.error("No matching pool found for the given token pair.");
      fs.unlinkSync("trimmed_mainnet.json"); // Cleanup empty file
    } else {
      console.log(
        "Trimmed mainnet.json file has been created as trimmed_mainnet.json"
      );
    }
  });

  pipeline.on("error", (err) => {
    console.error("Error processing the file:", err);
    outputStream.end(); // Ensure the output stream is closed on error
  });
}

trimMainnetJson();
