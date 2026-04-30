import React from 'react';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type IconSet = 'feather' | 'material';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  set?: IconSet;
};

export function Icon({
  name,
  size = 20,
  color = '#0f172a',
  set = 'material',
}: IconProps) {
  if (set === 'feather') {
    return <Feather name={name} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
