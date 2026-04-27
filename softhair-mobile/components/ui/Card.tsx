import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View
      className={`bg-surface rounded-2xl p-4 shadow-sm border border-border ${className}`}
      style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
      {...props}
    >
      {children}
    </View>
  );
}
