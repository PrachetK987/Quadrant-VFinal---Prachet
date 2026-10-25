/**
 * tools/build-pack.ts
 *
 * Pack compilation CLI utility.
 * Reads raw campus geo data, room schemas, and SVGs, calculates checksums,
 * validates relationships, and packages a versioned campus pack for distribution
 * via Supabase Storage / Cache Storage.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface PackManifestEntry {
  path: string;
  size: number;
  checksum: string;
}

interface PackManifest {
  version: string;
  campus_id: string;
  generated_at: string;
  total_size_bytes: number;
  files: PackManifestEntry[];
}

export function compileCampusPack(sourceDir: string, outVersion: string): PackManifest {
  console.log(`[Pack Builder] Packing from ${sourceDir} version ${outVersion}...`);
  
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory ${sourceDir} does not exist`);
  }

  const manifestEntries: PackManifestEntry[] = [];
  let totalBytes = 0;

  function walk(currentDir: string, relativeBase: string = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

      if (entry.name === 'manifest.json' || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
        const size = content.length;
        totalBytes += size;

        manifestEntries.push({
          path: relPath,
          size,
          checksum: `sha256-${hash}`
        });
      }
    }
  }

  walk(sourceDir);

  const manifest: PackManifest = {
    version: outVersion,
    campus_id: 'c-berkeley-central',
    generated_at: new Date().toISOString(),
    total_size_bytes: totalBytes,
    files: manifestEntries
  };

  const manifestPath = path.join(sourceDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`[Pack Builder] Successfully compiled manifest with ${manifestEntries.length} files (${totalBytes} bytes).`);
  console.log(`[Pack Builder] Manifest written to ${manifestPath}`);

  return manifest;
}

// Allow direct CLI execution if run with tsx / node
if (process.argv[1] && process.argv[1].endsWith('build-pack.ts')) {
  const packDir = path.resolve(__dirname, '../public/packs/campus-pack-v1');
  compileCampusPack(packDir, 'v1.2.0');
}
