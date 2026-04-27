import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  type?: 'text' | 'password' | 'email' | 'phone';
}

export function Input({ label, error, type = 'text', ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-text font-medium text-sm mb-1">{label}</Text>
      )}
      <View className="relative">
        <TextInput
          className={`bg-surface border rounded-xl px-4 py-3.5 text-text text-base ${
            error ? 'border-danger' : 'border-border'
          }`}
          placeholderTextColor="#9ca3af"
          secureTextEntry={isPassword && !showPassword}
          keyboardType={
            type === 'email'
              ? 'email-address'
              : type === 'phone'
              ? 'phone-pad'
              : 'default'
          }
          autoCapitalize={type === 'email' ? 'none' : undefined}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            className="absolute right-4 top-3.5"
            onPress={() => setShowPassword((v) => !v)}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#9ca3af"
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-danger text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
