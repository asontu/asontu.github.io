function $(id) {
	return document.getElementById(id);
}

function getSec(id) {
	// Get the total amount of seconds from the time displayed
	var r = $(id).innerText.split(':');
	return parseInt(r[0]) * 60 + parseInt(r[1]);
}

function setSec(id, to) {
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

function score(e) {
	// Add or substract a point to the score that was clicked on
	e.currentTarget.innerText = (
		parseInt(e.currentTarget.innerText) + ((e.altKey) ? -1 : 1)
	);
	e.preventDefault();
	e.stopPropagation();
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
	'Line-up:',
	'Line-up:',
	'Line-up:',
	'Jam is on:',
	'Team time-out:',
	'Official time-out:',
	'Official review:',
	'Halftime:',
	'Unofficial score',
	'Final score'
];

var aPeriodTexts = ['',
	'1st',
	'2nd'
];

var iPeriodSecs = 30 * 60;
var iBreakSecs = 15 * 60;

var iState = PRE_BOUT;
var iPeriod = 1;

var tJamTimer, tPeriodTimer;

function startTiming(iSec) {
	// Sets the jamclock to time the next thing (jam, line-up, T/O or halftime)
	clearInterval(tJamTimer);
	setSec('jamclock', iSec);
	tJamTimer = setInterval(jamSecondElapsed, 1000);
}

function jamSecondElapsed() {
	// if we're in lineup and the periodclock just expired, the period ends
	if (iState === LINEUP && getSec('periodclock') === 0) {
		periodEnd();
		return;
	}
	// else get the current time
	var iSec = getSec('jamclock');
	// substract a second, unless we're in OTO or OR which can last as long as needed
	iSec += iState === OTO || iState === OR ? 1 : -1;
	// if that results in 0 or more seconds, set to the jamclock
	if (iSec >= 0)
		setSec('jamclock', iSec);
	else {
		// negative jamclock, don't set
		// if the period is still running, just return.
		if (getSec('periodclock') > 0)
			return;
		// is the period is also 0, period ends
		periodEnd();
	}
}

function periodEnd() {
	if (iPeriod === 1) {
		iPeriod = 2;
		$('period').innerText = aPeriodTexts[iPeriod];
		iState = HALFTIME;
		clearInterval(tPeriodTimer);
		setSec('periodclock', iPeriodSecs);
		startTiming(iBreakSecs);
	} else if (iState !== HALFTIME) {
		clearInterval(tPeriodTimer);
		clearInterval(tJamTimer);
		iState = END_BOUT;
	}
	$('now').innerText = aNowTexts[iState];
}

function periodSecondElapsed() {
	var iSec = getSec('periodclock');
	if (iSec > 0)
		setSec('periodclock', --iSec);
}

function startStopJam() {
	switch (iState) {
		case PRE_BOUT:
			iPeriodSecs = getSec('periodclock');
			iBreakSecs = getSec('jamclock');
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
			if (getSec('periodclock') > 0) {
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
function startTimeOut() {
	switch (iState) {
		case HALFTIME:
			iPeriod = 1;
			$('period').innerText = aPeriodTexts[iPeriod];
			setSec('periodclock', 0);
		case LINEUP_1:
		case LINEUP:
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
			if (getSec('jamclock') <= 60) {
				iState = TTO;
				setSec('jamclock', 60 - getSec('jamclock'));
			}
		break;
		case TTO:
			iState = OTO;
			setSec('jamclock', 60 - getSec('jamclock'));
		break;
	}
	$('now').innerText = aNowTexts[iState];
}
function startOfficialReview() {
	if (iState !== OTO && iState !== TTO) {
		return;
	}
	if (iState === TTO) {
		setSec('jamclock', 60 - getSec('jamclock'));
	}
	iState = OR;
	$('now').innerText = aNowTexts[iState];
}
function togglePeriod() {
	iPeriod = (iPeriod === 1) ? 2 : 1
	$('period').innerText = aPeriodTexts[iPeriod];
}

window.onload=function() {
	$('score1').addEventListener('click', score, false);
	$('score2').addEventListener('click', score, false);
	$('score3').addEventListener('click', score, false);
	$('now').addEventListener('click', startStopJam, false);
	$('jamclock').addEventListener('click', startTimeOut, false);
	$('period').addEventListener('click', togglePeriod, false);
	window.onkeydown = function(e) {
		if (e.target.matches('input[type="text"],textarea,[contenteditable="true"]')) return;
		switch (e.key) {
			case 'r': $('score1').innerText++; break;
			case 'f': $('score2').innerText++; break;
			case 'v': $('score3').innerText++; break;
			case 'e': $('score1').innerText--; break;
			case 'd': $('score2').innerText--; break;
			case 'c': $('score3').innerText--; break;
			case ' ': startStopJam(); break;
			case 'Escape': startTimeOut(); break;
			case 'o': startOfficialReview(); break;
			case 'p': togglePeriod(); break;
			case '?': $('help').classList.toggle('hidden'); break;
			default:
				if (!isNaN(e.key)) {
					let clock = iState === HALFTIME ? 'jamclock' : 'periodclock';
					var newSec = e.ctrlKey ? -1 : 1;
					newSec *= (parseInt(e.key) + 9) % 10 + 1;
					newSec += getSec(clock);
					if (newSec >= 0)
						setSec(clock, newSec);
				} else {
//					$('team1').innerText = e.keyCode;
				}
			break;
		}
		e.preventDefault();
		return false;
	}
}