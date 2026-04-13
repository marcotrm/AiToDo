<?php
// backend/api/tasks.php
header("Content-Type: application/json");
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM notes");
    $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($notes);
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if(!$data) $data = $_POST;

    $text = isset($data['text']) ? $data['text'] : 'Nuova nota vuota';
    $priority = isset($data['priority']) ? $data['priority'] : 'Media';

    try {
        $stmt = $pdo->prepare("INSERT INTO notes (text, priority) VALUES (?, ?)");
        $stmt->execute([$text, $priority]);
        $id = $pdo->lastInsertId();
        echo json_encode(["success" => true, "id" => $id, "message" => "Nota salvata con successo."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to save note: " . $e->getMessage()]);
    }
}
