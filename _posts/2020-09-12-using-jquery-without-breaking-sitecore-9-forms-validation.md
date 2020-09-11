---
layout: post
title: "Using jQuery without breaking Sitecore 9 Forms validation"
tags: sitecore javascript front-end
---

If the front-end code of you Sitecore 9 site is using jQuery, you might have run into some issues on pages with Sitecore Forms. This is because vanilla Sitecore Forms uses an unobtrusive form validation library that's dependent on jQuery, but might not use the same version of jQuery that you wanna use in your front-end. jQuery has a `.noConflict()` method to deal with this, but how do you actually properly use it?

After implementing this on two sites in production now, I've gathered some notes and gotchas. I'll start with the solution and explain why after the code, this is for when you put the script tags at the bottom of the `<body>` tag to load them after loading the `<body>` html itself without using `defer`/`async`.

```html
<head>
	<!-- Your <head> content -->
	@Html.RenderFormStyles()
	@Html.RenderFormScripts()
</head>
<body>
	<!-- Your page, or possibly just @RenderBody() as this should be your Outer Layout -->
	<script type="text/javascript">
		if (typeof jQuery !== 'undefined') {
			var jq2 = jQuery.noConflict(true);
		}
	</script>
	<script type="text/javascript" src="/path/to/your/jquery.version.min.js"></script>
	<script type="text/javascript" src="/path/to/your/script.js"></script>
	<script>
		(function($) {
			// Your inline front-end code.
			// Wrapped in an immediately executed anonymous function
			// to scope the $-variable to the correct version
		})(jQuery);
	</script>
	<script type="text/javascript">
		if (typeof jq2 !== 'undefined') {
			var jq3 = jQuery.noConflict(true);
			$ = jQuery = jq2;
		}
	</script>
</body>
```

So what's happening here is this:

* If Sitecore's `@Html.RenderFormScripts()` helper has loaded its jQuery version, then the global variable `jQuery` is not undefined. Call `jQuery.noConflict()` with the `true` argument to unset and free up the global `$` and `jQuery` variables, and assign this version's jQuery object to `jq2`.
* Then load in your preferred version of jQuery which will now use the freed up `$` and `jQuery` global variables.
* Run your front-end code with their own scope by wrapping it in a function that gets immediately called after defining it. The correct version of jQuery is passed as an argument, binding it to `$` in that scope.  
  _This wrapping should also happen in any external script like `/path/to/your/script.js` above._
* Finally, and crucially, if the `jq2` is not undefined, envoke the `noConflict()` function of _your_ jQuery version with the `true` argument to again unset the `$` and `jQuery` variables. And reassign those variables to be the earlier saved `jq2` version.

This last step is necessary because inline form validation code from Sitecore expects to be able to use the global `$` variable as the user is filling out the form.

The above code assigns your preferred jQuery version to `jq3`, so you could load your scripts with `defer` or `async` if you wrap them in `(function($){ ... })(jq3);` I suppose. I've not tested this though. And be aware that any inline JavaScript that'll be fired after the page has loaded can't rely on the `$` variable, that's only available in the function-wrapped scopes.

As a final gotcha, when I was implementing this the second time, code I was surrounding with `(function($){...})($)` was defining functions that completely different scripts were using. So these had to be changed to assign themselves to `window` to be globally available for the other scripts to use:

```js
// this unscoped function:

function callMeFromADifferentScope() {
	$(this).method('needs the correct jQuery version');
}

// becomes:

(function($) {
	window.callMeFromADifferentScope = function() {
		$(this).method('needs the correct jQuery version');
	}
})(jQuery);
```
