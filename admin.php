<?php
session_start();

define('ADMIN_PASSWORD_HASH', '63b38ded3ce608f47342f48fe9ac1639'); // MD5 of "buddy1120"

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

// ── API: handle POST requests ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    if ($action === 'login') {
        $pw = $data['password'] ?? '';
        // Support plain text (from admin page which hashes client-side) or __plain__ prefix fallback
        if (strpos($pw, '__plain__') === 0) $pw = substr($pw, 9);
        if (md5($pw) === ADMIN_PASSWORD_HASH) {
            $_SESSION['admin'] = true;
            echo json_encode(['ok' => true]);
        } else {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Wrong password']);
        }
        exit;
    }

    if ($action === 'logout') {
        session_destroy();
        echo json_encode(['ok' => true]);
        exit;
    }

    if (empty($_SESSION['admin'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Not authenticated']);
        exit;
    }

    function cleanPlayerName($name) {
        // Strip captain indicators: trailing (C), C, *C*
        $name = preg_replace('/\s+\(?C\)?\s*$/i', '', $name);
        // Collapse whitespace
        $name = trim(preg_replace('/\s+/', ' ', $name));
        // Init-cap, handling hyphens and apostrophes
        $name = ucwords(strtolower($name), " \t\r\n\f\v-'");
        return $name;
    }

    switch ($action) {
        case 'save_teams':
            foreach ($data['teams'] as &$t) {
                if (!empty($t['password']) && strpos($t['password'], '__plain__') === 0) {
                    $t['password'] = md5(substr($t['password'], 9));
                }
            }
            unset($t);
            file_put_contents('teams.json', json_encode($data['teams'], JSON_PRETTY_PRINT));
            echo json_encode(['ok' => true]);
            break;

        case 'save_events':
            file_put_contents('events.json', json_encode($data['events'], JSON_PRETTY_PRINT));
            echo json_encode(['ok' => true]);
            break;

        case 'save_other_events':
            file_put_contents('other_events.json', json_encode($data['events'], JSON_PRETTY_PRINT));
            echo json_encode(['ok' => true]);
            break;

        case 'load_roster':
            $file = preg_replace('/[^a-zA-Z0-9_\/\-\.]/', '', $data['file'] ?? '');
            if (file_exists($file)) {
                echo json_encode(['ok' => true, 'roster' => json_decode(file_get_contents($file), true)]);
            } else {
                echo json_encode(['ok' => true, 'roster' => []]);
            }
            break;

        case 'save_roster':
            $file = preg_replace('/[^a-zA-Z0-9_\/\-\.]/', '', $data['file'] ?? '');
            if (strpos($file, 'rosters/') !== 0) {
                http_response_code(400); echo json_encode(['ok' => false, 'error' => 'Invalid path']); exit;
            }
            // Strip out blank players (no first or last name)
            $roster = array_values(array_filter($data['roster'], function($p) {
                return !empty(trim($p['first_name'])) || !empty(trim($p['last_name']));
            }));
            file_put_contents($file, json_encode($roster, JSON_PRETTY_PRINT));
            echo json_encode(['ok' => true]);
            break;

        case 'delete_game':
            $file = 'games/' . basename($data['file'] ?? '');
            if (file_exists($file)) {
                unlink($file);
                echo json_encode(['ok' => true]);
            } else {
                http_response_code(400); echo json_encode(['ok' => false, 'error' => 'Not found']);
            }
            break;

        case 'fetch_roster_url':
            $url = trim($data['url'] ?? '');
            if (!preg_match('#^https?://www\.gobound\.com/#i', $url)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Only gobound.com URLs are supported']);
                exit;
            }

            // Extract year from URL (e.g. /2025-26/ → 2026)
            $year = 0;
            if (preg_match('#/(\d{4})-(\d{2,4})/#', $url, $ym)) {
                $y2 = $ym[2];
                $year = intval(strlen($y2) === 2 ? '20' . $y2 : $y2);
            }

            // Extract school code from URL
            $schoolCode = '';
            if (preg_match('#gobound\.com/[^/]+/[^/]+/[^/]+/[^/]+/([^/]+)/#', $url, $sm)) {
                $schoolCode = $sm[1];
            }

            // Fetch page
            $html = false;
            if (function_exists('curl_init')) {
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL            => $url,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_TIMEOUT        => 15,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_USERAGENT      => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    CURLOPT_HTTPHEADER     => ['Accept: text/html,application/xhtml+xml', 'Accept-Language: en-US,en;q=0.9']
                ]);
                $html    = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                if ($httpCode !== 200) $html = false;
            }
            if (!$html) {
                $ctx = stream_context_create(['http' => [
                    'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
                    'timeout'    => 15
                ]]);
                $html = @file_get_contents($url, false, $ctx);
            }
            if (!$html) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Could not fetch the URL. The site may block automated requests.']);
                exit;
            }

            // Parse HTML
            $dom = new DOMDocument();
            libxml_use_internal_errors(true);
            $dom->loadHTML('<?xml encoding="UTF-8">' . $html);
            libxml_clear_errors();
            $xpath = new DOMXPath($dom);

            // Gender from URL sport segment
            $sportGender = '';
            if (preg_match('#gobound\.com/[^/]+/[^/]+/([^/]+)/#', $url, $sportM)) {
                $sport = strtolower($sportM[1]);
                if (strpos($sport, 'girl') !== false || strpos($sport, 'women') !== false) $sportGender = '(Girls)';
                elseif (strpos($sport, 'boy') !== false || strpos($sport, 'men') !== false) $sportGender = '(Boys)';
            }

            // Team name — split og:title and page title by pipe/dash, take first meaningful segment
            // (Bound pages: "Bound | Sioux City West Wolverines | |" → "Sioux City West Wolverines")
            $teamName = '';
            $skipWords = '/^(bound|gobound|home|roster|varsity|jv|junior varsity|schedule|stats|iowa|ighsau|soccer|football|basketball|\d{4}(-\d+)?)$/i';

            $titleSources = [];
            foreach ($xpath->query('//meta[@property="og:title"]/@content') as $n) { $titleSources[] = trim($n->nodeValue); }
            foreach ($xpath->query('//title') as $n) { $titleSources[] = trim($n->textContent); }
            foreach ($titleSources as $raw) {
                $parts = array_filter(array_map('trim', preg_split('/\s*[\|\-–—]\s*/', $raw)));
                foreach ($parts as $part) {
                    if (preg_match($skipWords, $part) || strlen($part) < 3) continue;
                    $teamName = $part; break 2;
                }
            }

            // h1/h2 fallback
            if (!$teamName) {
                foreach ($xpath->query('//h1 | //h2') as $n) {
                    $t = trim($n->textContent);
                    if ($t && !preg_match($skipWords, $t)) { $teamName = $t; break; }
                }
            }

            // Clean: strip year, page-type words, sport names, gender words
            $teamName = preg_replace('/\s*\d{4}-\d{2,4}\s*/', ' ', $teamName);
            $teamName = preg_replace('/\s*\b(Roster|Schedule|Stats|Varsity|JV|Junior Varsity)\b\s*/i', ' ', $teamName);
            $sports = 'Soccer|Football|Basketball|Baseball|Softball|Volleyball|Wrestling|Track|Tennis|Golf|Swimming|Lacrosse';
            $teamName = preg_replace('/\s*\b(Girls|Boys|Women\'s|Men\'s|Women|Men)\b\s*\b(' . $sports . ')\b\s*/i', ' ', $teamName);
            $teamName = preg_replace('/\s*\b(' . $sports . ')\b\s*/i', ' ', $teamName);
            $teamName = preg_replace('/\s*\b(Girls|Boys|Women\'s|Men\'s|Women|Men)\b\s*/i', ' ', $teamName);
            // Strip trailing mascot: if last word is likely a mascot (plural noun after a location name), remove it
            // Most Iowa school names are ≤ 3 words; a 4th+ word is almost always the mascot
            $words = preg_split('/\s+/', trim($teamName));
            if (count($words) >= 4) {
                // Remove last word (mascot) as long as the preceding words look like a school name
                array_pop($words);
                $teamName = implode(' ', $words);
            }
            $teamName = trim(preg_replace('/\s+/', ' ', $teamName));
            if ($sportGender && stripos($teamName, 'Girls') === false && stripos($teamName, 'Boys') === false) {
                $teamName .= ' ' . $sportGender;
            }

            // Try to find embedded JSON (Next.js / embedded state)
            $players = [];
            foreach ($xpath->query('//script[@id="__NEXT_DATA__"]') as $script) {
                $json = @json_decode($script->textContent, true);
                if (!$json) continue;
                // Walk the JSON looking for arrays that look like player arrays
                $flat = new RecursiveIteratorIterator(new RecursiveArrayIterator($json));
                foreach ($flat as $val) { /* just checking if json decoded */ }
                // Try common paths
                $roster = $json['props']['pageProps']['roster']
                       ?? $json['props']['pageProps']['athletes']
                       ?? $json['props']['pageProps']['players']
                       ?? null;
                if (is_array($roster) && count($roster)) {
                    foreach ($roster as $p) {
                        $first = $p['first_name'] ?? $p['firstName'] ?? '';
                        $last  = $p['last_name']  ?? $p['lastName']  ?? '';
                        if (!$first && !$last) {
                            $full = $p['name'] ?? $p['fullName'] ?? '';
                            if (strpos($full, ',') !== false) {
                                [$last, $first] = array_map('trim', explode(',', $full, 2));
                            } else {
                                $parts = explode(' ', $full, 2);
                                $first = $parts[0]; $last = $parts[1] ?? '';
                            }
                        }
                        $classRaw  = strtolower($p['grade'] ?? $p['class_year'] ?? $p['year'] ?? $p['grade_level'] ?? '');
                        $classMap  = ['9'=>'FR','10'=>'SO','11'=>'JR','12'=>'SR','freshman'=>'FR','sophomore'=>'SO','junior'=>'JR','senior'=>'SR'];
                        $classNorm = strtoupper($classRaw);
                        $classFinal = $classMap[$classRaw] ?? (in_array($classNorm, ['FR','SO','JR','SR']) ? $classNorm : '');
                        $numRaw2 = (string)($p['number'] ?? $p['jersey'] ?? $p['jersey_number'] ?? '');
                        preg_match('/\d+/', $numRaw2, $numM2);
                        $players[] = [
                            'first_name'      => cleanPlayerName($first),
                            'last_name'       => cleanPlayerName($last),
                            'number'          => $numM2[0] ?? '0',
                            'position'        => $p['position'] ?? $p['pos'] ?? '',
                            'class'           => $classFinal,
                            'default_starter' => 0
                        ];
                    }
                    break;
                }
            }

            // Fallback: parse HTML table
            if (empty($players)) {
                foreach ($xpath->query('//table') as $table) {
                    $headers = [];
                    foreach ($xpath->query('.//thead/tr[1]/th | .//thead/tr[1]/td', $table) as $th) {
                        $headers[] = strtolower(trim(preg_replace('/\s+/', ' ', $th->textContent)));
                    }
                    if (empty($headers)) {
                        foreach ($xpath->query('.//tr[1]/th | .//tr[1]/td', $table) as $th) {
                            $headers[] = strtolower(trim(preg_replace('/\s+/', ' ', $th->textContent)));
                        }
                    }

                    $nameIdx = $numIdx = $posIdx = $classIdx = -1;
                    foreach ($headers as $idx => $h) {
                        if (in_array($h, ['name','player','athlete','full name','athlete name'])) $nameIdx = $idx;
                        if (in_array($h, ['#','no','no.','num','number','jersey','jersey #'])) $numIdx = $idx;
                        if (in_array($h, ['pos','position','pos.'])) $posIdx = $idx;
                        if (in_array($h, ['yr','year','grade','cl','class','gr','grade level'])) $classIdx = $idx;
                    }
                    if ($nameIdx === -1) continue;

                    $rows = $xpath->query('.//tbody/tr', $table);
                    if (!$rows->length) $rows = $xpath->query('.//tr[position()>1]', $table);
                    foreach ($rows as $row) {
                        $cells = $xpath->query('.//td', $row);
                        if (!$cells->length) continue;
                        $nameRaw  = $nameIdx  >= 0 && $cells->length > $nameIdx  ? trim($cells->item($nameIdx)->textContent)  : '';
                        $numRaw   = $numIdx   >= 0 && $cells->length > $numIdx   ? trim($cells->item($numIdx)->textContent)   : '';
                        $posRaw   = $posIdx   >= 0 && $cells->length > $posIdx   ? trim($cells->item($posIdx)->textContent)   : '';
                        $classRaw = $classIdx >= 0 && $cells->length > $classIdx ? trim($cells->item($classIdx)->textContent) : '';
                        if (!$nameRaw) continue;
                        if (strpos($nameRaw, ',') !== false) {
                            [$last, $first] = array_map('trim', explode(',', $nameRaw, 2));
                        } else {
                            $parts = explode(' ', $nameRaw, 2);
                            $first = $parts[0]; $last = $parts[1] ?? '';
                        }
                        $classMap  = ['9'=>'FR','10'=>'SO','11'=>'JR','12'=>'SR','freshman'=>'FR','sophomore'=>'SO','junior'=>'JR','senior'=>'SR'];
                        $classNorm = strtoupper(trim($classRaw));
                        $classFinal = $classMap[strtolower($classRaw)] ?? (in_array($classNorm, ['FR','SO','JR','SR']) ? $classNorm : '');
                        preg_match('/\d+/', $numRaw, $numM);
                        $players[] = [
                            'first_name'      => cleanPlayerName($first),
                            'last_name'       => cleanPlayerName($last),
                            'number'          => $numM[0] ?? '0',
                            'position'        => trim($posRaw),
                            'class'           => $classFinal,
                            'default_starter' => 0
                        ];
                    }
                    if (!empty($players)) break;
                }
            }

            if (empty($players)) {
                echo json_encode(['ok' => false, 'error' => 'Could not find roster data on the page. The site may load data via JavaScript — try saving the page HTML and importing manually.']);
                exit;
            }

            // Sort by jersey number
            usort($players, fn($a,$b) => $a['number'] - $b['number']);

            // Suggested roster filename
            $codeClean = preg_replace('/[^a-z0-9]/', '', strtolower($schoolCode));
            $suggestedFile = 'rosters/roster_' . $codeClean . '_' . $year . '.json';

            echo json_encode([
                'ok'             => true,
                'team_name'      => $teamName,
                'year'           => $year,
                'suggested_file' => $suggestedFile,
                'players'        => $players
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Unknown action']);
    }
    exit;
}

// ── Load data for page ─────────────────────────────────────────────────────
$teams      = json_decode(file_get_contents('teams.json'), true) ?? [];
$events     = json_decode(file_get_contents('events.json'), true) ?? [];
$otherEvents= json_decode(file_get_contents('other_events.json'), true) ?? [];
$gameFiles  = glob('games/*.json') ?: [];
rsort($gameFiles);
$isAdmin    = !empty($_SESSION['admin']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Admin — Soccer Stats</title>
  <link rel="stylesheet" href="css.css?nocache=<?php echo time(); ?>">
  <style>
    .admin-section { background:#1e1e1e; border-radius:8px; padding:12px; margin-bottom:12px; }
    .admin-section h2 { margin:0 0 10px; font-size:13px; color:#3498db; border-bottom:1px solid #333; padding-bottom:6px; }
    .admin-row { display:flex; align-items:center; gap:6px; background:#2a2a2a; border-radius:6px; padding:8px 10px; margin-bottom:4px; }
    .admin-row .row-label { flex:1; font-size:14px; font-weight:600; min-width:0; }
    .admin-row .row-sub { font-size:11px; color:#aaa; margin-top:1px; }
    .admin-row-actions { display:flex; gap:6px; flex-shrink:0; }
    .btn-edit { background:#2980b9; font-size:13px; padding:0 12px; height:32px; }
    .btn-delete { background:#e74c3c; font-size:13px; padding:0 12px; height:32px; }
    .btn-save { background:#27ae60; font-size:13px; padding:0 14px; height:36px; }
    .btn-add { background:#2c3e50; border:1px dashed #555; width:100%; height:36px; font-size:13px; margin-top:4px; }
    .btn-logout { background:#555; font-size:13px; padding:0 14px; height:36px; }
    .edit-form { background:#1a1a1a; border-radius:6px; padding:10px; margin-bottom:6px; display:none; }
    .edit-form.open { display:block; }
    .form-row { display:flex; flex-direction:column; gap:3px; margin-bottom:8px; }
    .form-row label { font-size:11px; color:#aaa; text-transform:uppercase; letter-spacing:0.4px; }
    .form-row input, .form-row select { height:36px; padding:0 10px; font-size:14px; border-radius:6px; border:none; background:#2a2a2a; color:#e0e0e0; width:100%; }
    .form-row-inline { display:flex; gap:8px; }
    .form-row-inline .form-row { flex:1; }
    .form-actions { display:flex; gap:8px; margin-top:8px; }
    .starter-toggle { display:flex; align-items:center; gap:8px; font-size:14px; }
    .starter-toggle input[type=checkbox] { width:20px; height:20px; accent-color:#2ecc71; }
    .game-date { font-size:13px; font-weight:600; }
    .game-vs   { font-size:11px; color:#aaa; }
    .section-save-row { display:flex; justify-content:flex-end; margin-top:8px; }
    #loginSection { max-width:320px; margin:80px auto; background:#1e1e1e; border-radius:10px; padding:24px; }
    #loginSection h2 { text-align:center; font-size:18px; margin-bottom:16px; color:#e0e0e0; text-transform:none; letter-spacing:0; border:none; }
    .admin-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .admin-header h1 { font-size:16px; color:#3498db; }
    .us-them-badges { display:flex; gap:4px; }
    .badge { font-size:10px; padding:2px 6px; border-radius:4px; font-weight:600; }
    .badge-us   { background:#27ae60; color:#fff; }
    .badge-them { background:#e74c3c; color:#fff; }
    .badge-none { background:#444; color:#aaa; }
  </style>
</head>
<body>
<div class="container" style="padding-top:16px; max-width:600px;">

<?php if (!$isAdmin): ?>
<!-- ── Login ── -->
<div id="loginSection">
  <h2>Admin Login</h2>
  <div class="form-row">
    <label>Password</label>
    <input type="password" id="loginPassword" placeholder="Enter admin password">
  </div>
  <button style="width:100%;height:42px;font-size:15px;" onclick="doLogin()">Login</button>
  <div id="loginError" style="color:#e74c3c;font-size:13px;margin-top:8px;text-align:center;"></div>
</div>

<?php else: ?>
<!-- ── Admin Panel ── -->
<div class="admin-header">
  <h1>⚙ Admin Panel</h1>
  <button class="btn-logout" onclick="doLogout()">Logout</button>
</div>

<!-- ══ TEAMS ══════════════════════════════════════════════════════ -->
<div class="admin-section" id="teamsSection">
  <h2>Teams</h2>
  <div id="teamsList"></div>
  <button class="btn-add" onclick="addTeam()">+ Add Team</button>
  <div class="section-save-row">
    <button class="btn-save" onclick="saveTeams()">Save Teams</button>
  </div>
</div>

<!-- ══ IMPORT FROM GOBOUND ═══════════════════════════════════════ -->
<div class="admin-section" id="importSection">
  <h2>Import Roster from Gobound URL</h2>
  <div class="form-row" style="margin-bottom:8px;">
    <label>Gobound Roster URL</label>
    <div style="display:flex;gap:6px;">
      <input id="importUrl" type="url" placeholder="https://www.gobound.com/ia/ighsau/girlssoccer/2025-26/scnorth/v/roster" style="flex:1;">
      <button class="btn-save" style="flex-shrink:0;white-space:nowrap;" onclick="fetchGoboundRoster()">Fetch</button>
    </div>
  </div>
  <div id="importError" style="color:#e74c3c;font-size:13px;display:none;margin-bottom:8px;"></div>
  <div id="importPreview" style="display:none;">
    <div class="form-row-inline" style="margin-bottom:8px;">
      <div class="form-row"><label>Team Name</label><input id="importTeamName"></div>
      <div class="form-row" style="max-width:80px;"><label>Year</label><input id="importYear" type="number"></div>
    </div>
    <div class="form-row" style="margin-bottom:8px;">
      <label>Roster File Path</label>
      <input id="importFile">
    </div>
    <div class="form-row-inline" style="margin-bottom:8px;">
      <div class="form-row"><label>Team Password (for app login)</label><input type="password" id="importPassword" placeholder="set a password"></div>
      <div class="form-row" style="max-width:120px;">
        <label>&nbsp;</label>
        <div class="starter-toggle" style="margin-top:8px;">
          <input type="checkbox" id="importAddTeam" checked>
          <label for="importAddTeam">Add to Teams</label>
        </div>
      </div>
    </div>
    <div style="font-size:11px;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">
      Players — check ★ to mark as default starter
    </div>
    <div id="importPlayerList" style="max-height:320px;overflow-y:auto;border:1px solid #333;border-radius:6px;padding:4px 0;"></div>
    <div style="display:flex;gap:8px;margin-top:6px;align-items:center;">
      <button class="btn-edit" style="font-size:12px;height:28px;padding:0 10px;" onclick="importToggleAll(true)">Check All</button>
      <button class="btn-edit" style="font-size:12px;height:28px;padding:0 10px;" onclick="importToggleAll(false)">Uncheck All</button>
      <span id="importStarterCount" style="font-size:12px;color:#aaa;margin-left:4px;"></span>
    </div>
    <div class="form-actions" style="margin-top:10px;justify-content:flex-end;">
      <button class="btn-cancel" onclick="cancelImport()">Cancel</button>
      <button class="btn-save" onclick="saveImportedRoster()">Save Roster</button>
    </div>
  </div>
</div>

<!-- ══ ROSTER ════════════════════════════════════════════════════ -->
<div class="admin-section" id="rosterSection">
  <h2>Roster</h2>
  <div class="form-row" style="margin-bottom:10px;">
    <label>Select Team</label>
    <select id="rosterTeamSelect" onchange="loadRoster()">
      <option value="">— select team —</option>
    </select>
  </div>
  <div id="rosterList"></div>
  <div id="rosterActions" style="display:none;">
    <button class="btn-add" onclick="addPlayer()">+ Add Player</button>
    <div class="section-save-row">
      <button class="btn-save" onclick="saveRoster()">Save Roster</button>
    </div>
  </div>
</div>

<!-- ══ EVENTS ════════════════════════════════════════════════════ -->
<div class="admin-section" id="eventsSection">
  <h2>Events</h2>
  <div id="eventsList"></div>
  <button class="btn-add" onclick="addEvent('events')">+ Add Event</button>
  <div class="section-save-row">
    <button class="btn-save" onclick="saveEvents()">Save Events</button>
  </div>
</div>

<!-- ══ OTHER EVENTS ══════════════════════════════════════════════ -->
<div class="admin-section" id="otherEventsSection">
  <h2>Other Events</h2>
  <div id="otherEventsList"></div>
  <button class="btn-add" onclick="addEvent('otherEvents')">+ Add Other Event</button>
  <div class="section-save-row">
    <button class="btn-save" onclick="saveOtherEvents()">Save Other Events</button>
  </div>
</div>

<!-- ══ GAME FILES ════════════════════════════════════════════════ -->
<div class="admin-section" id="gamesSection">
  <h2>Game Files</h2>
  <div id="gamesList"></div>
</div>

<?php endif; ?>

<div id="notification" class="notification"></div>

<!-- ── Modal ── -->
<div id="appModal" class="modal" style="display:none;">
  <div class="modal-content">
    <p id="appModalMessage"></p>
    <input id="appModalInput" class="modal-text-input" style="display:none;">
    <div id="appModalButtons" class="modal-buttons"></div>
  </div>
</div>

</div><!-- /container -->

<script>
const appModal        = document.getElementById('appModal');
const appModalMessage = document.getElementById('appModalMessage');
const appModalInput   = document.getElementById('appModalInput');
const appModalButtons = document.getElementById('appModalButtons');
const notification    = document.getElementById('notification');

function showConfirm(message) {
  return new Promise(resolve => {
    appModalMessage.textContent = message;
    appModalInput.style.display = 'none';
    appModalButtons.innerHTML = '';
    const yes = document.createElement('button');
    yes.textContent = 'Delete';
    yes.style.background = '#e74c3c';
    yes.onclick = () => { appModal.style.display = 'none'; resolve(true); };
    const no = document.createElement('button');
    no.textContent = 'Cancel';
    no.className = 'btn-cancel';
    no.onclick = () => { appModal.style.display = 'none'; resolve(false); };
    appModalButtons.appendChild(yes);
    appModalButtons.appendChild(no);
    appModal.style.display = 'flex';
  });
}

function showNotification(msg, type='success') {
  notification.innerHTML = msg;
  notification.className = 'notification show' + (type === 'warning' ? ' warning' : '');
  clearTimeout(notification._t);
  notification._t = setTimeout(() => notification.classList.remove('show'), 2000);
}

async function api(payload) {
  const res = await fetch('admin.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ── Login / Logout ──────────────────────────────────────────────
async function doLogin() {
  const pw = document.getElementById('loginPassword').value;
  const r = await api({ action: 'login', password: pw });
  if (r.ok) { location.reload(); }
  else { document.getElementById('loginError').textContent = 'Wrong password.'; }
}
document.getElementById('loginPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogout() {
  await api({ action: 'logout' });
  location.reload();
}

<?php if ($isAdmin): ?>

// ── DATA ────────────────────────────────────────────────────────
let teams       = <?php echo json_encode($teams); ?>;
let events      = <?php echo json_encode($events); ?>;
let otherEvents = <?php echo json_encode($otherEvents); ?>;
const gameFiles = <?php echo json_encode(array_map('basename', $gameFiles)); ?>;
let currentRoster = [];
let currentRosterFile = '';

// ── Populate roster team selector ───────────────────────────────
(function() {
  const sel = document.getElementById('rosterTeamSelect');
  teams.forEach((t, i) => {
    const o = document.createElement('option');
    o.value = t.roster;
    o.textContent = t.name + ' (' + t.year + ')';
    sel.appendChild(o);
  });
})();

// ══ TEAMS ══════════════════════════════════════════════════════
function renderTeams() {
  const el = document.getElementById('teamsList');
  el.innerHTML = '';
  teams.forEach((t, i) => {
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="admin-row">
        <div class="row-label">
          ${escHtml(t.name)} <span style="color:#aaa;font-weight:400;">(${t.year})</span>
          ${t.is_active !== 0 ? '' : '<span style="background:#c0392b;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;margin-left:6px;">INACTIVE</span>'}
          <div class="row-sub">${escHtml(t.roster)}</div>
        </div>
        <div class="admin-row-actions">
          <button class="btn-edit" onclick="toggleTeamEdit(${i})">Edit</button>
          <button class="btn-delete" onclick="deleteTeam(${i})">Delete</button>
        </div>
      </div>
      <div class="edit-form" id="teamEdit_${i}">
        <div class="form-row-inline">
          <div class="form-row"><label>Team Name</label><input id="tName_${i}" value="${escHtml(t.name)}"></div>
          <div class="form-row" style="max-width:90px;"><label>Year</label><input id="tYear_${i}" type="number" value="${t.year}"></div>
        </div>
        <div class="form-row"><label>Roster File</label><input id="tRoster_${i}" value="${escHtml(t.roster)}"></div>
        <div class="form-row"><label>New Password (leave blank to keep)</label><input type="password" id="tPass_${i}" placeholder="••••••"></div>
        <div class="starter-toggle" style="margin-bottom:8px;">
          <input type="checkbox" id="tActive_${i}" ${t.is_active !== 0 ? 'checked' : ''}>
          <label for="tActive_${i}">Active (visible in app)</label>
        </div>
        <div class="form-actions">
          <button class="btn-save" onclick="applyTeamEdit(${i})">Apply</button>
          <button class="btn-cancel" onclick="toggleTeamEdit(${i})">Cancel</button>
        </div>
      </div>`;
    el.appendChild(row);
  });
}

function toggleTeamEdit(i) {
  const f = document.getElementById('teamEdit_' + i);
  f.classList.toggle('open');
}

function applyTeamEdit(i) {
  teams[i].name      = document.getElementById('tName_' + i).value.trim();
  teams[i].year      = parseInt(document.getElementById('tYear_' + i).value) || teams[i].year;
  teams[i].roster    = document.getElementById('tRoster_' + i).value.trim();
  teams[i].is_active = document.getElementById('tActive_' + i).checked ? 1 : 0;
  const pw = document.getElementById('tPass_' + i).value;
  if (pw) teams[i].password = md5(pw);
  document.getElementById('teamEdit_' + i).classList.remove('open');
  renderTeams();
  showNotification('Team updated — click Save Teams to persist.');
}

function addTeam() {
  teams.push({ name: 'New Team', year: new Date().getFullYear(), roster: 'rosters/roster_new.json', password: '', is_active: 1 });
  renderTeams();
  const i = teams.length - 1;
  document.getElementById('teamEdit_' + i).classList.add('open');
}

async function deleteTeam(i) {
  if (!await showConfirm(`Delete "${teams[i].name} (${teams[i].year})"?`)) return;
  teams.splice(i, 1);
  renderTeams();
  showNotification('Removed — click Save Teams to persist.', 'warning');
}

async function saveTeams() {
  const r = await api({ action: 'save_teams', teams });
  showNotification(r.ok ? 'Teams saved!' : 'Error: ' + r.error, r.ok ? 'success' : 'warning');
}

// ══ ROSTER ═════════════════════════════════════════════════════
async function loadRoster() {
  const sel = document.getElementById('rosterTeamSelect');
  currentRosterFile = sel.value;
  if (!currentRosterFile) { document.getElementById('rosterList').innerHTML = ''; document.getElementById('rosterActions').style.display='none'; return; }
  const r = await api({ action: 'load_roster', file: currentRosterFile });
  currentRoster = r.roster || [];
  document.getElementById('rosterActions').style.display = 'block';
  renderRoster();
}

function renderRoster() {
  const el = document.getElementById('rosterList');
  el.innerHTML = '';
  const sorted = [...currentRoster].sort((a, b) => a.number - b.number);
  currentRoster = sorted;
  currentRoster.forEach((p, i) => {
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="admin-row">
        <div class="row-label">
          <span style="background:rgba(255,255,255,0.15);border-radius:4px;padding:1px 5px;font-size:13px;margin-right:6px;">${p.number}</span>
          ${escHtml(p.first_name)} ${escHtml(p.last_name)}
          <div class="row-sub">${escHtml(p.position)} · ${escHtml(p.class)} ${p.default_starter ? '· <span style="color:#2ecc71;">★ Starter</span>' : ''}</div>
        </div>
        <div class="admin-row-actions">
          <button class="btn-edit" onclick="togglePlayerEdit(${i})">Edit</button>
          <button class="btn-delete" onclick="deletePlayer(${i})">Delete</button>
        </div>
      </div>
      <div class="edit-form" id="playerEdit_${i}">
        <div class="form-row-inline">
          <div class="form-row"><label>First Name</label><input id="pFirst_${i}" value="${escHtml(p.first_name)}"></div>
          <div class="form-row"><label>Last Name</label><input id="pLast_${i}" value="${escHtml(p.last_name)}"></div>
        </div>
        <div class="form-row-inline">
          <div class="form-row" style="max-width:80px;"><label>#</label><input id="pNum_${i}" type="number" value="${p.number}"></div>
          <div class="form-row"><label>Position</label><input id="pPos_${i}" value="${escHtml(p.position)}"></div>
          <div class="form-row" style="max-width:80px;"><label>Class</label>
            <select id="pClass_${i}">
              ${['FR','SO','JR','SR'].map(c => `<option ${c===p.class?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="starter-toggle" style="margin-bottom:8px;">
          <input type="checkbox" id="pStarter_${i}" ${p.default_starter ? 'checked' : ''}>
          <label for="pStarter_${i}">Default Starter</label>
        </div>
        <div class="form-actions">
          <button class="btn-save" onclick="applyPlayerEdit(${i})">Apply</button>
          <button class="btn-cancel" onclick="togglePlayerEdit(${i})">Cancel</button>
        </div>
      </div>`;
    el.appendChild(row);
  });
}

function togglePlayerEdit(i) {
  document.getElementById('playerEdit_' + i).classList.toggle('open');
}

function applyPlayerEdit(i) {
  currentRoster[i] = {
    first_name:      document.getElementById('pFirst_' + i).value.trim(),
    last_name:       document.getElementById('pLast_' + i).value.trim(),
    number:          parseInt(document.getElementById('pNum_' + i).value) || 0,
    position:        document.getElementById('pPos_' + i).value.trim(),
    class:           document.getElementById('pClass_' + i).value,
    default_starter: document.getElementById('pStarter_' + i).checked ? 1 : 0
  };
  document.getElementById('playerEdit_' + i).classList.remove('open');
  renderRoster();
  showNotification('Player updated — click Save Roster to persist.');
}

function addPlayer() {
  currentRoster.push({ first_name:'', last_name:'', number:0, position:'', class:'FR', default_starter:0 });
  renderRoster();
  const i = currentRoster.length - 1;
  document.getElementById('playerEdit_' + i).classList.add('open');
  document.getElementById('playerEdit_' + i).scrollIntoView({ behavior:'smooth' });
}

async function deletePlayer(i) {
  const p = currentRoster[i];
  if (!await showConfirm(`Delete ${p.first_name} ${p.last_name}?`)) return;
  currentRoster.splice(i, 1);
  renderRoster();
  showNotification('Removed — click Save Roster to persist.', 'warning');
}

async function saveRoster() {
  const r = await api({ action: 'save_roster', file: currentRosterFile, roster: currentRoster });
  showNotification(r.ok ? 'Roster saved!' : 'Error: ' + r.error, r.ok ? 'success' : 'warning');
}

// ══ EVENTS ══════════════════════════════════════════════════════
function renderEventList(list, containerId, type) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  list.forEach((ev, i) => {
    const usBadge   = ev.us   ? '<span class="badge badge-us">+Us</span>'   : '';
    const themBadge = ev.them ? '<span class="badge badge-them">+Them</span>' : '';
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="admin-row">
        <div class="row-label">
          ${escHtml(ev.name)}
          <div class="us-them-badges" style="margin-top:3px;">${usBadge}${themBadge}</div>
        </div>
        <div class="admin-row-actions">
          <button class="btn-edit" onclick="toggleEventEdit('${type}',${i})">Edit</button>
          <button class="btn-delete" onclick="deleteEvent('${type}',${i})">Delete</button>
        </div>
      </div>
      <div class="edit-form" id="evEdit_${type}_${i}">
        <div class="form-row"><label>Event Name</label><input id="evName_${type}_${i}" value="${escHtml(ev.name)}"></div>
        <div class="form-row-inline">
          <div class="form-row">
            <label>Scores for Us</label>
            <select id="evUs_${type}_${i}">
              <option value="0" ${!ev.us?'selected':''}>0 — no</option>
              <option value="1" ${ev.us?'selected':''}>1 — yes</option>
            </select>
          </div>
          <div class="form-row">
            <label>Scores for Them</label>
            <select id="evThem_${type}_${i}">
              <option value="0" ${!ev.them?'selected':''}>0 — no</option>
              <option value="1" ${ev.them?'selected':''}>1 — yes</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-save" onclick="applyEventEdit('${type}',${i})">Apply</button>
          <button class="btn-cancel" onclick="toggleEventEdit('${type}',${i})">Cancel</button>
        </div>
      </div>`;
    el.appendChild(row);
  });
}

function toggleEventEdit(type, i) {
  document.getElementById(`evEdit_${type}_${i}`).classList.toggle('open');
}

function applyEventEdit(type, i) {
  const list = type === 'events' ? events : otherEvents;
  list[i] = {
    name: document.getElementById(`evName_${type}_${i}`).value.trim(),
    us:   parseInt(document.getElementById(`evUs_${type}_${i}`).value),
    them: parseInt(document.getElementById(`evThem_${type}_${i}`).value)
  };
  document.getElementById(`evEdit_${type}_${i}`).classList.remove('open');
  renderAllEvents();
  showNotification('Updated — click Save to persist.');
}

function addEvent(type) {
  const list = type === 'events' ? events : otherEvents;
  list.push({ name: 'New Event', us: 0, them: 0 });
  renderAllEvents();
  const i = list.length - 1;
  const f = document.getElementById(`evEdit_${type}_${i}`);
  f.classList.add('open');
  f.scrollIntoView({ behavior: 'smooth' });
}

async function deleteEvent(type, i) {
  const list = type === 'events' ? events : otherEvents;
  if (!await showConfirm(`Delete "${list[i].name}"?`)) return;
  list.splice(i, 1);
  renderAllEvents();
  showNotification('Removed — click Save to persist.', 'warning');
}

function renderAllEvents() {
  renderEventList(events, 'eventsList', 'events');
  renderEventList(otherEvents, 'otherEventsList', 'otherEvents');
}

async function saveEvents() {
  const r = await api({ action: 'save_events', events });
  showNotification(r.ok ? 'Events saved!' : 'Error: ' + r.error, r.ok ? 'success' : 'warning');
}

async function saveOtherEvents() {
  const r = await api({ action: 'save_other_events', events: otherEvents });
  showNotification(r.ok ? 'Other Events saved!' : 'Error: ' + r.error, r.ok ? 'success' : 'warning');
}

// ══ GAME FILES ══════════════════════════════════════════════════
function parseGameFilename(f) {
  // Format: 2026-03-26_121141_SiouxCityNorthGirls2026_SiouxCenter.json
  try {
    const parts = f.replace('.json','').split('_');
    const date = new Date(parts[0]);
    const dateStr = date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const teamRaw = parts[2] || '';
    const oppRaw  = parts.slice(3).join(' ') || '';
    // Insert spaces before capitals
    const team = teamRaw.replace(/([A-Z])/g, ' $1').trim();
    const opp  = oppRaw.replace(/([A-Z])/g, ' $1').trim();
    return { dateStr, team, opp };
  } catch(e) { return { dateStr: f, team: '', opp: '' }; }
}

function renderGames() {
  const el = document.getElementById('gamesList');
  el.innerHTML = '';
  if (!gameFiles.length) {
    el.innerHTML = '<div style="color:#aaa;font-size:13px;padding:8px;">No game files found.</div>';
    return;
  }
  gameFiles.forEach(f => {
    const { dateStr, team, opp } = parseGameFilename(f);
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="row-label">
        <div class="game-date">${dateStr}</div>
        <div class="game-vs">${escHtml(team)} vs. ${escHtml(opp)}</div>
      </div>
      <div class="admin-row-actions">
        <button class="btn-delete" onclick="deleteGame('${escHtml(f)}', this)">Delete</button>
      </div>`;
    el.appendChild(row);
  });
}

async function deleteGame(f, btn) {
  if (!await showConfirm(`Delete game file "${f}"? This cannot be undone.`)) return;
  const r = await api({ action: 'delete_game', file: f });
  if (r.ok) {
    btn.closest('.admin-row').remove();
    showNotification('Game deleted.', 'warning');
  } else {
    showNotification('Error: ' + r.error, 'warning');
  }
}

// ── Helpers ─────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function md5(s) {
  // Simple MD5 via the existing blueimp library loaded on main page — not available here.
  // We'll send plain text to PHP for hashing instead.
  return '__plain__' + s;
}

// ══ IMPORT FROM GOBOUND ════════════════════════════════════════
let importedPlayers = [];

async function fetchGoboundRoster() {
  const url = document.getElementById('importUrl').value.trim();
  const errEl = document.getElementById('importError');
  const previewEl = document.getElementById('importPreview');
  errEl.style.display = 'none';
  previewEl.style.display = 'none';
  importedPlayers = [];

  if (!url) { errEl.textContent = 'Please enter a URL.'; errEl.style.display = 'block'; return; }

  const btn = document.querySelector('#importSection .btn-save');
  const origText = btn.textContent;
  btn.textContent = 'Fetching…';
  btn.disabled = true;

  const r = await api({ action: 'fetch_roster_url', url });
  btn.textContent = origText;
  btn.disabled = false;

  if (!r.ok) {
    errEl.textContent = r.error || 'Failed to fetch roster.';
    errEl.style.display = 'block';
    return;
  }

  importedPlayers = r.players;
  document.getElementById('importTeamName').value = r.team_name || '';
  document.getElementById('importYear').value      = r.year      || new Date().getFullYear();
  document.getElementById('importFile').value      = r.suggested_file || '';
  document.getElementById('importPassword').value  = '';
  renderImportPreview();
  previewEl.style.display = 'block';
}

function renderImportPreview() {
  const el = document.getElementById('importPlayerList');
  el.innerHTML = '';
  importedPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:5px;padding:3px 8px;border-bottom:1px solid #2a2a2a;';
    row.innerHTML = `
      <input type="checkbox" id="imp_${i}" ${p.default_starter ? 'checked' : ''}
             style="width:18px;height:18px;flex-shrink:0;accent-color:#2ecc71;" onchange="updateImportStarter(${i},this.checked)">
      <input type="text" value="${escHtml(p.number ?? '')}" placeholder="#"
             style="width:38px;flex-shrink:0;text-align:center;font-size:12px;padding:2px 4px;height:26px;background:#1a1a1a;border:1px solid #444;border-radius:4px;color:#e0e0e0;"
             oninput="importedPlayers[${i}].number=this.value">
      <input type="text" value="${escHtml(p.first_name)}" placeholder="First"
             style="flex:1;min-width:60px;font-size:13px;padding:2px 6px;height:26px;background:#1a1a1a;border:1px solid #444;border-radius:4px;color:#e0e0e0;"
             oninput="importedPlayers[${i}].first_name=this.value">
      <input type="text" value="${escHtml(p.last_name)}" placeholder="Last"
             style="flex:1;min-width:60px;font-size:13px;padding:2px 6px;height:26px;background:#1a1a1a;border:1px solid #444;border-radius:4px;color:#e0e0e0;"
             oninput="importedPlayers[${i}].last_name=this.value">
      <select style="width:52px;flex-shrink:0;font-size:12px;padding:2px;height:26px;background:#1a1a1a;border:1px solid #444;border-radius:4px;color:#e0e0e0;"
              onchange="importedPlayers[${i}].class=this.value">
        ${['FR','SO','JR','SR'].map(c => `<option ${c===p.class?'selected':''}>${c}</option>`).join('')}
      </select>
      <label for="imp_${i}" style="font-size:13px;color:#2ecc71;width:14px;text-align:center;flex-shrink:0;cursor:pointer;">${p.default_starter ? '★' : '☆'}</label>`;
    el.appendChild(row);
  });
  updateImportStarterCount();
}

function updateImportStarter(i, checked) {
  importedPlayers[i].default_starter = checked ? 1 : 0;
  const label = document.querySelector(`label[for="imp_${i}"]`);
  if (label) label.textContent = checked ? '★' : '☆';
  updateImportStarterCount();
}

function updateImportStarterCount() {
  const count = importedPlayers.filter(p => p.default_starter).length;
  document.getElementById('importStarterCount').textContent =
    count + ' starter' + (count !== 1 ? 's' : '') + ' selected' + (count === 11 ? ' ✓' : count > 11 ? ' — too many!' : '');
}

function importToggleAll(checked) {
  importedPlayers.forEach((p, i) => {
    p.default_starter = checked ? 1 : 0;
    const cb = document.getElementById('imp_' + i);
    if (cb) cb.checked = checked;
    const label = document.querySelector(`label[for="imp_${i}"]`);
    if (label) label.textContent = checked ? '★' : '';
  });
  updateImportStarterCount();
}

function cancelImport() {
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('importUrl').value = '';
  document.getElementById('importError').style.display = 'none';
  importedPlayers = [];
}

async function saveImportedRoster() {
  const file     = document.getElementById('importFile').value.trim();
  const teamName = document.getElementById('importTeamName').value.trim();
  const year     = parseInt(document.getElementById('importYear').value) || new Date().getFullYear();
  const password = document.getElementById('importPassword').value;
  const addTeam  = document.getElementById('importAddTeam').checked;

  if (!file || !file.startsWith('rosters/')) {
    showNotification('Roster file path must start with rosters/', 'warning'); return;
  }
  if (!teamName) { showNotification('Team name is required.', 'warning'); return; }
  if (addTeam && !password) { showNotification('Password is required to add the team.', 'warning'); return; }

  // Validate all names populated
  const emptyNames = importedPlayers.filter(p => !p.first_name.trim() || !p.last_name.trim());
  if (emptyNames.length) {
    showNotification(`${emptyNames.length} player(s) have empty names — please fill them in.`, 'warning'); return;
  }
  // Validate exactly 11 starters
  const starterCount = importedPlayers.filter(p => p.default_starter).length;
  if (starterCount !== 11) {
    showNotification(`Select exactly 11 default starters (${starterCount} currently selected).`, 'warning'); return;
  }

  // Save roster file
  const r = await api({ action: 'save_roster', file, roster: importedPlayers });
  if (!r.ok) { showNotification('Error saving roster: ' + r.error, 'warning'); return; }

  // Add to teams list if requested
  if (addTeam) {
    teams.push({ name: teamName, year, roster: file, password: md5(password), is_active: 1 });
    const tr = await api({ action: 'save_teams', teams });
    if (!tr.ok) { showNotification('Roster saved but error adding team: ' + tr.error, 'warning'); return; }
    // Refresh roster dropdown
    const sel = document.getElementById('rosterTeamSelect');
    const o = document.createElement('option');
    o.value = file; o.textContent = teamName + ' (' + year + ')';
    sel.appendChild(o);
    renderTeams();
  }

  showNotification('Roster saved' + (addTeam ? ' and team added!' : '!'));
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('importUrl').value = '';
  importedPlayers = [];
}

// ── Init ────────────────────────────────────────────────────────
renderTeams();
renderAllEvents();
renderGames();

<?php endif; ?>
</script>

<script src="https://cdnjs.cloudflare.com/ajax/libs/blueimp-md5/2.19.0/js/md5.min.js"></script>
<script>
// Override md5 shim now that real library is loaded
<?php if ($isAdmin): ?>
function md5(s) { return window.md5 ? window.md5(s) : s; }
<?php endif; ?>
</script>
</body>
</html>
