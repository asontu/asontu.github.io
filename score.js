function $(id) {
	return document.getElementById(id);
}

var PRE_BOUT = 0;
var LINEUP_POST_TO = 1;
var LINEUP = 2;
var JAM_ON = 3;
var TTO = 4;
var OTO = 5;
var OR = 6;
var HALFTIME = 7;
var END_BOUT = 8;
var SCORE_OK = 9;

var aNowTexts = [
	'Line-up',
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

var DomState = new (function() {
	this.setScore = (team, score) => $(`score${team}`).innerText = score;
	this.toggleHelp = () => $('help').classList.toggle('hidden');
	this.setJamClock = (to) => setSeconds('jamclock', to);
	this.setPeriodClock = (to) => setSeconds('periodclock', to);
	this.setPeriodNumber = (to) => $('period').innerText = to;
	
	function setSeconds(id, to) {
		// Set the display's time based on amount of seconds (with leading zeroes)
		var r = [];
		r[0] = Math.floor(to / 60);
		r[1] = to % 60;
		if (r[0] < 10)
			r[0] = '0' + r[0];
		if (r[1] < 10)
			r[1] = '0' + r[1];
		$(id).innerText = r.join(':');
	}
})();

var GameState = new (function() {
	var internalState = {
		score: [0, 0, 0],
		stage: PRE_BOUT,
		period: {
			number: 1,
			lastStarted: new Date(1970, 0),
			secondsLeft: 30 * 60
		},
		jam: {
			lastStarted: new Date(1970, 0),
			secondsLeft: 30
		},
		halftime: {
			lastStarted: new Date(1970, 0),
			secondsLeft: 15 * 60
		}
	};
	
	var tJamTimer, tPeriodTimer;

	this.startStopJam = () => {
		switch (internalState.stage) {
			case PRE_BOUT:
				internalState.period.secondsLeft = getSeconds('periodclock');
				internalState.halftime.secondsLeft = getSeconds('jamclock');
				$('jamclock').setAttribute('contenteditable', 'false');
			case HALFTIME:
			case TTO:
			case OTO:
			case OR:
				internalState.stage = LINEUP_POST_TO;
				startTiming(30);
			break;
			case LINEUP_POST_TO:
				tPeriodTimer = setInterval(periodSecondElapsed, 1000);
			case LINEUP:
				internalState.stage = JAM_ON;
				startTiming(120);
			break;
			case JAM_ON:
				if (getSeconds('periodclock') > 0) {
					internalState.stage = LINEUP;
					startTiming(30);
				} else {
					periodEnd();
				}
			break;
			case END_BOUT:
				internalState.stage = SCORE_OK;
			break;
		}
		$('now').innerText = aNowTexts[internalState.stage];
	}
	this.startTimeOut = () => {
		switch (internalState.stage) {
			case HALFTIME:
				internalState.period.number = 1;
				$('period').innerText = internalState.period.number;
				setSeconds('periodclock', 0);
			case LINEUP_POST_TO:
			case LINEUP:
			case JAM_ON:
			case END_BOUT:
			case SCORE_OK:
				internalState.stage = OTO;
				clearInterval(tPeriodTimer);
				startTiming(0);
			break;
			case OR:
				internalState.stage = OTO;
			break;
			case OTO:
				if (getSeconds('jamclock') <= 60) {
					internalState.stage = TTO;
					setSeconds('jamclock', 60 - getSeconds('jamclock'));
				}
			break;
			case TTO:
				internalState.stage = OTO;
				setSeconds('jamclock', 60 - getSeconds('jamclock'));
			break;
		}
		$('now').innerText = aNowTexts[internalState.stage];
	}
	this.startOfficialReview = () => {
		if (internalState.stage !== OTO && internalState.stage !== TTO) {
			return;
		}
		if (internalState.stage === TTO) {
			setSeconds('jamclock', 60 - getSeconds('jamclock'));
		}
		internalState.stage = OR;
		$('now').innerText = aNowTexts[internalState.stage];
	}
	this.togglePeriod = () => {
		internalState.period.number = (internalState.period.number === 1) ? 2 : 1
		$('period').innerText = internalState.period.number;
	}
	this.addSeconds = (amount) => {
		let clock = internalState.stage === HALFTIME ? 'jamclock' : 'periodclock';
		amount += getSeconds(clock);
		if (amount >= 0)
			setSeconds(clock, amount);
	}
	this.increaseScore = (team, amount) => changeScore(team, (amount ?? 1));
	this.decreaseScore = (team, amount) => changeScore(team, -(amount ?? 1));
	function changeScore(team, amount) {
		if (team < 1 || team > 3) return;
		let teamIndex = team - 1;
		internalState.score[teamIndex] += amount;
		if (internalState.score[teamIndex] < 0)
			internalState.score[teamIndex] = 0;
		DomState.setScore(team, internalState.score[teamIndex]);
	}

	function startTiming(iSec) {
		// Sets the jamclock to time the next thing (jam, line-up, T/O or halftime)
		clearInterval(tJamTimer);
		setSeconds('jamclock', iSec);
		tJamTimer = setInterval(jamSecondElapsed, 1000);
	}
	
	function jamSecondElapsed() {
		// if we're in lineup and the periodclock just expired, the period ends
		if (internalState.stage === LINEUP && getSeconds('periodclock') === 0) {
			periodEnd();
			return;
		}
		// else get the current time
		var iSec = getSeconds('jamclock');
		// substract a second, unless we're in OTO or OR which can last as long as needed
		iSec += internalState.stage === OTO || internalState.stage === OR ? 1 : -1;
		// if that results in 0 or more seconds, set to the jamclock
		if (iSec >= 0)
			setSeconds('jamclock', iSec);
		else {
			// negative jamclock, don't set
			// if the period is still running, just return.
			if (getSeconds('periodclock') > 0)
				return;
			// is the period is also 0, period ends
			periodEnd();
		}
	}
	
	function periodEnd() {
		if (internalState.period.number === 1) {
			internalState.period.number = 2;
			$('period').innerText = internalState.period.number;
			internalState.stage = HALFTIME;
			clearInterval(tPeriodTimer);
			setSeconds('periodclock', internalState.period.secondsLeft);
			startTiming(internalState.halftime.secondsLeft);
		} else if (internalState.stage !== HALFTIME) {
			clearInterval(tPeriodTimer);
			clearInterval(tJamTimer);
			internalState.stage = END_BOUT;
		}
		$('now').innerText = aNowTexts[internalState.stage];
	}
	
	function periodSecondElapsed() {
		var iSec = getSeconds('periodclock');
		if (iSec > 0)
			setSeconds('periodclock', --iSec);
	}

	function getSeconds(id) {
		// Get the total amount of seconds from the time displayed
		var r = $(id).innerText.split(':');
		return parseInt(r[0]) * 60 + parseInt(r[1]);
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
		$(id).innerText = r.join(':');
	}
})();

window.onload=function() {
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