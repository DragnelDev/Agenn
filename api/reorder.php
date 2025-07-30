<?php
// api/reorder.php
session_start();
header('Content-Type: application/json');

require_once 'config.php';

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado. Por favor, inicie sesión.']);
    exit;
}

$user_id = $_SESSION['user_id'];
$input = json_decode(file_get_contents('php://input'), true);

$items = $input['items'] ?? [];
$type = $input['type'] ?? ''; // 'tasks' or 'events'

if (empty($items) || !in_array($type, ['tasks', 'events'])) {
    echo json_encode(['success' => false, 'message' => 'Datos inválidos para reordenar.']);
    exit;
}

$table_name = ($type === 'tasks') ? 'tasks' : 'events';

// Iniciar una transacción
$conn->begin_transaction();
$success = true;

foreach ($items as $item) {
    $id = $item['id'] ?? null;
    $order = $item['order'] ?? null;

    if ($id === null || $order === null) {
        $success = false;
        break;
    }

    $stmt = $conn->prepare("UPDATE " . $table_name . " SET orden = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param("iii", $order, $id, $user_id);
    if (!$stmt->execute()) {
        $success = false;
        break;
    }
    $stmt->close();
}

if ($success) {
    $conn->commit();
    echo json_encode(['success' => true, 'message' => ucwords($type) . ' reordenadas exitosamente.']);
} else {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error al reordenar ' . $type . '.']);
}

$conn->close();
?>

