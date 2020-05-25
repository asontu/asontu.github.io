---
layout: post
title: "Introducing nifty Sitecore userscript and filtering MutationObserver events"
tags: sitecore front-end javascript
---

Like I'm sure many developers, when I use the same tool a lot I start see posibilities for improvement to suite my workflow. So too with the Sitecore client. So to automate everything I find myself doing twice, _to the **Tampermobile!**_

It started because I was constantly working in the Content Editor of the wrong environment, adjusting a template on Test rather than Dev and not understanding why TDS won't see the changes. So a small userscript to give different environments different colors in the header was born. Then we started migration from Sitecore 8 to Sitecore 9 and I couldn't quickly see which was which, so features were added and little by little the script became quite extensive. A couple of colleagues have been using this script now too so it was time to put it online on GitHub as [Asontu's Sitecore nifties](https://github.com/asontu/Asontus-Sitecore-nifties).

A full list of features is listed in the [GitHub README](https://github.com/asontu/Asontus-Sitecore-nifties#features), but I wanted to highlight one feature here. When I have one part of the Content Tree in view on the left - like a list of options - and a different item opened on the right - like the `__Standard Values` containing items from that list - I wanna be able to switch from the _master_ database to _web_ without having to click open the same items again. So I made the script do it for me, as demoed here:

![Switch database and continue](https://github.com/asontu/Asontus-Sitecore-nifties/raw/master/assets/continue-to-tree.gif)

The implementation of this feature proved a bit of a challenge, as every click in the Content Tree triggers an XHR call in the background and multiple DOM tree mutations. Attaching a `MutationObserver` triggered the callback function a few times before the element of interest was actually added. Unfortunately `MutationObserver.observe()` doesn't have a filter option and [it doesn't look like this'll come in the future](https://github.com/whatwg/dom/issues/77#issuecomment-372568780) so I implemented this filtering function that I use in the callback to return if no elements matching a query are found.

{% highlight js linenos %}
function searchMutationListFor(mutationList, query) {
	if (!mutationList.length) {
		return false;
	}
	let foundNodes = [];
	function findNodes(addedNode) {
		if (addedNode.matches(query)) {
			foundNodes.push(addedNode);
		}
		foundNodes = foundNodes.concat(Array.from(addedNode.querySelectorAll(query)));
	}
	for (let m = 0; m < mutationList.length; m++) {
		if (!mutationList[m].addedNodes.length) continue;
		Array.from(mutationList[m].addedNodes)
			.filter(nod => nod.nodeType == 1)
			.forEach(findNodes);
	}
	if (!foundNodes.length) {
		return false;
	}
	return foundNodes;
}
{% endhighlight %}
