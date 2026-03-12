import { CopilotClient } from '@github/copilot-sdk';

/**
 * Service wrapper for GitHub Copilot SDK
 * Manages Copilot client lifecycle and session handling
 */
export class CopilotService {
  private client: CopilotClient | null = null;
  private isInitialized = false;

  /**
   * Initializes the Copilot client
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.client = new CopilotClient();
      await this.client.start();
      this.isInitialized = true;
      // eslint-disable-next-line no-console
      console.log('Copilot client initialized successfully');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize Copilot client:', error);
      throw new Error('Failed to initialize Copilot client. Ensure GitHub Copilot is configured.');
    }
  }

  /**
   * Sends a prompt to Copilot and receives a streaming response
   * @param prompt - The user's question or prompt
   * @param context - Optional context from knowledge base to enhance the response
   * @returns Promise resolving to the AI response
   */
  async getResponse(prompt: string, context?: string): Promise<string> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('Copilot client is not initialized');
    }

    try {
      // System instruction for detailed, comprehensive responses
      const systemInstruction = 'You are a helpful and knowledgeable assistant. Use the provided local knowledge base to give detailed, comprehensive answers with specific tips, instructions, and explanations. Aim for thorough responses that fully address the question.';

      // Build enhanced prompt with knowledge base context if available
      const enhancedPrompt = context
        ? `${systemInstruction}\n\nUsing the following context from the knowledge base:\n\n${context}\n\nPlease provide a detailed answer to this question: ${prompt}`
        : `${systemInstruction}\n\nPlease provide a detailed answer to this question: ${prompt}`;

      // Create a session with GPT-4
      const session = await this.client.createSession({ model: 'gpt-4.1' });

      // Send prompt and wait for response
      const response = await session.sendAndWait({ prompt: enhancedPrompt });

      // Extract content from response
      if (response?.data?.content) {
        return response.data.content;
      }

      return 'I apologize, but I was unable to generate a response. Please try again.';
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting Copilot response:', error);
      throw new Error('Failed to get response from Copilot');
    }
  }

  /**
   * Streams a response from Copilot
   * @param prompt - The user's question or prompt
   * @param context - Optional context from knowledge base
   * @param onChunk - Callback function called for each chunk of the response
   * @returns Promise that resolves when streaming is complete
   */
  async streamResponse(
    prompt: string,
    context: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.client || !this.isInitialized) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('Copilot client is not initialized');
    }

    try {
      // System instruction for detailed, comprehensive responses
      const systemInstruction = 'You are a helpful and knowledgeable assistant. Use the provided local knowledge base to give detailed, comprehensive answers with specific tips, instructions, and explanations. Aim for thorough responses that fully address the question.';

      // Build enhanced prompt with knowledge base context if available
      const enhancedPrompt = context
        ? `${systemInstruction}\n\nUsing the following context from the knowledge base:\n\n${context}\n\nPlease provide a detailed answer to this question: ${prompt}`
        : `${systemInstruction}\n\nPlease provide a detailed answer to this question: ${prompt}`;

      // Create a session with GPT-4
      const session = await this.client.createSession({ model: 'gpt-4.1' });

      // For now, use sendAndWait and send the full response at once
      // The SDK's streaming API may differ from our assumption
      const response = await session.sendAndWait({ prompt: enhancedPrompt });

      // Send the full response as one chunk
      if (response?.data?.content) {
        onChunk(response.data.content);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error streaming Copilot response:', error);
      throw new Error('Failed to stream response from Copilot');
    }
  }

  /**
   * Evaluates document relevance using Copilot's semantic understanding
   * @param query - The user's question
   * @param documents - Array of document summaries to evaluate
   * @returns Array of document indices ranked by relevance (most relevant first)
   */
  async rankDocumentsByRelevance(
    query: string,
    documents: Array<{ title: string; snippet: string }>
  ): Promise<number[]> {
    try {
      if (!this.client || !this.isInitialized) {
        await this.initialize();
      }

      if (!this.client) {
        throw new Error('Copilot client is not initialized');
      }
      // Build a prompt asking Copilot to rank documents by relevance
      const documentsList = documents
        .map((doc, idx) => `[${idx}] Title: ${doc.title}\nSnippet: ${doc.snippet}`)
        .join('\n\n');

      const prompt = `Given the following user question and a list of documents, identify which documents are most relevant to answering the question. Return ONLY the document numbers in order of relevance (most relevant first), as a comma-separated list of numbers.

User Question: "${query}"

Documents:
${documentsList}

Return format: Just the numbers separated by commas (e.g., "2,0,4,1")
Your response:`;

      // Create a session with GPT-4
      const session = await this.client.createSession({ model: 'gpt-4.1' });

      // Send prompt and wait for response
      const response = await session.sendAndWait({ prompt });

      // Extract and parse the ranking
      if (response?.data?.content) {
        const ranking = this.parseRanking(response.data.content, documents.length);
        return ranking;
      }

      // Fallback: return original order if parsing fails
      return Array.from({ length: documents.length }, (_, i) => i);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error ranking documents with Copilot:', error);
      // Fallback: return original order on error
      return Array.from({ length: documents.length }, (_, i) => i);
    }
  }

  /**
   * Parses ranking response from Copilot
   * @param content - Response content from Copilot
   * @param documentCount - Total number of documents
   * @returns Array of document indices
   */
  private parseRanking(content: string, documentCount: number): number[] {
    try {
      // Extract numbers from the response
      const numbers = content
        .match(/\d+/g)
        ?.map(num => parseInt(num, 10))
        .filter(num => num >= 0 && num < documentCount) || [];

      // Remove duplicates while preserving order
      const uniqueNumbers = Array.from(new Set(numbers));

      // Add any missing indices at the end (in original order)
      const missingIndices = Array.from({ length: documentCount }, (_, i) => i)
        .filter(i => !uniqueNumbers.includes(i));

      return [...uniqueNumbers, ...missingIndices];
    } catch {
      // Fallback: return original order
      return Array.from({ length: documentCount }, (_, i) => i);
    }
  }

  /**
   * Shuts down the Copilot client
   */
  async shutdown(): Promise<void> {
    if (this.client && this.isInitialized) {
      try {
        await this.client.stop();
        this.isInitialized = false;
        // eslint-disable-next-line no-console
        console.log('Copilot client shut down successfully');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error shutting down Copilot client:', error);
      }
    }
  }
}
