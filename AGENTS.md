# AGENTS.md

This file provides context and instructions for AI coding agents working on the chat-web-garbot project.

## Project Overview

chat-web-garbot is a TypeScript web application.

## Development Environment

### Prerequisites
- Node.js and npm/pnpm/yarn (check package.json for specific versions)
- TypeScript
- Git

### Setup
1. Clone the repository
2. Install dependencies: `npm install` (or `pnpm install`/`yarn install`)
3. Review configuration files (tsconfig.json, package.json) for project setup

## Testing Instructions

**IMPORTANT**: Always run linting and unit tests before committing and in pull requests.

### Before Every Commit
1. Run linting: `npm run lint` (or equivalent command from package.json)
2. Run unit tests: `npm test` (or equivalent command from package.json)
3. Ensure all tests pass before committing

### In Pull Requests
- All linting checks must pass
- All unit tests must pass
- Add or update tests for any code changes
- Ensure test coverage is maintained or improved

## Security Best Practices

### OWASP Top 10 Compliance
- **Injection Prevention**: Always sanitize and validate user inputs; use parameterized queries for database operations
- **Authentication & Session Management**: Implement secure authentication; never store passwords in plain text; use industry-standard libraries
- **XSS Prevention**: Sanitize all user-generated content before rendering; use Content Security Policy (CSP) headers
- **Broken Access Control**: Implement proper authorization checks; verify user permissions on server-side
- **Security Misconfiguration**: Keep all dependencies updated; remove default credentials and unnecessary features
- **Vulnerable Dependencies**: Regularly audit dependencies with `npm audit`; address critical vulnerabilities promptly
- **Insufficient Logging**: Log security-relevant events; never log sensitive data (passwords, tokens, personal information)

### Input Validation & Sanitization
- Validate all user inputs on both client and server side
- Use allowlists rather than blocklists for validation
- Sanitize data before rendering in HTML, SQL queries, or system commands
- Implement rate limiting for API endpoints to prevent abuse
- Validate file uploads: check file type, size, and content

### Authentication & Authorization
- Use secure session management and HTTP-only cookies
- Implement multi-factor authentication where appropriate
- Use bcrypt, argon2, or similar for password hashing (never MD5 or SHA1)
- Implement proper CORS policies
- Use JWT tokens securely with appropriate expiration times
- Never expose authentication tokens in URLs or logs

### Data Protection
- Encrypt sensitive data at rest and in transit (use HTTPS/TLS)
- Never commit secrets, API keys, credentials, or tokens to version control
- Use environment variables for configuration secrets
- Implement proper data retention and deletion policies
- Follow principle of least privilege for data access

### API Security
- Implement proper authentication and authorization for all endpoints
- Use HTTPS for all API communications
- Validate and sanitize all API inputs
- Implement rate limiting and throttling
- Use API versioning and deprecation strategies
- Never expose internal error details to clients

### Code Security Practices
- Avoid using `eval()`, `Function()`, or `setTimeout/setInterval` with strings
- Be cautious with `innerHTML`; prefer `textContent` or use sanitization libraries
- Implement Content Security Policy (CSP) headers
- Use security headers: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security
- Regular security audits and penetration testing

## Code Quality Standards

### TypeScript
- Use strict mode (no `any` types without justification)
- Prefer explicit types for function parameters and return values
- Use type inference where appropriate
- Document exported functions with JSDoc comments

### Testing
- Write unit tests for new features and bug fixes
- Maintain existing test patterns and conventions
- Test edge cases and error conditions
- Use descriptive test names that explain the expected behavior
- Include security testing for authentication, authorization, and input validation

## PR Workflow

### Pull Request Requirements
1. **Pre-commit checks**:
   - Linting must pass
   - All unit tests must pass
2. **Code review**: PRs require review before merging
3. **Commit messages**: Use clear, descriptive commit messages
4. **Testing**: Include tests with code changes

### Best Practices
- Keep PRs focused on a single concern
- Update documentation if changing functionality
- Respond to review comments promptly
- Ensure CI/CD checks pass before requesting review
- **Always include screenshots for GUI changes**: When making changes to the user interface, take a screenshot of the change and include it in the pull request description to help reviewers visualize the modifications

## Boundaries and Restrictions

### DO NOT
- Commit code without running linting and tests
- Skip tests when making code changes
- Ignore TypeScript errors or warnings
- Commit secrets, API keys, or sensitive data
- Modify dependencies without justification
- Make changes to generated or vendored files without proper understanding
- Use `eval()` or execute dynamic code from user input
- Store passwords or tokens in plain text
- Expose sensitive error messages to end users
- Disable security features or bypass security checks

### DO
- Follow existing code patterns and conventions
- Write clean, maintainable code
- Add comments for complex logic
- Keep functions small and focused
- Use meaningful variable and function names

## Project Structure

The project structure will be established as development progresses. Key directories and their purposes will be documented here.

## Additional Notes

- This is a TypeScript web application
- Code quality is enforced through linting and testing
- All contributions must maintain or improve code quality standards
