# src/utils/helpers.js

**Repository:** Server
**File:** `src/utils/helpers.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/utils/helpers.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
/**
 * Utility Functions for SoftHair Server
 */

const crypto = require('crypto');

class Helpers {
  static generateId() {
    	return crypto.randomUUID();
  }

  static generateShortId(length = 8) {
    	return crypto.randomBytes(length/2).toString('hex');
  }

  static formatDate(date, format = 'Y-m-d') {
    if (!(date instanceof Date)) date = new Date(date);
    if (isNaN(date.getTime())) return null;
    
    const pad = (num) => num.toString().padStart(2, '0');
    
    // Usar tokens delimitados por % para evitar conflitos
    const tokens = {
      'Y': date.getFullYear().toString(),
      'm': pad(date.getMonth() + 1),
      'd': pad(date.getDate()),
      'H': pad(date.getHours()),
      'i': pad(date.getMinutes()),
      's': pad(date.getSeconds()),
    };

    let result = format;
    // Substituir da string mais longa para evitar conflitos
    for (const [key, value] of Object.entries(tokens)) {
      result = result.split(key).join(value);
    }
    
    return result;
  }

  static formatCurrency(amount, currency = 'BRL') {
    	return new Intl.NumberFormat('pt-BR', {
      	style: 'currency',
      	currency: currency,
    	}).format(amount);
  }

  static sanitizeInput(input, options = {}) {
    // Remove HTML/XML tags
    if (typeof input !== 'string') return input;
  
    let sanitized = input
      .replace(/\u003c[^\u003e]*\u003e/g, '') // Remove HTML tags
      .trim();
    
    // Remove multiple whitespace
    if (options.removeExtraSpaces) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }
    
    // Escape special characters if needed for DB, JSON etc
    if (options.escape) {
      sanitized = sanitized
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n');
    }
    
    return sanitized;
  }

  static validateCPF(cpf) {
    // Remove non-digit characters
    cpf = cpf.replace(/\D/g, '');
    
    // Check basic length
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false; // Same digits check
    
    // Calculate verification digits
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
  	    sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
  	    sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
  }

  static formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  static validatePhone(phone) {
    // Remove non-digit characters
    phone = phone.replace(/\D/g, '');
    return phone.length >= 10 && phone.length <= 11;
  }

  static formatPhone(phone) {
    phone = phone.replace(/\D/g, '');
    
    if (phone.length === 11) {
      	return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (phone.length === 10) {
      	return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    
    return phone;
  }

  static generateHash(data) {
 	  const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET);
 	  hmac.update(data);
   return hmac.digest('hex');
  }

  static generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateSecurePassword(length = 12) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let chars = [];
    
    // Ensure at least one character from each category (using crypto)
    chars.push(lowercase[crypto.randomInt(lowercase.length)]);
    chars.push(uppercase[crypto.randomInt(uppercase.length)]);
    chars.push(numbers[crypto.randomInt(numbers.length)]);
    chars.push(symbols[crypto.randomInt(symbols.length)]);
    
    // Fill remaining length with crypto-safe random
    for (let i = 4; i < length; i++) {
      chars.push(allChars[crypto.randomInt(allChars.length)]);
    }
  
    // Fisher-Yates shuffle (crypto-safe)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  static parseDate(dateString) {
 	  // Common Brazilian date formats
  	const formats = [
  	  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/<\d{2}>MM/YYYY
	  ];
  
  	for (const format of formats) {
      const match = dateString.match(format);
   	  if (match) {
	      if (format === formats[0]) {
 		      // YYYY-MM-DD
    	    return new Date(match[1], match[2] - 1, match[3]);
         } else {
   		    // DD/<\d{2}>MM/YYYY
       	return new Date(match[3], match[2] - 1, match[1]);
     }
  }
    }
    
    return null;
  }

  static validateEmail(email) {
    const re = /^(([^\u003c\u003e()\[\]\\.,;:\s@"]+(\.[^\u003c\u003e()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  static paginate(data, page = 1, itemsPerPage = 20) {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = data.slice(startIndex, endIndex);
    
    return {
      data: pageData,
      pagination: {
  	    currentPage: page,
   	    totalPages: Math.ceil(data.length / itemsPerPage),
        totalItems: data.length,
        hasNext: endIndex < data.length,
     hasPrevious: startIndex > 0
      }
    };
  }

  static slug(str) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  static truncate(str, max = 50, suffix = '...') {
  	return str.length > max ? str.substring(0, max - suffix.length) + suffix : str;
  }

}

module.exports = Helpers;
```
