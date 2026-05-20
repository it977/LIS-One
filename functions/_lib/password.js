import bcrypt from 'bcryptjs';

const DEFAULT_ROUNDS = 10;

export async function hashPassword(password, rounds = DEFAULT_ROUNDS) {
  if (typeof password !== 'string' || !password) return null;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || !password) return false;
  if (typeof hash !== 'string' || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d\d\$/.test(value);
}
