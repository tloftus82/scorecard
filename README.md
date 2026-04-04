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
├── teams.example.json         # Template — copy to teams.json and configure
├── teams.json                 # Team config with passwords (gitignored — create from example)
├── .github/workflows/
│   └── ftp-deploy.yml         # GitHub Actions deploy workflow
├── rosters/                   # Roster JSON files (gitignored)
│   └── roster_<team>_<year>.json
└── games/                     # Game data JSON files (gitignored — auto-created)
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

# Create your teams config from the example
cp teams.example.json teams.json

# Create required directories
mkdir -p games rosters

# Serve with PHP's built-in server
php -S localhost:8000
```

Open `http://localhost:8000` in your browser.

### Deployment

The app uses GitHub Actions to deploy via FTP whenever you push to `main`.

1. **Add your FTP password** to GitHub → Settings → Secrets → `FTP_PASSWORD`
2. **Update `.github/workflows/ftp-deploy.yml`** with your server address, FTP username, and target directory
3. **Push to `main`** — the workflow deploys automatically

> **Important:** `teams.json` and `rosters/` are gitignored. Upload them once manually to your server via FTP or your host's file manager. The `games/` directory is created automatically on first save.

## Configuration

### teams.json

Copy `teams.example.json` to `teams.json` and add your teams. Each entry:

```json
{
    "name": "Team Name",
    "year": 2026,
    "roster": "rosters/roster_teamcode_2026.json",
    "password": "<md5_of_password>",
    "is_active": 1
}
```

Generate a password hash (MD5):
```bash
php -r "echo md5('yourpassword');"
```

Set `is_active` to `0` to hide a team in the app without deleting it.

### Admin Password

The admin panel password is set in `admin.php` as `ADMIN_PASSWORD_HASH` (MD5 hash). Change this before deploying.

### events.json / other_events.json

Define the event buttons shown in the app. Each event:

```json
{ "name": "Goal", "us": 1, "them": 0, "stop_clock": true }
```

| Field | Description |
|---|---|
| `name` | Label shown on the button |
| `us` | `1` if this event scores a point for your team |
| `them` | `1` if this event scores a point for the opponent |
| `stop_clock` | `true` if this event should prompt to stop the clock |

`events.json` = events tied to a specific player. `other_events.json` = playerless events.

### Roster Files

Roster files live in `rosters/` as JSON arrays:

```json
[
    {
        "first_name": "Jane",
        "last_name": "Smith",
        "number": "7",
        "position": "MF",
        "class": "JR",
        "default_starter": 1
    }
]
```

Use the **Admin → Import Roster from Gobound** feature to auto-populate rosters from Gobound.com URLs.

## Usage Guide

### Starting a Game

1. Open the app and select a team from the dropdown
2. Enter the team password
3. Enter the opponent name
4. Click **Save Game** — select exactly 11 starters and confirm
5. The game file is created on the server immediately

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
| 1st Half | Resets to 40:00 and starts (confirms if game in progress) |
| 2nd Half | Resets to 40:00 and starts (confirms if game in progress) |
| Set | Opens a modal to set exact time and half |

### Scorecard

- Tap **Scorecard** to open the read-only stats view in a new tab
- Tap the link box below the button to copy the shareable URL to clipboard
- The scorecard URL is stable — send it to anyone to follow along

### Saving

The game auto-saves to the server after every event. A **Saved ✓** notification confirms each save. If the save fails, an alert is shown.

### Admin Panel

Access via the **Admin** button in the app (requires the admin password):

- **Teams** — add, edit, activate/deactivate teams
- **Import Roster from Gobound** — paste a Gobound.com roster URL to auto-import
- **Roster** — view and edit roster files directly
- **Events / Other Events** — customize event buttons and scoring flags
- **Game Files** — view and delete saved games

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
