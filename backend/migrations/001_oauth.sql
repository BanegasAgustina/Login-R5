-- Migracion aditiva sobre el esquema real de PetCare.
-- NULL indica que no existe contrasena local o que el proveedor no compartio email.
-- Conservamos usuarios, hashes, indices y relaciones existentes.
ALTER TABLE usuarios MODIFY email VARCHAR(120) NULL;
ALTER TABLE usuarios MODIFY password_hash VARCHAR(255) NULL;

-- El proveedor y su ID estable identifican la cuenta, aunque cambie su email.
-- La comparacion binaria evita confundir IDs por mayusculas/minusculas.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  provider VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  avatar_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY oauth_identity (provider, provider_user_id),
  CONSTRAINT oauth_user_fk FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Intentos compartidos entre procesos, validos durante 10 minutos.
-- State y cookie se guardan como hashes; no se almacenan access/refresh tokens.
CREATE TABLE IF NOT EXISTS oauth_flows (
  state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  browser_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(20) NOT NULL,
  verifier VARCHAR(128) NULL,
  nonce VARCHAR(128) NULL,
  expires_at DATETIME NOT NULL,
  INDEX oauth_expiry (expires_at)
) ENGINE=InnoDB;
