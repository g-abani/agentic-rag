# Testing Setup

This directory contains the test suite for the Agentic RAG project using Jest with TypeScript support.

## Test Structure

- `simple.test.ts` - Basic Jest setup verification tests
- `marketingAgent.simple.test.ts` - Unit tests with mocked functionality
- `marketingAgent.integration.test.ts` - Integration tests with real class imports
- `setup.ts` - Jest configuration and global setup

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test tests/marketingAgent.integration.test.ts

# Run only unit tests
npm run test:unit
```

## Test Coverage

Current coverage for `marketingAgent.ts`:
- **Statements**: 100%
- **Branches**: 87.5%
- **Functions**: 100%
- **Lines**: 100%

## Test Categories

### Unit Tests (`marketingAgent.simple.test.ts`)
- Tests core functionality with simple mocks
- Validates input/output behavior
- No external dependencies

### Integration Tests (`marketingAgent.integration.test.ts`)
- Tests actual class implementation
- Mocks external services (OpenAI, LangSmith)
- Verifies real method behavior

## Key Features Tested

1. **Constructor and Configuration**
   - Default and custom configurations
   - Environment variable handling

2. **System Prompt Management**
   - Getting/setting prompts
   - Input validation
   - Error handling

3. **Content Generation**
   - Valid query processing
   - Input validation
   - Error scenarios

4. **Exported Functions**
   - Standalone function exports
   - Instance exports
   - Backwards compatibility

5. **Workflow Integration**
   - Multi-step operations
   - State persistence
   - Independent instances

## Mock Strategy

- **ChatOpenAI**: Mocked to return predictable responses
- **LangSmith**: Mocked to avoid external tracing calls
- **Environment Variables**: Loaded from .env for realistic testing

## Adding New Tests

1. Create test files following the naming convention: `*.test.ts`
2. Import required Jest functions from `@jest/globals`
3. Mock external dependencies at the top of the file
4. Use descriptive test names and organize with `describe` blocks
5. Include both positive and negative test cases

## Best Practices

- Mock external dependencies to ensure fast, reliable tests
- Test both success and error scenarios
- Use descriptive test names that explain the expected behavior
- Group related tests with `describe` blocks
- Clean up mocks with `beforeEach` and `afterEach` hooks
