<?php
// api/config.php

define('DB_SERVER', 'nozomi.proxy.rlwy.net');
define('DB_USERNAME', 'root'); 
define('DB_PASSWORD', 'UvCnpVFeTNeJEGgDDsBUPizBKBPWlxeO');     // contraseña de BD
define('DB_NAME', 'railway'); //nombre de tu BD

// Intentar conexión a la base de datos MySQL
$conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);

// Verificar la conexión
if ($conn->connect_error) {
    die("Error de conexión a la base de datos: " . $conn->connect_error);
}

// Configurar el conjunto de caracteres a UTF8
$conn->set_charset("utf8mb4");
?>
