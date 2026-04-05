import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * JWT-Token prüfen — blockt unauthentifizierte Requests
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, name, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

/**
 * Rollen-Check — nur bestimmte Rollen dürfen durch
 * 
 * Verwendung:
 *   router.get('/skills', authenticate, authorize('ADMIN'), handler)
 *   router.post('/content', authenticate, authorize('ADMIN', 'POWERUSER'), handler)
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Keine Berechtigung. Benötigt: ${roles.join(' oder ')}`,
      });
    }
    next();
  };
}

/**
 * JWT-Token erstellen
 */
export function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
