<?php
// Disable browser caching
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Get the file name from URL
if (!isset($_GET['file'])) {
    die('No game file specified.');
}

$filename = basename($_GET['file']);
$filepath = 'games/' . $filename;

if (!file_exists($filepath)) {
    die('Game file not found.');
}

// Load the game JSON
$gameData = json_decode(file_get_contents($filepath), true);
$events = $gameData['events'];
$team = $gameData['team'];
$opponent = $gameData['opponent'];
$date = date('F j, Y', strtotime(str_replace('_', '-', substr($filename, 0, 10))));

// Load roster from the game JSON (assuming it's included)
$roster = isset($gameData['roster']) ? $gameData['roster'] : [];
usort($roster, function($a, $b) {
    return $a['number'] - $b['number']; // Sort in ascending order of number
});
$players = [];
$goalies = [];
$cornerKicksUs = 0;  // Total North corner kicks (with player names)
$cornerKicksThem = 0;  // Total Opponent corner kicks (without player names)

// Initialize player stats based on the roster
foreach ($roster as $player) {
    $players[$player['first_name'] . ' ' . $player['last_name']] = [
        'Number' => $player['number'],
        'Name' => $player['first_name'] . ' ' . $player['last_name'],
        'Played' => false, // Player has not played yet
        'Starter' => false, // Starter status will be computed later
        'IsGoalie' => false,
        'Goals' => 0,
        'Assists' => 0,
        'Shots' => 0,
        'ShotsOnGoal' => 0,
        'PKMade' => 0,
        'PKAttempted' => 0,
        'YellowCards' => 0,
        'Saves' => 0,
        'GoalsAllowed' => 0,
        'PKAgainst' => 0
    ];
}

// Initialize score variables
$usScore = 0;
$themScore = 0;

// Process events to calculate stats and track player participation
foreach ($events as $event) {
    $playerName = $event['player'];
    
    // Mark player as having played
    if (isset($players[$playerName])) {
        $players[$playerName]['Played'] = true;
    }

    // Check if the player is a starter
    if ($event['event'] === 'Entered Game (Starter)' && isset($players[$playerName])) {
        $players[$playerName]['Starter'] = true;
    }

    // Update stats based on the event and update score
    switch ($event['event']) {
        case 'Goal':
            $players[$playerName]['Goals']++;
            $players[$playerName]['Shots']++;
            $players[$playerName]['ShotsOnGoal']++;
            $usScore++; // Add goal to our score
            break;
        case 'PK (Scored)':
            $players[$playerName]['PKMade']++;
            $players[$playerName]['PKAttempted']++;
            $usScore++; // Add PK (Scored) to our score
            break;
        case 'Assist':
            $players[$playerName]['Assists']++;
            break;
        case 'Shot':
            $players[$playerName]['Shots']++;
            break;
        case 'Shot On Goal':
            $players[$playerName]['Shots']++;
            $players[$playerName]['ShotsOnGoal']++;
            break;
        case 'PK (Missed)':
            $players[$playerName]['PKAttempted']++;
            break;
        case 'Yellow Card':
            $players[$playerName]['YellowCards']++;
            break;
        case 'Save':
        case 'Goal Allowed':
        case 'PK Against (Scored)':
        case 'PK Against (Missed)':
            if ($event['event'] === 'Goal Allowed') {
                $themScore++; // Add goal to opponent's score
            }
            if ($event['event'] === 'PK Against (Scored)') {
                $themScore++; // Add PK Against (Scored) to opponent's score
            }
            if ($event['event'] === 'Save') {
                $players[$playerName]['Saves']++;
            }
            if ($event['event'] === 'Goal Allowed') {
                $players[$playerName]['GoalsAllowed']++;
            }
            if ($event['event'] === 'PK Against (Scored)') {
                $players[$playerName]['GoalsAllowed']++;
                $players[$playerName]['PKAgainst']++;
            }
            if ($event['event'] === 'PK Against (Missed)') {
                $players[$playerName]['PKAgainst']++;
            }
            break;
        case 'Corner Kick':
            $cornerKicksUs++; // North corner kick (player associated)
            break;
        case 'Corner Kick (Them)':
            $cornerKicksThem++; // Opponent corner kick (no player associated)
            break;
        case 'Own Goal (Us)':
          $themScore++; // Add goal to opponent's score
          break;
        case 'Own Goal (Them)':
          $usScore++; // Add goal to opponent's score
          break;
    }
}

// Set goalie status based on events
foreach ($players as $playerName => $player) {
    if ($player['Saves'] > 0) {
        $players[$playerName]['IsGoalie'] = true;
    }
    if ($player['GoalsAllowed'] > 0) {
        $players[$playerName]['IsGoalie'] = true;
    }
    if ($player['PKAgainst'] > 0) {
        $players[$playerName]['IsGoalie'] = true;
    }
}

// Filter events with half and time remaining
$timeEvents = [];
foreach ($events as $event) {
    if (isset($event['half']) && isset($event['timeRemaining'])) {
        $timeEvents[] = $event;
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Scorecard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #fff;
            color: #000;
            margin: 20px;
        }
        h1, h2 {
            text-align: center;
            margin: 5px 0;
        }
        .info {
            text-align: center;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 14px;
        }
        th, td {
            border: 1px solid #333;
            padding: 6px;
            text-align: center;
        }
        .totals, .goalie {
            margin-top: 20px;
            font-size: 14px;
        }
        #downloadBtn {
            display: block;
            margin: 10px auto 20px;
            padding: 10px 20px;
            background-color: #3498db;
            color: white;
            font-size: 16px;
            border: none;
            cursor: pointer;
            border-radius: 6px;
        }
        #downloadBtn:hover {
            background-color: #2980b9;
        }

        /* Light gray color for 0 values */
        .gray-zero {
            color: #DCDCDC; /* Light gray */
        }

        /* Color based on match result */
        .win {
            color: green;
        }
        .loss {
            color: red;
        }
        .tie {
            color: black;
        }
    </style>
</head>
<body>

<div id="scorecard">
    <div class="info">
        <h2><?php echo htmlspecialchars($team); ?> vs. <?php echo htmlspecialchars($opponent); ?></h2>
        <p><?php echo $date; ?></p>

        <!-- Final Score with color and result -->
        <h3 class="<?php 
            if ($usScore > $themScore) {
                echo 'win'; 
            } elseif ($usScore < $themScore) {
                echo 'loss'; 
            } else {
                echo 'tie'; 
            } 
        ?>">
            Final Score: <?php echo $usScore; ?> - <?php echo $themScore; ?>
            <?php 
                if ($usScore > $themScore) {
                    echo ' (W)';
                } elseif ($usScore < $themScore) {
                    echo ' (L)';
                } else {
                    echo ' (T)';
                }
            ?>
        </h3>
    </div>

    <!-- Player Stats Table -->
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Player</th>
                <th>Starter</th>
                <th>Goals + PKs</th>
                <th>Assists</th>
                <th>Shots</th>
                <th>Shots on Goal</th>
                <th>PKs Made</th>
                <th>PKs Attempted</th>
                <th>Yellow Cards</th>
            </tr>
        </thead>
        <tbody>
            <?php
            // Initialize total stats for players
            $totalGoals = 0;
            $totalAssists = 0;
            $totalShots = 0;
            $totalShotsOnGoal = 0;
            $totalPKMade = 0;
            $totalPKAttempted = 0;
            $totalYellowCards = 0;

            // Loop through each player and display their stats
            foreach ($players as $playerName => $stats):
                if($stats['Played'] == true) {
                // Add stats to totals
                $totalGoals += $stats['Goals'];
                $totalAssists += $stats['Assists'];
                $totalShots += $stats['Shots'];
                $totalShotsOnGoal += $stats['ShotsOnGoal'];
                $totalPKMade += $stats['PKMade'];
                $totalPKAttempted += $stats['PKAttempted'];
                $totalYellowCards += $stats['YellowCards'];
            ?>
                <tr>
                    <td><?php echo $stats['Number']; ?></td> <!-- Player Number -->
                    <td><?php echo htmlspecialchars($playerName); ?></td>
                    <td><?php echo $stats['Starter'] ? 'X' : ''; ?></td> <!-- X for starters -->
                    <td class="<?php echo ($stats['Goals'] + $stats['PKMade'] === 0) ? 'gray-zero' : ''; ?>"><?php echo $stats['Goals'] + $stats['PKMade']; ?></td> <!-- Goals + PKs (display 0 in gray) -->
                    <td class="<?php echo $stats['Assists'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['Assists']; ?></td> <!-- Assists (display 0 in gray) -->
                    <td class="<?php echo $stats['Shots'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['Shots']; ?></td> <!-- Shots (display 0 in gray) -->
                    <td class="<?php echo $stats['ShotsOnGoal'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['ShotsOnGoal']; ?></td> <!-- Shots on Goal (display 0 in gray) -->
                    <td class="<?php echo $stats['PKMade'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['PKMade']; ?></td> <!-- PKs Made (display 0 in gray) -->
                    <td class="<?php echo $stats['PKAttempted'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['PKAttempted']; ?></td> <!-- PKs Attempted (display 0 in gray) -->
                    <td class="<?php echo $stats['YellowCards'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['YellowCards']; ?></td> <!-- Yellow Cards (display 0 in gray) -->
                </tr>
            <?php } endforeach; ?>

            <!-- Totals Row for Players -->
            <tr>
                <td colspan="3"><strong>Total</strong></td>
                <td><?php echo $totalGoals + $totalPKMade; ?></td> <!-- Goals + PKs -->
                <td><?php echo $totalAssists; ?></td> <!-- Assists -->
                <td><?php echo $totalShots; ?></td> <!-- Shots -->
                <td><?php echo $totalShotsOnGoal; ?></td> <!-- Shots on Goal -->
                <td><?php echo $totalPKMade; ?></td> <!-- PKs Made -->
                <td><?php echo $totalPKAttempted; ?></td> <!-- PKs Attempted -->
                <td><?php echo $totalYellowCards; ?></td> <!-- Yellow Cards -->
            </tr>
        </tbody>
    </table>

    <!-- Game Totals Section -->
    <div class="totals">
        <strong>Corner Kicks:</strong> Us <?php echo $cornerKicksUs; ?>  |  Opponent <?php echo $cornerKicksThem; ?><br><br>
    </div>

    <!-- Goalkeeper Stats -->
    <div class="goalie">
        <h3>Goalie Stats</h3>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Goalie</th>
                    <th>Min Played</th>
                    <th>Saves</th>
                    <th>Goals Allowed</th>
                    <th>PKs Against/Allowed</th>
                </tr>
            </thead>
            <tbody>
                <?php
                // Initialize total stats for goalies
                $totalSaves = 0;
                $totalGoalsAllowed = 0;
                $totalPKAgainst = 0;

                // Loop through each player to display goalie stats
                foreach ($players as $playerName => $stats): 
                    if ($stats['IsGoalie'] === true): // Only display goalies
                        $totalSaves += $stats['Saves']; // Add to total saves
                        $totalGoalsAllowed += $stats['GoalsAllowed']; // Add to total goals allowed
                        $totalPKAgainst += $stats['PKAgainst']; // Add to total PKs against
                ?>
                    <tr>
                        <td><?php echo $stats['Number']; ?></td> <!-- Player number -->
                        <td><?php echo htmlspecialchars($playerName); ?></td>
                        <td><?php echo isset($stats['MinPlayed']) ? $stats['MinPlayed'] : 'N/A'; ?></td> <!-- Min Played -->
                        <td class="<?php echo $stats['Saves'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['Saves']; ?></td> <!-- Saves (display 0 in gray) -->
                        <td class="<?php echo $stats['GoalsAllowed'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['GoalsAllowed']; ?></td> <!-- Goals Allowed (display 0 in gray) -->
                        <td class="<?php echo $stats['PKAgainst'] === 0 ? 'gray-zero' : ''; ?>"><?php echo $stats['PKAgainst']; ?></td> <!-- PKs Against (display 0 in gray) -->
                    </tr>
                <?php 
                    endif; 
                endforeach; 
                ?>
                <!-- Totals Row for Goalies -->
                <tr>
                    <td colspan="3"><strong>Total</strong></td>
                    <td><?php echo $totalSaves; ?></td> <!-- Total Saves -->
                    <td><?php echo $totalGoalsAllowed; ?></td> <!-- Total Goals Allowed -->
                    <td><?php echo $totalPKAgainst; ?></td> <!-- Total PKs Against -->
                </tr>
            </tbody>
        </table>

    <!-- Event with Half and Time Remaining -->
    <h3>Goals</h3>
    <ul>
<?php foreach ($timeEvents as $event): ?>
    <?php
    // Only show real goal events
    if (in_array($event['event'], ['Goal', 'PK (Scored)', 'Own Goal (Them)'])):
    ?>
        <li>
            <?php echo $event['event']; ?> - <?php echo isset($event['player']) && $event['player'] !== '' ? $event['player'] : 'N/A'; ?>
 - <?php 
                if ($event['half'] == '1') {
                    echo '1st';  // 1st half
                } elseif ($event['half'] == '2') {
                    echo '2nd';  // 2nd half
                } else {
                    echo 'N/A';  // In case the half value is not valid
                }
            ?> Half - <?php 
                $seconds = str_pad($event['timeRemaining']['seconds'], 2, '0', STR_PAD_LEFT);
                echo $event['timeRemaining']['minutes'] . ':' . $seconds . ' Remaining';
            ?>
        </li>
    <?php endif; ?>
<?php endforeach; ?>
    </ul>

    <!-- Event with Half and Time Remaining -->
    <h3>Goals Against</h3>
    <ul>
<?php foreach ($timeEvents as $event): ?>
    <?php
    // Only show real goal events
    if (in_array($event['event'], ['Goal Allowed', 'PK Against (Scored)', 'Own Goal (Us)'])):
    ?>
        <li>
            <?php echo $event['event']; ?>
 - <?php 
                if ($event['half'] == '1') {
                    echo '1st';  // 1st half
                } elseif ($event['half'] == '2') {
                    echo '2nd';  // 2nd half
                } else {
                    echo 'N/A';  // In case the half value is not valid
                }
            ?> Half - <?php 
                $seconds = str_pad($event['timeRemaining']['seconds'], 2, '0', STR_PAD_LEFT);
                echo $event['timeRemaining']['minutes'] . ':' . $seconds . ' Remaining';
            ?>
        </li>
    <?php endif; ?>
<?php endforeach; ?>
    </ul>

    </div>


</div>

</body>
</html>

