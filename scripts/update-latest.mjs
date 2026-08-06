#!/usr/bin/env node
/**
 * Generates the Tauri updater `latest.json` for both the GitHub and Gitee
 * channels, mirroring the clash-verge-rev updater-release practice.
 *
 * Usage:
 *   node scripts/update-latest.mjs --from-dir <dir> --version <v> --tag <t> [--notes <notes>]
 *   node scripts/update-latest.mjs --from-release [--tag <t>]
 *
 * Outputs:
 *   latest.json               -> latest.json with GitHub download URLs
 *   update-gitee/latest.json  -> latest.json with Gitee download URLs
 *
 * Required env (from-release mode):
 *   GH_TOKEN, GITHUB_OWNER, GITHUB_REPO
 * Optional env:
 *   GITEE_OWNER, GITEE_REPO (used to build Gitee URLs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'KevinT-hub';
const GITHUB_REPO = process.env.GITHUB_REPO || 'database-workbench';
const GITEE_OWNER = process.env.GITEE_OWNER || 'kevint-hub';
const GITEE_REPO = process.env.GITEE_REPO || 'database-workbench';

const PLATFORM_RULES = [
  { re: /_x64-setup\.exe$/, key: 'windows-x86_64' },
  { re: /_arm64-setup\.exe$/, key: 'windows-aarch64' },
  { re: /_x64\.dmg$/, key: 'darwin-x86_64' },
  { re: /_aarch64\.dmg$/, key: 'darwin-aarch64' },
  { re: /_amd64\.AppImage$/, key: 'linux-x86_64' },
  { re: /_amd64\.deb$/, key: 'linux-x86_64-deb' },
];

function detectPlatform(fileName) {
  for (const rule of PLATFORM_RULES) {
    if (rule.re.test(fileName)) return rule.key;
  }
  return null;
}

function githubDownloadUrl(tag, fileName) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

function giteeDownloadUrl(tag, fileName) {
  return `https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function writeOutputs(version, notes, platforms) {
  const payload = {
    version,
    notes: notes || `Release ${version}`,
    pub_date: new Date().toISOString(),
    platforms,
  };

  const giteePlatforms = {};
  for (const [key, entry] of Object.entries(platforms)) {
    giteePlatforms[key] = {
      signature: entry.signature,
      url: entry.url.replace(
        `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/`,
        `https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/`,
      ),
    };
  }

  fs.mkdirSync('update-gitee', { recursive: true });
  fs.writeFileSync('latest.json', `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(
    'update-gitee/latest.json',
    `${JSON.stringify({ ...payload, platforms: giteePlatforms }, null, 2)}\n`,
  );

  console.log('Generated latest.json:');
  console.log(JSON.stringify(payload, null, 2));
}

function buildFromDir(dir, version, tag, notes) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Artifacts directory not found: ${dir}`);
  }

  const platforms = {};
  const files = walkFiles(dir).sort();

  for (const fullPath of files) {
    const file = path.basename(fullPath);
    if (file.endsWith('.sig') || file === 'latest.json') continue;
    const platform = detectPlatform(file);
    if (!platform) {
      console.warn(`[skip] ${file} does not match any updater platform`);
      continue;
    }

    const sigPath = `${fullPath}.sig`;
    if (!fs.existsSync(sigPath)) {
      throw new Error(`Missing signature file for ${file}: ${sigPath}`);
    }
    const signature = fs.readFileSync(sigPath, 'utf8').trim();
    if (!signature) {
      throw new Error(`Signature file is empty for ${file}: ${sigPath}`);
    }

    platforms[platform] = {
      signature,
      url: githubDownloadUrl(tag, file),
    };
    console.log(`[ok] ${platform} <- ${file}`);
  }

  if (Object.keys(platforms).length === 0) {
    throw new Error('No updater artifacts found in directory');
  }

  writeOutputs(version, notes, platforms);
}

function gh(argsList) {
  return execFileSync('gh', argsList, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
  }).trim();
}

async function fetchSignature(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/octet-stream',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download signature ${url}: HTTP ${response.status}`);
  }
  return (await response.text()).trim();
}

async function buildFromRelease(tag) {
  if (!process.env.GH_TOKEN) {
    throw new Error('GH_TOKEN is required in --from-release mode');
  }

  const resolvedTag =
    tag ||
    gh([
      'api',
      `repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      '--jq',
      '.tag_name',
    ]);
  const version = resolvedTag.replace(/^v/, '');

  const releaseJson = gh([
    'api',
    `repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${resolvedTag}`,
    '--jq',
    '{tag_name, body, assets: [.assets[] | {name, browser_download_url}]}',
  ]);
  const release = JSON.parse(releaseJson);
  const notes = release.body || `Release ${version}`;

  const platforms = {};
  const assets = release.assets;

  for (const asset of assets) {
    if (asset.name.endsWith('.sig')) continue;
    const platform = detectPlatform(asset.name);
    if (!platform) continue;

    const sigAsset = assets.find((a) => a.name === `${asset.name}.sig`);
    if (!sigAsset) {
      throw new Error(`Missing signature asset for ${asset.name}`);
    }
    const signature = await fetchSignature(sigAsset.browser_download_url);

    platforms[platform] = {
      signature,
      url: asset.browser_download_url,
    };
    console.log(`[ok] ${platform} <- ${asset.name}`);
  }

  if (Object.keys(platforms).length === 0) {
    throw new Error('No updater assets found on the release');
  }

  writeOutputs(version, notes, platforms);
}

async function main() {
  if (args.includes('--from-dir')) {
    const dir = argValue('--from-dir');
    const version = argValue('--version');
    const tag = argValue('--tag');
    const notes = argValue('--notes');
    if (!dir || !version || !tag) {
      throw new Error('--from-dir requires --dir/--version/--tag (--from-dir <dir>)');
    }
    buildFromDir(dir, version, tag, notes);
  } else if (args.includes('--from-release')) {
    await buildFromRelease(argValue('--tag'));
  } else {
    throw new Error('Usage: --from-dir <dir> --version <v> --tag <t> | --from-release [--tag <t>]');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
