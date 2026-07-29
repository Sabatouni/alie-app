// Runs verify-media-helpers.mjs under Node.
//
// The helpers live in src/, which is Vite code — it reads import.meta.env.
// Node has no such thing, so we bundle through esbuild (already present as a
// Vite dependency) with the env values substituted in, then import the result.
// The suite runs twice: once with image transformation off (the default the
// site ships with) and once with it on.

import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, 'verify-media-helpers.mjs');

async function run(transform) {
  const dir = await mkdtemp(join(tmpdir(), 'alie-verify-'));
  const outfile = join(dir, 'suite.mjs');

  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': '"https://verify.supabase.co"',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '"verify-anon-key"',
      'import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM': JSON.stringify(String(transform)),
    },
  });

  console.log(`\nimage transformation ${transform ? 'ON (Pro plan)' : 'OFF (default)'}:`);
  process.env.EXPECT_TRANSFORM = String(transform);

  let code = 0;
  try {
    await import(pathToFileURL(outfile).href);
  } catch (err) {
    if (typeof err?.code === 'number') code = err.code;
    else { console.error(err); code = 1; }
  }
  await rm(dir, { recursive: true, force: true });
  return code;
}

// verify-media-helpers.mjs calls process.exit; capture it rather than letting
// the first run tear down the second.
const realExit = process.exit.bind(process);
let exitCode = 0;
process.exit = (code) => {
  if (code) exitCode = code;
  throw Object.assign(new Error('suite finished'), { code: code || 0 });
};

for (const transform of [false, true]) {
  const code = await run(transform);
  if (code) exitCode = code;
}

process.exit = realExit;
process.exit(exitCode);
