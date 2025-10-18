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

var Persistence = new (function() {
	this.saveObject = (key, obj) => localStorage.setItem(key, JSON.stringify(obj));
	this.getSavedOrDefault = (key, def) => JSON.parse(localStorage.getItem(key) ?? JSON.stringify(def ?? {}));
	this.removeObject = (key) => localStorage.removeItem(key);
})();

var DomState = new (function() {
	var self = this;
	var lastState = null;
	this.setScore = (team, score) => $(`score${team}`).innerText = score;
	this.setTeam = (team, name) => $(`team${team}`).innerText = name;
	this.toggleHelp = () => {
		$('help-background').classList.toggle('hidden');
		$('help').classList.toggle('hidden');
	}
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
			if (reset || lastState.score[t] !== newState.score[t]) self.setScore(t + 1, newState.score[t]);
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

var GameState = new (function() {
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

	var self = this;
	var jamTimer, periodTimer;
	var saveKey = 'savedGameState';
	var undoKey = 'undoStack';
	var redoKey = 'redoStack';

	var internalState = Persistence.getSavedOrDefault(saveKey, initialState);
	// Parse datetimes from either default 0 or saved string-value
	internalState.period.lastStarted = new Date(internalState.period.lastStarted);
	internalState.jam.lastStarted = new Date(internalState.jam.lastStarted);
	internalState.lastUpdated = new Date(internalState.lastUpdated);

	this.initializeGame = () => {
		let secondsSinceLastUpdated = Math.floor((new Date() - internalState.lastUpdated) / 1000);

		switch (true) {
			case (secondsSinceLastUpdated > 3600): // longer than 1 hour ago, only take team names and score
				let teams = internalState.teams;
				let score = internalState.score;
				internalState = deepCopy(initialState);
				internalState.teams = teams;
				internalState.score = score;
				Persistence.removeObject(undoKey);
				Persistence.removeObject(redoKey);
			break;
			case ([PRE_BOUT, END_BOUT, SCORE_OK].includes(internalState.stage)): // game hadn't started yet or was already finished, modify nothing
			break;
			case ([OTO, OR].includes(internalState.stage)): // Official Time-out/Review, add seconds and continue timing
				internalState.jam.secondsLeft += secondsSinceLastUpdated;
				continueJam();
			break;
			case ([TTO, HALFTIME, LINEUP_AFTER_TO].includes(internalState.stage)
				&& internalState.jam.secondsLeft > secondsSinceLastUpdated): // Team time-out, Halftime or Line-up after TO and not elapsed yet, subtract seconds and continue timing
				internalState.jam.secondsLeft -= secondsSinceLastUpdated;
				continueJam();
			break;
			case ([TTO, HALFTIME, LINEUP_AFTER_TO].includes(internalState.stage)): // Team time-out, Halftime or Line-up after TO elapsed, set to 0 and don't time
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
	this.undoLastStep = () => applyUndo(undoKey, redoKey);
	this.redoLastUndo = () => applyUndo(redoKey, undoKey);
	function applyUndo(key, otherKey) {
		let undoStack = Persistence.getSavedOrDefault(key, []);
		if (undoStack.length === 0) return;
		clearInterval(jamTimer);
		clearInterval(periodTimer);
		saveUndo(otherKey, internalState);
		let applyState = undoStack.pop();
		Persistence.saveObject(key, undoStack);
		internalState.stage = applyState.stage;
		internalState.period = applyState.period;
		internalState.period.lastStarted = new Date(internalState.period.lastStarted);
		internalState.jam = applyState.jam;
		internalState.jam.lastStarted = new Date(internalState.jam.lastStarted);
		internalState.lastUpdated = new Date(applyState.lastUpdated);
		self.initializeGame();
	}
	this.resetGame = () => {
		if (!confirm('Reset the game?\nThis keeps only the team names and period & halftime lengths')) return;
		clearInterval(jamTimer);
		clearInterval(periodTimer);
		Persistence.removeObject(undoKey);
		Persistence.removeObject(redoKey);

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
		saveUndo(undoKey, internalState);
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
		saveUndo(undoKey, internalState);
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
		saveUndo(undoKey, internalState);
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
		saveUndo(undoKey, internalState);
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

	function saveUndo(key, state) {
		let undoStack = Persistence.getSavedOrDefault(key, []);
		undoStack.push(deepCopy({
			stage: state.stage,
			period: state.period,
			jam: state.jam,
			lastUpdated: state.lastUpdated
		}));
		if (undoStack.length > 10) {
			undoStack.shift();
		}
		Persistence.saveObject(key, undoStack);
		if (key === undoKey) {
			Persistence.removeObject(redoKey);
		}
	}

	function saveAndUpdateView(reset) {
		internalState.lastUpdated = new Date();
		Persistence.saveObject(saveKey, internalState);
		DomState.updateGameState(deepCopy(internalState), reset);
	}
	
	function deepCopy(obj) {
		return JSON.parse(JSON.stringify(obj));
	}
})();

var HotKeys = new (function() {
	const defaultHotKeys = {
		'?': 'toggleHelp',
		'shift+?': 'toggleHelp',
		'ctrl+escape': 'resetGame',
		' ': 'startStopJam',
		'escape': 'startTimeOut',
		'o': 'startOfficialReview',
		'p': 'togglePeriod',
		'ctrl+z': 'undoLastStep',
		'meta+z': 'undoLastStep',
		'ctrl+shift+z': 'redoLastUndo',
		'shift+meta+z': 'redoLastUndo',
		'r': 'increaseScore1by1',
		'f': 'increaseScore2by1',
		'v': 'increaseScore3by1',
		't': 'increaseScore1by6',
		'g': 'increaseScore2by6',
		'b': 'increaseScore3by6',
		'e': 'decreaseScore1by1',
		'd': 'decreaseScore2by1',
		'c': 'decreaseScore3by1',
		'w': 'decreaseScore1by6',
		's': 'decreaseScore2by6',
		'x': 'decreaseScore3by6',
		'1': 'increasePeriodBy1',
		'2': 'increasePeriodBy2',
		'3': 'increasePeriodBy3',
		'4': 'increasePeriodBy4',
		'5': 'increasePeriodBy5',
		'6': 'increasePeriodBy6',
		'7': 'increasePeriodBy7',
		'8': 'increasePeriodBy8',
		'9': 'increasePeriodBy9',
		'0': 'increasePeriodBy10',
		'shift+1': 'decreasePeriodBy1',
		'shift+2': 'decreasePeriodBy2',
		'shift+3': 'decreasePeriodBy3',
		'shift+4': 'decreasePeriodBy4',
		'shift+5': 'decreasePeriodBy5',
		'shift+6': 'decreasePeriodBy6',
		'shift+7': 'decreasePeriodBy7',
		'shift+8': 'decreasePeriodBy8',
		'shift+9': 'decreasePeriodBy9',
		'shift+0': 'decreasePeriodBy10',
	};
	var hotKeys = Persistence.getSavedOrDefault('hotKeyPreferences', defaultHotKeys);
	this.setEventListeners = () => {
		window.addEventListener('keydown', function(e) {
			if (e.target.matches('input[type="text"],input[type="password"],textarea,[contenteditable="plaintext-only"],[contenteditable="true"]'))
				return;

			let keyInfo = getKeyInfo(e);
			if (!keyInfo || !Object.hasOwn(hotKeys, keyInfo.string))
				return;

			switch (hotKeys[keyInfo.string]) {
				case 'toggleHelp': DomState.toggleHelp(); break;
				case 'resetGame': GameState.resetGame(); break;
				case 'startStopJam': GameState.startStopJam(); break;
				case 'startTimeOut': GameState.startTimeOut(); break;
				case 'startOfficialReview': GameState.startOfficialReview(); break;
				case 'togglePeriod': GameState.togglePeriod(); break;
				case 'undoLastStep': GameState.undoLastStep(); break;
				case 'redoLastUndo': GameState.redoLastUndo(); break;
				case 'increaseScore1by1': GameState.increaseScore(1); break;
				case 'increaseScore2by1': GameState.increaseScore(2); break;
				case 'increaseScore3by1': GameState.increaseScore(3); break;
				case 'increaseScore1by6': GameState.increaseScore(1, 6); break;
				case 'increaseScore2by6': GameState.increaseScore(2, 6); break;
				case 'increaseScore3by6': GameState.increaseScore(3, 6); break;
				case 'decreaseScore1by1': GameState.decreaseScore(1); break;
				case 'decreaseScore2by1': GameState.decreaseScore(2); break;
				case 'decreaseScore3by1': GameState.decreaseScore(3); break;
				case 'decreaseScore1by6': GameState.decreaseScore(1, 6); break;
				case 'decreaseScore2by6': GameState.decreaseScore(2, 6); break;
				case 'decreaseScore3by6': GameState.decreaseScore(3, 6); break;
				case 'increasePeriodBy1': GameState.addSeconds(1); break;
				case 'increasePeriodBy2': GameState.addSeconds(2); break;
				case 'increasePeriodBy3': GameState.addSeconds(3); break;
				case 'increasePeriodBy4': GameState.addSeconds(4); break;
				case 'increasePeriodBy5': GameState.addSeconds(5); break;
				case 'increasePeriodBy6': GameState.addSeconds(6); break;
				case 'increasePeriodBy7': GameState.addSeconds(7); break;
				case 'increasePeriodBy8': GameState.addSeconds(8); break;
				case 'increasePeriodBy9': GameState.addSeconds(9); break;
				case 'increasePeriodBy10': GameState.addSeconds(10); break;
				case 'decreasePeriodBy1': GameState.addSeconds(-1); break;
				case 'decreasePeriodBy2': GameState.addSeconds(-2); break;
				case 'decreasePeriodBy3': GameState.addSeconds(-3); break;
				case 'decreasePeriodBy4': GameState.addSeconds(-4); break;
				case 'decreasePeriodBy5': GameState.addSeconds(-5); break;
				case 'decreasePeriodBy6': GameState.addSeconds(-6); break;
				case 'decreasePeriodBy7': GameState.addSeconds(-7); break;
				case 'decreasePeriodBy8': GameState.addSeconds(-8); break;
				case 'decreasePeriodBy9': GameState.addSeconds(-9); break;
				case 'decreasePeriodBy10': GameState.addSeconds(-10); break;
				default:
					return; // Don't prevent default
			}
			e.preventDefault();
			return false;
		});
	}

	function getKeyInfo(e) {
		if (e.key.length > 1 && e.key !== e.code) return false;
		let info = {
			key: e.key.toLowerCase(),
			ctrl: e.ctrlKey,
			alt: e.altKey,
			shift: e.shiftKey,
			meta: e.metaKey
		};
		if (e.code.substring(0, 3) === 'Key') {
			info.key = e.code.charAt(3).toLowerCase();
		}
		if (e.code.substring(0, 5) === 'Digit') {
			info.key = e.code.charAt(5);
		}
		info.string = ['ctrl', 'alt', 'shift', 'meta']
			.filter(modifier => info[modifier])
			.concat([info.key])
			.join('+');
		return info;
	}
})();

document.addEventListener("DOMContentLoaded", function() {
	GameState.initializeGame();
	DomState.setEventListeners();
	HotKeys.setEventListeners();
});