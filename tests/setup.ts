import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Mock console methods to reduce noise during testing
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // You can suppress console output during tests if needed
  // console.log = jest.fn();
  // console.error = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test timeout
jest.setTimeout(30000);
