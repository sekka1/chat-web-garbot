# chat-web-garbot

A TypeScript web application built with Express.js that provides an AI chat interface powered by the GitHub Copilot SDK. This is a single chat application with deep local knowledge on topics you care about — add content to the `data/` directory and the assistant automatically uses it to provide context-aware answers. It comes with skills to download new content, and when a user asks a question, it searches its local knowledge base for relevant context before the AI responds.

## Features

- **Express.js Server**: Minimal TypeScript-based Express.js server
- **AI Chat Interface**: Clean, dark-themed chat interface
- **GitHub Copilot SDK Integration**: Powered by GitHub Copilot for intelligent AI responses
- **Knowledge Base Integration**: Searches local knowledge base to provide context-aware answers
- **Streaming Responses**: Real-time streaming of AI responses via Server-Sent Events (SSE)
- **TypeScript**: Strict type safety throughout the application
- **Linting**: ESLint configured for TypeScript
- **CI/CD**: GitHub Actions workflow for automated testing and building

## Project Structure

```
chat-web-garbot/
├── src/
│   ├── server.ts              # Express server with API endpoints
│   ├── copilot-service.ts     # GitHub Copilot SDK wrapper
│   ├── knowledge-service.ts   # Knowledge base search service
│   ├── auth-service.ts        # Login verification, JWT tokens
│   ├── auth-middleware.ts     # requireAuth middleware, rate limiter
│   ├── auth-routes.ts         # Login/logout/status API routes
│   └── db.ts                  # SQLite database layer
├── public/
│   ├── index.html             # Chat interface UI
│   └── login.html             # Login page
├── data/                      # Knowledge base documents
├── scripts/
│   ├── deploy.sh              # Deployment script
│   └── seed-users.ts          # Database user seeding script
├── .github/
│   └── workflows/
│       └── lint-and-build.yml  # CI/CD pipeline
├── dist/                      # Compiled JavaScript (generated)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── .eslintrc.json             # ESLint configuration
└── README.md                  # This file
```

## Prerequisites

- Node.js >= 24.0.0
- npm, pnpm, or yarn
- GitHub Copilot subscription and CLI configured (required for AI functionality)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/sekka1/chat-web-garbot.git
cd chat-web-garbot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure GitHub Copilot

Ensure you have GitHub Copilot CLI installed and authenticated:

```bash
# Login to GitHub Copilot (if not already logged in)
gh copilot login
```

Note: The application requires an active GitHub Copilot subscription. If Copilot is not available, the application will provide fallback responses with knowledge base context.

### 4. Configure Authentication

The app requires a `SESSION_SECRET` for signing JWT session tokens. Generate one:

```bash
openssl rand -hex 32
```

This produces a 64-character hex string like `a3f1b9c2e4...`.

#### Local development

Set it as an environment variable before starting the server:

```bash
export SESSION_SECRET="<your-generated-secret>"
npm run dev
```

Or create a `.env` file (already in `.gitignore`):

```
SESSION_SECRET=<your-generated-secret>
```

#### Production (GitHub Actions → server)

The deploy pipeline automatically passes `SESSION_SECRET` from GitHub Actions secrets to the server via PM2:

1. **Add `SESSION_SECRET` as a GitHub repository secret**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SESSION_SECRET`
   - Value: Paste the output of `openssl rand -hex 32`
   - Click "Add secret"

2. The deploy script (`scripts/deploy.sh`) automatically:
   - Passes the secret to the PM2 process on every deploy
   - Writes it to `/opt/bitnami/apps/garbot-chat/.env` on the server so it persists across manual PM2 restarts
   - Seeds the user database on first deploy (prints passwords to the deploy log)

> **⚠️ Important:** Use the **same** `SESSION_SECRET` value in GitHub secrets and on the server. Changing it will invalidate all existing user sessions.

### 5. Seed Users

On first deploy, users are auto-seeded. To seed manually (local development):

```bash
npm run seed
```

This creates two users with random passwords and prints them to stdout:
- `ci-system@gmail.com` — for CI/automated use
- `garlandk@gmail.com` — for regular use

> **⚠️ Save the passwords immediately** — they cannot be recovered. To reset, delete `data/auth.db` and re-run the seed.

## Development

### Run in development mode

```bash
npm run dev
```

This starts the server using `ts-node` in development mode.

### Build the application

```bash
npm run build
```

This compiles TypeScript files from `src/` to JavaScript in `dist/`.

### Run in production mode

```bash
npm start
```

This runs the compiled JavaScript from the `dist/` folder.

### Lint the code

```bash
npm run lint
```

To automatically fix linting issues:

```bash
npm run lint:fix
```

### Run tests

Run the automated unit tests:

```bash
npm test
```

The unit tests use mocks and don't require GitHub Copilot authentication. They verify:
- Copilot service initialization and shutdown
- Response handling for "what is a live moss wall?" query
- Context-aware responses with knowledge base integration
- Streaming functionality

#### Integration Testing with Real Copilot

To test with the actual GitHub Copilot SDK (requires authentication):

**Basic integration test** (tests simple Copilot responses):
```bash
npm run test:integration
```

**Semantic search integration test** (tests the new document ranking flow):
```bash
npm run test:integration:semantic
```

**Requirements for integration testing:**
- Active GitHub Copilot subscription
- GitHub CLI authenticated (`gh auth login`)
- GitHub Copilot configured (`gh copilot login`)

The basic integration test will:
1. Ask "what is a live moss wall?" to the real Copilot SDK
2. Verify a valid response is received
3. Display the response for manual verification

The semantic search integration test will:
1. Test document ranking with sample documents
2. Verify semantic understanding (watering queries, troubleshooting intent)
3. Test integration with real knowledge base documents
4. Validate edge cases (empty lists, single documents)

**Additional test commands:**
```bash
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate test coverage report
```

## Application Usage

1. Start the server using one of the methods above
2. Open your browser to `http://localhost:3000`
3. You'll see the Garbot Chat interface with:
   - **Top area**: Displays AI responses and chat history
   - **Bottom area**: Input box for typing questions
4. Type a question and press Enter or click Send
5. The application will use GitHub Copilot SDK to generate intelligent responses, enhanced with relevant information from the knowledge base

## API Endpoints

### POST /api/chat

Send a message to the AI assistant and receive a complete response.

**Request:**
```json
{
  "message": "Your question here"
}
```

**Response:**
```json
{
  "response": "AI response generated by GitHub Copilot SDK"
}
```

### POST /api/chat/stream

Send a message and receive a streaming response via Server-Sent Events (SSE).

**Request:**
```json
{
  "message": "Your question here"
}
```

**Response:** Server-Sent Events stream with chunks:
```
data: {"chunk":"AI response chunk"}

data: {"chunk":"more response..."}

data: [DONE]
```

### GET /api/health

Health check endpoint to verify the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

## GitHub Copilot SDK Integration

This application uses the [GitHub Copilot SDK](https://github.com/github/copilot-sdk) to provide intelligent AI responses. The integration includes:

- **Semantic Document Ranking**: Uses GitHub Copilot SDK to evaluate which documents from the knowledge base are most relevant to user questions, going beyond simple keyword matching
- **Context-Aware Responses**: Searches the local knowledge base before generating responses to provide more accurate, context-specific answers
- **Streaming Support**: Real-time streaming of responses via Server-Sent Events
- **Model Selection**: Uses GPT-4.1 for high-quality responses
- **Graceful Fallback**: Provides informative fallback responses if Copilot is unavailable

### Documentation Resources

- [GitHub Copilot SDK Documentation](https://github.com/github/copilot-sdk)
- [Node.js Integration Guide](https://github.com/github/awesome-copilot/blob/main/cookbook/copilot-sdk/nodejs/README.md)
- [Copilot SDK Cookbook](https://github.com/github/awesome-copilot/tree/main/cookbook/copilot-sdk)

### How It Works

1. **User Question**: User sends a question via the chat interface
2. **Initial Keyword Search**: The system performs a fast keyword search on the local `data/` directory to identify candidate documents
3. **Semantic Ranking**: GitHub Copilot SDK evaluates the candidates and ranks them by semantic relevance to the question
4. **Context Enhancement**: The most relevant document snippets are included as context
5. **Copilot Generation**: The GitHub Copilot SDK generates a response using the question and context
6. **Response Display**: The response is returned to the user (streamed or complete)

This two-stage approach combines the speed of keyword search with the semantic understanding of AI:
- **Stage 1**: Fast keyword filtering on lowercased text to narrow down candidates (exact and substring matches)
- **Stage 2**: Semantic ranking by Copilot SDK to select truly relevant documents (understands synonyms, intent, context)

The result is better document selection that can:
- Find documents even when different terminology is used
- Understand the intent behind questions
- Rank by true relevance rather than just keyword frequency

The main integration points are:
- `src/copilot-service.ts`: Wrapper for GitHub Copilot SDK with initialization, session management, and document ranking
- `src/knowledge-service.ts`: Implements both simple keyword search and Copilot-enhanced semantic search
- `src/server.ts`: API endpoints that combine knowledge base search with Copilot responses

## CI/CD Pipeline

The project includes GitHub Actions workflows that automatically run on every pull request:

### Lint and Build Workflow (`.github/workflows/lint-and-build.yml`)

- **Linting**: Ensures code quality and TypeScript standards
- **Building**: Verifies the application compiles successfully
- **Testing**: Runs the unit test suite (uses mocks, no authentication required)
- **Multi-version**: Tests against Node.js 24.x

### Integration Test Workflow (`.github/workflows/integration-test.yml`)

Runs integration tests with the real GitHub Copilot SDK to verify end-to-end functionality.

**Requirements:**
- Node.js 24.x or later (required by `@github/copilot-sdk@0.1.23`)
- Tests against Node.js 24.x in CI

**Required Setup:**

To enable integration testing in GitHub Actions, you must configure a GitHub secret:

1. **Create a Personal Access Token (PAT)**:
   - Go to GitHub Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
   - Click "Generate new token"
   - Give it a descriptive name (e.g., "Copilot Integration Tests")
   - Select your repository under "Repository access"
   - Under "Permissions" → "Account permissions", add **"Copilot Requests: Read"**
   - Generate and copy the token

2. **Add the token as a repository secret**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `COPILOT_TOKEN`
   - Value: Paste the PAT you created
   - Click "Add secret"

The integration test workflow will use this token to authenticate with the GitHub Copilot SDK.

## Code Quality Standards

This project follows strict TypeScript and code quality standards:

- **TypeScript Strict Mode**: No `any` types without justification
- **ESLint**: Configured for TypeScript with recommended rules
- **JSDoc Comments**: All exported functions include documentation
- **Security**: Input validation and sanitization for user inputs

See [AGENTS.md](./AGENTS.md) and [.github/copilot-instructions.md](./.github/copilot-instructions.md) for detailed coding standards.

## Development Workflow

### Before Every Commit

1. Run linting: `npm run lint`
2. Run build: `npm run build`
3. Run tests: `npm test`
4. Ensure all checks pass

### Pull Request Guidelines

- Include screenshots for any GUI changes
- Ensure CI/CD pipeline passes
- Keep PRs focused on a single concern
- Update documentation for any API changes

## Contributing

1. Follow the TypeScript coding standards in `.github/copilot-instructions.md`
2. Run linting and tests before committing
3. Keep functions small and focused
4. Document exported functions with JSDoc
5. For GUI changes, include screenshots in the PR

## License

MIT

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Linting**: ESLint
- **CI/CD**: GitHub Actions

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `SESSION_SECRET` | **Yes** | — | JWT signing secret. Generate with `openssl rand -hex 32` |
| `AUTH_DB_PATH` | No | `./data/auth.db` | Path to the SQLite user database |
| `COPILOT_GITHUB_TOKEN` | Yes (prod) | — | GitHub Copilot authentication token |
| `NODE_ENV` | No | — | Set to `production` for secure cookies |

GitHub Copilot authentication is handled via the GitHub CLI (`gh copilot login`) in development, or via `COPILOT_GITHUB_TOKEN` in production.

## Security

This application implements security best practices:

- **Authentication**: Login required — JWT in HTTP-only, Secure, SameSite=Strict cookies (30-day expiry)
- **Password handling**: Passwords are SHA-256 hashed client-side before transmission, then argon2-hashed server-side for storage — plaintext passwords never travel over the wire or touch the server
- **Rate limiting**: Login endpoint limited to 10 attempts per 15 minutes per IP
- **Timing-safe**: User enumeration protection (constant-time response for invalid users)
- **Input validation** on all API endpoints
- **No hardcoded secrets** — all credentials via environment variables
- **XSS prevention**: DOMPurify sanitization on rendered content
- **SQLite database** excluded from version control and deployments

For detailed security guidelines, see [AGENTS.md](./AGENTS.md).
