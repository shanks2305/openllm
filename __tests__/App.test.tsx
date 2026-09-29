/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
  readFile: jest.fn(async () => '{}'),
  writeFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  moveFile: jest.fn(async () => undefined),
  copyFile: jest.fn(async () => undefined),
  stat: jest.fn(async () => ({ size: 0 })),
  getFSInfo: jest.fn(async () => ({ freeSpace: 1_000_000_000 })),
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({ statusCode: 200 }),
  })),
  stopDownload: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
