function $(id) {
	return document.getElementById(id);
}

var PRE_BOUT = 0;
var LINEUP_AFTER_TO = 1;
var LINEUP = 2;
var JAM_ON = 3;
var TTO = 4;
var OTO = 5;
var OR = 6;
var HALFTIME = 7;
var END_BOUT = 8;
var SCORE_OK = 9;
var PERIOD_CLOCK_STOPPED = [PRE_BOUT, LINEUP_AFTER_TO, OTO, TTO, OR, HALFTIME];

var initialState = {
	teams: ['Red', 'White', 'Black'],
	score: [0, 0, 0],
	stage: PRE_BOUT,
	period: {
		number: 1,
		secondsTotal: 30 * 60,
		lastStarted: new Date(1970, 0),
		secondsLeft: 30 * 60
	},
	jam: {
		lastStarted: new Date(1970, 0),
		secondsLeft: 30
	},
	halftime: {
		secondsTotal: 15 * 60
	}
};

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
		$('jamclock').contentEditable = stage === PRE_BOUT;
		$('periodclock').contentEditable = PERIOD_CLOCK_STOPPED.includes(stage);
	}
	this.updateGameState = (state, reset) => {
		reset ??= lastState === null;
		for (let t = 0; t < 3; t++) {
			if (reset || lastState.teams[t] !== state.teams[t]) self.setTeam(t + 1, state.teams[t]);
			if (reset || lastState.score[t] !== state.score[t]) self.setScore(t + 1, state.score[t])
		}
		if (reset || lastState.period.number !== state.period.number) self.setPeriodNumber(state.period.number);
		if (reset || lastState.period.secondsLeft !== state.period.secondsLeft) self.setPeriodClock(state.period.secondsLeft);
		if (state.stage === PRE_BOUT) {
			if (reset || lastState.halftime.secondsTotal !== state.halftime.secondsTotal) self.setJamClock(state.halftime.secondsTotal);
		} else {
			if (reset || lastState.jam.secondsLeft !== state.jam.secondsLeft) self.setJamClock(state.jam.secondsLeft);
		}
		if (reset || lastState.stage !== state.stage) self.updateStage(state.stage);
		lastState = deepCopy(state); // TODO: move deepCopy to GameState and set stuf in newState
		if (state.stage === PRE_BOUT)
			lastState.jam.secondsLeft = state.halftime.secondsTotal;
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
	
	function deepCopy(obj) {
		return JSON.parse(JSON.stringify(obj));
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
	var internalState = initialState;
	
	var jamTimer, periodTimer;

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
		DomState.updateGameState(internalState);
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
				internalState.stage = OTO;
				clearInterval(periodTimer);
				startTiming(0);
			break;
			case OR:
				internalState.stage = OTO;
			break;
			case OTO:
				if (internalState.jam.secondsLeft <= 60) {
					internalState.stage = TTO;
					internalState.jam.secondsLeft = 60 - internalState.jam.secondsLeft;
				}
			break;
			case TTO:
				internalState.stage = OTO;
				internalState.jam.secondsLeft = 60 - internalState.jam.secondsLeft;
			break;
		}
		DomState.updateGameState(internalState);
	}
	this.startOfficialReview = () => {
		if (![OTO, TTO].includes(internalState.stage)) {
			return;
		}
		if (internalState.stage === TTO) {
			internalState.jam.secondsLeft = 60 - internalState.jam.secondsLeft;
		}
		internalState.stage = OR;
		DomState.updateGameState(internalState);
	}
	this.togglePeriod = () => {
		internalState.period.number = (internalState.period.number === 1) ? 2 : 1;
		DomState.setPeriodNumber(internalState.period.number);
	}
	this.addSeconds = (amount) => {
		let clock = internalState.stage === HALFTIME ? internalState.jam : internalState.period;
		clock.secondsLeft += amount;
		if (clock.secondsLeft < 0)
			clock.secondsLeft = 0;
		DomState.updateGameState(internalState);
	}
	this.updateTeam = (team, name) => {
		if (team < 1 || team > 3) return;
		let teamIndex = team - 1;
		internalState.teams[teamIndex] = name;
		DomState.updateGameState(internalState);
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
		DomState.setScore(team, internalState.score[teamIndex]);
	}
	this.updatePeriodLength = (newLength) => {
		if (internalState.stage === PRE_BOUT)
			internalState.period.secondsTotal = newLength;
		if (PERIOD_CLOCK_STOPPED.includes(internalState.stage))
			internalState.period.secondsLeft = newLength;
		DomState.updateGameState(internalState);
	}
	this.updateHalftimeLength = (newLength) => {
		if (internalState.stage !== PRE_BOUT) return;
		internalState.halftime.secondsTotal = newLength;
		DomState.updateGameState(internalState);
	}

	function startTiming(seconds) {
		// Sets the jamclock to time the next thing (jam, line-up, T/O or halftime)
		clearInterval(jamTimer);
		internalState.jam.secondsLeft = seconds;
		internalState.jam.lastStarted = new Date();
		jamTimer = setInterval(jamSecondElapsed, 1000);
		DomState.updateGameState(internalState);
	}
	
	function jamSecondElapsed() {
		var iSec = internalState.jam.secondsLeft;
		// substract a second, unless we're in OTO or OR which can last as long as needed
		internalState.jam.secondsLeft += [OTO, OR].includes(internalState.stage) ? 1 : -1;
		// if that results in less than 0 seconds, set to 0
		if (internalState.jam.secondsLeft < 0)
			internalState.jam.secondsLeft = 0;
		DomState.updateGameState(internalState);
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
		DomState.updateGameState(internalState);
	}
	
	function periodSecondElapsed() {
		if (internalState.period.secondsLeft > 0)
			internalState.period.secondsLeft--;
		DomState.updateGameState(internalState);
	}
})(initialState);

window.onload=function() {
	DomState.updateGameState(initialState, true);
	DomState.setEventListeners();
	window.onkeydown = function(e) {
		if (e.target.matches('input[type="text"],textarea,[contenteditable="true"]')) return;
		switch (e.key) {
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
				} else {
/*					$('team1').innerText = e.key;
					$('team2').innerText = e.code;
					console.log(e); //*/
				}
			break;
		}
		e.preventDefault();
		return false;
	}
}