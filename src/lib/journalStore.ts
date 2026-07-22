// Reads/writes src/content/journal/<slug>.json through Netlify git-gateway
// (the same backend Decap uses). Writes commit to main; GH Pages rebuilds.
// Only ever touches journal JSON — recipe markdown is off limits by design.

import { accessToken } from './identity';
import type { JournalEntry } from '../components/RecipePageIsland';

const ORIGIN: string | null = import.meta.env.PUBLIC_ANNOTATE_ORIGIN ?? null;
const gateway = () => `${ORIGIN}/.netlify/git/github`;
const filePath = (slug: string) => `src/content/journal/${slug}.json`;

const b64encode = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64decode = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

/** Append one entry and commit. Throws on auth/network/conflict errors. */
export async function commitNote(slug: string, entry: JournalEntry): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error('not logged in');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const getRes = await fetch(`${gateway()}/contents/${filePath(slug)}?ref=main`, { headers });
  let sha: string | undefined;
  let doc: { slug: string; entries: JournalEntry[] } = { slug, entries: [] };
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
    doc = JSON.parse(b64decode(data.content));
  } else if (getRes.status !== 404) {
    throw new Error(`read failed: ${getRes.status}`);
  }

  doc.entries = [...doc.entries, entry];
  const putRes = await fetch(`${gateway()}/contents/${filePath(slug)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `journal: note on ${slug}`,
      branch: 'main',
      content: b64encode(JSON.stringify(doc, null, 2) + '\n'),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!putRes.ok) throw new Error(`write failed: ${putRes.status}`);
}
