CREATE DATABASE IF NOT EXISTS inventory_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  gender ENUM('male', 'female', 'other') NULL,
  cadre_id INT NULL,
  designation_id INT NULL,
  group_id INT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  mobile_no VARCHAR(20) NULL,
  telephone_no VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'inventory_head', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cadres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS designations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cadre_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_designation_per_cadre (cadre_id, name),
  CONSTRAINT fk_designation_cadre FOREIGN KEY (cadre_id) REFERENCES cadres(id)
);

CREATE TABLE IF NOT EXISTS groups_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cadre_id INT NOT NULL,
  designation_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_group_link (cadre_id, designation_id, name),
  CONSTRAINT fk_group_cadre FOREIGN KEY (cadre_id) REFERENCES cadres(id),
  CONSTRAINT fk_group_designation FOREIGN KEY (designation_id) REFERENCES designations(id)
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
