<?php
// api/tasks.php
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
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $completed_filter = $_GET['completed'] ?? null;
        $search = $_GET['search'] ?? '';
        $sortBy = $_GET['sortBy'] ?? 'orden';
        $sortOrder = $_GET['sortOrder'] ?? 'asc';
        $limit = $_GET['limit'] ?? null;
        $offset = $_GET['offset'] ?? 0;

        $sql = "SELECT id, titulo, descripcion, fecha_vencimiento, completada, orden FROM tasks WHERE user_id = ?";
        $params = [$user_id];
        $types = "i";

        if ($completed_filter !== null) {
            $sql .= " AND completada = ?";
            $params[] = ($completed_filter === 'true' ? 1 : 0);
            $types .= "i";
        }

        if (!empty($search)) {
            $sql .= " AND (titulo LIKE ? OR descripcion LIKE ?)";
            $params[] = "%" . $search . "%";
            $params[] = "%" . $search . "%";
            $types .= "ss";
        }

        // Obtener el total de tareas para paginación
        $count_sql = "SELECT COUNT(*) AS total FROM tasks WHERE user_id = ?";
        $count_params = [$user_id];
        $count_types = "i";

        if ($completed_filter !== null) {
            $count_sql .= " AND completada = ?";
            $count_params[] = ($completed_filter === 'true' ? 1 : 0);
            $count_types .= "i";
        }
        if (!empty($search)) {
            $count_sql .= " AND (titulo LIKE ? OR descripcion LIKE ?)";
            $count_params[] = "%" . $search . "%";
            $count_params[] = "%" . $search . "%";
            $count_types .= "ss";
        }

        $stmt_count = $conn->prepare($count_sql);
        if (count($count_params) > 0) {
            $stmt_count->bind_param($count_types, ...$count_params);
        }
        $stmt_count->execute();
        $total_result = $stmt_count->get_result()->fetch_assoc();
        $total_tasks = $total_result['total'];
        $stmt_count->close();


        // Sorting
        $allowedSortBy = ['id', 'titulo', 'fecha_vencimiento', 'completada', 'orden'];
        if (!in_array($sortBy, $allowedSortBy)) {
            $sortBy = 'orden'; // Default sorting
        }

        $sortOrder = (strtolower($sortOrder) === 'desc') ? 'DESC' : 'ASC';

        if ($sortBy === 'completada') {
            // Special sorting for 'completada': pending first, then completed
            $sql .= " ORDER BY completada ASC, " . $sortBy . " " . $sortOrder;
        } else {
             $sql .= " ORDER BY " . $sortBy . " " . $sortOrder;
        }


        // Pagination
        if ($limit !== null) {
            $sql .= " LIMIT ? OFFSET ?";
            $params[] = (int)$limit;
            $params[] = (int)$offset;
            $types .= "ii";
        }

        $stmt = $conn->prepare($sql);
        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        $tasks = $result->fetch_all(MYSQLI_ASSOC);

        echo json_encode(['success' => true, 'data' => $tasks, 'total' => $total_tasks]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $titulo = $input['titulo'] ?? '';
        $descripcion = $input['descripcion'] ?? null;
        $fecha_vencimiento = $input['fecha_vencimiento'] ?? null;

        if (empty($titulo)) {
            echo json_encode(['success' => false, 'message' => 'El título de la tarea es obligatorio.']);
            exit;
        }

        // Obtener el siguiente valor de orden
        $stmt_order = $conn->prepare("SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM tasks WHERE user_id = ?");
        $stmt_order->bind_param("i", $user_id);
        $stmt_order->execute();
        $next_order = $stmt_order->get_result()->fetch_assoc()['next_order'];
        $stmt_order->close();

        $stmt = $conn->prepare("INSERT INTO tasks (user_id, titulo, descripcion, fecha_vencimiento, orden) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("isssi", $user_id, $titulo, $descripcion, $fecha_vencimiento, $next_order);

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Tarea añadida exitosamente.', 'id' => $conn->insert_id]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al añadir tarea: ' . $stmt->error]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;
        $titulo = $input['titulo'] ?? null;
        $descripcion = $input['descripcion'] ?? null;
        $fecha_vencimiento = $input['fecha_vencimiento'] ?? null;
        $completada = $input['completada'] ?? null;

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de tarea es obligatorio para actualizar.']);
            exit;
        }

        $updates = [];
        $params = [];
        $types = "";

        if ($titulo !== null) {
            $updates[] = "titulo = ?";
            $params[] = $titulo;
            $types .= "s";
        }
        if ($descripcion !== null) {
            $updates[] = "descripcion = ?";
            $params[] = $descripcion;
            $types .= "s";
        }
        if ($fecha_vencimiento !== null) {
            $updates[] = "fecha_vencimiento = ?";
            $params[] = $fecha_vencimiento;
            $types .= "s";
        }
        if ($completada !== null) {
            $updates[] = "completada = ?";
            $params[] = $completada;
            $types .= "i";
        }

        if (empty($updates)) {
            echo json_encode(['success' => false, 'message' => 'No hay datos para actualizar.']);
            exit;
        }

        $sql = "UPDATE tasks SET " . implode(', ', $updates) . " WHERE id = ? AND user_id = ?";
        $params[] = $id;
        $params[] = $user_id;
        $types .= "ii";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Tarea actualizada exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'No se encontró la tarea o no hay cambios para actualizar.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar tarea: ' . $stmt->error]);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de tarea es obligatorio para eliminar.']);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $id, $user_id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Tarea eliminada exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'No se encontró la tarea o no tienes permiso para eliminarla.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al eliminar tarea: ' . $stmt->error]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

