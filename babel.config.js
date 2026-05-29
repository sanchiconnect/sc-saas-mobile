module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // react-native-worklets/plugin powers Reanimated 4 worklets. It MUST be
  // the last entry in the plugins array per the Reanimated docs.
  plugins: ['react-native-worklets/plugin'],
};
