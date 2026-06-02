const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.nivel !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
}

function canAccess(...niveis) {
  return (req, res, next) => {
    if (!niveis.includes(req.user?.nivel) && req.user?.nivel !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para esta operação' });
    }
    next();
  };
}

module.exports = { authMiddleware, adminOnly, canAccess };
