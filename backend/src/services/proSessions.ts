// Session management for PRO mode (DeepSeek)
// Stores reasoning_content for multi-turn conversations

interface SessionData {
  sessionId: string;
  reasoningContent: string;
  lastActivity: number;
  messages: any[];
}

class ProSessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  createSession(sessionId: string): SessionData {
    const session: SessionData = {
      sessionId,
      reasoningContent: '',
      lastActivity: Date.now(),
      messages: []
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  updateReasoningContent(sessionId: string, content: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.reasoningContent += content;
      session.lastActivity = Date.now();
    }
  }

  clearReasoningContent(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.reasoningContent = '';
      session.lastActivity = Date.now();
    }
  }

  addMessage(sessionId: string, message: any): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.messages.push(message);
      session.lastActivity = Date.now();
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // Cleanup old sessions
  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

export const proSessionManager = new ProSessionManager();

// Cleanup every 10 minutes
setInterval(() => {
  proSessionManager.cleanup();
}, 10 * 60 * 1000);
