#!/usr/bin/env node
/**
 * Mirrors release artifacts to a Gitee release through the Gitee OpenAPI.
 *
 * It only touches releases (never pushes code), so the README / LICENSE on the
 * Gitee repository remain managed by the maintainer.
 *
 * Usage:
 *   node scripts/gitee-release.mjs --tag <tag> --dir <dir> [--title <title>] [--notes <notes>]
 *
 * Required env:
 *   GITEE_ACCESS_TOKEN (personal token with `projects` scope)
 * Optional env:
 *   GITEE_OWNER, GITEE_REPO
 *
 * The release is deleted and recreated when it already exists so uploads are
 * idempotent (Gitee does not allow replacing attachments in place).
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
  return /\.(exe|msi|dmg|deb|rpm|AppImage|tar\.gz|sig)$/i.test(filePath);
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
  return releases.find((release) => release.tag_name === tag);
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
  const args = [
    '-sS',
    '-L',
    '--fail-with-body',
    '--retry',
    '3',
    '--retry-delay',
    '5',
    '--retry-all-errors',
    '--connect-timeout',
    '30',
    '--max-time',
    '1800',
    '-F',
    `access_token=${TOKEN}`,
    '-F',
    `name=${fileName}`,
    '-F',
    `file=@${filePath}`,
    `${GITEE_API}/repos/${OWNER}/${REPO}/releases/${releaseId}/attach_files`,
  ];

  try {
    execFileSync('curl', args, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Upload ${fileName} failed: ${error.message}`);
  }
  console.log(`[ok] uploaded ${fileName}`);
}

async function main() {
  const tag = argValue('--tag');
  const dir = argValue('--dir');
  const title = argValue('--title');
  const notes = argValue('--notes');

  if (!tag || !dir) {
    throw new Error('--tag and --dir are required');
  }
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const existing = await findRelease(tag);
  if (existing) {
    await deleteRelease(existing.id);
  }
  const release = await createRelease(tag, title, notes);

  const files = walkFiles(dir).filter(isReleaseFile).sort();
  if (files.length === 0) {
    throw new Error(`No release files to upload in ${dir}`);
  }
  const seen = new Set();
  for (const file of files) {
    const name = path.basename(file);
    if (seen.has(name)) continue;
    seen.add(name);
    await uploadAttachment(release.id, file);
  }

  console.log(`Gitee release ready: https://gitee.com/${OWNER}/${REPO}/releases/tag/${tag}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
