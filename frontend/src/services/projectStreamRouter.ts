export type ProjectStreamFileStatus = 'queued' | 'writing' | 'ready';

export interface ProjectStreamRouterHandlers {
  onFileDiscovered?: (path: string) => void;
  onFileStatus?: (path: string, status: ProjectStreamFileStatus) => void;
  onFileChunk?: (path: string, chunk: string) => void;
  onFileComplete?: (path: string) => void;
}

const safeDecodeJSONString = (raw: string) => {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
};

class JSONStringDecoder {
  private escaping = false;
  private unicodeMode = false;
  private unicodeBuffer = '';

  write(input: string) {
    let out = '';
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (this.unicodeMode) {
        this.unicodeBuffer += ch;
        if (this.unicodeBuffer.length === 4) {
          const code = Number.parseInt(this.unicodeBuffer, 16);
          out += Number.isFinite(code) ? String.fromCharCode(code) : `\\u${this.unicodeBuffer}`;
          this.unicodeMode = false;
          this.unicodeBuffer = '';
        }
        continue;
      }

      if (this.escaping) {
        this.escaping = false;
        switch (ch) {
          case '"':
            out += '"';
            break;
          case '\\':
            out += '\\';
            break;
          case '/':
            out += '/';
            break;
          case 'n':
            out += '\n';
            break;
          case 'r':
            out += '\r';
            break;
          case 't':
            out += '\t';
            break;
          case 'b':
            out += '\b';
            break;
          case 'f':
            out += '\f';
            break;
          case 'u':
            this.unicodeMode = true;
            this.unicodeBuffer = '';
            break;
          default:
            out += ch;
            break;
        }
        continue;
      }

      if (ch === '\\') {
        this.escaping = true;
        continue;
      }

      out += ch;
    }
    return out;
  }

  reset() {
    this.escaping = false;
    this.unicodeMode = false;
    this.unicodeBuffer = '';
  }
}

/**
 * Streams DeepSeek JSON output into per-file chunks in real time.
 *
 * We parse the JSON text stream and detect `project_files[*].name` + `project_files[*].content`,
 * decoding JSON string escapes on the fly.
 */
export const createProjectJSONStreamRouter = (handlers: ProjectStreamRouterHandlers = {}) => {
  const stack: Array<'object' | 'array'> = [];

  let expectingKey = false;
  let expectingValue = false;
  let currentKey: string | null = null;

  let inString = false;
  let stringEscape = false;
  let stringBuffer = '';
  let stringIsKey = false;

  let inProjectFiles = false;
  let projectFilesDepth = -1;

  let currentFilePath: string | null = null;
  let isStreamingContent = false;
  const contentDecoder = new JSONStringDecoder();

  const setStatus = (path: string, status: ProjectStreamFileStatus) => {
    handlers.onFileStatus?.(path, status);
  };

  const onFileDiscovered = (path: string) => {
    handlers.onFileDiscovered?.(path);
    setStatus(path, 'queued');
  };

  const startWriting = (path: string) => {
    setStatus(path, 'writing');
  };

  const finishWriting = (path: string) => {
    setStatus(path, 'ready');
    handlers.onFileComplete?.(path);
  };

  const resetStringState = () => {
    inString = false;
    stringEscape = false;
    stringBuffer = '';
    stringIsKey = false;
  };

  const resetAll = () => {
    stack.length = 0;
    expectingKey = false;
    expectingValue = false;
    currentKey = null;
    resetStringState();
    inProjectFiles = false;
    projectFilesDepth = -1;
    currentFilePath = null;
    isStreamingContent = false;
    contentDecoder.reset();
  };

  const handleStringEnd = () => {
    const decoded = safeDecodeJSONString(stringBuffer);

    if (stringIsKey) {
      currentKey = decoded;
      expectingKey = false;
      expectingValue = false;
      resetStringState();
      return;
    }

    // String value
    if (inProjectFiles && (currentKey === 'name' || currentKey === 'path')) {
      currentFilePath = decoded;
      if (currentFilePath) onFileDiscovered(currentFilePath);
    }

    resetStringState();
    expectingValue = false;
  };

  const pushChar = (ch: string) => {
    // Handle string parsing first
    if (inString) {
      if (!stringEscape && ch === '"') {
        // String ends
        if (isStreamingContent && currentFilePath) {
          isStreamingContent = false;
          finishWriting(currentFilePath);
          contentDecoder.reset();
        }
        handleStringEnd();
        return;
      }

      // Inside string
      if (ch === '\\' && !stringEscape) {
        stringEscape = true;
      } else {
        stringEscape = false;
      }

      stringBuffer += ch;

      if (isStreamingContent && currentFilePath) {
        const decodedChunk = contentDecoder.write(ch);
        if (decodedChunk.length > 0) handlers.onFileChunk?.(currentFilePath, decodedChunk);
      }

      return;
    }

    // Ignore whitespace outside strings
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') return;

    if (ch === '{') {
      stack.push('object');
      expectingKey = true;
      currentKey = null;
      return;
    }

    if (ch === '}') {
      if (stack.pop() === 'object') {
        expectingKey = false;
        expectingValue = false;
        currentKey = null;
      }
      if (inProjectFiles && stack.length < projectFilesDepth) {
        inProjectFiles = false;
        projectFilesDepth = -1;
        currentFilePath = null;
      }
      return;
    }

    if (ch === '[') {
      stack.push('array');
      expectingValue = true;

      if (currentKey === 'project_files') {
        inProjectFiles = true;
        projectFilesDepth = stack.length;
      }
      return;
    }

    if (ch === ']') {
      if (stack.pop() === 'array') {
        expectingValue = false;
      }
      if (inProjectFiles && stack.length < projectFilesDepth) {
        inProjectFiles = false;
        projectFilesDepth = -1;
        currentFilePath = null;
      }
      return;
    }

    if (ch === ':') {
      expectingValue = true;
      return;
    }

    if (ch === ',') {
      const top = stack[stack.length - 1];
      if (top === 'object') expectingKey = true;
      if (top === 'array') expectingValue = true;
      currentKey = top === 'object' ? null : currentKey;
      return;
    }

    if (ch === '"') {
      const top = stack[stack.length - 1];
      const inObject = top === 'object';
      stringIsKey = Boolean(inObject && expectingKey);
      inString = true;
      stringEscape = false;
      stringBuffer = '';

      if (!stringIsKey && expectingValue && inProjectFiles && currentKey === 'content' && currentFilePath) {
        // Streaming content for the current file.
        isStreamingContent = true;
        contentDecoder.reset();
        startWriting(currentFilePath);
      }
      return;
    }

    // Non-string tokens: ignore, but keep minimal structure state.
    if (expectingValue) {
      expectingValue = false;
    }
  };

  return {
    reset: resetAll,
    push: (chunk: string) => {
      for (let i = 0; i < chunk.length; i++) pushChar(chunk[i]);
    }
  };
};

