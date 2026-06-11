CREATE DATABASE IF NOT EXISTS inventory_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'inventory_head', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ledger_page_no VARCHAR(80) NOT NULL,
  nomenclature VARCHAR(255) NOT NULL,
  quantity_au VARCHAR(80) NOT NULL DEFAULT '0 no.',
  owner_user_id INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
  CONSTRAINT fk_inventory_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transfer_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  requested_by INT NOT NULL,
  approved_by INT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  note VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  CONSTRAINT fk_transfer_inventory FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  CONSTRAINT fk_transfer_from FOREIGN KEY (from_user_id) REFERENCES users(id),
  CONSTRAINT fk_transfer_to FOREIGN KEY (to_user_id) REFERENCES users(id),
  CONSTRAINT fk_transfer_requester FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_transfer_approver FOREIGN KEY (approved_by) REFERENCES users(id)
);
