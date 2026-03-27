<?php
// Disable browser caching
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

$directory = 'games/';
$files = array_diff(scandir($directory), array('.', '..'));
$games = array_filter($files, function($file) {
    return pathinfo($file, PATHINFO_EXTENSION) === 'json';
});
echo json_encode(array_values($games));
?>

