<?php
// Set CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$db_path = '../../db.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($db_path)) {
        $default_db = [
            "cheatExeUsers" => new stdClass(),
            "cheatExeKeyHistory" => [],
            "cheatExeAuditLogs" => [],
            "cheatExeDevices" => [],
            "cheatExeBannedUsers" => [],
            "adminUser" => "JACK",
            "adminPass" => "22153310"
        ];
        file_put_contents($db_path, json_encode($default_db, JSON_PRETTY_PRINT));
    }
    
    $data = file_get_contents($db_path);
    header("Content-Type: application/json");
    echo $data;
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    
    // Check if input is valid JSON
    $decoded = json_decode($input);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        header("Content-Type: application/json");
        echo json_encode(["success" => false, "message" => "Invalid JSON payload"]);
        exit;
    }
    
    // Save JSON to file
    if (file_put_contents($db_path, json_encode($decoded, JSON_PRETTY_PRINT))) {
        header("Content-Type: application/json");
        echo json_encode(["success" => true, "message" => "Database saved successfully"]);
    } else {
        http_response_code(500);
        header("Content-Type: application/json");
        echo json_encode(["success" => false, "message" => "Failed to write database file"]);
    }
} else {
    http_response_code(405);
    header("Content-Type: application/json");
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
}
