# Frontend Security Fixes Recommendations

## 1. Fix Insecure Token Storage

### Issue
Authentication tokens and user data are stored in localStorage, which is vulnerable to XSS attacks.

### Solution - Implement Secure Token Storage
Create a secure token management system:

```javascript
// src/services/tokenStorage.js
class SecureTokenStorage {
  // Use memory-only storage for sensitive data
  constructor() {
    this.token = null;
    this.refreshToken = null;
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    // Optional: Store refresh token in httpOnly cookie if needed
  }

  getToken() {
    return this.token;
  }

  getRefreshToken() {
    return this.refreshToken;
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
  }
}

const tokenStorage = new SecureTokenStorage();
export default tokenStorage;
```

Update AuthContext.jsx:
```javascript
// Replace localStorage usage with tokenStorage
import tokenStorage from '../services/tokenStorage';

// In login function:
const login = async (email, password) => {
  const res = await authAPI.login({ email, password });
  tokenStorage.setTokens(res.data.token, res.data.refreshToken);
  setUser(res.data.user);
  return res.data;
};

// In logout function:
const logout = () => {
  tokenStorage.clearTokens();
  setUser(null);
};
```

Update api.js:
```javascript
// Replace localStorage.getItem('token') with:
import tokenStorage from './tokenStorage';
const token = tokenStorage.getToken();
```

## 2. Improve Content Security Policy

Update helmet configuration in backend/src/server.js:
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"], // Remove 'unsafe-inline'
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // ... other configurations
}));
```

## 3. Enforce HTTPS

Update frontend API configuration to always use HTTPS in production:

src/services/api.js:
```javascript
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const isDevelopment = import.meta.env.MODE === 'development';

let apiBaseURL;

if (isDevelopment && isFileProtocol) {
  apiBaseURL = 'http://localhost:3001/api';
} else if (isDevelopment) {
  apiBaseURL = '/api';
} else {
  // Production should always use HTTPS
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  apiBaseURL = `https://${hostname}/api`;
}

// Alternative: Always force HTTPS in production environments
if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && 
    process.env.NODE_ENV === 'production' && !isFileProtocol) {
  window.location.protocol = 'https:';
}
```

## 4. Add Input Sanitization

Before displaying any user input, sanitize it properly:

```javascript
// src/utils/sanitize.js
export function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Usage in components:
import { sanitizeText } from '../utils/sanitize';

// Before rendering user data:
const safeUserName = sanitizeText(userData.name);
```

## 5. Upgrade Dependencies

Ensure all frontend dependencies are up to date:
```bash
cd frontend
npm outdated
npm update
```

## 6. Add Security Headers to Vite Configuration

vite.config.js:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```