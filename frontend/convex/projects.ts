import { mutation } from './_generated/server'; // تم تصحيح import لتكون بحرف صغير

const DEFAULT_PROJECT_SLUG = 'default';
const DEFAULT_PROJECT_NAME = 'Nexus Apex Project';

export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. البحث عن المشروع باستخدام الـ Index 'by_slug'
    let project = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', DEFAULT_PROJECT_SLUG))
      .first();

    let projectId;

    if (!project) {
      // 2. إنشاء المشروع في حالة عدم وجوده
      projectId = await ctx.db.insert('projects', {
        slug: DEFAULT_PROJECT_SLUG,
        name: DEFAULT_PROJECT_NAME,
        createdAt: Date.now(),
      });
    } else {
      projectId = project._id;
    }

    // 3. التحقق من وجود ملفات باستخدام الـ Index 'by_project'
    const anyFile = await ctx.db
      .query('files')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .first();

    // 4. إنشاء ملف README كملف أساسي لتجنب الـ Timeout
    if (!anyFile) {
      await ctx.db.insert('files', {
        projectId,
        path: 'README.md',
        content: '# Nexus Apex\n\n© 2026 Nexus Apex | Built by Matany Labs.\n',
        updatedAt: Date.now(),
      });
    }

    return { projectId, name: DEFAULT_PROJECT_NAME };
  },
});
