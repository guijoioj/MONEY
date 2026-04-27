/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#db2777',
        secondary: '#6366f1',
        background: '#f9fafb',
        surface: '#ffffff',
        text: '#111827',
        muted: '#6b7280',
        border: '#e5e7eb',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        'pro-bg': '#f3f4f6',
      },
    },
  },
  plugins: [],
};
