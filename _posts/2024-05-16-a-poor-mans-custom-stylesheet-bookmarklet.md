---
layout: post
title:  "A poor man's custom stylesheet bookmarklet"
tags: front-end javascript css
---

Working on a non-Sitecore project the last two years has caused a small hiatus in posts, but a strictly enforced no browser plug-ins policy did inspire me to make my own poor man's custom CSS bookmarklet.

Sometimes you just want to tweak a website's CSS a bit, just for yourself. Either because the default is buggy, doesn't utilize your ultra-widescreen resolution or because they don't have a dark mode. Normally you'd use plug-ins for this like [Stylus](https://github.com/openstyles/stylus) for CSS, [Tampermonkey](https://www.tampermonkey.net) if you need custom Javascript or [Darkreader](https://darkreader.org/) if you want dark mode everything. The customer I've been working for however, provided me their own laptop to work on with their own system policies. One of those policies is that I absolutely cannot install any browser plug-ins. And frankly I understand why and this post isn't about questioning that policy at all. But I still have some legitimate uses for custom CSS that I wanted to use on their machines, and then I remembered a [YouTube video](https://www.youtube.com/shorts/D02AK3WoYH8) I once came across that showed a funny little trick that didn't seem actually useful at the time...

You can set a `<style>` tag to have `display: block;` and you will see the CSS rules on screen as if it's just another div with text. Moreover, you can give it an `contenteditable` attribute and now you can write CSS inside this element and you immediately see the results. So with that as a starting point and using `localStorage` to save entered CSS, I made myself this little bookmarklet:

{% gist 6c00e82739637a926a70a912a97c35eb %}
<noscript>
{% highlight js linenos %}
javascript:(function(){
    var styleTag = document.querySelector('#niftyStyle');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'niftyStyle';
        styleTag.type = 'text/css';
        styleTag.contentEditable = 'plaintext-only';
        styleTag.style.position = 'fixed';
        styleTag.style.top = '0';
        styleTag.style.minHeight = '1em';
        styleTag.style.minWidth= '4em';
        styleTag.style.zIndex = '99999';
        styleTag.style.padding = '3px';
        styleTag.style.whiteSpace = 'pre';
        styleTag.style.background = '#000';
        styleTag.style.color = '#fff';
        styleTag.style.fontFamily = 'consolas, monospace';
        document.body.appendChild(styleTag);
    }
    if (!styleTag.innerText.trim()) {
        var sheet = localStorage.getItem('niftyStyle');
        if (!sheet) {
            sheet = 'html {\n    filter: invert(1) hue-rotate(180deg);\n}';
            styleTag.style.display = 'block';
        }
        styleTag.appendChild(document.createTextNode(sheet));
        return;
    }
    if (styleTag.style.display == 'block') {
        localStorage.setItem('niftyStyle', styleTag.innerText.trim());
        styleTag.style.display = 'none';
    } else {
        styleTag.style.display = 'block';
    }
})();
{% endhighlight %}
</noscript>

You can simply copy this script and paste it in the field for the bookmark URL and it should work.

The first time you click the bookmark it finds that there is no saved stylesheet for the domain you're on and it adds a visible `<style>` tag to the page, absolutely positioned at the top-left of the page. By default it adds a small snippet that acts like a poor man's dark mode also discussed [earlier on this blog](/2020/04/21/styling-external-iframe-content.html). You can write the CSS you want and when you're done, click the bookmark a second time and it will save the CSS in the `localStorage` associated with that domain and hide the style tag. Now any time you visit the website and click the bookmark, it will see that you have CSS saved and apply it silently. Clicking the bookmark toggles the visibility of the `<style>` tag so you can continue editing and save etc.

Q&A - Why it's a "poor man's" solution
--------------------------------------

- **_Every time I click a link and the page refreshes, my style is gone and I have to click the bookmark again!_**  
  Such is the nature of websites, browser plug-ins can solve this for you, a bookmarklet cannot. You might get lucky and encounter a website that loads new content through ajax, but likely you won't.
- **_This doesn't work in Firefox!_**  
  That's because of the `contentEditable = 'plaintext-only'` which is a [WebKit](https://webkit.org/) and [Blink](https://www.chromium.org/blink/) exclusive feature. Luckily this means it works in Edge, Safari, Opera and a bunch more, but not Firefox. You could look into [alternatives](https://stackoverflow.com/a/61237402/2684660) to stop Firefox from adding html to the `<style>` tag if you need it to work there.
- **_This doesn't work for website_ X _!_**  
  This is possibly because that website uses strict CSP headers preventing `<style>` tags directly on the page and only loads CSS that's in a separate resource on the server.
- **_The style tag is in the way of the element I want to style!_**  
  You can solve this by adding the following to place the element on the right side in stead of the left:
  ```
  #niftyStyle {
      right: 0;
  }
  ```  
  You could even add `top: unset !important;` and `bottom: 0;` to place the element at the bottom if you must.