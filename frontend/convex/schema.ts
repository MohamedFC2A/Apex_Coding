import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    createdAt: v.number()
  }),

  files: defineTable({
    projectId: v.id('projects'),
    path: v.string(),
    content: v.string(),
    updatedAt: v.number()
  })
    .index('by_project_path', ['projectId', 'path'])
    .index('by_project', ['projectId'])
});

