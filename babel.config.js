module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // react-native-worklets/plugin powers Reanimated 4 worklets (used by
  // react-native-keyboard-controller's KeyboardAwareScrollView). It MUST be
  // the last entry in the plugins array.
  plugins: ['react-native-worklets/plugin'],
};
