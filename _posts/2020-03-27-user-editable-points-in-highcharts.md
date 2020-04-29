---
layout: post
title:  "User-editable points in Highcharts"
tags: front-end javascript
---

A customer wanted data displayed in a chart and be able to edit a single point. It seemed to me the best UX would be to have a button in Highchart's Tooltip with which to edit the value. Searching for a solution I found more people asking for this feature but not really an answer I could work with.

So I went to work and came up with this, using [this Stack Overflow answer cloning the tooltip](https://stackoverflow.com/a/11486497) and [this plugin for a tooltip-show event](http://jsfiddle.net/gevgeny/7egwguay/).

Code below and demo on [JSFiddle](https://jsfiddle.net/joLq0ukx/). Click a point, it sticks, double-click the value and a prompt comes up for a new value.

{% gist 66ba5f060ef79b3d37f850b1292e619e %}
<noscript markdown="1">
```js
// Plugin code 
(function (Highcharts) {

	Highcharts.wrap(Highcharts.Tooltip.prototype, 'hide', function (proceed) {
		var tooltip = this.chart.options.tooltip;

		// Run the original proceed method
		proceed.apply(this, Array.prototype.slice.call(arguments, 1));

		if (!this.isHidden && tooltip.events && tooltip.events.hide) {
			tooltip.events.hide();
		}
	});

	Highcharts.wrap(Highcharts.Tooltip.prototype, 'refresh', function (proceed) {
		var tooltip = this.chart.options.tooltip;

		// Run the original proceed method
		proceed.apply(this, Array.prototype.slice.call(arguments, 1));

		if (tooltip.events && tooltip.events.show) {
			tooltip.events.show(this.chart.hoverPoints);
		}
	});

}(Highcharts));

$(function () {
	function setVisibility(setObject, setValue) {
		setObject.element.setAttribute('visibility', setValue);
		setObject.div.style.visibility = setValue;
	}
	function setClone(doWhat) {
		chart.container.firstChild[doWhat+'Child'](cloneToolTip.element);
		chart.container[doWhat+'Child'](cloneToolTip.div);
	}

	var cloneToolTip = null;
	var clickedPoint = null;
	var chart = new Highcharts.Chart({
		chart: {
			renderTo: 'container'
		},
		xAxis: {
			categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		},
		
		series: [{
			allowPointSelect: true,
			data: [29.9, 71.5, 106.4, 129.2, 144.0, 176.0, 135.6, 148.5, 216.4, 194.1, 95.6, 54.4]
		}, {
			allowPointSelect: true,
			data: [29.9, 71.5, 106.4, 129.2, 144.0, 176.0, 135.6, 148.5, 216.4, 194.1, 95.6, 54.4].reverse()
		}, {
			allowPointSelect: true,
			data: [194.1, 95.6, 54.4, 29.9, 71.5, 106.4, 129.2, 144.0, 176.0, 135.6, 148.5, 216.4]
		}],
		
		plotOptions: {
			series: {
				cursor: 'pointer',
				point: {
					events: {
						// this function makes the ToolTip "stick" when its point is clicked by cloning it
						click: function() {
							var doClone = true;
							// if there is currently a cloned ToolTip, remove it from the DOM before adding a new one
							if (cloneToolTip) {
								setClone('remove');
								// if the clicked point is the one that was already cloned, don't clone it again, only remove
								if (clickedPoint == this) {
									doClone = false;
								}
							}
							// if a _different_ point from the cloned one was clicked (or there is no clone currently),
							// clone the newly clicked point's ToolTip
							if (doClone) {
								// clone
								cloneToolTip = {
									element : chart.tooltip.label.element.cloneNode(true),
									div : chart.tooltip.label.div.cloneNode(true)
								};
								// make clone visible, original might not be
								setVisibility(cloneToolTip, 'visible');
								// only ToolTip from a clicked point can receive events
								cloneToolTip.div.style.pointerEvents = 'auto';
								// append clones to the appropriate element
								setClone('append');
								// hide the original ToolTip
								setVisibility(chart.tooltip.label, 'hidden');
								// remember which point was clicked to detect closing it
								clickedPoint = this;
							} else {
								// a clicked point was clicked again to "unstick", set clones to null
								cloneToolTip = null;
								// show the original ToolTip again
								setVisibility(chart.tooltip.label, 'visible');
								// set last clicked point to null
								clickedPoint = null;
							}
						}
					}
				}
			}
		},
		tooltip: {
			useHTML: true,
			events: {
				// even though we hide the ToolTip in the click-event above. if the mouse moves away from the chart long
				// enough to completely remove the ToolTip then it will be redrawn from scratch, nullifying the
				// visibility-attributes so we have to hide it again in this custom event that fires right after
				// the ToolTip has been drawn. Simply using [return false] in the formatter doesn't work because we need
				// a ToolTip to clone if a different point is clicked.
				show: function(points) {
					if (cloneToolTip) {
						setVisibility(chart.tooltip.label, 'hidden');
					}
				}
			},
			formatter: function() {
				// build the ToolTip, this is made to resemble the default ToolTip with added data- attributes
				// to know in the dblclick event-handler which point from which series to update
				return `
<span>${this.point.category}<br>
	<span style="color:${this.series.color}">●</span> ${this.series.name}:
	<b data-series="${this.series.index}" data-x="${this.point.index}" data-y="${this.y}" title="Double-click to edit value">${this.y}</b>
</span>`;
			}
		}
	});
	
	$(window).resize(function() {
		if (cloneToolTip) {
			// remove cloned ToolTip after screen resize
			setClone('remove');
			cloneToolTip = null;
			// edited point is no longer clicked
			clickedPoint = null;
			// show original ToolTip again
			setVisibility(chart.tooltip.label, 'visible');
			// go through selected points and unselect()
			chart.getSelectedPoints().map(p => p.select(false));
		}
	});
	
	// watch for any <b> elements (dynamically) added to #container that have a data-x attribute
	// and attach dblclick event-handler
	$('#container').on('dblclick', 'b[data-x]', function() {
		var el = $(this);
		// get information about which point from which series to update
		var x = parseInt(el.attr('data-x'));
		var series = parseInt(el.attr('data-series'));
		// ask new value
		var newVal = parseFloat(prompt('New value', el.attr('data-y')));
		// return if new value wasn't given or not a valid float
		if (newVal == undefined || isNaN(newVal)) return;

		// Some $.ajax() call to actually persist the new value server-side
		// and possibly do more validation-checks here
		
		// update point by removing it without redraw and adding it _with_ redraw
		chart.series[series].removePoint(x, false);
		chart.series[series].addPoint([x, newVal], true);

		// remove cloned ToolTip after point is edited
		setClone('remove');
		cloneToolTip = null;
		// edited point is no longer clicked
		clickedPoint = null;
		// show original ToolTip again
		setVisibility(chart.tooltip.label, 'visible');
	});
});
```
</noscript>