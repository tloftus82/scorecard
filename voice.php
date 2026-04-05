<?php
require_once __DIR__ . '/voice_config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (empty($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No audio received']);
    exit;
}

$tmpFile  = $_FILES['audio']['tmp_name'];
$origName = $_FILES['audio']['name'] ?? 'audio.webm';
$mimeType = $_FILES['audio']['type'] ?: 'audio/webm';

$ch = curl_init('https://api.elevenlabs.io/v1/speech-to-text');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => ['xi-api-key: ' . $elevenLabsApiKey],
    CURLOPT_POSTFIELDS     => [
        'file'          => new CURLFile($tmpFile, $mimeType, $origName),
        'model_id'      => 'scribe_v1',
        'language_code' => 'en',   // force English recognition
        'num_speakers'  => '1',    // single speaker optimisation
    ],
]);

$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200) {
    http_response_code(500);
    echo json_encode(['error' => 'ElevenLabs API error', 'status' => $code]);
    exit;
}

$result = json_decode($body, true);
echo json_encode(['text' => $result['text'] ?? '']);
