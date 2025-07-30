<?php
// api/login.php
session_start();
header('Content-Type: application/json');

require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);

$username = $input['username'] ?? '';
$password = $input['password'] ?? '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Nombre de usuario y contraseña son obligatorios.']);
    exit;
}

// Preparar la consulta
$stmt = $conn->prepare("SELECT id, username, password FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();
    // Verificar la contraseña
    if (password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        echo json_encode(['success' => true, 'message' => 'Inicio de sesión exitoso.', 'username' => $user['username']]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Credenciales inválidas.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Credenciales inválidas.']);
}

$stmt->close();
$conn->close();
?>

