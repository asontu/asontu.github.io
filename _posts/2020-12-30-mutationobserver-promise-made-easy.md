---
layout: post
title:  "MutationObserver Promise made easy"
tags: front-end javascript
---

When adding a [new feature](https://github.com/asontu/Asontus-Sitecore-nifties#export-and-import-my-toolbar-customization) to my Nifty Sitecore Userscript I noticed a lot of similar code to initiate one-time `MutationObserver`s and disbanding them again after the Mutation was Observed. Clearly, a refactor was in order.

I found [this Gist](https://gist.github.com/jwilson8767/db379026efcbd932f64382db4b02853e) that was already half the way to what I needed, including someone asking for a `Timeout` feature in the comments. I just needed more flexibility on what to Observe and on when to resolve immediately.

This resulted in `mop()`, a **M**utation**O**bserver **P**romise implementation. With `mop()` it becomes very easy to make a function that triggers some Mutation and returns a `Promise` that resolves when the Mutation is Observed or rejects if after a set Timeout the Mutation still hasn't happened.

This `mop()` function accepts the following arguments:

- `trigger`  
  Logic to perform the action that triggers the Mutation  
  _(If this function returns `true`, the Promise immediately resolves without waiting for a Mutation)_
- `watch`  
  Element to Observe Mutation on
- `query`  
  Query selector to search for in the added nodes  
  _(**optional**, defaults to `'*'` for everything)_
- `options`  
  MutationObserver options about how deep to observe  
  _(**optional**, defaults to only childList)_
- `timeout`  
  Milliseconds after which to fail  
  _(**optional**, defaults to never timing out)_

{% gist 266d5dfa48df0a7530889be2f5d79efe %}
<noscript>
{% highlight js linenos %}
function mop(trigger, watch, query, options, timeout) {
	return new Promise((resolve, reject) => {
		let timer;
		let observer = new MutationObserver((mutationList) => {
			let any = searchMutationListFor(mutationList, query || '*');
			if (query && !any) {
				return;
			}
			observer.disconnect();
			clearTimeout(timer);
			resolve(any);
		});
		observer.observe(watch, options || {attributes:false, childList: true, subtree: false});
		if (timeout) {
			timer = setTimeout(() => {
				observer.disconnect();
				reject(new Error('Timed out observing mutation'));
			}, timeout);
		}
		if (trigger()) {
			observer.disconnect();
			clearTimeout(timer);
			resolve([]);
		}
	});
}
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
</noscript>

An example use of this function would be the following function to click a node in the Sitecore Content Editor. Utilizing `mop()` the function `clickTreeNode()` contains simply the logic for clicking the element and what to watch for. All logic of building a `MutationObserver`, `Timeout` and removing those again is taken care of.

As well this function is an example of using `return true;` to skip clicking and Observing a Mutation entirely if the node to click was never found in the first place.

{% highlight js linenos %}
function clickTreeNode(itemId) {
	return mop(function() {
		let nodeToClick = document.querySelector(`a#Tree_Node_${itemId}.scContentTreeNodeNormal`);
		if (!nodeToClick) {
			document.getElementById('TreeSearch').value = itemId;
			return true;
		}
		nodeToClick.click();
	},
	document.getElementById('ContentEditor'),
	'#EditorTabs .scEditorHeaderVersionsLanguage',
	{attributes:false, childList: true, subtree: true},
	2000);
}
{% endhighlight %}

`clickTreeNode()` and similar functions using `mop()` is then used in the code like so:

{% highlight js linenos %}
search.expandTo
	.split('!')
	.map(id => `#Tree_Glyph_${id}[src*=treemenu_collapsed]`)
	.map(itemId => () => expandTreeNode(itemId))
	.reduce((prom, fn) => prom.then(fn), Promise.resolve())
	.then(() => clickTreeNode(search.clickTo))
	.then((nodes) => openLangMenu(search.langTo, !!nodes.length))
	.then((nodes) => clickLang(search.langTo, !!nodes.length))
	.then(() => scrollTree(search.scrollTreeTo))
	.then(() => scrollPanel(search.scrollPanelTo))
	.then(() => hideSpinner());
{% endhighlight %}