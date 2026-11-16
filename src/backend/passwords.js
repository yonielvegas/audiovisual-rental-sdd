import { Algorithm, hash, verify } from '@node-rs/argon2';

// Parámetros de la variante «segunda recomendación» de la RFC 9106: 19 MiB de
// memoria, dos pasadas y un hilo. Argon2id resiste ataques por GPU y por canal
// lateral, y la codificación PHC guarda la sal y los parámetros con el hash,
// de modo que subirlos más adelante no invalida las contraseñas existentes.
const options = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

// Hash de referencia para gastar el mismo tiempo cuando el usuario no existe.
// Sin esto, el tiempo de respuesta revelaría qué nombres están registrados.
let decoyHash;

export function hashPassword(password) {
  return hash(password, options);
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await verify(passwordHash, password, options);
  } catch {
    // Un hash ilegible se trata como credencial inválida, nunca como válida.
    return false;
  }
}

export async function spendVerificationTime(password) {
  decoyHash ??= await hashPassword('contraseña-de-referencia-que-nadie-usa');
  await verifyPassword(decoyHash, password);
}
