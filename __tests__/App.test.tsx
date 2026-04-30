/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');

  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => (
      <View>{children}</View>
    ),
    SafeAreaView: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
  };
});

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  expect(JSON.stringify(tree!.toJSON())).toContain('Welcome back');
});
