<?php
// Set CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $api_url = "https://auth.terminalx999.online/api_admin.php";
    
    // Read raw input
    $post_data = file_get_contents('php://input');
    
    // Proxy the request using curl
    $ch = curl_init($api_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
    
    // Set headers
    $content_type = $_SERVER['CONTENT_TYPE'] ?? 'application/json';
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: " . $content_type
    ]);
    
    // Disable SSL verification for curl
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Send back response code and body
    http_response_code($http_code);
    header("Content-Type: application/json");
    echo $response;
} else {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
}
