// src/services/tokenStorage.js
class SecureTokenStorage {
  // In-memory token storage for enhanced security
  constructor() {
    this.token = null;
    this.refreshToken = null;
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
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

  isAuthenticated() {
    return !!this.token;
  }
}

const tokenStorage = new SecureTokenStorage();
export default tokenStorage;