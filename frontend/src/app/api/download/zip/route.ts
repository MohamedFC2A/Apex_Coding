export const runtime = 'edge';

interface FileData {
  path?: string;
  name: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const files: FileData[] = body.files || [];

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Import JSZip dynamically
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Add files to zip
    files.forEach((file) => {
      const filePath = file.path || file.name;
      zip.file(filePath, file.content || '');
    });

    // Generate zip file
    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });

    return new Response(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="project.zip"',
      },
    });
  } catch (error: any) {
    console.error('ZIP generation error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate ZIP' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
