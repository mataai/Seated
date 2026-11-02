// Dev helper for the Angular demo: runs the Node reference server and books
// random seats of the sample floorplan every 2 seconds.
//
//   npm run start:live-server
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SAMPLE_FLOORPLAN } from '../../libs/core/src/samples.ts';

const planPath = join(tmpdir(), 'open-seats-demo-floorplan.json');
writeFileSync(planPath, JSON.stringify(SAMPLE_FLOORPLAN));

process.env.FLOORPLAN_ID ??= 'demo';
process.env.SIMULATE_FLOORPLAN ??= planPath;

await import('../../servers/node/server.mjs');
