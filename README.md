# Soccer Stats Tracker

A mobile-first, real-time soccer stats tracking web app designed for coaches and team managers to log in-game events from the sideline and generate shareable scorecards.

## Features

- **Live scoreboard** with countdown clock and half indicator
- **Player & event tracking** — goals, assists, shots, saves, PKs, yellow cards, corner kicks, substitutions, and more
- **Automatic scorekeeping** driven by configurable event flags (no hardcoded logic)
- **Goalie stats** — saves, goals allowed, PKs faced
- **Goals log** with time remaining and half displayed
- **Shareable scorecard URL** — opens a read-only view in any browser
- **Session persistence** — survives phone lock and page refresh without losing progress
- **Tab-isolated sessions** — two coaches on the same device don't interfere
- **Offline detection** with overlay warning
- **Admin panel** for managing teams, rosters, and event definitions
- **Gobound.com roster importer** — paste a URL and import directly with an editable preview
- **Multi-team support** with per-team password protection

## Tech Stack

- **Backend:** PHP (flat-file JSON — no database required)
- **Frontend:** Vanilla JavaScript, CSS3
- **Hosting:** Any PHP-capable web host (GoDaddy shared hosting tested)
- **CI/CD:** GitHub Actions → FTP deploy on push to `main`

## File Structure

```
├── index.php                  # Main tracking interface
├── admin.php                  # Admin panel (teams, rosters, events, games)
├── scorecard.php              # Read-only scorecard view
├── list_games.php             # API: list/filter game files by team
├── ping.php                   # Lightweight connectivity check
├── css.css                    # Shared stylesheet
├── javascript.js              # Main app logic
├── events.json                # Player event definitions
├── other_events.json          # Playerless event definitions (own goals, opp corner kicks)
├── teams.example.json         # Reference structure for teams.json
├── teams.json                 # Team config with passwords (gitignored — managed via Admin panel)
├── .github/workflows/
│   └── ftp-deploy.yml         # GitHub Actions deploy workflow
├── rosters/                   # Roster JSON files (gitignored — managed via Admin panel)
│   └── roster_<team>_<year>.json
└── games/                     # Game data JSON files (gitignored — auto-created on first save)
    └── <date>_<time>_<team>_<opponent>.json
```

## Setup

### Requirements

- PHP 7.4+ with cURL extension enabled
- A web server (Apache/Nginx) or shared PHP hosting

### Local Development

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Create required directories
mkdir -p games rosters

# Create a minimal teams.json to get started (see teams.example.json for structure)
echo '[]' > teams.json

# Serve with PHP's built-in server
php -S localhost:8000
```

Open `http://localhost:8000` in your browser, then use the **Admin panel** to configure everything.

### Deployment

The app uses GitHub Actions to deploy via FTP whenever you push to `main`.

1. **Add three secrets** to your GitHub repo (Settings → Secrets and variables → Actions):
   - `FTP_SERVER` — your FTP hostname
   - `FTP_USERNAME` — your FTP username
   - `FTP_PASSWORD` — your FTP password
2. **Update `server-dir`** in `.github/workflows/ftp-deploy.yml` to match your target path
3. **Push to `main`** — the workflow deploys automatically

> **Note:** `teams.json`, `rosters/`, and `games/` are gitignored and never deployed by the workflow. After your first deploy, use the **Admin panel** to set up teams and import rosters directly through the browser.

### Admin Password

Before deploying, update the `ADMIN_PASSWORD_HASH` in `admin.php` to your own MD5 hash:

```bash
php -r "echo md5('your-chosen-password');"
```

Replace the existing hash value on line 4 of `admin.php` with the output.

## Configuration

All configuration is managed through the **Admin panel** (`/admin.php`). No manual file editing required.

### Admin Panel

Access at `/admin.php` using your admin password:

| Section | What you can do |
|---|---|
| **Teams** | Add teams, set passwords, activate/deactivate, link roster files |
| **Import Roster from Gobound** | Paste a Gobound.com roster URL to auto-import players with an editable preview |
| **Roster** | View and edit individual player records |
| **Events** | Customize player-linked event buttons and their scoring flags |
| **Other Events** | Customize playerless events (opponent corner kicks, own goals, etc.) |
| **Game Files** | View and delete saved game records |

### Event Flags

Each event in the Admin panel has three configurable flags:

| Flag | Description |
|---|---|
| **Scores for Us** | Adds 1 to your score when this event is logged |
| **Scores for Them** | Adds 1 to the opponent's score when this event is logged |
| **Stop Clock** | Prompts the user to stop the clock when this event is logged |

## Usage Guide

### Starting a Game

1. Open the app and select a team from the dropdown
2. Enter the team password
3. Enter the opponent name
4. Click **Save Game** — select exactly 11 starters and confirm
5. The game file is created on the server and auto-saves after every event

### Tracking Events

1. Tap a **player button** to select them (highlights green)
2. Tap an **event button** to log the event for that player
3. Use **Other Events** for things without a specific player (opponent corner kicks, own goals)
4. Tap the **Delete** button on any event in the log to remove it (with confirmation)
5. Tap a selected player again to deselect them

### Clock

| Button | Action |
|---|---|
| Start / Stop | Manual clock control |
| 1st Half | Resets to 40:00 and starts (confirms if game is in progress) |
| 2nd Half | Resets to 40:00 and starts (confirms if game is in progress) |
| Set | Opens a modal to manually set the time and half |

### Scorecard

- Tap **Scorecard** to open the read-only stats view in a new tab
- Tap the link box below the button to copy the shareable URL to clipboard
- The scorecard URL is stable — send it to parents, players, or anyone following along

### Saving

The game auto-saves to the server after every event. A **Saved ✓** notification confirms each save. If the connection is lost, an offline overlay appears and saves resume automatically when connectivity returns.

## Contributing / Feedback

Feedback and contributions welcome!

- **Bug reports / feature requests** → open a [GitHub Issue](../../issues)
- **Pull requests** → fork the repo, make your changes, and submit a PR

When reporting a bug, please include:
- What you were doing when it happened
- What you expected vs. what actually occurred
- Device and browser (this is a mobile-first app — iOS Safari and Android Chrome are primary targets)

## License

MIT
