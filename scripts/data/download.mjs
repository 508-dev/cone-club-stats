import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export async function download(url, destination) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (!response.body) throw new Error(`Empty response for ${url}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Download attempt ${attempt} failed: ${error.message}`);
      await new Promise((done) => setTimeout(done, attempt * 1000));
    }
  }
}
