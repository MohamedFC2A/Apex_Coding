import { fileSystemAI } from './fileSystemAI';
import { useProjectStore } from '@/stores/projectStore';

// Smart Template System with AI-Powered Generation
export class SmartTemplates {
  private static instance: SmartTemplates;
  private templates = new Map<string, any>();
  private customTemplates = new Map<string, any>();

  static getInstance(): SmartTemplates {
    if (!SmartTemplates.instance) {
      SmartTemplates.instance = new SmartTemplates();
      SmartTemplates.instance.initializeTemplates();
    }
    return SmartTemplates.instance;
  }

  private initializeTemplates() {
    // Component Templates
    this.templates.set('react-component', {
      name: 'React Component',
      description: 'A modern React component with TypeScript',
      category: 'components',
      files: [
        {
          path: 'src/components/{{componentName}}.tsx',
          content: `import React from 'react';
import { cn } from '@/utils/cn';

interface {{componentName}}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{componentName}}: React.FC<{{componentName}}Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'base-class',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default {{componentName}};`
        },
        {
          path: 'src/components/{{componentName}}.test.tsx',
          content: `import { render, screen } from '@testing-library/react';
import { {{componentName}} } from './{{componentName}}';

describe('{{componentName}}', () => {
  it('renders correctly', () => {
    render(<{{componentName}} />);
    expect(screen.getByRole('div')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<{{componentName}} className="custom-class" />);
    const element = screen.getByRole('div');
    expect(element).toHaveClass('custom-class');
  });
});`
        },
        {
          path: 'src/components/{{componentName}}.stories.tsx',
          content: `import type { Meta, StoryObj } from '@storybook/react';
import { {{componentName}} } from './{{componentName}}';

const meta: Meta<typeof {{componentName}}> = {
  title: 'Components/{{componentName}}',
  component: {{componentName}},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Hello World',
  },
};`
        }
      ]
    });

    // Page Template
    this.templates.set('next-page', {
      name: 'Next.js Page',
      description: 'A Next.js page with metadata and SEO',
      category: 'pages',
      files: [
        {
          path: 'src/app/{{pageName}}/page.tsx',
          content: `import { Metadata } from 'next';
import { {{pageName}} } from './{{pageName}}';

export const metadata: Metadata = {
  title: '{{pageTitle}}',
  description: '{{pageDescription}}',
  keywords: ['{{keywords}}'],
};

export default function Home() {
  return <{{pageName}} />;
}`
        },
        {
          path: 'src/app/{{pageName}}/{{pageName}}.tsx',
          content: `'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface {{pageName}}Props {
  className?: string;
}

export const {{pageName}}: React.FC<{{pageName}}Props> = ({
  className
}) => {
  return (
    <main className={cn('container mx-auto px-4', className)}>
      <h1 className="text-4xl font-bold mb-8">{{pageTitle}}</h1>
      <section className="prose max-w-none">
        <p>{{pageDescription}}</p>
      </section>
    </main>
  );
};

export default {{pageName}};`
        }
      ]
    });

    // API Route Template
    this.templates.set('api-route', {
      name: 'API Route',
      description: 'A Next.js API route with error handling',
      category: 'api',
      files: [
        {
          path: 'src/app/api/{{routeName}}/route.ts',
          content: `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  // Define your schema here
  data: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    // Handle GET request
    const data = await fetchData();
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error in GET /api/{{routeName}}:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    // Handle POST request
    const result = await createData(validatedData);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error in POST /api/{{routeName}}:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
async function fetchData() {
  // Implement your data fetching logic
  return {};
}

async function createData(data: any) {
  // Implement your data creation logic
  return data;
}`
        }
      ]
    });

    // Hook Template
    this.templates.set('react-hook', {
      name: 'Custom Hook',
      description: 'A reusable React hook with TypeScript',
      category: 'hooks',
      files: [
        {
          path: 'src/hooks/use{{hookName}}.ts',
          content: `import { useState, useEffect, useCallback } from 'react';

interface Use{{hookName}}Options {
  // Define options here
}

interface Use{{hookName}}Return {
  // Define return type here
  value: any;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const use{{hookName}} = (options?: Use{{hookName}}Options): Use{{hookName}}Return => {
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Implement your fetch logic here
      const result = await yourAsyncFunction();
      setValue(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    value,
    loading,
    error,
    refetch: fetchData,
  };
};

// Helper function
async function yourAsyncFunction() {
  // Implement your async function
  return {};
}`
        },
        {
          path: 'src/hooks/use{{hookName}}.test.ts',
          content: `import { renderHook, waitFor } from '@testing-library/react';
import { use{{hookName}} } from './use{{hookName}}';

describe('use{{hookName}}', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => use{{hookName}}());
    
    expect(result.current.value).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch data successfully', async () => {
    const { result } = renderHook(() => use{{hookName}}());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});`
        }
      ]
    });

    // Service Template
    this.templates.set('api-service', {
      name: 'API Service',
      description: 'A service class for API interactions',
      category: 'services',
      files: [
        {
          path: 'src/services/{{serviceName}}Service.ts',
          content: `import { z } from 'zod';

// Types
export interface {{serviceName}}Data {
  id: string;
  // Define your data structure
}

export interface Create{{serviceName}}Data {
  // Define creation data structure
}

export interface Update{{serviceName}}Data {
  // Define update data structure
}

// Schemas
const {{serviceName}}Schema = z.object({
  id: z.string(),
  // Define validation schema
});

// Service Class
export class {{serviceName}}Service {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getAll(): Promise<{{serviceName}}Data[]> {
    const response = await fetch(\`\${this.baseUrl}/{{serviceName.toLowerCase()}\`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(\`Failed to fetch {{serviceName}}: \${response.statusText}\`);
    }

    const data = await response.json();
    return z.array({{serviceName}}Schema).parse(data);
  }

  async getById(id: string): Promise<{{serviceName}}Data> {
    const response = await fetch(\`\${this.baseUrl}/{{serviceName.toLowerCase()}/\${id}\`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(\`Failed to fetch {{serviceName}}: \${response.statusText}\`);
    }

    const data = await response.json();
    return {{serviceName}}Schema.parse(data);
  }

  async create(data: Create{{serviceName}}Data): Promise<{{serviceName}}Data> {
    const response = await fetch(\`\${this.baseUrl}/{{serviceName.toLowerCase()}\`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(\`Failed to create {{serviceName}}: \${response.statusText}\`);
    }

    const result = await response.json();
    return {{serviceName}}Schema.parse(result);
  }

  async update(id: string, data: Update{{serviceName}}Data): Promise<{{serviceName}}Data> {
    const response = await fetch(\`\${this.baseUrl}/{{serviceName.toLowerCase()}/\${id}\`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(\`Failed to update {{serviceName}}: \${response.statusText}\`);
    }

    const result = await response.json();
    return {{serviceName}}Schema.parse(result);
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(\`\${this.baseUrl}/{{serviceName.toLowerCase()}/\${id}\`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(\`Failed to delete {{serviceName}}: \${response.statusText}\`);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = \`Bearer \${this.apiKey}\`;
    }

    return headers;
  }
}

// Singleton instance
export const {{serviceNameLower}}Service = new {{serviceName}}Service(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  process.env.NEXT_PUBLIC_API_KEY
);`
        }
      ]
    });

    // Utility Template
    this.templates.set('utility', {
      name: 'Utility Function',
      description: 'A reusable utility function',
      category: 'utils',
      files: [
        {
          path: 'src/utils/{{utilityName}}.ts',
          content: `/**
 * {{utilityDescription}}
 * 
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Description of return value
 * 
 * @example
 * \`\`\`typescript
 * const result = {{utilityName}}('value', 123);
 * console.log(result);
 * \`\`\`
 */
export function {{utilityName}}<T>(
  param1: string,
  param2: number
): T {
  // Implement your utility function here
  
  // Add validation
  if (!param1) {
    throw new Error('param1 is required');
  }
  
  if (param2 < 0) {
    throw new Error('param2 must be positive');
  }
  
  // Your logic here
  return {} as T;
}

/**
 * Alternative version with different signature
 */
export function {{utilityName}}Async(
  param1: string,
  param2: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const result = {{utilityName}}(param1, param2);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// Type definitions
export type {{utilityName}}Options = {
  // Define options type
};

// Constants
export const {{utilityNameUpper}}_DEFAULT = 'default';
export const {{utilityNameUpper}}_MAX = 100;`
        },
        {
          path: 'src/utils/{{utilityName}}.test.ts',
          content: `import { {{utilityName}}, {{utilityName}}Async } from './{{utilityName}}';

describe('{{utilityName}}', () => {
  it('should work with valid inputs', () => {
    const result = {{utilityName}}('test', 10);
    expect(result).toBeDefined();
  });

  it('should throw error with invalid param1', () => {
    expect(() => {{utilityName}}('', 10)).toThrow('param1 is required');
  });

  it('should throw error with negative param2', () => {
    expect(() => {{utilityName}}('test', -1)).toThrow('param2 must be positive');
  });

  it('should work asynchronously', async () => {
    const result = await {{utilityName}}Async('test', 10);
    expect(result).toBeDefined();
  });
});`
        }
      ]
    });
  }

  // Get all available templates
  getTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }> {
    return Array.from(this.templates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description,
      category: template.category,
    }));
  }

  // Get templates by category
  getTemplatesByCategory(category: string): any[] {
    return Array.from(this.templates.entries())
      .filter(([_, template]) => template.category === category)
      .map(([id, template]) => ({ id, ...template }));
  }

  // Generate files from template
  async generateFiles(
    templateId: string,
    variables: Record<string, string>
  ): Promise<Array<{ path: string; content: string }>> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const existingPaths = useProjectStore.getState().files.map((file) => file.path || file.name).filter(Boolean);

    return template.files.map((file: any) => {
      const rawPath = this.replaceVariables(file.path, variables);
      const inferredType = this.inferCanonicalType(rawPath);
      const mode = this.inferCanonicalMode(rawPath);
      const decision = fileSystemAI.generateCanonicalPath({
        goal: this.deriveGoal(rawPath, variables),
        fileType: inferredType,
        route: variables.pageName || variables.routeName || variables.route || '',
        mode,
        existingPaths
      });

      return {
        path: decision.action === 'create' ? rawPath : decision.path,
        content: this.replaceVariables(file.content, variables),
      };
    });
  }

  // Create custom template
  createCustomTemplate(
    id: string,
    template: {
      name: string;
      description: string;
      category: string;
      files: Array<{ path: string; content: string }>;
    }
  ) {
    this.customTemplates.set(id, template);
  }

  // Get structure for project type
  async getStructure(type: 'component' | 'page' | 'api' | 'hook'): Promise<any> {
    const structureMap = {
      component: {
        folders: ['src/components', 'src/components/ui', 'src/components/features'],
        templates: ['react-component'],
      },
      page: {
        folders: ['src/app/[pageName]', 'src/components/pages'],
        templates: ['next-page'],
      },
      api: {
        folders: ['src/app/api/[endpoint]', 'src/services', 'src/types/api'],
        templates: ['api-route', 'api-service'],
      },
      hook: {
        folders: ['src/hooks'],
        templates: ['react-hook'],
      },
    };

    return structureMap[type];
  }

  // AI-powered template suggestion
  async suggestTemplate(description: string): Promise<string[]> {
    // Simple keyword matching (in real app, use AI)
    const keywords = description.toLowerCase().split(' ');
    const suggestions: string[] = [];

    if (keywords.includes('component') || keywords.includes('ui')) {
      suggestions.push('react-component');
    }
    if (keywords.includes('page') || keywords.includes('route')) {
      suggestions.push('next-page');
    }
    if (keywords.includes('api') || keywords.includes('service')) {
      suggestions.push('api-service', 'api-route');
    }
    if (keywords.includes('hook') || keywords.includes('state')) {
      suggestions.push('react-hook');
    }
    if (keywords.includes('utility') || keywords.includes('helper')) {
      suggestions.push('utility');
    }

    return suggestions;
  }

  // Replace variables in template content
  private replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });

    // Handle special cases
    result = result.replace(/{{(\w+)Upper}}/g, (_, match) => variables[match]?.toUpperCase() || '');
    result = result.replace(/{{(\w+)Lower}}/g, (_, match) => variables[match]?.toLowerCase() || '');
    result = result.replace(/{{(\w+)Pascal}}/g, (_, match) => 
      variables[match]?.charAt(0).toUpperCase() + variables[match]?.slice(1) || ''
    );
    result = result.replace(/{{(\w+)Camel}}/g, (_, match) => 
      variables[match]?.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      ).replace(/\s+/g, '') || ''
    );

    return result;
  }

  private inferCanonicalType(path: string): 'page' | 'style' | 'script' | 'component' | 'asset' | 'data' | 'utility' {
    const lower = String(path || '').toLowerCase();
    if (lower.endsWith('.html') || /\/pages?\//.test(lower)) return 'page';
    if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass')) return 'style';
    if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
      if (/components?\//.test(lower)) return 'component';
      return 'script';
    }
    if (lower.endsWith('.json')) return 'data';
    if (/assets?\//.test(lower)) return 'asset';
    return 'utility';
  }

  private inferCanonicalMode(path: string): 'static_frontend' | 'framework' {
    const lower = String(path || '').toLowerCase();
    if (lower.startsWith('src/') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) return 'framework';
    return 'static_frontend';
  }

  private deriveGoal(path: string, variables: Record<string, string>): string {
    return (
      variables.componentName ||
      variables.pageName ||
      variables.routeName ||
      variables.utilityName ||
      String(path || '').split('/').pop()?.split('.')[0] ||
      'file'
    );
  }
}

export const smartTemplates = SmartTemplates.getInstance();
