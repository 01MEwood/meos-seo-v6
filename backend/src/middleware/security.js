import { logger } from '../services/logger.js';

/**
 * Rate Limiter — einfach, ohne externe Dependency
 * Nutzt In-Memory Map (reicht für Single-Instance auf VPS)
 */
const rateLimitStore = new Map();

export function rateLimit({ windowMs = 60000, max = 100, message = 'Zu viele Anfragen' } = {}) {
  // Cleanup alle 5 Minuten
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore) {
      if (now - data.start > windowMs) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now - entry.start > windowMs) {
      rateLimitStore.set(key, { start: now, count: 1 });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      logger.warn(`Rate limit überschritten: ${key} (${entry.count}/${max})`);
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/**
 * Strikte Rate-Limits für Auth-Routen (Brute-Force-Schutz)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10,                   // 10 Login-Versuche
  message: 'Zu viele Login-Versuche. Bitte 15 Minuten warten.',
});

/**
 * Standard Rate-Limit für API
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 Minute
  max: 120,              // 120 Requests/Minute
  message: 'Zu viele Anfragen. Bitte kurz warten.',
});

/**
 * Input-Sanitization — entfernt gefährliche Zeichen aus Strings
 */
export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Script-Tags entfernen
      obj[key] = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      sanitizeObject(val);
    }
  }
}

/**
 * Sicherheits-Header via Helmet (Ergänzung)
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}
