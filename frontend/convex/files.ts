import { mutation, query } from 'convex/server';
import { v } from 'convex/values';

export const list = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('files')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    return rows
      .map((row) => ({ path: row.path, content: row.content, updatedAt: row.updatedAt }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
});

export const upsert = mutation({
  args: {
    projectId: v.id('projects'),
    path: v.string(),
    content: v.string()
  },
  handler: async (ctx, args) => {
    const path = args.path.trim();
    const existing = await ctx.db
      .query('files')
      .withIndex('by_project_path', (q) => q.eq('projectId', args.projectId).eq('path', path))
      .first();

    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content, updatedAt });
      return { ok: true, updatedAt };
    }

    await ctx.db.insert('files', { projectId: args.projectId, path, content: args.content, updatedAt });
    return { ok: true, updatedAt };
  }
});

