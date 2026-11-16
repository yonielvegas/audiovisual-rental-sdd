-- Cuentas y sesiones de RF-01. El inicio de sesión es único para todas las
-- personas y el rol decide qué puede hacer cada una (RN-07).

CREATE TABLE audiovisual.users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL
    CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  email text
    CONSTRAINT users_email_format CHECK (
      email IS NULL
      OR (email = lower(btrim(email))
          AND char_length(email) <= 254
          AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    ),
  -- Solo la codificación PHC del hash. La contraseña nunca se almacena.
  password_hash text NOT NULL
    CONSTRAINT users_password_hash_present CHECK (char_length(password_hash) BETWEEN 20 AND 255),
  role text NOT NULL DEFAULT 'USER'
    CONSTRAINT users_role_allowed CHECK (role IN ('ADMIN', 'USER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- El nombre de usuario se normaliza a minúsculas en la aplicación, de modo que
-- «Admin» y «admin» compiten por la misma cuenta.
CREATE UNIQUE INDEX users_username_unique ON audiovisual.users (username);
CREATE UNIQUE INDEX users_email_unique ON audiovisual.users (email) WHERE email IS NOT NULL;

CREATE TABLE audiovisual.sessions (
  -- Se guarda el SHA-256 de la credencial de sesión, no la credencial. Una
  -- copia de la base no permite suplantar una sesión abierta.
  token_hash text PRIMARY KEY
    CONSTRAINT sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id integer NOT NULL
    REFERENCES audiovisual.users (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT sessions_expires_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_idx ON audiovisual.sessions (user_id);
CREATE INDEX sessions_expires_idx ON audiovisual.sessions (expires_at);

COMMENT ON COLUMN audiovisual.users.role IS
  'ADMIN administra el inventario. USER consulta el catálogo y sus propias reservas.';
COMMENT ON COLUMN audiovisual.users.password_hash IS
  'Codificación PHC de Argon2id. El alta del administrador la realiza bootstrap-admin.js con la contraseña del entorno.';
COMMENT ON TABLE audiovisual.sessions IS
  'Sesiones del lado del servidor. Cerrar sesión borra la fila, de modo que la revocación es inmediata.';
