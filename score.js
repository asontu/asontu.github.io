function $(id) {
	return document.getElementById(id);
}

const PRE_BOUT = 0;
const LINEUP_AFTER_TO = 1;
const LINEUP = 2;
const JAM_ON = 3;
const TTO = 4;
const OTO = 5;
const OR = 6;
const HALFTIME = 7;
const END_BOUT = 8;
const SCORE_OK = 9;
const PERIOD_CLOCK_STOPPED = [PRE_BOUT, LINEUP_AFTER_TO, OTO, TTO, OR, HALFTIME];

const initialState = {
	teams: ['Red', 'White', 'Black'],
	score: [0, 0, 0],
	stage: PRE_BOUT,
	period: {
		number: 1,
		secondsTotal: 30 * 60,
		lastStarted: 0,
		secondsLeft: 30 * 60
	},
	jam: {
		lastStarted: 0,
		secondsLeft: 30
	},
	halftime: {
		secondsTotal: 15 * 60
	},
	lastUpdated: 0
};

var Persistence = new (function() {
	this.saveObject = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));
	this.getSavedOrDefault = (key, def) => JSON.parse(localStorage.getItem(key) ?? JSON.stringify(def ?? {}));
})();

var DomState = new (function() {
	var self = this;
	var lastState = null;
	this.setScore = (team, score) => $(`score${team}`).innerText = score;
	this.setTeam = (team, name) => $(`team${team}`).innerText = name;
	this.toggleHelp = () => $('help').classList.toggle('hidden');
	this.setJamClock = (to) => setSeconds('jamclock', to);
	this.setPeriodClock = (to) => setSeconds('periodclock', to);
	this.setPeriodNumber = (to) => $('period').innerText = to;
	this.updateStage = (stage) => {
		$('now').innerText = gameStageTexts[stage];
		if (document.body.className.indexOf(gameStageClasses[stage]) === -1)
			document.body.className = gameStageClasses[stage];
		$('jamclock').contentEditable = editable(stage === PRE_BOUT);
		$('periodclock').contentEditable = editable(PERIOD_CLOCK_STOPPED.includes(stage));
	}
	function editable(bool) {
		return bool ? 'plaintext-only' : 'false';
	}
	this.updateGameState = (newState, reset) => {
		reset ??= lastState === null;
		for (let t = 0; t < 3; t++) {
			if (reset || lastState.teams[t] !== newState.teams[t]) self.setTeam(t + 1, newState.teams[t]);
			if (reset || lastState.score[t] !== newState.score[t]) self.setScore(t + 1, newState.score[t])
		}
		if (reset || lastState.period.number !== newState.period.number) self.setPeriodNumber(newState.period.number);
		if (reset || lastState.period.secondsLeft !== newState.period.secondsLeft) self.setPeriodClock(newState.period.secondsLeft);
		if (newState.stage === PRE_BOUT) {
			newState.jam.secondsLeft = newState.halftime.secondsTotal;
			if (reset || lastState.halftime.secondsTotal !== newState.halftime.secondsTotal) self.setJamClock(newState.halftime.secondsTotal);
		} else {
			if (reset || lastState.jam.secondsLeft !== newState.jam.secondsLeft) self.setJamClock(newState.jam.secondsLeft);
		}
		if (reset || lastState.stage !== newState.stage) self.updateStage(newState.stage);
		lastState = newState;
	}
	this.setEventListeners = () => {
		for (let t = 1; t <= 3; t++) {
			$(`score${t}`).addEventListener('beforeinput', numbersOnly);
			$(`score${t}`).addEventListener('blur', e => GameState.updateScore(t, parseInt(e.target.innerText)));
			$(`team${t}`).addEventListener('blur', e => GameState.updateTeam(t, e.target.innerText));
		}
		$('periodclock').addEventListener('beforeinput', timeOnly);
		$('periodclock').addEventListener('blur', e => GameState.updatePeriodLength(getSeconds(e.target)));
		$('jamclock').addEventListener('beforeinput', timeOnly);
		$('jamclock').addEventListener('blur', e => GameState.updateHalftimeLength(getSeconds(e.target)));
	}
	function numbersOnly(e) {
		if (e.data !== null && isNaN(e.data)) {
			e.preventDefault();
			return false;
		}
	}
	function timeOnly(e) {
		if (e.data !== null && isNaN(e.data) && e.data !== ':') {
			e.preventDefault();
			return false;
		}
	}

	function getSeconds(element) {
		var r = element.innerText.split(':');
		return r.length < 2
			? parseInt(r.join(''))
			: parseInt(r[0]) * 60 + parseInt(r[1]);
	}

	function setSeconds(id, to) {
		// Set the display's time based on amount of seconds (with leading zeroes)
		var r = [];
		r[0] = Math.floor(to / 60);
		r[1] = to % 60;
		if (r[0] < 10)
			r[0] = '0' + r[0];
		if (r[1] < 10)
			r[1] = '0' + r[1];
		$(id).innerHTML = r.join('<span>:</span>');
	}

	var gameStageTexts = [
		'Halftime length',
		'Line-up',
		'Line-up',
		'Jam is on',
		'Team time-out',
		'Official time-out',
		'Official review',
		'Halftime',
		'Unofficial score',
		'Final score'
	];
	var gameStageClasses = [
		'setup',
		'lineup',
		'lineup',
		'jam-ongoing',
		'team time-out',
		'official time-out',
		'review time-out',
		'end period',
		'end score check',
		'end score confirmed'
	];
})();

var GameState = new (function(initialState) {
	var jamTimer, periodTimer;
	var saveKey = 'savedGameState';

	var internalState = Persistence.getSavedOrDefault(saveKey, initialState);
	// Parse datetimes from either default 0 or saved string-value
	internalState.period.lastStarted = new Date(internalState.period.lastStarted);
	internalState.jam.lastStarted = new Date(internalState.jam.lastStarted);
	internalState.lastUpdated = new Date(internalState.lastUpdated);

	this.initializeGame = () => {
		let secondsSinceLastUpdated = Math.floor((new Date() - internalState.lastUpdated) / 1000);

		switch (true) {
			case (secondsSinceLastUpdated > 60 * 60): // longer than 1 hour ago, only take team names and score
				let teams = internalState.teams;
				let score = internalState.score;
				internalState = deepCopy(initialState);
				internalState.teams = teams;
				internalState.score = score;
			break;
			case ([PRE_BOUT, END_BOUT, SCORE_OK].includes(internalState.stage)): // game hadn't started yet or was already finished, modify nothing
			break;
			case ([OTO, TTO, OR].includes(internalState.stage)): // Time-out, add seconds and continue timing
				internalState.jam.secondsLeft += secondsSinceLastUpdated;
				continueJam();
			break;
			case ([HALFTIME, LINEUP_AFTER_TO].includes(internalState.stage)
				&& internalState.jam.secondsLeft > secondsSinceLastUpdated): // Halftime or Line-up after TO and not elapsed yet, subtract seconds and continue timing
				internalState.jam.secondsLeft -= secondsSinceLastUpdated;
				continueJam();
			break;
			case ([HALFTIME, LINEUP_AFTER_TO].includes(internalState.stage)): // Halftime or Line-up after TO elapsed, set to 0 and don't time
				internalState.jam.secondsLeft = 0;
			break;
			case (!PERIOD_CLOCK_STOPPED.includes(internalState.stage) // Period clock was running and both jam and period have more time than lost since last updated
				&& Math.min(internalState.period.secondsLeft, internalState.jam.secondsLeft) > secondsSinceLastUpdated): // substract from both clocks and continue timing
				internalState.period.secondsLeft -= secondsSinceLastUpdated;
				internalState.jam.secondsLeft -= secondsSinceLastUpdated;
				continuePeriod();
				continueJam();
			break;
			default: // Default (including more time lost than was available in running period/jam), go to OTO with length since last save
				internalState.stage = OTO;
				startTiming(secondsSinceLastUpdated);
			break;
		}
		saveAndUpdateView(true);
	}
	this.resetGame = () => {
		if (!confirm('Reset the game?\nThis keeps only the team names and period & halftime lengths')) return;
		clearInterval(jamTimer);
		clearInterval(periodTimer);

		// Reset everything back to initialState except team names and period/halftime length
		let teams = internalState.teams;
		let periodLength = internalState.period.secondsTotal;
		let halftimeLength = internalState.halftime.secondsTotal;
		internalState = deepCopy(initialState);
		internalState.teams = teams;
		internalState.period.secondsLeft = periodLength;
		internalState.period.secondsTotal = periodLength;
		internalState.halftime.secondsTotal = halftimeLength;
		saveAndUpdateView(true);
	}
	function continueJam() {
		jamTimer = setTimeout(() => {
			jamSecondElapsed();
			jamTimer = setInterval(jamSecondElapsed, 1000);
		},
		(new Date() - internalState.jam.lastStarted) % 1000);
	}
	function continuePeriod() {
		periodTimer = setTimeout(() => {
			periodSecondElapsed();
			periodTimer = setInterval(periodSecondElapsed, 1000);
		},
		(new Date() - internalState.period.lastStarted) % 1000);
	}

	this.startStopJam = () => {
		switch (internalState.stage) { // this _was_ the stage when starting/stopping a Jam
			case PRE_BOUT:
				internalState.period.secondsLeft = internalState.period.secondsTotal;
			case HALFTIME:
			case TTO:
			case OTO:
			case OR:
				if (internalState.period.secondsLeft <= 0) {
					periodEnd();
					return;
				}
				internalState.stage = LINEUP_AFTER_TO;
				startTiming(30);
			break;
			case LINEUP_AFTER_TO:
				internalState.period.lastStarted = new Date();
				periodTimer = setInterval(periodSecondElapsed, 1000);
			case LINEUP:
				if (internalState.period.secondsLeft <= 0) {
					periodEnd();
					return;
				}
				internalState.stage = JAM_ON;
				startTiming(120);
			break;
			case JAM_ON:
				if (internalState.period.secondsLeft <= 0) {
					periodEnd();
					return;
				}
				internalState.stage = LINEUP;
				startTiming(30);
			break;
			case END_BOUT:
				internalState.stage = SCORE_OK;
			break;
		}
		saveAndUpdateView();
	}
	this.startTimeOut = () => {
		switch (internalState.stage) { // this _was_ the stage when starting TimeOut
			case HALFTIME:
				internalState.period.number = 1;
				internalState.period.secondsLeft = 0;
			case LINEUP_AFTER_TO:
			case LINEUP:
			case JAM_ON:
			case END_BOUT:
			case SCORE_OK:
				clearInterval(periodTimer);
				startTiming(0);
			case OR:
				internalState.stage = OTO;
			break;
			case OTO:
				if (internalState.jam.secondsLeft < 60) {
					internalState.stage = TTO;
					internalState.jam.secondsLeft = 60 - internalState.jam.secondsLeft;
				}
			break;
			case TTO:
				internalState.stage = OTO;
				internalState.jam.secondsLeft = 60 - internalState.jam.secondsLeft;
			break;
		}
		saveAndUpdateView();
	}
	this.startOfficialReview = () => {
		if (![OTO, TTO].includes(internalState.stage)) {
			return;
		}
		if (internalState.stage === TTO) {
			internalState.jam.secondsLeft = 60 - internalState.jam.secondsLeft;
		}
		internalState.stage = OR;
		saveAndUpdateView();
	}
	this.togglePeriod = () => {
		internalState.period.number = (internalState.period.number === 1) ? 2 : 1;
		saveAndUpdateView();
	}
	this.addSeconds = (amount) => {
		let clock = internalState.stage === HALFTIME ? internalState.jam : internalState.period;
		clock.secondsLeft += amount;
		if (clock.secondsLeft < 0)
			clock.secondsLeft = 0;
		saveAndUpdateView();
	}
	this.updateTeam = (team, name) => {
		if (team < 1 || team > 3) return;
		let teamIndex = team - 1;
		internalState.teams[teamIndex] = name;
		saveAndUpdateView();
	}
	this.updateScore = (team, newScore) => changeScore(team, newScore, true);
	this.increaseScore = (team, amount) => changeScore(team, (amount ?? 1));
	this.decreaseScore = (team, amount) => changeScore(team, -(amount ?? 1));
	function changeScore(team, amount, reset) {
		reset ??= false;
		if (team < 1 || team > 3) return;
		let teamIndex = team - 1;
		if (reset)
			internalState.score[teamIndex] = amount;
		else
			internalState.score[teamIndex] += amount;
		if (internalState.score[teamIndex] < 0)
			internalState.score[teamIndex] = 0;
		saveAndUpdateView();
	}
	this.updatePeriodLength = (newLength) => {
		if (internalState.stage === PRE_BOUT)
			internalState.period.secondsTotal = newLength;
		if (PERIOD_CLOCK_STOPPED.includes(internalState.stage))
			internalState.period.secondsLeft = newLength;
		saveAndUpdateView();
	}
	this.updateHalftimeLength = (newLength) => {
		if (internalState.stage !== PRE_BOUT) return;
		internalState.halftime.secondsTotal = newLength;
		saveAndUpdateView();
	}

	function startTiming(secondsLeft) {
		// Sets the jamclock to time the next thing (jam, line-up, T/O or halftime)
		clearInterval(jamTimer);
		internalState.jam.secondsLeft = secondsLeft;
		internalState.jam.lastStarted = new Date();
		jamTimer = setInterval(jamSecondElapsed, 1000);
		saveAndUpdateView();
	}
	
	function jamSecondElapsed() {
		// substract a second, unless we're in OTO or OR which can last as long as needed
		internalState.jam.secondsLeft += [OTO, OR].includes(internalState.stage) ? 1 : -1;
		// if that results in less than 0 seconds, set to 0
		if (internalState.jam.secondsLeft < 0)
			internalState.jam.secondsLeft = 0;
		saveAndUpdateView();
	}
	
	function periodEnd() {
		if (internalState.period.number === 1) {
			internalState.period.number = 2;
			internalState.stage = HALFTIME;
			clearInterval(periodTimer);
			internalState.period.secondsLeft = internalState.period.secondsTotal;
			startTiming(internalState.halftime.secondsTotal);
		} else if (internalState.stage !== HALFTIME) {
			clearInterval(periodTimer);
			clearInterval(jamTimer);
			internalState.stage = END_BOUT;
		}
		saveAndUpdateView();
	}
	
	function periodSecondElapsed() {
		if (internalState.period.secondsLeft > 0)
			internalState.period.secondsLeft--;
		saveAndUpdateView();
	}

	function saveAndUpdateView(reset) {
		internalState.lastUpdated = new Date();
		Persistence.saveObject(saveKey, internalState);
		DomState.updateGameState(deepCopy(internalState), reset);
	}
	
	function deepCopy(obj) {
		return JSON.parse(JSON.stringify(obj));
	}
})(initialState);

window.onload=function() {
	GameState.initializeGame();
	DomState.setEventListeners();
	window.onkeydown = function(e) {
		if (e.target.matches('input[type="text"],textarea,[contenteditable="plaintext-only"]')) return;
		switch (e.key) {
			case '`':
			case '§': GameState.resetGame(); break;
			case 'r': GameState.increaseScore(1); break;
			case 'f': GameState.increaseScore(2); break;
			case 'v': GameState.increaseScore(3); break;
			case 't': GameState.increaseScore(1, 6); break;
			case 'g': GameState.increaseScore(2, 6); break;
			case 'b': GameState.increaseScore(3, 6); break;
			case 'e': GameState.decreaseScore(1); break;
			case 'd': GameState.decreaseScore(2); break;
			case 'c': GameState.decreaseScore(3); break;
			case 'w': GameState.decreaseScore(1, 6); break;
			case 's': GameState.decreaseScore(2, 6); break;
			case 'x': GameState.decreaseScore(3, 6); break;
			case ' ': GameState.startStopJam(); break;
			case 'Escape': GameState.startTimeOut(); break;
			case 'o': GameState.startOfficialReview(); break;
			case 'p': GameState.togglePeriod(); break;
			case '?': DomState.toggleHelp(); break;
			default:
				if (!isNaN(e.key)) {
					let amount = e.ctrlKey ? -1 : 1;
					amount *= (parseInt(e.key) + 9) % 10 + 1;
					GameState.addSeconds(amount);
				}
			break;
		}
		e.preventDefault();
		return false;
	}
}