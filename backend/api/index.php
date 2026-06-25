<?php

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';

function input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond($payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function require_fields(array $data, array $fields): void
{
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
            respond(['error' => "{$field} is required"], 422);
        }
    }
}

function validate_password(string $password): void
{
    if (strlen($password) < 6 || !preg_match('/[^A-Za-z0-9]/', $password)) {
        respond(['error' => 'Password must be at least 6 characters and include one special character.'], 422);
    }
}

function normalize_quantity_unit(array $data): string
{
    $quantity = trim((string) ($data['quantity_au'] ?? ''));
    $unit = trim((string) ($data['unit'] ?? ''));
    $allowedUnits = ['kg', 'no.', 'dozen'];

    if ($quantity === '') {
        respond(['error' => 'quantity_au is required'], 422);
    }

    if ($unit === '') {
        foreach ($allowedUnits as $candidate) {
            if (preg_match('/\s' . preg_quote($candidate, '/') . '$/', $quantity)) {
                return $quantity;
            }
        }
        $unit = 'no.';
    }

    if (!in_array($unit, $allowedUnits, true)) {
        respond(['error' => 'Invalid unit'], 422);
    }

    return $quantity . ' ' . $unit;
}

function user_payload(array $user): array
{
    return [
        'id' => $user['id'],
        'name' => $user['name'],
        'gender' => $user['gender'] ?? '',
        'cadre_id' => $user['cadre_id'] ?? '',
        'designation_id' => $user['designation_id'] ?? '',
        'group_id' => $user['group_id'] ?? '',
        'email' => $user['email'],
        'mobile_no' => $user['mobile_no'] ?? '',
        'telephone_no' => $user['telephone_no'] ?? '',
        'role' => $user['role'],
    ];
}

function validate_master_link(PDO $pdo, array $data): void
{
    require_fields($data, ['cadre_id', 'designation_id', 'group_id']);

    $stmt = $pdo->prepare(
        'SELECT gm.id
         FROM groups_master gm
         JOIN designations d ON d.id = gm.designation_id
         WHERE gm.id = ? AND gm.cadre_id = ? AND gm.designation_id = ? AND d.cadre_id = ?'
    );
    $stmt->execute([
        (int) $data['group_id'],
        (int) $data['cadre_id'],
        (int) $data['designation_id'],
        (int) $data['cadre_id'],
    ]);

    if (!$stmt->fetch()) {
        respond(['error' => 'Selected cadre, designation, and group are not linked.'], 422);
    }
}

function master_data(PDO $pdo): array
{
    return [
        'cadres' => $pdo->query('SELECT id, name, is_active FROM cadres ORDER BY name')->fetchAll(),
        'designations' => $pdo->query(
            'SELECT d.id, d.name, d.cadre_id, c.name AS cadre_name, d.is_active
             FROM designations d
             JOIN cadres c ON c.id = d.cadre_id
             ORDER BY c.name, d.name'
        )->fetchAll(),
        'groups' => $pdo->query(
            'SELECT gm.id, gm.name, gm.cadre_id, gm.designation_id,
                    c.name AS cadre_name, d.name AS designation_name, gm.is_active
             FROM groups_master gm
             JOIN cadres c ON c.id = gm.cadre_id
             JOIN designations d ON d.id = gm.designation_id
             ORDER BY c.name, d.name, gm.name'
        )->fetchAll(),
    ];
}

function auth(PDO $pdo): array
{
    if (empty($_SESSION['user_id'])) {
        respond(['error' => 'Authentication required'], 401);
    }

    $stmt = $pdo->prepare(
        'SELECT id, name, gender, cadre_id, designation_id, group_id, email, mobile_no, telephone_no, role
         FROM users WHERE id = ?'
    );
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        respond(['error' => 'Invalid session'], 401);
    }

    return $user;
}

function require_role(array $user, array $roles): void
{
    if (!in_array($user['role'], $roles, true)) {
        respond(['error' => 'Permission denied'], 403);
    }
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($action === 'masters' && $method === 'GET') {
        respond(master_data($pdo));
    }

    if ($action === 'register' && $method === 'POST') {
        $data = input();
        require_fields($data, ['name', 'gender', 'email', 'mobile_no', 'password']);
        if (!in_array($data['gender'], ['male', 'female', 'other'], true)) {
            respond(['error' => 'Invalid gender'], 422);
        }
        validate_master_link($pdo, $data);
        validate_password($data['password']);

        $stmt = $pdo->prepare(
            'INSERT INTO users
             (name, gender, cadre_id, designation_id, group_id, email, mobile_no, telephone_no, password_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            trim($data['name']),
            $data['gender'],
            (int) $data['cadre_id'],
            (int) $data['designation_id'],
            (int) $data['group_id'],
            strtolower(trim($data['email'])),
            trim($data['mobile_no']),
            trim($data['telephone_no'] ?? ''),
            password_hash($data['password'], PASSWORD_DEFAULT),
        ]);

        respond(['message' => 'Registration successful. Login to continue.'], 201);
    }

    if ($action === 'login' && $method === 'POST') {
        $data = input();
        require_fields($data, ['email', 'password']);

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([strtolower(trim($data['email']))]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($data['password'], $user['password_hash'])) {
            respond(['error' => 'Invalid email or password'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];

        respond([
            'user' => user_payload($user),
        ]);
    }

    $user = auth($pdo);

    if ($action === 'me' && $method === 'GET') {
        respond(['user' => user_payload($user)]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(['message' => 'Logged out']);
    }

    if ($action === 'profile' && $method === 'PUT') {
        $data = input();
        require_fields($data, ['name', 'gender', 'email', 'mobile_no']);
        if (!in_array($data['gender'], ['male', 'female', 'other'], true)) {
            respond(['error' => 'Invalid gender'], 422);
        }
        validate_master_link($pdo, $data);
        $stmt = $pdo->prepare(
            'UPDATE users
             SET name = ?, gender = ?, cadre_id = ?, designation_id = ?, group_id = ?,
                 email = ?, mobile_no = ?, telephone_no = ?
             WHERE id = ?'
        );
        $stmt->execute([
            trim($data['name']),
            $data['gender'],
            (int) $data['cadre_id'],
            (int) $data['designation_id'],
            (int) $data['group_id'],
            strtolower(trim($data['email'])),
            trim($data['mobile_no']),
            trim($data['telephone_no'] ?? ''),
            $user['id'],
        ]);
        respond(['message' => 'Profile updated']);
    }

    if ($action === 'password' && $method === 'PUT') {
        $data = input();
        require_fields($data, ['current_password', 'new_password']);
        validate_password($data['new_password']);

        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($data['current_password'], $row['password_hash'])) {
            respond(['error' => 'Current password is incorrect'], 422);
        }

        $hash = password_hash($data['new_password'], PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $user['id']]);
        respond(['message' => 'Password updated']);
    }

    if ($action === 'users' && $method === 'GET') {
        $stmt = $pdo->query(
            'SELECT u.id, u.name, u.gender, u.cadre_id, c.name AS cadre_name,
                    u.designation_id, d.name AS designation_name,
                    u.group_id, gm.name AS group_name,
                    u.email, u.mobile_no, u.telephone_no, u.role
             FROM users u
             LEFT JOIN cadres c ON c.id = u.cadre_id
             LEFT JOIN designations d ON d.id = u.designation_id
             LEFT JOIN groups_master gm ON gm.id = u.group_id
             ORDER BY u.name'
        );
        respond(['users' => $stmt->fetchAll()]);
    }

    if ($action === 'role' && $method === 'PUT') {
        require_role($user, ['admin']);
        $data = input();
        require_fields($data, ['user_id', 'role']);
        if (!in_array($data['role'], ['user', 'inventory_head', 'admin'], true)) {
            respond(['error' => 'Invalid role'], 422);
        }
        $pdo->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$data['role'], (int) $data['user_id']]);
        respond(['message' => 'Role updated']);
    }

    if ($action === 'cadre' && in_array($method, ['POST', 'PUT'], true)) {
        require_role($user, ['admin']);
        $data = input();
        require_fields($data, ['name']);
        if ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO cadres (name, is_active) VALUES (?, ?)');
            $stmt->execute([trim($data['name']), (int) ($data['is_active'] ?? 1)]);
            respond(['message' => 'Cadre added'], 201);
        }
        require_fields($data, ['id']);
        $stmt = $pdo->prepare('UPDATE cadres SET name = ?, is_active = ? WHERE id = ?');
        $stmt->execute([trim($data['name']), (int) ($data['is_active'] ?? 1), (int) $data['id']]);
        respond(['message' => 'Cadre updated']);
    }

    if ($action === 'designation' && in_array($method, ['POST', 'PUT'], true)) {
        require_role($user, ['admin']);
        $data = input();
        require_fields($data, ['cadre_id', 'name']);
        if ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO designations (cadre_id, name, is_active) VALUES (?, ?, ?)');
            $stmt->execute([(int) $data['cadre_id'], trim($data['name']), (int) ($data['is_active'] ?? 1)]);
            respond(['message' => 'Designation added'], 201);
        }
        require_fields($data, ['id']);
        $stmt = $pdo->prepare('UPDATE designations SET cadre_id = ?, name = ?, is_active = ? WHERE id = ?');
        $stmt->execute([(int) $data['cadre_id'], trim($data['name']), (int) ($data['is_active'] ?? 1), (int) $data['id']]);
        respond(['message' => 'Designation updated']);
    }

    if ($action === 'group' && in_array($method, ['POST', 'PUT'], true)) {
        require_role($user, ['admin']);
        $data = input();
        require_fields($data, ['cadre_id', 'designation_id', 'name']);

        $stmt = $pdo->prepare('SELECT id FROM designations WHERE id = ? AND cadre_id = ?');
        $stmt->execute([(int) $data['designation_id'], (int) $data['cadre_id']]);
        if (!$stmt->fetch()) {
            respond(['error' => 'Designation does not belong to selected cadre'], 422);
        }

        if ($method === 'POST') {
            $stmt = $pdo->prepare('INSERT INTO groups_master (cadre_id, designation_id, name, is_active) VALUES (?, ?, ?, ?)');
            $stmt->execute([(int) $data['cadre_id'], (int) $data['designation_id'], trim($data['name']), (int) ($data['is_active'] ?? 1)]);
            respond(['message' => 'Group added'], 201);
        }
        require_fields($data, ['id']);
        $stmt = $pdo->prepare('UPDATE groups_master SET cadre_id = ?, designation_id = ?, name = ?, is_active = ? WHERE id = ?');
        $stmt->execute([(int) $data['cadre_id'], (int) $data['designation_id'], trim($data['name']), (int) ($data['is_active'] ?? 1), (int) $data['id']]);
        respond(['message' => 'Group updated']);
    }

    if ($action === 'inventories' && $method === 'GET') {
        $stmt = $pdo->query(
            'SELECT i.id, i.ledger_page_no, i.nomenclature, i.quantity_au, i.owner_user_id,
                    owner.name AS owner_name, creator.name AS created_by_name
             FROM inventories i
             JOIN users owner ON owner.id = i.owner_user_id
             JOIN users creator ON creator.id = i.created_by
             ORDER BY i.id DESC'
        );
        respond(['inventories' => $stmt->fetchAll()]);
    }

    if ($action === 'inventories' && $method === 'POST') {
        $data = input();
        require_fields($data, ['ledger_page_no', 'nomenclature', 'quantity_au']);
        $stmt = $pdo->prepare(
            'INSERT INTO inventories (ledger_page_no, nomenclature, quantity_au, owner_user_id, created_by)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            trim($data['ledger_page_no']),
            trim($data['nomenclature']),
            normalize_quantity_unit($data),
            $user['id'],
            $user['id'],
        ]);
        respond(['message' => 'Inventory added'], 201);
    }

    if ($action === 'inventories' && $method === 'PUT') {
        $data = input();
        require_fields($data, ['id', 'ledger_page_no', 'nomenclature', 'quantity_au']);
        $stmt = $pdo->prepare('UPDATE inventories SET ledger_page_no = ?, nomenclature = ?, quantity_au = ? WHERE id = ?');
        $stmt->execute([
            trim($data['ledger_page_no']),
            trim($data['nomenclature']),
            normalize_quantity_unit($data),
            (int) $data['id'],
        ]);
        respond(['message' => 'Inventory updated']);
    }

    if ($action === 'transfer_requests' && $method === 'GET') {
        $stmt = $pdo->query(
            'SELECT tr.*, inv.nomenclature, inv.ledger_page_no,
                    from_user.name AS from_user_name, to_user.name AS to_user_name,
                    requester.name AS requested_by_name, approver.name AS approved_by_name
             FROM transfer_requests tr
             JOIN inventories inv ON inv.id = tr.inventory_id
             JOIN users from_user ON from_user.id = tr.from_user_id
             JOIN users to_user ON to_user.id = tr.to_user_id
             JOIN users requester ON requester.id = tr.requested_by
             LEFT JOIN users approver ON approver.id = tr.approved_by
             ORDER BY tr.id DESC'
        );
        respond(['requests' => $stmt->fetchAll()]);
    }

    if ($action === 'transfer_requests' && $method === 'POST') {
        $data = input();
        require_fields($data, ['inventory_id', 'to_user_id']);
        if ((int) $data['to_user_id'] === (int) $user['id']) {
            respond(['error' => 'Select another existing user for transfer.'], 422);
        }

        $stmt = $pdo->prepare('SELECT owner_user_id FROM inventories WHERE id = ?');
        $stmt->execute([(int) $data['inventory_id']]);
        $inventory = $stmt->fetch();
        if (!$inventory || (int) $inventory['owner_user_id'] !== (int) $user['id']) {
            respond(['error' => 'You can request transfer only for inventory under your ownership.'], 403);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
        $stmt->execute([(int) $data['to_user_id']]);
        if (!$stmt->fetch()) {
            respond(['error' => 'Target user does not exist.'], 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO transfer_requests (inventory_id, from_user_id, to_user_id, requested_by, note, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );
        $stmt->execute([
            (int) $data['inventory_id'],
            $user['id'],
            (int) $data['to_user_id'],
            $user['id'],
            trim($data['note'] ?? ''),
        ]);
        respond(['message' => 'Transfer request sent to inventory head'], 201);
    }

    if ($action === 'approve_transfer' && $method === 'PUT') {
        require_role($user, ['inventory_head', 'admin']);
        $data = input();
        require_fields($data, ['request_id', 'decision']);
        if (!in_array($data['decision'], ['approved', 'rejected'], true)) {
            respond(['error' => 'Decision must be approved or rejected'], 422);
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT * FROM transfer_requests WHERE id = ? AND status = ? FOR UPDATE');
        $stmt->execute([(int) $data['request_id'], 'pending']);
        $request = $stmt->fetch();
        if (!$request) {
            $pdo->rollBack();
            respond(['error' => 'Pending request not found'], 404);
        }

        if ($data['decision'] === 'approved') {
            $stmt = $pdo->prepare('UPDATE inventories SET owner_user_id = ? WHERE id = ? AND owner_user_id = ?');
            $stmt->execute([(int) $request['to_user_id'], (int) $request['inventory_id'], (int) $request['from_user_id']]);
        }

        $stmt = $pdo->prepare('UPDATE transfer_requests SET status = ?, approved_by = ?, decided_at = NOW() WHERE id = ?');
        $stmt->execute([$data['decision'], $user['id'], (int) $data['request_id']]);
        $pdo->commit();

        respond(['message' => $data['decision'] === 'approved' ? 'Transfer approved and completed' : 'Transfer rejected']);
    }

    respond(['error' => 'Route not found'], 404);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        respond(['error' => 'Duplicate or invalid related data.'], 422);
    }
    respond(['error' => 'Database error: ' . $e->getMessage()], 500);
} catch (Throwable $e) {
    respond(['error' => 'Server error: ' . $e->getMessage()], 500);
}
