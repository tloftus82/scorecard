<?php
// Disable browser caching
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header('Content-Type: application/json');

$directory = 'games/';
if (!is_dir($directory)) {
    echo json_encode([]);
    exit;
}

$teamFilter = isset($_GET['team']) ? $_GET['team'] : '';

$files = array_diff(scandir($directory), ['.', '..']);
$games = array_filter($files, function($f) {
    return pathinfo($f, PATHINFO_EXTENSION) === 'json';
});
rsort($games);

$result = [];
foreach ($games as $file) {
    $data = @json_decode(file_get_contents($directory . $file), true);
    if (!is_array($data)) continue;
    $team = $data['team'] ?? '';
    if ($teamFilter && $team !== $teamFilter) continue;
    $result[] = [
        'file'     => $file,
        'team'     => $team,
        'opponent' => $data['opponent'] ?? ''
    ];
}

echo json_encode($result);
