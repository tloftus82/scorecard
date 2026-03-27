document.addEventListener('DOMContentLoaded', function() {
  const eventListElement = document.getElementById('eventList');
  const eventButtonsContainer = document.getElementById('eventButtons');
  const playerButtonsContainer = document.getElementById('playerButtons');
  const saveGameButton = document.getElementById('saveGameButton');
  const loadGameButton = document.getElementById('loadGameButton');
  const scorecardButton = document.getElementById('scorecardButton');
  const opponentInput = document.getElementById('opponentInput');
  const loadMenu = document.getElementById('loadMenu');
  const otherEventButtonsContainer = document.getElementById('otherEventButtons');
  const editRosterLink = document.getElementById('editRosterLink');
  const editEventsLink = document.getElementById('editEventsLink');
  const editOtherEventsLink = document.getElementById('editOtherEventsLink');
  const notification = document.getElementById('notification');
  const sortSelect = document.getElementById('playerSortSelect');
  const teamSelect = document.getElementById('teamSelect');

  const starterModal = document.getElementById('starterModal');
  const starterList = document.getElementById('starterList');
  const confirmStartersButton = document.getElementById('confirmStartersButton');

  let selectedTeamName = '';
  let currentRoster = [];
  let events = [];
  let saved = false;
  let filename = '';

  let selectedPlayerButton = null;
  let selectedEventButton = null;
  let editingType = '';

  let usScore = 0;
  let themScore = 0;
  let startClockSeconds = 40 * 60; // Default to 40:00 (2400 seconds)

  let starters = [];

  let teamList = [];

  opponentInput.disabled = true;
  saveGameButton.disabled = true;
  loadGameButton.disabled = true;
  document.getElementById('startClockButton').classList.add('flash');

  teamList = teamsList.slice().sort((a, b) => a.name.localeCompare(b.name));
  teamList.forEach(team => {
    const option = document.createElement('option');
    option.value = team.roster;
    option.textContent = `${team.name} (${team.year})`;
    option.setAttribute('data-password', team.password);
    option.setAttribute('data-name', team.name);
    teamSelect.appendChild(option);
  });

  document.getElementById('teamSelect').addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    const file = this.value;
    const correctHash = selectedOption.getAttribute('data-password');
    selectedTeamName = selectedOption.textContent;

    const password = prompt("Enter password for team access:");
    if (!password) return;

    const enteredHash = md5(password);
    if (enteredHash !== correctHash) {
        alert("Incorrect password.");
        this.value = "";
        return;
    }
    fetch(`${file}?nocache=` + new Date().getTime())
    .then(res => res.json())
    .then(data => {
      currentRoster = data;
      renderPlayers();
      document.getElementById('teamSelect').disabled = true;
      loadGameButton.disabled = false;
      opponentInput.disabled = false;
      saveGameButton.disabled = false;
    })
    .catch(() => alert("Failed to load roster."));
  });
  
  sortSelect.addEventListener('change', function() {renderPlayers();});

  function generateFilename(opponent) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const dateTimePart = `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
    const teamPart = selectedTeamName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const opponentPart = opponent.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

    return `${dateTimePart}_${teamPart}_${opponentPart}`;
  }

  function disableSaveButton() {
    saveGameButton.disabled = true;
    saveGameButton.textContent = 'Saved';
    saveGameButton.style.display = 'none'; // Hide Save Game button
    saveGameButton.style.backgroundColor = 'gray';
    scorecardButton.style.display = 'inline-block'; // Ensure Scorecard button shows
  }
  
  function saveGame() {
    const gameData = {
      team: selectedTeamName,
      opponent: opponentInput.value.trim(),
      roster: currentRoster,
      events: events
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'index.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify({
      filename: filename,
      data: gameData
    }));

    xhr.onload = function() {
      if (xhr.status === 200) {
      } else {
        alert('Error saving game.');
      }
    };
  }

  function showNotification(message) {    
    notification.innerHTML = message;
    notification.classList.add('show');    
    setTimeout(() => {notification.classList.remove('show');}, 1000);
  }
  
  function renderPlayers() {
    const container = document.getElementById('playerButtons');
    const sortSelect = document.getElementById('playerSortSelect');
    const sortValue = sortSelect ? sortSelect.value : 'number';

    container.innerHTML = '';

    if (sortValue === 'first') {
        currentRoster.sort((a, b) => a.first_name.localeCompare(b.first_name));
    } else if (sortValue === 'last') {
        currentRoster.sort((a, b) => a.last_name.localeCompare(b.last_name));
    } else if (sortValue === 'number') {
        currentRoster.sort((a, b) => a.number - b.number);
    }

    function createButton(player) {
      const button = document.createElement('button');
      button.className = 'player-button';
      button.setAttribute('data-player', `${player.first_name} ${player.last_name}`);
      button.setAttribute('data-number', `${player.number}`);
      button.innerHTML = `
        <span class="player-number">${player.number}</span>
        <span class="player-name">${player.first_name} ${player.last_name}</span>
      `;

      button.disabled = !saved;

      const hasPlayed = events.some(event => event.player === `${player.first_name} ${player.last_name}`);
      button.style.backgroundColor = hasPlayed ? '#3498db' : '#2c3e50';

      button.addEventListener('click', function () {
        if (!saved) return;
        if (selectedPlayerButton) selectedPlayerButton.classList.remove('selected');
        selectedPlayerButton = this;
        selectedPlayerButton.classList.add('selected');
      });

      return button;
    }

    currentRoster.forEach(player => container.appendChild(createButton(player)));
  }

  function renderEventButtons() {
    const container = document.getElementById('eventButtons');
    container.innerHTML = '';

    function createEventButton(eventObj) {
      const button = document.createElement('button');
      button.className = 'event-button';
      button.setAttribute('data-event', eventObj.name);
      button.textContent = eventObj.name;
      button.disabled = !saved;

      button.addEventListener('click', function () {
        if (!saved) return;
        if (!selectedPlayerButton) {
          alert('Select a player first!');
          return;
        }

        if (selectedEventButton) {
          selectedEventButton.classList.remove('selected');
        }
        selectedEventButton = this;
        selectedEventButton.classList.add('selected');

        const player = selectedPlayerButton.getAttribute('data-player');
        const number = selectedPlayerButton.getAttribute('data-number');
        const eventName = selectedEventButton.getAttribute('data-event');
        const timestamp = new Date().toISOString();

        if (clockInterval === null) {
          alert("Warning: Clock is not running! Event time may be inaccurate.");
        }

        events.push({
          player,
          event: eventName,
          time: timestamp,
          half: currentHalf,
          timeRemaining: {
            minutes: Math.floor(clockSeconds / 60),
            seconds: clockSeconds % 60
          }
        });

        switch (eventName) {
          case 'Goal':
          case 'Goal Allowed':
            promptToStopClock();
            break;
        }

        showNotification('<small><i>' + player + '</i></small><br><b>' + eventName + '</b>');
        renderEvents();
        updateScoreboard();
        renderPlayers();

        if (saved) saveGame();

        selectedPlayerButton.classList.remove('selected');
        selectedEventButton.classList.remove('selected');
        selectedPlayerButton = null;
        selectedEventButton = null;
      });

      return button;
    }

    eventsList.forEach(event => container.appendChild(createEventButton(event)));
  }

  function renderOtherEventButtons() {
    const container = document.getElementById('otherEventButtons');
    container.innerHTML = '';

    function createOtherEventButton(eventObj) {
      const button = document.createElement('button');
      button.className = 'event-button';
      button.setAttribute('data-event', eventObj.name);
      button.textContent = eventObj.name;
      button.disabled = !saved;

      button.addEventListener('click', function () {
        if (!saved) return;

        const eventName = button.getAttribute('data-event');
        const timestamp = new Date().toISOString();

        if (clockInterval === null) {
          alert("Warning: Clock is not running! Event time may be inaccurate.");
        }

        events.push({
          event: eventName,
          time: timestamp,
          half: currentHalf,
          timeRemaining: {
            minutes: Math.floor(clockSeconds / 60),
            seconds: clockSeconds % 60
          }
        });

        switch (eventName) {
          case 'Own Goal (Them)':
          case 'Own Goal (Us)':
            promptToStopClock();
            break;
        }

        showNotification('<b>' + eventName + '</b>');
        renderEvents();
        updateScoreboard();

        if (saved) saveGame();
      });

      return button;
    }

    otherEvents.forEach(event => container.appendChild(createOtherEventButton(event)));
  }


  function flashScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    let flashes = 0;
    const maxFlashes = 6; // 3 full flashes (on/off)

    const flashInterval = setInterval(() => {
      scoreboard.classList.toggle('flash');
      flashes++;
      if (flashes >= maxFlashes) {
        clearInterval(flashInterval);
        scoreboard.classList.remove('flash'); // Make sure it ends clean
      }
    }, 200); // 200ms per flash
  }

  function renderEvents() {
    eventListElement.innerHTML = '';
    usScore = 0;
    themScore = 0;

    events.slice().reverse().forEach((event, index) => {
      const playerName = event.player ? event.player : 'N/A';
      let eventText = '';

      if (event.half && event.timeRemaining) {
        const halfText = event.half == 1 ? '1H' : event.half == 2 ? '2H' : 'N/A';
        const minutes = event.timeRemaining.minutes.toString();
        const seconds = event.timeRemaining.seconds.toString().padStart(2, '0');
        const timeRemainingFormatted = `${minutes}:${seconds}`;

        eventText = `${halfText} - ${timeRemainingFormatted} - ${playerName} - ${event.event}`;
      } else {
        eventText = `${playerName} - ${event.event}`;
      }

      const li = document.createElement('li');
      li.innerHTML = `${eventText} <button onclick="deleteEvent(${events.length - 1 - index})">Delete</button>`;
      eventListElement.appendChild(li);

      switch (event.event) {
        case 'PK (Scored)':    
        case 'Goal':
        case 'Own Goal (Them)':
          usScore++;
          break;
        case 'PK Against (Scored)':
        case 'Goal Allowed':
        case 'Own Goal (Us)':
          themScore++;
          break;
      }
      updateScoreboard();
    });

    document.querySelector('.event-window').scrollTop = 0;
  }

  function promptToStopClock() {
    if (clockInterval) {
      const stop = confirm("Goal event recorded. Stop the clock?");
      if (stop) {stopClock();}
    }
  }

  function updateScoreboard() {
    const usScoreElement = document.getElementById('usScore');
    const themScoreElement = document.getElementById('themScore');

    usScoreElement.textContent = usScore;
    themScoreElement.textContent = themScore;

    if (usScore > themScore) {
      usScoreElement.style.color = '#2ecc71';   // Green
      themScoreElement.style.color = '#2ecc71';
    } else if (usScore < themScore) {
      usScoreElement.style.color = '#e74c3c';   // Red
      themScoreElement.style.color = '#e74c3c';
    } else {
      usScoreElement.style.color = '#ffffff';   // White
      themScoreElement.style.color = '#ffffff';
    }
  }

  window.deleteEvent = function(index) {
    events.splice(index, 1);
    renderEvents();
    renderPlayers();
    if (saved) {
      saveGame();
    }
  }

  saveGameButton.addEventListener('click', function() {
    const opponent = opponentInput.value.trim();
    if (!opponent) {
      alert('Please enter the opponent name.');
      return;
    }

    filename = generateFilename(opponent);
    showStarterModal();
  });

  function showStarterModal() {
    starterList.innerHTML = '';
    currentRoster.sort((a, b) => a.number - b.number); // Sort by uniform number
    currentRoster.forEach(player => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = `${player.first_name} ${player.last_name}`;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${player.first_name} ${player.last_name} (No. ${player.number})`));
      starterList.appendChild(label);
      starterList.appendChild(document.createElement('br'));
    });
    starterModal.style.display = 'flex';
  }

  confirmStartersButton.addEventListener('click', function() {
    const checkboxes = starterList.querySelectorAll('input[type="checkbox"]');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    starters = [];

    if (checkedCount !== 11) {
      alert('You must select exactly 11 starters.');
      return;
    }

    checkboxes.forEach(cb => {
      if (cb.checked) {
        starters.push(cb.value);
        const player = cb.value;
        const timestamp = new Date().toISOString();
        const selectedPlayer = currentRoster.find(p => `${p.first_name} ${p.last_name}` === player);
        const playerNumber = selectedPlayer ? selectedPlayer.number : null;
        events.push({
          player: player,
          event: 'Entered Game (Starter)',
          time: timestamp
        });
      }
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

  loadGameButton.addEventListener('click', function () {
    if (!selectedTeamName) {
      alert("Please select a team first.");
      return;
    }

    fetch('list_games.php?nocache=' + new Date().getTime())
    .then(response => response.json())
    .then(files => {
      loadMenu.innerHTML = '<h3>Select a game to load:</h3>';
      let matchingFiles = [];
      let fetches = files.map(file => {
        return fetch('games/' + file + '?nocache=' + new Date().getTime())
        .then(res => res.json())
        .then(json => {
          if (json.team === selectedTeamName) {matchingFiles.push(file);}
        })
        .catch(() => {});
      });

      Promise.all(fetches).then(() => {
        matchingFiles.sort((a, b) => b.localeCompare(a));
        if (matchingFiles.length === 0) {
          loadMenu.innerHTML += '<p>No games found for this team.</p>';
        } else {
          matchingFiles.forEach(file => {
            const button = document.createElement('button');
            button.textContent = file;
            button.addEventListener('click', function () {
              loadSelectedGame(file);
            });
            loadMenu.appendChild(button);
          });
        }
        loadMenu.style.display = 'block';
      });
    });
  });

  function loadSelectedGame(file) {
    fetch('games/' + file + '?nocache=' + new Date().getTime())
    .then(response => response.json())
    .then(data => {
      opponentInput.value = data.opponent;
      opponentInput.readOnly = true;
      filename = file.replace('.json', '');
      saved = true;
      events = data.events || [];
      renderEvents();

      disableSaveButton();
      loadGameButton.style.display = 'none';
      scorecardButton.style.display = 'inline-block';
      loadMenu.style.display = 'none';

      updateScoreboard();
      renderPlayers();
      renderEventButtons();
      renderOtherEventButtons();
    });
  }

  scorecardButton.addEventListener('click', function() {
    if (!filename) {
      alert('No game loaded or saved!');
      return;
    }
    window.open('scorecard.php?file=' + encodeURIComponent(filename + '.json'), '_blank');
    });

  let clockInterval = null;
  let clockSeconds = 40 * 60; // Start at 40:00
  let currentHalf = 1;

  function setButtonState(buttonId, enabled) {
    const button = document.getElementById(buttonId);
    button.disabled = !enabled;
    if (enabled) {
      button.classList.add('enabled');
      button.classList.remove('disabled');
    } else {
      button.classList.add('disabled');
      button.classList.remove('enabled');
    }
  }

  function updateClockDisplay() {
    const minutes = Math.floor(clockSeconds / 60);
    const seconds = clockSeconds % 60;
    document.getElementById('clockDisplay').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function startClock() {
    if (clockInterval) return; // Already running

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
        flashScoreboard();  // flash at 00:00
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
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }

    setButtonState('startClockButton', true);
    setButtonState('stopClockButton', false);
    setButtonState('setClockButton', true);

    document.getElementById('startClockButton').classList.add('flash');
  }

  function setClock() {
    const defaultTime = "40:00";
    const timeInput = prompt("Enter time (mm:ss):", defaultTime);
    const halfInput = prompt("Enter half (1 or 2):", currentHalf);

    if (!timeInput || !halfInput) return;

    const timePattern = /^([0-5]?[0-9]):([0-5]?[0-9])$/;
    if (!timePattern.test(timeInput)) {
      alert("Invalid time format. Use mm:ss.");
      return;
    }

    const [minutes, seconds] = timeInput.split(':').map(Number);
    clockSeconds = (minutes * 60) + seconds;
    startClockSeconds = clockSeconds;  // <-- ADD THIS LINE!

    if (halfInput === "1" || halfInput === "2") {
      currentHalf = parseInt(halfInput);
      document.getElementById('halfIndicator').textContent = (currentHalf === 1) ? '1st Half' : '2nd Half';
    } else {
        alert("Invalid half. Enter 1 or 2.");
    }

    updateClockDisplay();
  }

  document.getElementById('startClockButton').addEventListener('click', startClock);
  document.getElementById('stopClockButton').addEventListener('click', stopClock);
  document.getElementById('setClockButton').addEventListener('click', setClock);
  updateClockDisplay();
  setButtonState('startClockButton', true);
  setButtonState('stopClockButton', false);
  setButtonState('setClockButton', true);

  renderOtherEventButtons();
  renderPlayers();
  renderEventButtons();

function setOfflineOverlay(visible) {
    document.getElementById('offlineOverlay').style.display = visible ? 'flex' : 'none';
  }

  function checkConnectionStatus() {
    if (!navigator.onLine) {
      setOfflineOverlay(true);
      return;
    }

    fetch('teams.json?nocache=' + new Date().getTime())
    .then(response => {
      if (!response.ok) throw new Error('Network error');
      return response.json();
    })
    .then(() => setOfflineOverlay(false))
    .catch(() => setOfflineOverlay(true));
  }
  checkConnectionStatus();
  setInterval(checkConnectionStatus, 5000);
  window.addEventListener('online', checkConnectionStatus);
  window.addEventListener('offline', () => setOfflineOverlay(true));
});
