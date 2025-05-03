// Import jest-dom's matchers
import '@testing-library/jest-dom';

// Setup global mocks here
global.fetch = jest.fn();

// Reset all mocks after each test
afterEach(() => {
  jest.resetAllMocks();
});