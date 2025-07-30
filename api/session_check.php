<?php
// api/session_check.php
session_start();
header('Content-Type: application/json');

$response = [
    'isLoggedIn' => false,
    'username' => null
];

if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
    $response['isLoggedIn'] = true;
    $response['username'] = $_SESSION['username'];
}

echo json_encode($response);
?>
