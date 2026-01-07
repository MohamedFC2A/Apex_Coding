import { mutation } from "./_generated/server";

const DEFAULT_PROJECT_SLUG = 'default';
const DEFAULT_PROJECT_NAME = 'Nexus Apex Project';

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: any;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    try {
      clearTimeout(timer);
    } catch {
      // ignore
    }
  }
};

export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    return await withTimeout(
      (async () => {
        try {
          const existing = await ctx.db
            .query('projects')
            .withIndex('by_slug', (q) => q.eq('slug', DEFAULT_PROJECT_SLUG))
            .first();

          const projectId =
            existing?._id ??
            (await ctx.db.insert('projects', {
              slug: DEFAULT_PROJECT_SLUG,
              name: DEFAULT_PROJECT_NAME,
              createdAt: Date.now()
            }));

          const anyFile = await ctx.db
            .query('files')
            .withIndex('by_project', (q) => q.eq('projectId', projectId))
            .first();

          if (!anyFile) {
            const now = Date.now();
            const seed = [
              { path: 'src/components/.keep', content: '' },
              { path: 'src/hooks/.keep', content: '' },
              { path: 'src/services/.keep', content: '' },
              { path: 'convex/.keep', content: '' },
              {
                path: 'README.md',
                content: '# Nexus Apex\n\n© 2026 Nexus Apex | Built by Matany Labs.\n'
              }
            ];

            for (const file of seed) {
              await ctx.db.insert('files', {
                projectId,
                path: file.path,
                content: file.content,
                updatedAt: now
              });
            }
          }

          return { projectId, name: existing?.name ?? DEFAULT_PROJECT_NAME };
        } catch (e: any) {
          const message = e?.message ? `projects:ensureDefault failed: ${e.message}` : 'projects:ensureDefault failed';
          throw new Error(message);
        }
      })(),
      5_000,
      'projects:ensureDefault timed out'
    );
  }
});
