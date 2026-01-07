import { mutation } from 'convex/server';

const DEFAULT_PROJECT_NAME = 'Nexus Apex Project';

export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('projects').filter((q) => q.eq(q.field('name'), DEFAULT_PROJECT_NAME)).first();

    const projectId =
      existing?._id ??
      (await ctx.db.insert('projects', {
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
          content:
            '# Nexus Apex\\n\\n© 2026 Nexus Apex | Built by Matany Labs.\\n'
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

    return { projectId, name: DEFAULT_PROJECT_NAME };
  }
});
