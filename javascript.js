document.addEventListener('DOMContentLoaded', function() {
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
  let currentRoster = [];
  let events = [];
  let saved = false;
  let filename = '';
  let selectedPlayerButton = null;
  let selectedEventButton = null;
  let usScore = 0;
  let themScore = 0;

  opponentInput.disabled = true;
  saveGameButton.disabled = true;
  loadGameButton.disabled = true;
  document.getElementById('startClockButton').classList.add('flash');

  teamsList.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
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

  function disableSaveButton() {
    saveGameButton.style.display = 'none';
    scorecardButton.style.display = 'inline-block';
  }

  function saveGame() {
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
      if (xhr.status !== 200) showAlert('Error saving game.');
    };
  }

  function showNotification(message, type = 'success') {
    notification.innerHTML = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), type === 'warning' ? 2500 : 1000);
  }

  function renderPlayers() {
    playerButtonsContainer.innerHTML = '';
    const sortValue = sortSelect.value;

    if (sortValue === 'first') {
      currentRoster.sort((a, b) => a.first_name.localeCompare(b.first_name));
    } else if (sortValue === 'last') {
      currentRoster.sort((a, b) => a.last_name.localeCompare(b.last_name));
    } else {
      currentRoster.sort((a, b) => a.number - b.number);
    }

    currentRoster.forEach(player => {
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
      button.addEventListener('click', function () {
        if (!saved) return;
        if (selectedPlayerButton) selectedPlayerButton.classList.remove('selected');
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

        if (eventName === 'Goal' || eventName === 'Goal Allowed') await promptToStopClock();

        const warning = clockWasRunning ? '' : '<br><small>⚠️ Clock was not running</small>';
        showNotification(`<small><i>${player}</i></small><br><b>${eventName}</b>${warning}`, clockWasRunning ? 'success' : 'warning');
        renderEvents();
        updateScoreboard();
        renderPlayers();
        if (saved) saveGame();

        selectedPlayerButton.classList.remove('selected');
        selectedEventButton.classList.remove('selected');
        selectedPlayerButton = null;
        selectedEventButton = null;
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

        if (eventName === 'Own Goal (Them)' || eventName === 'Own Goal (Us)') await promptToStopClock();

        const warning = clockWasRunning ? '' : '<br><small>⚠️ Clock was not running</small>';
        showNotification(`<b>${eventName}</b>${warning}`, clockWasRunning ? 'success' : 'warning');
        renderEvents();
        updateScoreboard();
        if (saved) saveGame();
      });

      otherEventButtonsContainer.appendChild(button);
    });
  }

  function flashScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    let flashes = 0;
    const flashInterval = setInterval(() => {
      scoreboard.classList.toggle('flash');
      if (++flashes >= 6) {
        clearInterval(flashInterval);
        scoreboard.classList.remove('flash');
      }
    }, 200);
  }

  function renderEvents() {
    eventListElement.innerHTML = '';
    usScore = 0;
    themScore = 0;

    events.slice().reverse().forEach((event, index) => {
      const playerName = event.player || 'N/A';

      const li = document.createElement('li');
      const span = document.createElement('span');

      const timeStr = (event.half && event.timeRemaining)
        ? `${event.half === 1 ? '1st Half' : '2nd Half'} - ${event.timeRemaining.minutes}:${String(event.timeRemaining.seconds).padStart(2, '0')}`
        : '';
      span.innerHTML = `<span class="event-log-name">${event.event}</span><span class="event-log-meta"><span class="event-log-time">${timeStr}</span><span class="event-log-player">${playerName}</span></span>`;

      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.onclick = () => deleteEvent(events.length - 1 - index);
      li.appendChild(span);
      li.appendChild(btn);
      eventListElement.appendChild(li);

      switch (event.event) {
        case 'Goal': case 'PK (Scored)': case 'Own Goal (Them)':
          usScore++; break;
        case 'Goal Allowed': case 'PK Against (Scored)': case 'Own Goal (Us)':
          themScore++; break;
      }
    });

    updateScoreboard();
    document.querySelector('.event-window').scrollTop = 0;
  }

  async function promptToStopClock() {
    if (clockInterval && await showConfirm("Goal recorded. Stop the clock?", "Stop", "Keep Running")) {
      stopClock();
    }
  }

  function updateScoreboard() {
    usScoreElement.textContent = usScore;
    themScoreElement.textContent = themScore;
    const cls = usScore > themScore ? 'score-win' : usScore < themScore ? 'score-loss' : 'score-tie';
    usScoreElement.className = cls;
    themScoreElement.className = cls;
  }

  window.deleteEvent = function(index) {
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

  function showStarterModal() {
    starterList.innerHTML = '';
    currentRoster.slice().sort((a, b) => a.number - b.number).forEach(player => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = `${player.first_name} ${player.last_name}`;
      checkbox.checked = player.default_starter === 1;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${player.first_name} ${player.last_name} (No. ${player.number})`));
      starterList.appendChild(label);
      starterList.appendChild(document.createElement('br'));
    });
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
    scorecardButton.style.display = 'inline-block';
    starterModal.style.display = 'none';

    renderPlayers();
    renderEventButtons();
    renderOtherEventButtons();
    renderEvents();
    saveGame();
  });

  loadGameButton.addEventListener('click', async function () {
    if (!selectedTeamName) {
      await showAlert("Please select a team first.");
      return;
    }

    fetch('list_games.php?nocache=' + Date.now())
      .then(r => r.json())
      .then(files => {
        loadMenu.innerHTML = '<h3>Select a game to load:</h3>';
        const fetches = files.map(file =>
          fetch('games/' + file + '?nocache=' + Date.now())
            .then(r => r.json())
            .then(json => json.team === selectedTeamName ? file : null)
            .catch(() => null)
        );

        Promise.all(fetches).then(results => {
          const matching = results.filter(Boolean).sort((a, b) => b.localeCompare(a));
          if (matching.length === 0) {
            loadMenu.innerHTML += '<p>No games found for this team.</p>';
          } else {
            matching.forEach(file => {
              const btn = document.createElement('button');
              btn.textContent = file;
              btn.addEventListener('click', () => loadSelectedGame(file));
              loadMenu.appendChild(btn);
            });
          }
          loadMenu.style.display = 'block';
        });
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
        scorecardButton.style.display = 'inline-block';
        loadMenu.style.display = 'none';

        renderEvents();
        updateScoreboard();
        renderPlayers();
        renderEventButtons();
        renderOtherEventButtons();
      });
  }

  scorecardButton.addEventListener('click', async function() {
    if (!filename) { await showAlert('No game loaded or saved!'); return; }
    window.open('scorecard.php?file=' + encodeURIComponent(filename + '.json'), '_blank');
  });

  let clockInterval = null;
  let clockSeconds = 40 * 60;
  let currentHalf = 1;

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
    clockInterval = setInterval(() => {
      clockSeconds--;
      if (clockSeconds <= 0) {
        clockSeconds = 0;
        updateClockDisplay();
        clearInterval(clockInterval);
        clockInterval = null;
        setButtonState('startClockButton', true);
        setButtonState('stopClockButton', false);
        setButtonState('setClockButton', true);
        flashScoreboard();
      } else {
        updateClockDisplay();
      }
    }, 1000);
    setButtonState('startClockButton', false);
    setButtonState('stopClockButton', true);
    setButtonState('setClockButton', false);
    document.getElementById('startClockButton').classList.remove('flash');
  }

  function stopClock() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    setButtonState('startClockButton', true);
    setButtonState('stopClockButton', false);
    setButtonState('setClockButton', true);
    document.getElementById('startClockButton').classList.add('flash');
  }

  // Set Clock modal
  function setClock() {
    const mins = Math.floor(clockSeconds / 60);
    const secs = clockSeconds % 60;
    document.getElementById('clockTimeInput').value =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('clockHalfSelect').value = currentHalf;
    document.getElementById('setClockModal').style.display = 'flex';
    setTimeout(() => document.getElementById('clockTimeInput').focus(), 50);
  }

  document.getElementById('clockModalOk').addEventListener('click', async function() {
    const timeInput = document.getElementById('clockTimeInput').value.trim();
    const halfInput = document.getElementById('clockHalfSelect').value;

    if (!/^([0-5]?[0-9]):([0-5]?[0-9])$/.test(timeInput)) {
      await showAlert("Invalid time format. Use mm:ss.");
      return;
    }

    const [minutes, seconds] = timeInput.split(':').map(Number);
    clockSeconds = (minutes * 60) + seconds;
    currentHalf = parseInt(halfInput);
    document.getElementById('halfIndicator').textContent = currentHalf === 1 ? '1st Half' : '2nd Half';
    updateClockDisplay();
    document.getElementById('setClockModal').style.display = 'none';
  });

  document.getElementById('clockModalCancel').addEventListener('click', function() {
    document.getElementById('setClockModal').style.display = 'none';
  });

  document.getElementById('startClockButton').addEventListener('click', startClock);
  document.getElementById('stopClockButton').addEventListener('click', stopClock);
  document.getElementById('setClockButton').addEventListener('click', setClock);
  updateClockDisplay();
  setButtonState('startClockButton', true);
  setButtonState('stopClockButton', false);
  setButtonState('setClockButton', true);
  updateScoreboard();

  renderOtherEventButtons();
  renderPlayers();
  renderEventButtons();

  function setOfflineOverlay(visible) {
    document.getElementById('offlineOverlay').style.display = visible ? 'flex' : 'none';
  }

  function checkConnectionStatus() {
    if (!navigator.onLine) { setOfflineOverlay(true); return; }
    fetch('teams.json?nocache=' + Date.now())
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => setOfflineOverlay(false))
      .catch(() => setOfflineOverlay(true));
  }

  checkConnectionStatus();
  setInterval(checkConnectionStatus, 15000);
  window.addEventListener('online', checkConnectionStatus);
  window.addEventListener('offline', () => setOfflineOverlay(true));
});
