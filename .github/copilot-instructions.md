# GitHub Copilot Instructions for TypeScript Web Application

This file provides TypeScript-specific coding standards and best practices for GitHub Copilot when working on the chat-web-garbot project.

## General TypeScript Standards

### Type Safety
- **Always use strict mode**: No `any` types without explicit justification
- **Prefer explicit types** for function parameters and return values
- **Use type inference** where the type is obvious from the assigned value
- **Use interfaces or type aliases** for complex object shapes
- **Avoid type assertions** unless absolutely necessary

### Code Style
- Use arrow functions for components, utilities, and callbacks
- Prefer `const` over `let`; avoid `var` entirely
- Use template literals for string interpolation
- Prefer destructuring for objects and arrays
- Keep functions small and single-purpose (ideally under 50 lines)

### File Conventions
- One main export per file (component, utility, class, etc.)
- File names should match their primary export
- Use descriptive, intention-revealing names
- Group related functionality in the same directory

## React/Frontend Best Practices (if applicable)

### Components
- Use functional components with hooks (no class components)
- Define prop types using TypeScript interfaces
- Use `React.FC<PropsInterface>` or explicit typing
- Memoize expensive computations with `useMemo`
- Avoid inline object/array creation in props to prevent unnecessary re-renders

### Example: Good React Component
```tsx
interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onSelect?: (userId: string) => void;
}

/**
 * Displays a user card with basic information
 * @param props UserCardProps containing user data and optional callback
 * @returns JSX.Element representing the user card
 */
const UserCard: React.FC<UserCardProps> = ({ user, onSelect }) => {
  const handleClick = () => {
    onSelect?.(user.id);
  };

  return (
    <div className="user-card" onClick={handleClick}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
};

export default UserCard;
```

## Documentation Standards

### JSDoc Comments
- **All exported functions** must include JSDoc comments
- Include `@param` for each parameter with description
- Include `@returns` with description of return value
- Document edge cases and important behavior
- Explain "why" not just "what" for complex logic

### Example: Good Function Documentation
```typescript
/**
 * Validates user email address format
 * @param email - The email address to validate
 * @returns true if email format is valid, false otherwise
 * @throws Never throws - returns false for invalid input
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

## Testing Requirements

### Test Standards
- Write tests for all new features and bug fixes
- Use descriptive test names: `it('should return error when email is invalid', ...)`
- Test happy paths and error cases
- Mock external dependencies
- Aim for meaningful coverage, not just high percentage

### Example: Good Test Structure
```typescript
describe('validateEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should return false for email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});
```

## Error Handling

### Best Practices
- Use custom error types for different error categories
- Provide meaningful error messages
- Handle errors at appropriate levels
- Don't swallow errors silently
- Log errors with sufficient context
- Never expose sensitive information in error messages (stack traces, database details, credentials)

### Example: Good Error Handling
```typescript
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function processUserData(data: unknown): User {
  if (!isValidUserData(data)) {
    throw new ValidationError('Invalid user data format');
  }
  // Process data...
}
```

## Security Best Practices

### Input Validation & Sanitization
- **Always validate user input**: Never trust data from users, APIs, or external sources
- **Use allowlists, not blocklists**: Define what is allowed rather than what is blocked
- **Sanitize before use**: Clean data before rendering, storing, or processing
- **Type validation**: Use TypeScript types and runtime validation libraries (e.g., Zod, Yup)
- **Validate on both client and server**: Client-side validation for UX, server-side for security

### Example: Input Validation
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
});

/**
 * Validates and processes user registration data
 * @param data - Raw user input data
 * @returns Validated user object
 * @throws ValidationError if data is invalid
 */
function registerUser(data: unknown): User {
  const validated = UserSchema.parse(data); // Throws if invalid
  // Process validated data...
}
```

### XSS Prevention
- **Escape user content**: Always escape HTML, JavaScript, and CSS when rendering user data
- **Use frameworks safely**: React auto-escapes by default, but be careful with `dangerouslySetInnerHTML`
- **Content Security Policy**: Implement CSP headers to restrict resource loading
- **Avoid `innerHTML`**: Prefer `textContent` or use DOMPurify for sanitization

### Example: Safe Content Rendering
```typescript
// ❌ UNSAFE - vulnerable to XSS
function UnsafeComponent({ userInput }: { userInput: string }) {
  return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
}

// ✅ SAFE - auto-escaped by React
function SafeComponent({ userInput }: { userInput: string }) {
  return <div>{userInput}</div>;
}

// ✅ SAFE - sanitized HTML when necessary
import DOMPurify from 'dompurify';

function SafeHtmlComponent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### Authentication & Authorization
- **Use secure authentication**: Implement OAuth2, JWT, or session-based auth with industry-standard libraries
- **HTTP-only cookies**: Store session tokens in HTTP-only, secure cookies
- **Password security**: Use bcrypt, argon2, or scrypt for password hashing (min 10 rounds)
- **Token management**: Set appropriate expiration times; implement refresh tokens
- **Never expose tokens**: Don't log tokens or include them in URLs or client-side storage insecurely

### Example: Secure Password Hashing
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Securely hashes a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored password hash
 * @returns true if password matches
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### SQL Injection Prevention
- **Use parameterized queries**: Never concatenate user input into SQL queries
- **Use ORMs safely**: Prefer query builders and ORMs (Prisma, TypeORM) with parameterized queries
- **Validate input types**: Ensure IDs are numbers, emails are valid, etc.

### Example: Safe Database Queries
```typescript
// ❌ UNSAFE - SQL injection vulnerability
function getUserUnsafe(userId: string) {
  return db.query(`SELECT * FROM users WHERE id = ${userId}`);
}

// ✅ SAFE - parameterized query
function getUserSafe(userId: number) {
  return db.query('SELECT * FROM users WHERE id = $1', [userId]);
}

// ✅ SAFE - ORM usage
function getUserWithORM(userId: number) {
  return prisma.user.findUnique({ where: { id: userId } });
}
```

### API Security
- **Authenticate all endpoints**: Verify user identity before processing requests
- **Authorize access**: Check user permissions for each resource
- **Rate limiting**: Prevent abuse with rate limiting (e.g., express-rate-limit)
- **CORS configuration**: Only allow trusted origins
- **Input validation**: Validate all request parameters, body, and headers
- **HTTPS only**: Never send sensitive data over HTTP

### Example: Secure API Endpoint
```typescript
/**
 * Secure API endpoint with authentication, authorization, and validation
 * @param req - Express request with authenticated user
 * @param res - Express response
 */
async function updateUserProfile(req: AuthenticatedRequest, res: Response) {
  // 1. Authentication (middleware ensures req.user exists)
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Authorization - users can only update their own profile
  if (req.user.id !== parseInt(req.params.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Input validation
  const UpdateSchema = z.object({
    name: z.string().min(1).max(100),
    bio: z.string().max(500).optional(),
  });

  try {
    const validated = UpdateSchema.parse(req.body);
    const updated = await updateUser(req.user.id, validated);
    return res.json(updated);
  } catch (error) {
    // Don't expose internal errors
    return res.status(400).json({ error: 'Invalid input' });
  }
}
```

### Secrets Management
- **Never commit secrets**: No API keys, passwords, tokens, or credentials in code
- **Use environment variables**: Store secrets in `.env` files (add to `.gitignore`)
- **Use secret management**: Consider AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault
- **Rotate credentials**: Regularly update API keys and tokens
- **Minimum privileges**: Grant least privilege access to services

### Example: Environment Configuration
```typescript
// ❌ NEVER DO THIS
const API_KEY = 'sk-1234567890abcdef'; // Hardcoded secret!

// ✅ Use environment variables
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}
```

### Dependency Security
- **Audit regularly**: Run `npm audit` or `pnpm audit` before each release
- **Keep dependencies updated**: Use Dependabot or Renovate for automated updates
- **Review updates**: Check changelogs before updating dependencies
- **Minimal dependencies**: Only add necessary packages; fewer dependencies = smaller attack surface
- **Verify packages**: Check package popularity, maintenance, and known vulnerabilities

### Security Headers
Implement these HTTP security headers:
- `Content-Security-Policy`: Restrict resource loading
- `X-Frame-Options: DENY`: Prevent clickjacking
- `X-Content-Type-Options: nosniff`: Prevent MIME sniffing
- `Strict-Transport-Security`: Enforce HTTPS
- `X-XSS-Protection: 1; mode=block`: Enable XSS filtering (legacy browsers)
- `Referrer-Policy: no-referrer-when-downgrade`: Control referrer information

### Example: Security Headers (Express)
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

### Logging & Monitoring
- **Log security events**: Authentication attempts, authorization failures, input validation errors
- **Never log secrets**: Passwords, tokens, API keys, or PII
- **Sanitize logs**: Remove sensitive data before logging
- **Monitor for anomalies**: Track failed login attempts, unusual access patterns
- **Implement alerting**: Get notified of security-relevant events

## Code Quality Checklist

Before suggesting code changes, ensure:
- [ ] TypeScript strict mode compliance (no `any` without justification)
- [ ] All exported functions have JSDoc comments
- [ ] Functions are focused and single-purpose
- [ ] Proper error handling is in place
- [ ] Tests are included for new functionality
- [ ] Code follows existing patterns in the project
- [ ] No hardcoded values (use constants or configuration)
- [ ] Meaningful variable and function names
- [ ] Input validation and sanitization implemented
- [ ] No security vulnerabilities (XSS, SQL injection, etc.)
- [ ] Secrets not hardcoded in code
- [ ] Authentication and authorization properly implemented

## Prohibited Actions

### NEVER
- Use `any` type without explicit justification in comments
- Ignore TypeScript errors or use `@ts-ignore` without explanation
- Create functions longer than 100 lines without good reason
- Skip writing tests for new features
- Commit code that doesn't pass linting
- Use deprecated APIs or patterns
- Introduce console.log statements (use proper logging)
- Store secrets or API keys in code
- Use `eval()`, `Function()`, or execute dynamic code from user input
- Concatenate user input into SQL queries (use parameterized queries)
- Render unsanitized user input as HTML (XSS vulnerability)
- Store passwords in plain text or use weak hashing (MD5, SHA1)
- Disable security features or CORS without justification
- Expose sensitive error details to end users
- Log passwords, tokens, API keys, or personal information

### AVOID
- Deep nesting (more than 3 levels)
- Global variables or mutable state
- Magic numbers or strings (use named constants)
- Overly complex conditionals (extract to named functions)
- Mutation of function parameters
- Side effects in utility functions

## Git and Version Control

### Commit Standards
- **ALWAYS run linting before committing**: `npm run lint`
- **ALWAYS run tests before committing**: `npm test`
- Write clear, descriptive commit messages
- Keep commits focused on single concerns
- Don't commit commented-out code
- Don't commit debugging code or console.logs

### PR Standards
- Ensure all CI/CD checks pass
- Include tests with code changes
- Update documentation for API changes
- Respond to code review feedback
- Keep PRs reasonably sized (under 500 lines when possible)

## Performance Considerations

- Avoid unnecessary re-renders in React components
- Use lazy loading for heavy components or routes
- Memoize expensive computations
- Debounce/throttle event handlers when appropriate
- Optimize bundle size (check imports, avoid unnecessary dependencies)

## Accessibility (if applicable for web app)

- Use semantic HTML elements
- Include ARIA labels where needed
- Ensure keyboard navigation works
- Maintain sufficient color contrast
- Test with screen readers when adding UI components

## Dependencies

- Only add new dependencies when necessary
- Prefer well-maintained, popular libraries
- Check bundle size impact before adding dependencies
- Keep dependencies up to date (but test thoroughly after updates)
- Document why non-obvious dependencies are needed

---

## Quick Reference

**Before every commit:**
1. Run `npm run lint` (or project-specific linting command)
2. Run `npm test` (or project-specific test command)
3. Ensure all checks pass

**When writing code:**
- Use TypeScript strict mode
- Add JSDoc to exported functions
- Write tests for new features
- Follow existing patterns
- Keep it simple and maintainable
