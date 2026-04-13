<?php
// backend/api/projects.php
header("Content-Type: application/json");
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM projects");
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($projects);
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if(!$data) $data = $_POST;

    $id = isset($data['id']) ? $data['id'] : 'proj_' . time() . rand(100,999);
    $title = isset($data['title']) ? $data['title'] : 'Nuovo Progetto';
    $desc = isset($data['desc']) ? $data['desc'] : '';
    $status = isset($data['status']) ? $data['status'] : 'todo';

    try {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO projects (id, title, desc, status) VALUES (?, ?, ?, ?)");
        $stmt->execute([$id, $title, $desc, $status]);
        echo json_encode(["success" => true, "id" => $id, "message" => "Progetto salvato con successo."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to save project: " . $e->getMessage()]);
    }
}
