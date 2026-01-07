import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  projects: defineTable({
    slug: v.string(),
    name: v.string(),
    createdAt: v.number()
  }).index('by_slug', ['slug']),

  files: defineTable({
    projectId: v.id('projects'),
    path: v.string(),
    content: v.string(),
    updatedAt: v.number()
  })
    .index('by_project_path', ['projectId', 'path'])
    .index('by_project', ['projectId'])
});
