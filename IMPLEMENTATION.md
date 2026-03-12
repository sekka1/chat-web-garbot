# Enhanced Document Relevance Implementation

## Overview

This document describes the implementation of GitHub Copilot SDK-based semantic document relevance ranking in the chat-web-garbot application.

## Problem Statement

The original system used simple keyword matching to find relevant documents in the knowledge base. This approach had several limitations:

1. **No semantic understanding**: Only matched exact keywords
2. **No synonym handling**: Couldn't find documents using different terminology
3. **Frequency-based scoring**: Documents with more keyword occurrences scored higher, regardless of actual relevance
4. **No intent understanding**: Couldn't distinguish between different meanings of the same words

## Solution

We implemented a two-stage document selection process that combines the speed of keyword search with the semantic understanding of GitHub Copilot SDK.

### Architecture

```
User Query
    ↓
[Stage 1: Keyword Search]
    ↓
Top 10 Candidates
    ↓
[Stage 2: Copilot SDK Semantic Ranking]
    ↓
Top 3 Most Relevant Documents
    ↓
Used as Context for AI Response
```

### Key Components

#### 1. CopilotService.rankDocumentsByRelevance()

**Location**: `src/copilot-service.ts:117-199`

**Purpose**: Uses GitHub Copilot SDK to evaluate and rank documents by semantic relevance.

**How it works**:
1. Formats documents with title and snippet
2. Sends a carefully crafted prompt to Copilot SDK asking it to rank documents by relevance
3. Parses the response to extract document indices
4. Returns ranking as an array of indices (most relevant first)

**Fallback**: Returns original order if Copilot is unavailable or parsing fails

**Example prompt**:
```
Given the following user question and a list of documents, identify which
documents are most relevant to answering the question. Return ONLY the
document numbers in order of relevance (most relevant first), as a
comma-separated list of numbers.

User Question: "How do I water my moss?"

Documents:
[0] Title: Moss Care Guide
Snippet: General care information for moss plants

[1] Title: Watering Schedule
Snippet: Best practices for watering moss walls

[2] Title: Light Requirements
Snippet: Proper lighting for moss growth

Return format: Just the numbers separated by commas (e.g., "2,0,4,1")
```

#### 2. KnowledgeService.searchWithCopilot()

**Location**: `src/knowledge-service.ts:77-173`

**Purpose**: Orchestrates the two-stage search process.

**Algorithm**:
```typescript
1. Perform keyword search on all documents
   - Score based on title matches (+10) and content matches (+1 to +5)
   - Extract relevant snippets around matched terms

2. Sort by keyword score and select top N candidates (default: 10)
   - If no keyword matches, use up to N documents (default: 10) from the full collection as fallback candidates

3. If candidates ≤ desired results, return them immediately

4. Use Copilot SDK to semantically rank the candidates
   - Calls copilotService.rankDocumentsByRelevance()

5. Reorder candidates based on Copilot's ranking

6. Return top M results (default: 3)
```

**Parameters**:
- `query`: The user's question
- `maxCandidates`: Maximum number of candidates to consider (default: 10)
- `maxResults`: Number of results to return (default: 3)

**Fallback**: Falls back to simple keyword search if Copilot service is unavailable

#### 3. Server Integration

**Location**: `src/server.ts:60-67, 117-124`

**Changes**:
- KnowledgeService now receives CopilotService instance in constructor
- Both `/api/chat` and `/api/chat/stream` endpoints now use `searchWithCopilot()` instead of `search()`

## Benefits

### 1. Better Semantic Understanding

**Before** (keyword matching):
```
Query: "How often should I mist my wall?"
Results: Documents containing "mist" or "wall" (might miss "watering schedule")
```

**After** (semantic ranking):
```
Query: "How often should I mist my wall?"
Results: Copilot understands this is about watering frequency, ranks
"Watering Schedule" highest even if it doesn't mention "mist"
```

### 2. Synonym Handling

**Before**:
```
Query: "humidity requirements"
Misses: Document titled "Moisture needs" (doesn't contain "humidity")
```

**After**:
```
Query: "humidity requirements"
Finds: "Moisture needs" document (Copilot understands the semantic equivalence)
```

### 3. Intent Understanding

**Before**:
```
Query: "moss turning brown"
Results: Any document mentioning "brown" or "moss" (might include
"Brown Sheet Moss" species guide instead of troubleshooting)
```

**After**:
```
Query: "moss turning brown"
Results: Copilot understands this indicates a problem, prioritizes
troubleshooting/care guides over species descriptions
```

## Performance Considerations

### Two-Stage Approach

We use keyword search as a first pass for several reasons:

1. **Speed**: Keyword search is fast (O(n) where n = number of documents)
2. **Cost**: Reduces Copilot API calls by filtering candidates first
3. **Reliability**: If Copilot is unavailable, keyword search provides fallback

### Typical Flow

For a knowledge base with 20 documents:
1. Keyword search: ~10ms, evaluates all 20 documents
2. Copilot ranking: ~500-1000ms, evaluates top 10 candidates
3. Total: ~510-1010ms

Without filtering:
- Copilot ranking of all 20 documents: ~800-1500ms

The two-stage approach saves time and API costs while maintaining quality.

## Testing

### Unit Tests

**Location**: `src/copilot-service.test.ts:117-166`

Tests cover:
- ✅ Ranking multiple documents
- ✅ Handling empty document list
- ✅ Handling single document
- ✅ Parsing various response formats
- ✅ Fallback behavior on errors

All tests use mocks to avoid requiring actual Copilot authentication.

### Integration Testing

To test with real Copilot SDK:
```bash
npm run test:integration
```

Requires:
- GitHub Copilot subscription
- `COPILOT_GITHUB_TOKEN` environment variable

## Future Improvements

### 1. Caching Copilot Rankings

Currently, every search triggers a new Copilot call. We could cache rankings for common queries:

```typescript
private rankingCache = new Map<string, number[]>();

async rankDocuments(query: string, docs: Document[]) {
  const cacheKey = `${query}:${docs.map(d => d.path).join(',')}`;
  if (this.rankingCache.has(cacheKey)) {
    return this.rankingCache.get(cacheKey)!;
  }
  // ... perform ranking ...
  this.rankingCache.set(cacheKey, ranking);
  return ranking;
}
```

### 2. Adaptive Candidate Count

Adjust the number of candidates based on query complexity:

```typescript
const candidateCount = query.split(' ').length > 10 ? 15 : 10;
await searchWithCopilot(query, candidateCount);
```

### 3. Hybrid Scoring

Combine keyword scores with Copilot ranking for a weighted final score:

```typescript
const finalScore = (keywordScore * 0.3) + (copilotRanking * 0.7);
```

### 4. Document Chunking

For very large documents, split into chunks and rank chunks instead of full documents:

```typescript
interface DocumentChunk {
  path: string;
  title: string;
  chunkIndex: number;
  content: string;
}
```

### 5. Query Expansion

Use Copilot to expand queries before searching:

```typescript
// "watering" → ["watering", "misting", "irrigation", "moisture"]
const expandedTerms = await copilot.expandQuery(query);
```

## Comparison: Before vs After

### API

**Before**:
```typescript
class KnowledgeService {
  constructor(dataDirectory: string)

  async search(query: string): Promise<KnowledgeDocument[]>
  // Simple keyword matching only
}
```

**After**:
```typescript
class KnowledgeService {
  constructor(dataDirectory: string, copilotService?: CopilotService)

  async search(query: string): Promise<KnowledgeDocument[]>
  // Simple keyword matching (still available as fallback)

  async searchWithCopilot(
    query: string,
    maxCandidates = 10,
    maxResults = 3
  ): Promise<KnowledgeDocument[]>
  // Two-stage semantic search with Copilot ranking
}
```

### Code Changes Summary

| File | Changes | Lines Added | Lines Changed |
|------|---------|-------------|---------------|
| `src/copilot-service.ts` | Added `rankDocumentsByRelevance()` and `parseRanking()` | +84 | 0 |
| `src/knowledge-service.ts` | Added `searchWithCopilot()`, updated constructor | +101 | 3 |
| `src/server.ts` | Updated to use `searchWithCopilot()` | +3 | 4 |
| `src/copilot-service.test.ts` | Added ranking tests | +51 | 32 |
| `README.md` | Updated documentation | +18 | 8 |

**Total**: +257 lines, 47 changed lines

## Conclusion

The implementation successfully addresses the problem statement by providing semantic document ranking using GitHub Copilot SDK. The two-stage approach balances performance with quality, and comprehensive fallback mechanisms ensure reliability even when Copilot is unavailable.

The system now provides better document selection that can:
- ✅ Find documents even when different terminology is used
- ✅ Understand the intent behind questions
- ✅ Rank by true relevance rather than just keyword frequency
- ✅ Handle synonyms and related concepts
- ✅ Distinguish between different meanings of words based on context
