---
layout: post
title: "Inspecting Jekyll objects for GitHub Pages"
tags: jekyll javascript
---

This blog runs on [GitHub Pages](https://pages.github.com/), which is powered by [Jekyll](https://jekyllrb.com/). Jekyll generates the website as static html based on html templates, scss and markdown files. The templating system used is Liquid which has its own [Liquid code](https://shopify.github.io/liquid/basics/introduction/) to which Jekyll exposes some objects that you can use to iterate posts and tags etc. But because this code is run when regenerating the static html, you can't easily debug and step through this code.

To get a glimpse of the Jekyll objects that are available, the best way I found to inspect them was [this Stack Overflow answer](https://stackoverflow.com/a/61025949/2684660) using `{{ "{{" }} object | jsonify | uri_escape }}` and a bit of JavaScript to pretty print the resulting JSON object. I used this, combined with a client-side JavaScript highlighter I had laying around, to make an inspector for Jekyll, or [Inspeckyll](/inspeckyll.html).

This adds a `<select>` with multiple objects to inspect. I've consolidated the part of the code where the different objects are added to the `<select>` at [the top](https://github.com/asontu/asontu.github.io/blob/master/inspeckyll.html#L21) so you can quickly add new objects to inspect:

{% raw %}
```js
		var site = makeOption("site", "site", "{{ site | jsonify | uri_escape }}");
		var posts = makeOption("posts", "site.posts", "{{ site.posts | jsonify | uri_escape }}");
		var pages = makeOption("pages", "site.pages", "{{ site.pages | jsonify | uri_escape }}");
		var docs = makeOption("docs", "site.documents", "{{ site.documents | jsonify | uri_escape }}");
		var tags = makeOption("tags", "site.tags", "{{ site.tags | jsonify | uri_escape }}");
		var tag = [];
{%		assign i = 0
%}{%	for tag in site.tags
%}			tag[{{ i }}] = makeOption("tag {{ i }}", "site.tags[{{ tag[0] }}]", "{{ tag | jsonify | uri_escape }}");
{%			assign i = i | plus: 1
%}{%	endfor
%}{%	assign years = site.posts | group_by_exp: 'post', 'post.date | date: "%Y"'
%}		var years = makeOption("years", "site.posts grouped", "{{ years | jsonify | uri_escape }}");
```
{% endraw %}

To add an option, add a line `var myOption = makeOption()` with these parameters:

1.	Name of the variable that the function return value is assigned to.
2.	Label of the `<option>`.
3.	The actual object to inspect, with Liquid filters `jsonify` and `uri_escape`.  
	_This param **has** to go in double quotes, not single quotes or backticks, because `uri_escape` only escapes double quotes_

So for example if you wanted to look into the `site.categories` object, you would add this line:

{% raw %}
```js
var categories = makeOption("categories", "site.categories", "{{ site.categories | jsonify | uri_escape }}");
```
{% endraw %}

You could also loop through the categories just like how I loop through the tags. The first parameter with the variable name also accepts space-separated var-name and index-integer as you can see in the `"tag {{ "{{" }} i }}"` part inside the Liquid `{{ "{%" }} for %}` loop.

### Limited depth

Important to note is that the resulting JSON object has a limited _depth_, this is probably to prevent an infinite loop as objects reference each other. For instance if you look at the `site` object and inspect the `tags` section, it looks like every individual tag like `"sitecore"` or `"t-sql"` contains just a array of the blog-posts html-string:

```js
"tags": {
	"sitecore": [
		"<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n",
		"<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n"
	],
	"t-sql": [
		"<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n",
		"<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n"
	],
	"back-end": [
		"<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n",
		"<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n"
	],
	// ...
}
```

But then when you pick the `site.tags` option in the `<select>` up top, you discover that each entry has a _lot_ of meta information besides just the raw html:

```js
{
	"sitecore": [
		{
			"collection": "posts",
			"url": "/2020/05/26/introducing-nifty-sitecore-userscript-and-filtering-mutationobserver-events.html",
			"excerpt": "<p>Like I’m sure many developers, ...</p>\n",
			"content": "<p>Like I’m sure many developers, ...</figure>\n\n",
			"date": "2020-05-26 00:00:00 +0200",
			"output": "<!DOCTYPE html>\n<html lang=\"en-US\">...</html>\n",
			"id": "/2020/05/26/introducing-nifty-sitecore-userscript-and-filtering-mutationobserver-events",
			"relative_path": "_posts/2020-05-26-introducing-nifty-sitecore-userscript-and-filtering-mutationobserver-events.md",
			"next": null,
			"path": "_posts/2020-05-26-introducing-nifty-sitecore-userscript-and-filtering-mutationobserver-events.md",
			"previous": {
				"collection": "posts",
				"url": "/2020/05/18/unittesting-t-sql-stored-procs-made-easy.html",
				"date": "2020-05-18 00:00:00 +0200",
				"id": "/2020/05/18/unittesting-t-sql-stored-procs-made-easy",
				"relative_path": "_posts/2020-05-18-unittesting-t-sql-stored-procs-made-easy.md",
				"path": "_posts/2020-05-18-unittesting-t-sql-stored-procs-made-easy.md",
				"draft": false,
				"categories": [],
				"image": "/assets/images/asontu-banner.png",
				"layout": "post",
				"title": "UnitTesting T-SQL stored procs made easy",
				"tags": [
					"t-sql"
				],
				"slug": "unittesting-t-sql-stored-procs-made-easy",
				"ext": ".md"
			},
			"draft": false,
			"categories": [],
			"image": "/assets/images/asontu-banner.png",
			"layout": "post",
			"title": "Introducing nifty Sitecore userscript and filtering MutationObserver events",
			"tags": [
				"sitecore",
				"front-end",
				"javascript"
			],
			"slug": "introducing-nifty-sitecore-userscript-and-filtering-mutationobserver-events",
			"ext": ".md"
		},
		{
			"collection": "posts",
			"url": "/2020/03/22/sitecore-path-in-sql-query.html",
			// ...
		}
	],
	"t-sql": [
		{
			"collection": "posts",
			// ...
		}
	]
}
```

You also see that a every blog-post has a `next` and `previous`, which would result in endless iteration if there was no depth limit. This is precisely the reason that I wanted the `<select>` with multiple options of objects to inspect.

Happy Jekyllin'!