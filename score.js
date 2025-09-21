function $(id) {
	return document.getElementById(id);
}

var PRE_BOUT = 0;
var LINEUP_1 = 1;
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

var GameState = new (function() {
	var iPeriodSecs = 30 * 60;
	var iBreakSecs = 15 * 60;
	
	var iState = PRE_BOUT;
	var iPeriod = 1;
	
	var tJamTimer, tPeriodTimer;

	this.startStopJam = () => {
		switch (iState) {
			case PRE_BOUT:
				iPeriodSecs = getSeconds('periodclock');
				iBreakSecs = getSeconds('jamclock');
				$('jamclock').setAttribute('contenteditable', 'false');
			case HALFTIME:
			case TTO:
			case OTO:
			case OR:
				iState = LINEUP_1;
				startTiming(30);
			break;
			case LINEUP_1:
				tPeriodTimer = setInterval(periodSecondElapsed, 1000);
			case LINEUP:
				iState = JAM_ON;
				startTiming(120);
			break;
			case JAM_ON:
				if (getSeconds('periodclock') > 0) {
					iState = LINEUP;
					startTiming(30);
				} else {
					periodEnd();
				}
			break;
			case END_BOUT:
				iState = SCORE_OK;
			break;
		}
		$('now').innerText = aNowTexts[iState];
	}
	this.startTimeOut = () => {
		switch (iState) {
			case HALFTIME:
				iPeriod = 1;
				$('period').innerText = iPeriod;
				setSeconds('periodclock', 0);
			case LINEUP_1:
			case LINEUP:
			case JAM_ON:
			case END_BOUT:
			case SCORE_OK:
				iState = OTO;
				clearInterval(tPeriodTimer);
				startTiming(0);
			break;
			case OR:
				iState = OTO;
			break;
			case OTO:
				if (getSeconds('jamclock') <= 60) {
					iState = TTO;
					setSeconds('jamclock', 60 - getSeconds('jamclock'));
				}
			break;
			case TTO:
				iState = OTO;
				setSeconds('jamclock', 60 - getSeconds('jamclock'));
			break;
		}
		$('now').innerText = aNowTexts[iState];
	}
	this.startOfficialReview = () => {
		if (iState !== OTO && iState !== TTO) {
			return;
		}
		if (iState === TTO) {
			setSeconds('jamclock', 60 - getSeconds('jamclock'));
		}
		iState = OR;
		$('now').innerText = aNowTexts[iState];
	}
	this.togglePeriod = () => {
		iPeriod = (iPeriod === 1) ? 2 : 1
		$('period').innerText = iPeriod;
	}

	this.addSeconds = (amount) => {
		let clock = iState === HALFTIME ? 'jamclock' : 'periodclock';
		let newSec = amount + getSeconds(clock);
		if (newSec >= 0)
			setSeconds(clock, newSec);
	}

	function startTiming(iSec) {
		// Sets the jamclock to time the next thing (jam, line-up, T/O or halftime)
		clearInterval(tJamTimer);
		setSeconds('jamclock', iSec);
		tJamTimer = setInterval(jamSecondElapsed, 1000);
	}
	
	function jamSecondElapsed() {
		// if we're in lineup and the periodclock just expired, the period ends
		if (iState === LINEUP && getSeconds('periodclock') === 0) {
			periodEnd();
			return;
		}
		// else get the current time
		var iSec = getSeconds('jamclock');
		// substract a second, unless we're in OTO or OR which can last as long as needed
		iSec += iState === OTO || iState === OR ? 1 : -1;
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
		if (iPeriod === 1) {
			iPeriod = 2;
			$('period').innerText = iPeriod;
			iState = HALFTIME;
			clearInterval(tPeriodTimer);
			setSeconds('periodclock', iPeriodSecs);
			startTiming(iBreakSecs);
		} else if (iState !== HALFTIME) {
			clearInterval(tPeriodTimer);
			clearInterval(tJamTimer);
			iState = END_BOUT;
		}
		$('now').innerText = aNowTexts[iState];
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
			case 'r': $('score1').innerText++; break;
			case 'f': $('score2').innerText++; break;
			case 'v': $('score3').innerText++; break;
			case 'e': $('score1').innerText--; break;
			case 'd': $('score2').innerText--; break;
			case 'c': $('score3').innerText--; break;
			case ' ': GameState.startStopJam(); break;
			case 'Escape': GameState.startTimeOut(); break;
			case 'o': GameState.startOfficialReview(); break;
			case 'p': GameState.togglePeriod(); break;
			case '?': $('help').classList.toggle('hidden'); break;
			default:
				if (!isNaN(e.key)) {
					var newSec = e.ctrlKey ? -1 : 1;
					newSec *= (parseInt(e.key) + 9) % 10 + 1;
					GameState.addSeconds(newSec);
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