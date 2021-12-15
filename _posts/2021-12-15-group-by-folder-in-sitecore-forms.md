---
layout: post
title:  "Group by folder in Sitecore Forms"
tags: back-end sitecore
---

Recently I was made aware of Mohammad Abujaffal's excellent article on how to [View Sitecore Forms in Groups or Categories in Forms Dashboard](http://jaffal.me/view-sitecore-forms-in-groups-or-categories-in-forms-dashboard/) and while implementing it I found some optimizations.

Out of the box, Sitecore Forms has 3 links in the collapsible menu on the left. Turns out these are defined in the Core database and it's relatively simple to add some additional buttons here.

![Sitecore Forms menu](/assets/{{page.slug}}/default-menu.png)

As Mohammad found out, the menu-items are found under `/sitecore/client/Applications/FormsBuilder/Components/Navigation/Menu/Forms`. The fields of interest here are the `NavigateUrl` under `Behavior` that defines what the menu-item links to and under `Data` the `Text` field that defines the text that's displayed on the button.

![Sitecore Forms menu](/assets/{{page.slug}}/hyperlink-fields.png)

In the **My Forms** item we can see that the `NavigateUrl` contains a Guid in the `sc` query string parameter, this refers to a SearchConfig item that defines how Forms are searched/filtered for display. These SearchConfigs can be found under `/sitecore/client/Applications/FormsBuilder/Pages/Forms/PageSettings/DataSource`.

So now, in order to add a link that would display only the forms under a certain folder, all we need to do is make another menu-item and another SearchConfig. Mohammad's article talks about extending the SearchConfig's Solr query to include `AND (_parent:someguid)`, but I found that the SearchConfig item also has a `Root` field in which you can paste the Guid of the folder you wish to filter on. This way, forms in sub- and subsubfolders are also included. The following is what worked for me.

### Steps:

1. In the Master database, make or select a subfolder under `/sitecore/Forms` that you wish to have a button for and copy the ID.
2. In the Core database, go to `/sitecore/client/Applications/FormsBuilder/Pages/Forms/PageSettings/DataSource` and duplicate the **AllFormsSearchConfig** item.
3. Set the `DisplayText` field to whatever it should say up top when the button is selected.
4. Set the `Root` field to the copied ID from step **1.** and copy the ID of this newly created SearchConfig item.
5. Still in the Core database, go to `/sitecore/client/Applications/FormsBuilder/Components/Navigation/Menu/Forms` and duplicate the **My forms** item.
6. Edit the `NavigateUrl` by replacing the existing Guid with the one copied in step **4.**
7. Set the `Text` field to whatever the button text should be and optionally change the sorting of the items to order in which the buttons should appear.

More options
------------

You could look into more options you have in the SearchConfig items, some ideas:

- If you have a lot of templates and wish to organize them in folders, you could change the Solr query in the `Search` field to say `(is template:1)` in stead of `(is template:0)` like it has in the **AllTemplatesSearchConfig**.
- To show only the forms under a certain folder that are created by the current user, check the `CreatedByCurrentUser` checkbox like the **MyFormsSearchConfig** has.
- Similarly, there are checkboxes called `CreatedWithin7Days`, `UpdatedWithin7Days` and `UpdatedByCurrentUser` that might be interesting in certain use-cases. I've not tried these myself though.
- Inspired by the Solr query that Mohammad uses, make an "Uncategorized" option that shows all the Forms that are not in any subfolder but live directly under `/sitecore/Forms` by setting the `Search` field to `(is template:0) AND (_latestversion:1) AND (_parent:b701850acb8a4943b2bcdddb1238c103) AND *`  
  _(this parent guid is the ID for the `/sitecore/Forms` item on my instance, should be the same for any Sitecore install)_