<?php
// api/events.php
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
        $search = $_GET['search'] ?? '';
        $sortBy = $_GET['sortBy'] ?? 'orden';
        $sortOrder = $_GET['sortOrder'] ?? 'asc';
        $limit = $_GET['limit'] ?? null;
        $offset = $_GET['offset'] ?? 0;

        $sql = "SELECT id, titulo, descripcion, fecha_inicio, fecha_fin, orden FROM events WHERE user_id = ?";
        $params = [$user_id];
        $types = "i";

        if (!empty($search)) {
            $sql .= " AND (titulo LIKE ? OR descripcion LIKE ?)";
            $params[] = "%" . $search . "%";
            $params[] = "%" . $search . "%";
            $types .= "ss";
        }

        // Obtener el total de eventos para paginación
        $count_sql = "SELECT COUNT(*) AS total FROM events WHERE user_id = ?";
        $count_params = [$user_id];
        $count_types = "i";
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
        $total_events = $total_result['total'];
        $stmt_count->close();

        // Sorting
        $allowedSortBy = ['id', 'titulo', 'fecha_inicio', 'fecha_fin', 'orden'];
        if (!in_array($sortBy, $allowedSortBy)) {
            $sortBy = 'orden'; // Default sorting
        }

        $sortOrder = (strtolower($sortOrder) === 'desc') ? 'DESC' : 'ASC';
        $sql .= " ORDER BY " . $sortBy . " " . $sortOrder;

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
        $events = $result->fetch_all(MYSQLI_ASSOC);

        echo json_encode(['success' => true, 'data' => $events, 'total' => $total_events]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $titulo = $input['titulo'] ?? '';
        $descripcion = $input['descripcion'] ?? null;
        $fecha_inicio = $input['fecha_inicio'] ?? null;
        $fecha_fin = $input['fecha_fin'] ?? null;

        if (empty($titulo) || empty($fecha_inicio) || empty($fecha_fin)) {
            echo json_encode(['success' => false, 'message' => 'Título, fecha de inicio y fecha de fin son obligatorios.']);
            exit;
        }

        // Validar fechas
        if (new DateTime($fecha_inicio) >= new DateTime($fecha_fin)) {
            echo json_encode(['success' => false, 'message' => 'La fecha de fin debe ser posterior a la de inicio.']);
            exit;
        }

        // Obtener el siguiente valor de orden
        $stmt_order = $conn->prepare("SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM events WHERE user_id = ?");
        $stmt_order->bind_param("i", $user_id);
        $stmt_order->execute();
        $next_order = $stmt_order->get_result()->fetch_assoc()['next_order'];
        $stmt_order->close();

        $stmt = $conn->prepare("INSERT INTO events (user_id, titulo, descripcion, fecha_inicio, fecha_fin, orden) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("issssi", $user_id, $titulo, $descripcion, $fecha_inicio, $fecha_fin, $next_order);

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Evento añadido exitosamente.', 'id' => $conn->insert_id]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al añadir evento: ' . $stmt->error]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;
        $titulo = $input['titulo'] ?? null;
        $descripcion = $input['descripcion'] ?? null;
        $fecha_inicio = $input['fecha_inicio'] ?? null;
        $fecha_fin = $input['fecha_fin'] ?? null;

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de evento es obligatorio para actualizar.']);
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
        if ($fecha_inicio !== null) {
            $updates[] = "fecha_inicio = ?";
            $params[] = $fecha_inicio;
            $types .= "s";
        }
        if ($fecha_fin !== null) {
            $updates[] = "fecha_fin = ?";
            $params[] = $fecha_fin;
            $types .= "s";
        }

        if (empty($updates)) {
            echo json_encode(['success' => false, 'message' => 'No hay datos para actualizar.']);
            exit;
        }

        // Validar fechas si ambas están siendo actualizadas
        if ($fecha_inicio !== null && $fecha_fin !== null) {
             if (new DateTime($fecha_inicio) >= new DateTime($fecha_fin)) {
                echo json_encode(['success' => false, 'message' => 'La fecha de fin debe ser posterior a la de inicio.']);
                exit;
            }
        } elseif ($fecha_inicio !== null && $fecha_fin === null) {
            // Si solo se actualiza fecha_inicio, necesitamos la fecha_fin actual para validar
            $stmt_check = $conn->prepare("SELECT fecha_fin FROM events WHERE id = ? AND user_id = ?");
            $stmt_check->bind_param("ii", $id, $user_id);
            $stmt_check->execute();
            $current_event = $stmt_check->get_result()->fetch_assoc();
            $stmt_check->close();
            if ($current_event && new DateTime($fecha_inicio) >= new DateTime($current_event['fecha_fin'])) {
                echo json_encode(['success' => false, 'message' => 'La fecha de fin debe ser posterior a la de inicio.']);
                exit;
            }
        } elseif ($fecha_fin !== null && $fecha_inicio === null) {
            // Si solo se actualiza fecha_fin, necesitamos la fecha_inicio actual para validar
            $stmt_check = $conn->prepare("SELECT fecha_inicio FROM events WHERE id = ? AND user_id = ?");
            $stmt_check->bind_param("ii", $id, $user_id);
            $stmt_check->execute();
            $current_event = $stmt_check->get_result()->fetch_assoc();
            $stmt_check->close();
            if ($current_event && new DateTime($current_event['fecha_inicio']) >= new DateTime($fecha_fin)) {
                echo json_encode(['success' => false, 'message' => 'La fecha de fin debe ser posterior a la de inicio.']);
                exit;
            }
        }


        $sql = "UPDATE events SET " . implode(', ', $updates) . " WHERE id = ? AND user_id = ?";
        $params[] = $id;
        $params[] = $user_id;
        $types .= "ii";

        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Evento actualizado exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'No se encontró el evento o no hay cambios para actualizar.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar evento: ' . $stmt->error]);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de evento es obligatorio para eliminar.']);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM events WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $id, $user_id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Evento eliminado exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'No se encontró el evento o no tienes permiso para eliminarlo.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al eliminar evento: ' . $stmt->error]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>
