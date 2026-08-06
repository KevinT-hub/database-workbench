#!/usr/bin/env node
/**
 * Mirrors release artifacts to a Gitee release through the Gitee OpenAPI.
 *
 * It only touches releases (never pushes code), so the README / LICENSE on the
 * Gitee repository remain managed by the maintainer.
 *
 * Usage:
 *   node scripts/gitee-release.mjs --tag <tag> --dir <dir> [--title <title>] [--notes <notes>] [--replace] [--concurrency <n>]
 *
 * Required env:
 *   GITEE_ACCESS_TOKEN (personal token with `projects` scope)
 * Optional env:
 *   GITEE_OWNER, GITEE_REPO
 *
 * By default an existing release is kept and only missing attachments are
 * uploaded (fast re-runs). Pass --replace (used for the update channel) to
 * delete and recreate the release so the latest.json can be replaced.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

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

function isReleaseFile(filePath) {
  return /\.(exe|msi|dmg|deb|rpm|AppImage|tar\.gz|sig|json)$/i.test(filePath);
}

const GITEE_API = 'https://gitee.com/api/v5';
const TOKEN = process.env.GITEE_ACCESS_TOKEN;
const OWNER = process.env.GITEE_OWNER || 'kevint-hub';
const REPO = process.env.GITEE_REPO || 'database-workbench';

if (!TOKEN) {
  console.error('GITEE_ACCESS_TOKEN is required');
  process.exit(1);
}

async function request(pathname, options = {}) {
  const url = `${GITEE_API}${pathname}`;
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`Gitee API ${response.status} ${pathname}: ${String(text).slice(0, 300)}`);
  }
  return data;
}

async function deleteRelease(releaseId) {
  await request(
    `/repos/${OWNER}/${REPO}/releases/${releaseId}?access_token=${encodeURIComponent(TOKEN)}`,
    { method: 'DELETE' },
  );
  console.log(`Deleted existing release ${releaseId}`);
}

async function findRelease(tag) {
  const releases =
    (await request(
      `/repos/${OWNER}/${REPO}/releases?access_token=${encodeURIComponent(TOKEN)}&per_page=100&page=1`,
    )) || [];
  return releases.find((release) => release.tag_name === tag) || null;
}

async function listAttachmentNames(releaseId) {
  try {
    const attachments = await request(
      `/repos/${OWNER}/${REPO}/releases/${releaseId}/attach_files?access_token=${encodeURIComponent(TOKEN)}&per_page=100`,
    );
    return new Set((attachments || []).map((attachment) => attachment.name));
  } catch (error) {
    console.warn(`[warn] could not list existing attachments: ${error.message}`);
    return new Set();
  }
}

async function getDefaultBranch() {
  const repo = await request(
    `/repos/${OWNER}/${REPO}?access_token=${encodeURIComponent(TOKEN)}`,
  );
  return repo.default_branch || 'master';
}

async function createRelease(tag, title, notes) {
  const form = new URLSearchParams();
  form.set('access_token', TOKEN);
  form.set('tag_name', tag);
  form.set('name', title || tag);
  form.set('body', notes || '');
  form.set('prerelease', 'false');
  // Gitee requires a branch/commit to create the tag from when the tag does
  // not exist on the repository yet (we never push code to Gitee).
  form.set('target_commitish', await getDefaultBranch());

  const release = await request(`/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  console.log(`Created Gitee release ${tag} (id=${release.id})`);
  return release;
}

async function uploadAttachment(releaseId, filePath) {
  const fileName = path.basename(filePath);
  const size = fs.statSync(filePath).size;
  console.log(`Uploading ${fileName} (${size} bytes)...`);

  // curl handles large multipart uploads more reliably than fetch and
  // supports retries/timeouts for the often-slow Gitee endpoints.
  const curlArgs = [
    '-sS',
    '-L',
    '--fail-with-body',
    '--retry',
    '5',
    '--retry-delay',
    '10',
    '--retry-all-errors',
    '--connect-timeout',
    '30',
    '--max-time',
    '1200',
    '--form-string',
    `access_token=${TOKEN}`,
    '-F',
    `name=${fileName}`,
    '-F',
    `file=@${filePath}`,
    `${GITEE_API}/repos/${OWNER}/${REPO}/releases/${releaseId}/attach_files`,
  ];

  try {
    execFileSync('curl', curlArgs, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Upload ${fileName} failed: ${error.message}`);
  }
  console.log(`[ok] uploaded ${fileName}`);
}

async function uploadAll(releaseId, files, concurrency) {
  // Upload in parallel: Gitee is often slow from GitHub-hosted runners and
  // per-connection throughput is the bottleneck.
  let index = 0;
  const worker = async () => {
    while (index < files.length) {
      const file = files[index++];
      await uploadAttachment(releaseId, file);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker()),
  );
}

async function main() {
  const tag = argValue('--tag');
  const dir = argValue('--dir');
  const title = argValue('--title');
  const notes = argValue('--notes');
  const replace = args.includes('--replace');
  const concurrency = Number(argValue('--concurrency') || 3);

  if (!tag || !dir) {
    throw new Error('--tag and --dir are required');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error('--concurrency must be an integer between 1 and 8');
  }
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const existing = await findRelease(tag);
  let release;
  if (existing) {
    if (replace) {
      await deleteRelease(existing.id);
      release = await createRelease(tag, title, notes);
    } else {
      release = existing;
      console.log(`Using existing Gitee release ${tag} (id=${existing.id})`);
    }
  } else {
    release = await createRelease(tag, title, notes);
  }

  const files = walkFiles(dir).filter(isReleaseFile).sort();
  if (files.length === 0) {
    throw new Error(`No release files to upload in ${dir}`);
  }

  const existingNames = replace ? new Set() : await listAttachmentNames(release.id);
  const seen = new Set();
  const uniqueFiles = [];
  for (const file of files) {
    const name = path.basename(file);
    if (seen.has(name)) continue;
    seen.add(name);
    if (existingNames.has(name)) {
      console.log(`[skip] ${name} already exists on Gitee`);
      continue;
    }
    uniqueFiles.push(file);
  }

  if (uniqueFiles.length > 0) {
    await uploadAll(release.id, uniqueFiles, concurrency);
  } else {
    console.log('No missing attachments to upload.');
  }

  console.log(`Gitee release ready: https://gitee.com/${OWNER}/${REPO}/releases/tag/${tag}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
