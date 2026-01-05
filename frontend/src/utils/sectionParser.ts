export interface ParsedSections {
  interpretation?: string;
  trace?: string;
  structure?: string;
  code?: string;
  preview?: string;
  download?: string;
  jsonPayload?: any;
}

export function parseSections(text: string): ParsedSections {
  const sections: ParsedSections = {};

  // Extract sections using regex
  const interpretationMatch = text.match(/\[REQUEST INTERPRETATION\]([\s\S]*?)(?=\[|$)/);
  if (interpretationMatch) {
    sections.interpretation = interpretationMatch[1].trim();
  }

  const traceMatch = text.match(/\[AI DECISION TRACE\]([\s\S]*?)(?=\[|$)/);
  if (traceMatch) {
    sections.trace = traceMatch[1].trim();
  }

  const structureMatch = text.match(/\[PROJECT STRUCTURE\]([\s\S]*?)(?=\[|$)/);
  if (structureMatch) {
    sections.structure = structureMatch[1].trim();
  }

  const codeMatch = text.match(/\[FULL SOURCE CODE\]([\s\S]*?)(?=\[|$)/);
  if (codeMatch) {
    sections.code = codeMatch[1].trim();
  }

  const previewMatch = text.match(/\[LIVE PREVIEW BEHAVIOR\]([\s\S]*?)(?=\[|$)/);
  if (previewMatch) {
    sections.preview = previewMatch[1].trim();
  }

  const downloadMatch = text.match(/\[DOWNLOAD INSTRUCTIONS\]([\s\S]*?)(?=```json|$)/);
  if (downloadMatch) {
    sections.download = downloadMatch[1].trim();
  }

  // Extract JSON payload
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      sections.jsonPayload = JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error('Failed to parse JSON payload:', e);
    }
  }

  return sections;
}
