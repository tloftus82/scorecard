document.addEventListener('DOMContentLoaded', async function() {
  const eventListElement = document.getElementById('eventList');
  const playerButtonsContainer = document.getElementById('playerButtons');
  const eventButtonsContainer = document.getElementById('eventButtons');
  const otherEventButtonsContainer = document.getElementById('otherEventButtons');
  const saveGameButton = document.getElementById('saveGameButton');
  const loadGameButton = document.getElementById('loadGameButton');
  const scorecardButton = document.getElementById('scorecardButton');
  const opponentInput = document.getElementById('opponentInput');
  const loadMenu = document.getElementById('loadMenu');
  const notification = document.getElementById('notification');
  const sortSelect = document.getElementById('playerSortSelect');
  const teamSelect = document.getElementById('teamSelect');
  const usScoreElement = document.getElementById('usScore');
  const themScoreElement = document.getElementById('themScore');
  const starterModal = document.getElementById('starterModal');
  const starterList = document.getElementById('starterList');
  const confirmStartersButton = document.getElementById('confirmStartersButton');

  // ── Modal utility ──────────────────────────────────────────
  const appModal = document.getElementById('appModal');
  const appModalMessage = document.getElementById('appModalMessage');
  const appModalInput = document.getElementById('appModalInput');
  const appModalButtons = document.getElementById('appModalButtons');

  function showAlert(message) {
    return new Promise(resolve => {
      appModalMessage.textContent = message;
      appModalInput.style.display = 'none';
      appModalButtons.innerHTML = '';
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      ok.addEventListener('click', () => { appModal.style.display = 'none'; resolve(); });
      appModalButtons.appendChild(ok);
      appModal.style.display = 'flex';
      ok.focus();
    });
  }

  function showConfirm(message, yesText = 'Yes', noText = 'No') {
    return new Promise(resolve => {
      appModalMessage.textContent = message;
      appModalInput.style.display = 'none';
      appModalButtons.innerHTML = '';
      const yes = document.createElement('button');
      yes.textContent = yesText;
      yes.addEventListener('click', () => { appModal.style.display = 'none'; resolve(true); });
      const no = document.createElement('button');
      no.textContent = noText;
      no.className = 'btn-cancel';
      no.addEventListener('click', () => { appModal.style.display = 'none'; resolve(false); });
      appModalButtons.appendChild(yes);
      appModalButtons.appendChild(no);
      appModal.style.display = 'flex';
    });
  }

  function showPrompt(message, defaultValue = '', inputType = 'text') {
    return new Promise(resolve => {
      appModalMessage.textContent = message;
      appModalInput.type = inputType;
      appModalInput.value = defaultValue;
      appModalInput.style.display = 'block';
      appModalButtons.innerHTML = '';
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      ok.addEventListener('click', () => {
        appModal.style.display = 'none';
        resolve(appModalInput.value || null);
      });
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.className = 'btn-cancel';
      cancel.addEventListener('click', () => { appModal.style.display = 'none'; resolve(null); });
      appModalButtons.appendChild(ok);
      appModalButtons.appendChild(cancel);
      appModal.style.display = 'flex';
      appModalInput.onkeydown = e => { if (e.key === 'Enter') ok.click(); };
      setTimeout(() => appModalInput.focus(), 50);
    });
  }
  // ──────────────────────────────────────────────────────────

  let selectedTeamName = '';
  let currentRosterPath = '';
  let currentRoster = [];
  let events = [];
  let saved = false;
  let filename = '';
  let celebrationsEnabled = false;
  let selectedPlayerButton = null;
  let selectedEventButton = null;
  let usScore = 0;
  let themScore = 0;
  let renderedUsScore = 0;
  let renderedThemScore = 0;

  opponentInput.disabled = true;
  saveGameButton.disabled = true;
  loadGameButton.disabled = true;
  document.getElementById('startClockButton').classList.add('flash');

  teamsList.filter(t => t.is_active !== 0).slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
    const option = document.createElement('option');
    option.value = team.roster;
    option.textContent = `${team.name} (${team.year})`;
    option.setAttribute('data-password', team.password);
    teamSelect.appendChild(option);
  });

  teamSelect.addEventListener('change', async function () {
    const selectedOption = this.options[this.selectedIndex];
    const file = this.value;
    const correctHash = selectedOption.getAttribute('data-password');
    selectedTeamName = selectedOption.textContent;

    const password = await showPrompt("Enter password for team access:", "", "password");
    if (!password) { this.value = ""; return; }

    if (md5(password) !== correctHash) {
      await showAlert("Incorrect password.");
      this.value = "";
      return;
    }

    fetch(`${file}?nocache=` + Date.now())
      .then(res => res.json())
      .then(data => {
        currentRoster = data;
        currentRosterPath = file;
        renderPlayers();
        teamSelect.disabled = true;
        loadGameButton.disabled = false;
        opponentInput.disabled = false;
        saveGameButton.disabled = false;
      })
      .catch(() => showAlert("Failed to load roster."));
  });

  sortSelect.addEventListener('change', renderPlayers);

  function generateFilename(opponent) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const teamPart = selectedTeamName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const opponentPart = opponent.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}_${teamPart}_${opponentPart}`;
  }

  function showGameSection() {
    document.getElementById('gameSection').style.display = 'block';
  }

  function showMatchupBar() {
    const teamParts = selectedTeamName.match(/^(.*?)\s*\((\d{4})\)$/);
    const teamLabel = teamParts ? `${teamParts[1]} (${teamParts[2]})` : selectedTeamName;
    const opponent  = opponentInput.value.trim();
    const bar = document.getElementById('matchupBar');
    bar.textContent = opponent ? `${teamLabel} vs ${opponent}` : teamLabel;
    bar.style.display = 'block';
    // Hide the setup inputs — matchup bar replaces them
    teamSelect.style.display = 'none';
    document.querySelector('.vs-row').style.display = 'none';
    // Adjust container top padding to clear the now-taller scoreboard
    const scoreboard = document.getElementById('scoreboard');
    document.querySelector('.container').style.paddingTop =
      (scoreboard.offsetHeight + 6) + 'px';
  }

  function updateScorecardLink() {
    const url = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/') + 'scorecard.php?file=' + encodeURIComponent(filename + '.json');
    document.getElementById('scorecardLink').value = url;
  }

  function disableSaveButton() {
    saveGameButton.style.display = 'none';
    const setupAdmin = document.getElementById('setupAdminButton');
    if (setupAdmin) setupAdmin.style.display = 'none';
    showMatchupBar();
  }

  function saveGame(silent = false) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'index.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify({
      filename,
      data: {
        team: selectedTeamName,
        opponent: opponentInput.value.trim(),
        roster: currentRoster,
        events
      }
    }));
    xhr.onload = function() {
      if (xhr.status === 200) {
        if (!silent) {
          const delay = Math.max(0, notificationEndsAt - Date.now());
          setTimeout(() => showNotification('Saved ✓', 'success'), delay);
        }
      } else {
        showAlert('Error saving game.');
      }
    };
  }

  let notificationEndsAt = 0;

  function showNotification(message, type = 'success') {
    const duration = type === 'warning' ? 2500 : 1000;
    notificationEndsAt = Date.now() + duration;
    notification.innerHTML = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), duration);
  }

  function renderPlayers() {
    playerButtonsContainer.innerHTML = '';
    const sortValue = sortSelect.value;
    // Read actual column count from the computed grid style so landscape (2 cols) sorts correctly
    const computedCols = getComputedStyle(playerButtonsContainer).gridTemplateColumns.split(' ').length;
    const cols = computedCols > 1 ? computedCols : 3;

    let sorted;
    if (sortValue === 'first') {
      sorted = currentRoster.slice().sort((a, b) => a.first_name.localeCompare(b.first_name));
    } else if (sortValue === 'last') {
      sorted = currentRoster.slice().sort((a, b) => a.last_name.localeCompare(b.last_name));
    } else {
      sorted = currentRoster.slice().sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0));
    }

    // Flow column-first: reorder array so items read top-to-bottom per column
    const rows = Math.ceil(sorted.length / cols);
    const colFirst = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = c * rows + r;
        if (i < sorted.length) colFirst.push(sorted[i]);
      }
    }

    colFirst.forEach(player => {
      const button = document.createElement('button');
      button.className = 'player-button';
      button.setAttribute('data-player', `${player.first_name} ${player.last_name}`);
      button.setAttribute('data-number', `${player.number}`);
      button.innerHTML = `
        <span class="player-number">${player.number}</span>
        <span class="player-name"><span class="player-first">${player.first_name}</span><span class="player-last">${player.last_name}</span></span>
      `;
      button.disabled = !saved;
      const hasPlayed = events.some(e => e.player === `${player.first_name} ${player.last_name}`);
      button.style.backgroundColor = hasPlayed ? '#3498db' : '#2c3e50';
      button.addEventListener('click', function (e) {
        if (!saved) return;

        // Ripple effect
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
        this.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());

        if (selectedPlayerButton) selectedPlayerButton.classList.remove('selected');
        if (selectedPlayerButton === this) { selectedPlayerButton = null; return; }
        selectedPlayerButton = this;
        this.classList.add('selected');
      });
      playerButtonsContainer.appendChild(button);
    });
  }

  function renderEventButtons() {
    eventButtonsContainer.innerHTML = '';
    eventsList.forEach(eventObj => {
      const button = document.createElement('button');
      button.className = 'event-button';
      button.setAttribute('data-event', eventObj.name);
      button.textContent = eventObj.name;
      button.disabled = !saved;

      button.addEventListener('click', async function () {
        if (!saved) return;
        if (!selectedPlayerButton) {
          await showAlert('Select a player first!');
          return;
        }

        if (selectedEventButton) selectedEventButton.classList.remove('selected');
        selectedEventButton = this;
        this.classList.add('selected');
        this.classList.remove('event-tap-flash');
        void this.offsetWidth; // force reflow to restart animation
        this.classList.add('event-tap-flash');

        const player = selectedPlayerButton.getAttribute('data-player');
        const eventName = this.getAttribute('data-event');

        const clockWasRunning = clockInterval !== null;

        events.push({
          player,
          event: eventName,
          time: new Date().toISOString(),
          half: currentHalf,
          timeRemaining: {
            minutes: Math.floor(clockSeconds / 60),
            seconds: clockSeconds % 60
          }
        });

        if (stopClockLookup.has(eventName)) await promptToStopClock();

        let assistPlayer = null;
        if (promptAssistLookup.has(eventName)) {
          assistPlayer = await showAssistModal(player);
          if (assistPlayer) {
            events.push({
              player: assistPlayer,
              event: 'Assist',
              time: new Date().toISOString(),
              half: currentHalf,
              timeRemaining: {
                minutes: Math.floor(clockSeconds / 60),
                seconds: clockSeconds % 60
              }
            });
          }
        }

        const warning = clockWasRunning ? '' : '<br><small>⚠️ Clock was not running</small>';
        const assistLine = assistPlayer ? `<br><small><i>Assist: ${assistPlayer}</i></small>` : '';
        showNotification(`<small><i>${player}</i></small><br><b>${eventName}</b>${assistLine}${warning}`, clockWasRunning ? 'success' : 'warning');

        if (celebrationsEnabled && celebrationLookup[eventName]) {
          launchFallingItems(celebrationLookup[eventName]);
        }

        // Deselect before re-rendering — renderPlayers() destroys the old button nodes
        if (selectedEventButton) selectedEventButton.classList.remove('selected');
        selectedEventButton = null;
        selectedPlayerButton = null;

        renderEvents();
        renderPlayers();
        if (saved) saveGame(true);
      });

      eventButtonsContainer.appendChild(button);
    });
  }

  function renderOtherEventButtons() {
    otherEventButtonsContainer.innerHTML = '';
    otherEvents.forEach(eventObj => {
      const button = document.createElement('button');
      button.className = 'event-button';
      button.setAttribute('data-event', eventObj.name);
      button.textContent = eventObj.name;
      button.disabled = !saved;

      button.addEventListener('click', async function () {
        if (!saved) return;
        const eventName = this.getAttribute('data-event');

        this.classList.remove('event-tap-flash');
        void this.offsetWidth;
        this.classList.add('event-tap-flash');

        const clockWasRunning = clockInterval !== null;

        events.push({
          event: eventName,
          time: new Date().toISOString(),
          half: currentHalf,
          timeRemaining: {
            minutes: Math.floor(clockSeconds / 60),
            seconds: clockSeconds % 60
          }
        });

        if (stopClockLookup.has(eventName)) await promptToStopClock();

        const warning = clockWasRunning ? '' : '<br><small>⚠️ Clock was not running</small>';
        showNotification(`<b>${eventName}</b>${warning}`, clockWasRunning ? 'success' : 'warning');

        if (celebrationsEnabled && celebrationLookup[eventName]) {
          launchFallingItems(celebrationLookup[eventName]);
        }

        renderEvents();
        updateScoreboard();
        if (saved) saveGame(true);
      });

      otherEventButtonsContainer.appendChild(button);
    });
  }

  function flashScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.classList.remove('scoreboard-flash');
    void scoreboard.offsetWidth; // force reflow to restart animation if called twice
    scoreboard.classList.add('scoreboard-flash');
    scoreboard.addEventListener('animationend', () => scoreboard.classList.remove('scoreboard-flash'), { once: true });
  }

  // Build score lookup from events/otherEvents flags (best practice: no hardcoded names)
  const scoreLookup = {};
  [...eventsList, ...otherEvents].forEach(e => {
    scoreLookup[e.name] = { us: e.us || 0, them: e.them || 0 };
  });

  // Build stop-clock lookup from flags
  const stopClockLookup = new Set(
    [...eventsList, ...otherEvents].filter(e => e.stop_clock).map(e => e.name)
  );

  // Build prompt-assist lookup from flags
  const promptAssistLookup = new Set(
    [...eventsList, ...otherEvents].filter(e => e.prompt_assist).map(e => e.name)
  );

  // Build celebration lookup: eventName → celebration type
  const celebrationLookup = {};
  [...eventsList, ...otherEvents].forEach(e => {
    if (e.celebration) celebrationLookup[e.name] = e.celebration;
  });

  function showAssistModal(scorerName) {
    return new Promise(resolve => {
      const modal   = document.getElementById('assistModal');
      const grid    = document.getElementById('assistPlayerGrid');
      const header  = document.getElementById('assistModalHeader');

      header.textContent = `Assist on ${scorerName.split(' ')[0]}'s goal?`;
      grid.innerHTML = '';

      currentRoster.slice()
        .sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0))
        .forEach(player => {
          const fullName = `${player.first_name} ${player.last_name}`;
          if (fullName === scorerName) return; // skip the goal scorer
          const btn = document.createElement('button');
          btn.className = 'player-button';
          btn.innerHTML = `
            <span class="player-number">${player.number}</span>
            <span class="player-name">
              <span class="player-first">${player.first_name}</span>
              <span class="player-last">${player.last_name}</span>
            </span>`;
          btn.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve(fullName);
          });
          grid.appendChild(btn);
        });

      document.getElementById('assistNoAssistButton').onclick = () => {
        modal.style.display = 'none';
        resolve(null);
      };

      modal.style.display = 'flex';
    });
  }

  function renderEvents() {
    eventListElement.innerHTML = '';
    usScore = 0;
    themScore = 0;

    events.slice().reverse().forEach((event, index) => {
      const playerName = event.player || '';

      const li = document.createElement('li');
      const span = document.createElement('span');

      const timeStr = (event.half && event.timeRemaining)
        ? `${event.half === 1 ? '1st Half' : '2nd Half'} - ${event.timeRemaining.minutes}:${String(event.timeRemaining.seconds).padStart(2, '0')}`
        : '';
      const detail = [timeStr, playerName].filter(Boolean).join(' · ');
      span.innerHTML = `<span class="event-log-name">${event.event}</span><span class="event-log-detail">${detail}</span>`;

      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.onclick = () => deleteEvent(events.length - 1 - index);
      li.appendChild(span);
      li.appendChild(btn);
      eventListElement.appendChild(li);
      // Animate only the newest event (index 0 = most recent, list is reversed)
      if (index === 0) li.classList.add('event-slide-in');

      const scoring = scoreLookup[event.event] || { us: 0, them: 0 };
      usScore += scoring.us;
      themScore += scoring.them;
    });

    updateScoreboard();
    document.querySelector('.event-window').scrollTop = 0;
  }

  async function promptToStopClock() {
    if (clockInterval && await showConfirm("Goal recorded. Stop the clock?", "Stop", "Keep Running")) {
      stopClock();
    }
  }

  function popScoreElement(el) {
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
    el.addEventListener('animationend', () => el.classList.remove('score-pop'), { once: true });
  }

  function animateCount(el, from, to, cls) {
    if (from === to) return;
    const step = to > from ? 1 : -1;
    const duration = 300;
    const steps = Math.abs(to - from);
    const interval = Math.max(40, Math.floor(duration / steps));
    let current = from;
    const timer = setInterval(() => {
      current += step;
      el.textContent = current;
      if (current === to) clearInterval(timer);
    }, interval);
  }

  function launchFallingItems(type) {
    const count = 44;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('span');
        const duration = 1.2 + Math.random() * 1.4;
        const left = Math.random() * 100;
        el.style.left = left + 'vw';
        el.style.animationDuration = duration + 's';

        if (type === 'yellow' || type === 'red') {
          el.className = `falling-item card card-${type}`;
          const scale = 0.7 + Math.random() * 0.8;
          el.style.transform = `scale(${scale})`;
        } else {
          el.className = 'falling-item ball';
          el.textContent = type === 'wall' ? '🧱' : type === 'poop' ? '💩' : '⚽';
          const size = 24 + Math.random() * 28;
          el.style.fontSize = size + 'px';
        }

        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration * 1000);
      }, i * 60);
    }
  }

  function showGoalCelebration() {
    launchFallingItems('ball');
  }

function updateScoreboard() {
    const prevUs   = renderedUsScore;
    const prevThem = renderedThemScore;
    renderedUsScore  = usScore;
    renderedThemScore = themScore;
    const cls = usScore > themScore ? 'score-win' : usScore < themScore ? 'score-loss' : 'score-tie';
    usScoreElement.className = cls;
    themScoreElement.className = cls;
    if (usScore !== prevUs) {
      animateCount(usScoreElement, prevUs, usScore, cls);
      popScoreElement(usScoreElement);
      if (usScore > prevUs && celebrationsEnabled) showGoalCelebration();
    } else {
      usScoreElement.textContent = usScore;
    }
    if (themScore !== prevThem) {
      animateCount(themScoreElement, prevThem, themScore, cls);
      popScoreElement(themScoreElement);
    } else {
      themScoreElement.textContent = themScore;
    }
  }

  window.deleteEvent = async function(index) {
    const e = events[index];
    const label = e.event + (e.player ? ` — ${e.player}` : '');
    if (!await showConfirm(`Delete "${label}"?`, 'Delete', 'Cancel')) return;
    events.splice(index, 1);
    renderEvents();
    renderPlayers();
    if (saved) saveGame();
  };

  saveGameButton.addEventListener('click', async function() {
    const opponent = opponentInput.value.trim();
    if (!opponent) {
      await showAlert('Please enter the opponent name.');
      return;
    }
    filename = generateFilename(opponent);
    showStarterModal();
  });

  function updateStarterCount() {
    const checked = starterList.querySelectorAll('input[type="checkbox"]:checked').length;
    const el = document.getElementById('starterCount');
    if (el) el.textContent = `(${checked} of 11)`;
  }

  function showStarterModal() {
    starterList.innerHTML = '';
    currentRoster.slice().sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).forEach(player => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = `${player.first_name} ${player.last_name}`;
      checkbox.checked = player.default_starter === 1;
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          const total = starterList.querySelectorAll('input[type="checkbox"]:checked').length;
          if (total > 11) { this.checked = false; return; }
        }
        updateStarterCount();
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${player.first_name} ${player.last_name} (No. ${player.number})`));
      starterList.appendChild(label);
      starterList.appendChild(document.createElement('br'));
    });
    updateStarterCount();
    starterModal.style.display = 'flex';
  }

  confirmStartersButton.addEventListener('click', async function() {
    const checkboxes = starterList.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);

    if (checked.length !== 11) {
      await showAlert('You must select exactly 11 starters.');
      return;
    }

    const timestamp = new Date().toISOString();
    checked.forEach(cb => {
      events.push({ player: cb.value, event: 'Entered Game (Starter)', time: timestamp });
    });

    saved = true;
    opponentInput.readOnly = true;
    disableSaveButton();
    loadGameButton.style.display = 'none';
    starterModal.style.display = 'none';
    showGameSection();
    updateScorecardLink();

    renderPlayers();
    renderEventButtons();
    renderOtherEventButtons();
    renderEvents();
    saveGame();
    saveSessionState();
  });

  loadGameButton.addEventListener('click', async function () {
    if (!selectedTeamName) {
      await showAlert("Please select a team first.");
      return;
    }

    const encodedTeam = encodeURIComponent(selectedTeamName);
    fetch(`list_games.php?team=${encodedTeam}&nocache=` + Date.now())
      .then(r => r.json())
      .then(games => {
        loadMenu.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
        header.innerHTML = '<h3 style="margin:0;font-size:13px;">Select a game to load:</h3>';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:#555;width:28px;height:28px;padding:0;font-size:14px;flex-shrink:0;';
        closeBtn.addEventListener('click', () => { loadMenu.style.display = 'none'; });
        header.appendChild(closeBtn);
        loadMenu.appendChild(header);

        if (games.length === 0) {
          const p = document.createElement('p');
          p.style.cssText = 'font-size:13px;color:#aaa;padding:4px;';
          p.textContent = 'No games found for this team.';
          loadMenu.appendChild(p);
        } else {
          games.forEach(({ file, opponent }) => {
            const btn = document.createElement('button');
            const { dateStr } = parseGameFilename(file);
            btn.textContent = opponent ? `${dateStr} — vs. ${opponent}` : file;
            btn.style.cssText = 'text-align:left;font-size:13px;';
            btn.addEventListener('click', () => loadSelectedGame(file));
            loadMenu.appendChild(btn);
          });
        }
        loadMenu.style.display = 'block';
      });
  });

  function loadSelectedGame(file) {
    fetch('games/' + file + '?nocache=' + Date.now())
      .then(r => r.json())
      .then(data => {
        opponentInput.value = data.opponent;
        opponentInput.readOnly = true;
        filename = file.replace('.json', '');
        saved = true;
        events = data.events || [];

        disableSaveButton();
        loadGameButton.style.display = 'none';
        loadMenu.style.display = 'none';
        showGameSection();
        updateScorecardLink();

        renderEvents();
        updateScoreboard();
        renderPlayers();
        renderEventButtons();
        renderOtherEventButtons();
        saveSessionState();
      });
  }

  scorecardButton.addEventListener('click', async function() {
    if (!filename) { await showAlert('No game loaded or saved!'); return; }
    window.open('scorecard.php?file=' + encodeURIComponent(filename + '.json'), '_blank');
  });

  document.getElementById('scorecardLink').addEventListener('click', function() {
    if (!this.value) return;
    navigator.clipboard.writeText(this.value).then(() => {
      showNotification('Link copied!', 'success');
    }).catch(() => {
      this.select();
    });
  });

  let clockInterval = null;
  let clockSeconds = 40 * 60;
  let currentHalf = 1;
  let clockStartedAt = null;
  let clockSecondsAtStart = 40 * 60;

  // ── Session persistence ─────────────────────────────────────
  function saveSessionState() {
    sessionStorage.setItem('scorecard_session', JSON.stringify({
      filename,
      selectedTeamName,
      currentRosterPath,
      currentHalf,
      clockStartedAt,
      clockSecondsAtStart,
      clockSeconds,
      isRunning: clockInterval !== null
    }));
  }

  function clearSessionState() {
    sessionStorage.removeItem('scorecard_session');
  }

  async function restoreSessionState() {
    let state;
    try { state = JSON.parse(sessionStorage.getItem('scorecard_session')); } catch(e) { return; }
    if (!state || !state.filename || !state.currentRosterPath) return;

    // Re-fetch roster (no password prompt — session was already authenticated)
    try {
      const rosterRes = await fetch(`${state.currentRosterPath}?nocache=` + Date.now());
      currentRoster = await rosterRes.json();
      currentRosterPath = state.currentRosterPath;
      selectedTeamName = state.selectedTeamName;
      teamSelect.value = state.currentRosterPath;
      teamSelect.disabled = true;
    } catch(e) { clearSessionState(); return; }

    // Re-fetch game from server
    try {
      const gameRes = await fetch(`games/${state.filename}.json?nocache=` + Date.now());
      const data = await gameRes.json();
      opponentInput.value = data.opponent;
      opponentInput.readOnly = true;
      filename = state.filename;
      saved = true;
      events = data.events || [];
    } catch(e) { clearSessionState(); return; }

    disableSaveButton();
    loadGameButton.style.display = 'none';
    showGameSection();
    updateScorecardLink();
    renderEvents();
    updateScoreboard();

    // Restore half indicator
    currentHalf = state.currentHalf || 1;
    document.getElementById('halfIndicator').textContent = currentHalf === 1 ? '1st Half' : '2nd Half';

    // Restore clock
    if (state.isRunning && state.clockStartedAt) {
      const elapsed = Math.floor((Date.now() - state.clockStartedAt) / 1000);
      clockSeconds = Math.max(0, state.clockSecondsAtStart - elapsed);
      updateClockDisplay();
      if (clockSeconds > 0) {
        startClock();
      }
    } else {
      clockSeconds = state.clockSeconds ?? 40 * 60;
      updateClockDisplay();
    }
  }
  // ──────────────────────────────────────────────────────────

  function setButtonState(buttonId, enabled) {
    const button = document.getElementById(buttonId);
    button.disabled = !enabled;
    button.classList.toggle('enabled', enabled);
    button.classList.toggle('disabled', !enabled);
  }

  function updateClockDisplay() {
    const minutes = Math.floor(clockSeconds / 60);
    const seconds = clockSeconds % 60;
    document.getElementById('clockDisplay').textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function startClock() {
    if (clockInterval) return;
    clockStartedAt = Date.now();
    clockSecondsAtStart = clockSeconds;
    clockInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - clockStartedAt) / 1000);
      clockSeconds = Math.max(0, clockSecondsAtStart - elapsed);
      updateClockDisplay();
      if (clockSeconds <= 0) {
        clearInterval(clockInterval);
        clockInterval = null;
        clockStartedAt = null;
        setButtonState('startClockButton', true);
        setButtonState('stopClockButton', false);
        setButtonState('setClockButton', true);
        setButtonState('startFirstHalfButton', true);
        setButtonState('startSecondHalfButton', true);
        flashScoreboard();
      }
    }, 500);
    setButtonState('startClockButton', false);
    setButtonState('stopClockButton', true);
    setButtonState('setClockButton', false);
    setButtonState('startFirstHalfButton', false);
    setButtonState('startSecondHalfButton', false);
    document.getElementById('startClockButton').classList.remove('flash');
    saveSessionState();
  }

  function stopClock() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    clockStartedAt = null;
    setButtonState('startClockButton', true);
    setButtonState('stopClockButton', false);
    setButtonState('setClockButton', true);
    setButtonState('startFirstHalfButton', true);
    setButtonState('startSecondHalfButton', true);
    document.getElementById('startClockButton').classList.add('flash');
    saveSessionState();
  }

  // Set Clock modal
  function setClock() {
    const mins = Math.floor(clockSeconds / 60);
    const secs = clockSeconds % 60;
    document.getElementById('clockMinInput').value = mins;
    document.getElementById('clockSecInput').value = String(secs).padStart(2, '0');
    document.getElementById('clockHalfSelect').value = currentHalf;
    document.getElementById('setClockModal').style.display = 'flex';
    setTimeout(() => document.getElementById('clockMinInput').focus(), 50);
  }

  document.getElementById('clockModalOk').addEventListener('click', async function() {
    const halfInput = document.getElementById('clockHalfSelect').value;
    const minutes = parseInt(document.getElementById('clockMinInput').value) || 0;
    const seconds = parseInt(document.getElementById('clockSecInput').value) || 0;

    if (seconds > 59) {
      await showAlert("Seconds must be 0–59.");
      return;
    }

    clockSeconds = (minutes * 60) + seconds;
    currentHalf = parseInt(halfInput);
    document.getElementById('halfIndicator').textContent = currentHalf === 1 ? '1st Half' : '2nd Half';
    updateClockDisplay();
    document.getElementById('setClockModal').style.display = 'none';
    saveSessionState();
  });

  document.getElementById('clockModalCancel').addEventListener('click', function() {
    document.getElementById('setClockModal').style.display = 'none';
  });

  document.getElementById('startClockButton').addEventListener('click', startClock);
  document.getElementById('stopClockButton').addEventListener('click', stopClock);
  document.getElementById('setClockButton').addEventListener('click', setClock);

  document.getElementById('startFirstHalfButton').addEventListener('click', async function() {
    if (saved && !await showConfirm('Reset clock to 1st Half?', 'Reset', 'Cancel')) return;
    stopClock();
    clockSeconds = 40 * 60;
    currentHalf = 1;
    document.getElementById('halfIndicator').textContent = '1st Half';
    updateClockDisplay();
    startClock();
  });

  document.getElementById('startSecondHalfButton').addEventListener('click', async function() {
    if (saved && !await showConfirm('Reset clock to 2nd Half?', 'Reset', 'Cancel')) return;
    stopClock();
    clockSeconds = 40 * 60;
    currentHalf = 2;
    document.getElementById('halfIndicator').textContent = '2nd Half';
    updateClockDisplay();
    startClock();
  });
  updateClockDisplay();
  setButtonState('startClockButton', true);
  setButtonState('stopClockButton', false);
  setButtonState('setClockButton', true);
  setButtonState('startFirstHalfButton', true);
  setButtonState('startSecondHalfButton', true);
  updateScoreboard();

  await restoreSessionState();
  renderEventButtons();
  renderOtherEventButtons();
  renderPlayers();
  celebrationsEnabled = true;

  function parseGameFilename(f) {
    try {
      const parts = f.replace('.json', '').split('_');
      const date = new Date(parts[0] + 'T12:00:00');
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const teamRaw = (parts[2] || '').replace(/\d{4}$/, '');
      const oppRaw  = parts.slice(3).join(' ');
      const fmt = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim();
      return { dateStr, team: fmt(teamRaw), opp: fmt(oppRaw) };
    } catch(e) { return { dateStr: f, team: '', opp: '' }; }
  }

  document.getElementById('closeGameButton').addEventListener('click', async function() {
    if (!await showConfirm('Close this game? All events are saved on the server.', 'Close Game', 'Cancel')) return;
    clearSessionState();
    location.reload();
  });

  function setOfflineOverlay(visible) {
    document.getElementById('offlineOverlay').style.display = visible ? 'flex' : 'none';
  }

  function checkConnectionStatus() {
    if (!navigator.onLine) { setOfflineOverlay(true); return; }
    fetch('ping.php?t=' + Date.now())
      .then(r => { if (!r.ok) throw new Error(); setOfflineOverlay(false); })
      .catch(() => setOfflineOverlay(true));
  }

  checkConnectionStatus();
  setInterval(checkConnectionStatus, 15000);
  window.addEventListener('online', checkConnectionStatus);
  window.addEventListener('offline', () => setOfflineOverlay(true));

  // Re-render players on orientation change so button heights recalculate cleanly
  screen.orientation
    ? screen.orientation.addEventListener('change', () => setTimeout(renderPlayers, 100))
    : window.addEventListener('orientationchange', () => setTimeout(renderPlayers, 100));
});
