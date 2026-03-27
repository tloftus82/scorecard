<?php
  header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
  header("Cache-Control: post-check=0, pre-check=0", false);
  header("Pragma: no-cache");

  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (isset($data['filename']) && isset($data['data'])) {
      $filename = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['filename']);
      $filepath = "games/" . $filename . ".json";
      file_put_contents($filepath, json_encode($data['data'], JSON_PRETTY_PRINT));
      http_response_code(200);
      echo "Saved successfully.";
    } else {
      http_response_code(400);
      echo "Invalid data.";
    }
    exit;
  }

  $teamsFile = 'teams.json';
  $teams = [];
  $teams = json_decode(file_get_contents($teamsFile), true);

  $eventsFile = 'events.json';
  $events = [];
  $events = json_decode(file_get_contents($eventsFile), true);

  $otherEventsFile = 'other_events.json';
  $otherEvents = [];
  $otherEvents = json_decode(file_get_contents($otherEventsFile), true);
?>

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Soccer Stats Tracker</title>
    <link rel="stylesheet" href="css.css?nocache=<?php echo time(); ?>">
  </head>
  <body>
    <div id="offlineOverlay">
      <div class="offline-message">No Internet Connection</div>
    </div>

    <div id="scoreboard">
      <div class="score-clock-container">
        <div id="usScore" class="score-number">0</div>
        <div class="clock-info">
          <div id="clockDisplay">40:00</div>
          <div id="halfIndicator">1st Half</div>
        </div>
        <div id="themScore" class="score-number">0</div>
      </div>
      <div class="clock-buttons">
        <button id="startClockButton">Start</button>
        <button id="stopClockButton">Stop</button>
        <button id="setClockButton">Set</button>
      </div>
    </div>

    <div class="container">

      <div class="setup-section">
        <select id="teamSelect">
          <option value="">Select Team...</option>
        </select>
        <div class="vs-row">
          <span class="vs-label">vs.</span>
          <input type="text" id="opponentInput" placeholder="Opponent name...">
        </div>
        <div class="setup-buttons">
          <button id="saveGameButton">Save Game</button>
          <button id="loadGameButton">Load Game</button>
          <button id="scorecardButton">Scorecard</button>
        </div>
      </div>

      <div id="loadMenu" class="load-menu" style="display: none;"></div>

      <div id="notification" class="notification"></div>

      <div class="section-header">
        <h2>Select Player</h2>
        <div class="sort-container">
          <span class="sort-label">Sort:</span>
          <select id="playerSortSelect">
            <option value="number">No.</option>
            <option value="first">First</option>
            <option value="last">Last</option>
          </select>
        </div>
      </div>

      <div id="playerButtons" class="player-grid"></div>

      <h2>Select Event</h2>
      <div id="eventButtons" class="event-grid"></div>

      <h2>Other Events</h2>
      <div id="otherEventButtons" class="event-grid"></div>

      <h2>Game Events</h2>
      <div class="event-window">
        <ul id="eventList"></ul>
      </div>

    </div>

    <div id="starterModal" class="modal">
      <div class="modal-content">
        <h2>Select Starters (11 players)</h2>
        <div id="starterList"></div>
        <div class="modal-buttons">
          <button id="confirmStartersButton">Confirm Starters</button>
        </div>
      </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/blueimp-md5/2.19.0/js/md5.min.js"></script>
    <script>
      const teamsList = <?php echo json_encode($teams); ?>;
      const eventsList = <?php echo json_encode($events); ?>;
      const otherEvents = <?php echo json_encode($otherEvents); ?>;
    </script>
    <script src="javascript.js?nocache=<?php echo time(); ?>"></script>
  </body>
</html>
