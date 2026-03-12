import express, { Request, Response } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { KnowledgeService } from './knowledge-service.js';
import { CopilotService } from './copilot-service.js';
import { createAuthRouter } from './auth-routes.js';
import { requireAuth } from './auth-middleware.js';
import { closeDb } from './db.js';

// Use process.cwd() so the file works in both ESM (production) and CommonJS (ts-jest)
const projectRoot = process.cwd();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (Apache terminates SSL on Bitnami)
app.set('trust proxy', 1);

// Initialize Copilot service
const copilotService = new CopilotService();

// Initialize knowledge service with Copilot service for enhanced semantic search
const knowledgeService = new KnowledgeService(
  path.join(projectRoot, 'data'),
  copilotService
);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Auth routes (login, logout, status) — must be before static/protected routes
app.use(createAuthRouter());

// Serve login page without auth
app.get('/login.html', (_req: Request, res: Response) => {
  res.sendFile(path.join(projectRoot, 'public/login.html'));
});

// Protect the main chat page — redirect to login if not authenticated
app.get('/', (req: Request, res: Response) => {
  const token = req.cookies?.garbot_session as string | undefined;
  if (!token) {
    res.redirect('/login.html');
    return;
  }
  // Let the frontend verify with /api/auth/status for a smoother UX;
  // this server-side check catches the obvious no-cookie case.
  res.sendFile(path.join(projectRoot, 'public/index.html'));
});

// Serve static assets (CSS, JS, images) without auth
app.use(express.static(path.join(projectRoot, 'public'), {
  index: false, // Don't auto-serve index.html — we handle '/' above
}));

/**
 * Interface for chat message
 */
interface ChatMessage {
  message: string;
}

/**
 * Interface for chat response
 */
interface ChatResponse {
  response: string;
}

/**
 * Initialize Copilot service on startup
 */
copilotService.initialize().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Warning: Copilot service failed to initialize:', error);
  // eslint-disable-next-line no-console
  console.log('Server will continue with fallback responses');
});

/**
 * POST endpoint to handle chat messages with streaming support
 * Pre-answer step: Search knowledge base for relevant context
 * Uses GitHub Copilot SDK to generate AI responses
 * @param req - Express request with chat message
 * @param res - Express response with AI response (streaming or complete)
 */
app.post('/api/chat', requireAuth, async (req: Request<object, ChatResponse, ChatMessage>, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ response: 'Invalid message format' });
    return;
  }

  try {
    // Pre-answer step: Search knowledge base for relevant documents using Copilot-enhanced search
    // This provides better semantic relevance than simple keyword matching
    const relevantDocs = await knowledgeService.searchWithCopilot(message);

    // Build context from knowledge base to enhance AI response
    const context = relevantDocs.length > 0
      ? relevantDocs.map(doc => `${doc.title}: ${doc.snippet}`).join('\n\n')
      : undefined;

    // Use GitHub Copilot SDK to generate response
    try {
      const aiResponse = await copilotService.getResponse(message, context);
      res.json({ response: aiResponse });
    } catch (copilotError) {
      // Fallback to informative error message if Copilot fails
      // eslint-disable-next-line no-console
      console.error('Copilot SDK error:', copilotError);

      const fallbackResponse = context
        ? `I found relevant information in the knowledge base:\n\n${context.substring(0, 300)}...\n\nHowever, the AI service is currently unavailable. Please ensure GitHub Copilot is properly configured.`
        : 'The AI service is currently unavailable. Please ensure GitHub Copilot is properly configured.';

      res.json({ response: fallbackResponse });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error processing chat message:', error);
    res.status(500).json({ response: 'An error occurred processing your request' });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/**
 * POST endpoint to handle chat messages with server-sent events (SSE) streaming
 * This endpoint streams the AI response back in real-time
 * @param req - Express request with chat message
 * @param res - Express response with streaming AI response
 */
app.post('/api/chat/stream', requireAuth, async (req: Request<object, unknown, ChatMessage>, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Invalid message format' });
    return;
  }

  // Set headers for server-sent events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Pre-answer step: Search knowledge base for relevant documents using Copilot-enhanced search
    // This provides better semantic relevance than simple keyword matching
    const relevantDocs = await knowledgeService.searchWithCopilot(message);

    // Build context from knowledge base to enhance AI response
    const context = relevantDocs.length > 0
      ? relevantDocs.map(doc => `${doc.title}: ${doc.snippet}`).join('\n\n')
      : undefined;

    // Stream response from Copilot
    try {
      await copilotService.streamResponse(message, context, (chunk: string) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (copilotError) {
      // eslint-disable-next-line no-console
      console.error('Copilot streaming error:', copilotError);

      const fallbackMessage = context
        ? `I found relevant information in the knowledge base:\n\n${context.substring(0, 300)}...\n\nHowever, the AI service is currently unavailable.`
        : 'The AI service is currently unavailable. Please ensure GitHub Copilot is properly configured.';

      res.write(`data: ${JSON.stringify({ chunk: fallbackMessage })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error processing streaming chat message:', error);
    res.write(`data: ${JSON.stringify({ error: 'An error occurred processing your request' })}\n\n`);
    res.end();
  }
});

/**
 * Export the Express app for testing with supertest
 */
export { app };

/**
 * Start the Express server (skip when imported by Jest for testing)
 * JEST_WORKER_ID is set automatically by Jest in every worker process.
 */
if (!process.env.JEST_WORKER_ID) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

/**
 * Graceful shutdown handling
 * Ensures Copilot client is properly closed on process termination
 */
process.on('SIGTERM', async () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully...');
  closeDb();
  await copilotService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  // eslint-disable-next-line no-console
  console.log('SIGINT received, shutting down gracefully...');
  closeDb();
  await copilotService.shutdown();
  process.exit(0);
});
