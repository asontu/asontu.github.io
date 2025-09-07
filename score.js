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
		parseInt(e.currentTarget.innerText) + ((e.altKey)?-1:1)
	);
	e.preventDefault();
	e.stopPropagation();
}

var bNoKeys = false;
function f() {
	bNoKeys = true;
}
function b() {
	bNoKeys = false;
}

var PRE_BOUT = 0;
var LINEUP_1 = 1;
var LINEUP = 2;
var JAM_ON = 3;
var TTO = 4;
var OTO = 5;
var HALFTIME = 6;
var END_BOUT = 7;
var SCORE_OK = 8;

var aNowTexts = [
	'Line-up:',
	'Line-up:',
	'Line-up:',
	'Jam is on:',
	'Team time-out:',
	'Official time-out:',
	'Halftime:',
	'Unofficial score',
	'Final score'
];

var aPeriodTexts = ['',
	'1st',
	'2nd'
];

var iPeriodSecs = 20 * 60;
var iBreakSecs = 15 * 60;

var iState = PRE_BOUT;
var iPeriod = 1;

var tJamTimer, tPeriodTimer;

function nextJam(iSec) {
	// Sets the jamclock to time the next thing (jam, line-up, T/O or halftime)
	clearInterval(tJamTimer);
	setSec('jamclock', iSec);
	tJamTimer = setInterval(jamSecond, 1000);
}

function jamSecond() {
	// if we're in lineup and the periodclock just expired, the period ends
	if (iState == LINEUP && getSec('periodclock')==0) {
		periodEnd();
		return;
	}
	// else get the current time
	var iSec = getSec('jamclock');
	// substract a second, unless we're in OTO which can last as long as needed
	iSec += ((iState==OTO)?1:-1);
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
	if (iPeriod == 1) {
		iPeriod = 2;
		$('period').innerText = aPeriodTexts[iPeriod];
		iState = HALFTIME;
		clearInterval(tPeriodTimer);
		setSec('periodclock', iPeriodSecs);
		nextJam(iBreakSecs);
	} else if (iState != HALFTIME) {
		clearInterval(tPeriodTimer);
		clearInterval(tJamTimer);
		iState = END_BOUT;
	}
	$('now').innerText = aNowTexts[iState];
}

function periodSecond() {
	var iSec = getSec('periodclock');
	if (iSec > 0)
		setSec('periodclock', --iSec);
}

function jamClick() {
	switch (iState) {
		case PRE_BOUT:
			iPeriodSecs = getSec('periodclock');
			iBreakSecs = getSec('jamclock');
			$('jamclock').setAttribute('contenteditable', 'false');
		case HALFTIME:
		case TTO:
		case OTO:
			iState = LINEUP_1;
			nextJam(30);
		break;
		case LINEUP_1:
			tPeriodTimer = setInterval(periodSecond, 1000);
		case LINEUP:
			iState = JAM_ON;
			nextJam(120);
		break;
		case JAM_ON:
			if (getSec('periodclock') > 0) {
				iState = LINEUP;
				nextJam(30);
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
function clockClick() {
	switch (iState) {
		case LINEUP_1:
		case LINEUP:
			iState = OTO;
			clearInterval(tPeriodTimer);
			nextJam(0);
		break;
		case OTO:
			if (getSec('jamclock') <= 60) {
				iState = TTO;
				setSec('jamclock', 60-getSec('jamclock'));
			}
		break;
		case TTO:
			iState = OTO;
			setSec('jamclock', 60-getSec('jamclock'));
		break;
	}
	$('now').innerText = aNowTexts[iState];
}
function periodClick() {
	iPeriod = (iPeriod == 1)?2:1
	$('period').innerText = aPeriodTexts[iPeriod];
}

window.onload=function() {
	$('score1').addEventListener('click', score, false);
	$('score2').addEventListener('click', score, false);
	$('score3').addEventListener('click', score, false);
	$('now').addEventListener('click', jamClick, false);
	$('jamclock').addEventListener('click', clockClick, false);
	$('period').addEventListener('click', periodClick, false);
	$('team1').addEventListener('focus', f);
	$('team1').addEventListener('blur', b);
	$('team2').addEventListener('focus', f);
	$('team2').addEventListener('blur', b);
	$('team3').addEventListener('focus', f);
	$('team3').addEventListener('blur', b);
	$('jamclock').addEventListener('focus', f);
	$('jamclock').addEventListener('blur', b);
	$('periodclock').addEventListener('focus', f);
	$('periodclock').addEventListener('blur', b);
	window.onkeydown=function(e) {
		if (bNoKeys) return;
		switch (e.keyCode) {
			case 82: // R
				$('score1').innerText++;
			break;
			case 70: // F
				$('score2').innerText++;
			break;
			case 86: // V
				$('score3').innerText++;
			break;
			case 69: // E
				$('score1').innerText--;
			break;
			case 68: // D
				$('score2').innerText--;
			break;
			case 67: // C
				$('score3').innerText--;
			break;
			case 32: // [ ]
				jamClick();
			break;
			case 27: // [Esc]
				clockClick();
			break;
			case 80: // P
				periodClick();
			break;
			case 191: // ?
				if (!e.shiftKey)
					break;
				$('help').style.display=($('help').style.display=='none')?'block':'none';
			break;
			default:
				if (e.keyCode >= 48 && e.keyCode <= 57) {
					var nwSec = getSec('periodclock') +
							((e.shiftKey?-1:1) *
							((e.keyCode==48)?10:e.keyCode-48));
					if (nwSec >= 0)
						setSec('periodclock', nwSec);
				} else {
//					$('team1').innerText = e.keyCode;
				}
			break;
		}
	}
}