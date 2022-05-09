---
layout: post
title:  "Revisited: Sitecore path in SQL Query"
tags: sitecore t-sql back-end
---

A little over 2 years ago, when we all thought the pandemic might just be a 2-3 month ordeal, I wrote the first article of this blog about how to get Sitecore item paths when directly querying the (master) database. A lot has happened since then, let's talk about it.

With the release of Sitecore 10.1 all the standard, Out-Of-The-Box items that come with Sitecore are no longer stored in the master/web/core databases. In stead they are delivered as Item Resource Files. [These](https://blog.martinmiles.net/post/everything-you-wanted-to-ask-about-items-as-resources-coming-with-new-sitecore-10-1) [articles](https://jermdavis.wordpress.com/2021/03/01/v10-1s-new-database-update-strategy/) go more in depth about the how and why. For this article we mostly care that this breaks the query of my [original solution](/2020/03/22/sitecore-path-in-sql-query.html).

The query uses a [recursive common table expression](https://docs.microsoft.com/en-us/sql/t-sql/queries/with-common-table-expression-transact-sql?view=sql-server-ver15#guidelines-for-defining-and-using-recursive-common-table-expressions) where the [base case](https://en.wikipedia.org/wiki/Recursion_(computer_science)#Base_case) is defined as the item that doesn't have a `ParentID`. This is the `/sitecore` item, but since that item is now no longer in the database, the query can't find it and doesn't return any results. To have a working query again this base-case needs updating to contain the item paths and IDs that other items refer to in their `ParentID` column:

{% gist 0feb1c592a42dd0cea34bbf0c9eee806 %}
<noscript>
{% highlight sql linenos %}
;with RootItems as (
	select cast(rt.ID as uniqueidentifier) ID, cast(rt.Path as nvarchar(max)) Path
	from (select ''n)t
	cross apply ( values
		('{0DE95AE4-41AB-4D01-9EB0-67441B7C2450}', '/sitecore/content'),
		('{B701850A-CB8A-4943-B2BC-DDDB1238C103}', '/sitecore/Forms'),
		('{3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1}', '/sitecore/media library'),
		('{B26BD035-8D0A-4DF3-8F67-2DE3C7FDD74A}', '/sitecore/templates/Foundation'),
		('{8F343079-3CC5-4EF7-BC27-32ADDB46F45E}', '/sitecore/templates/Feature'),
		('{825B30B4-B40B-422E-9920-23A1B6BDA89C}', '/sitecore/templates/Project'),
		('{B29EE504-861C-492F-95A3-0D890B6FCA09}', '/sitecore/templates/User Defined'),
		('{E24C4A00-08D6-41C8-B60E-E7990B21697A}', '/sitecore/templates/Branches/Foundation'),
		('{AD71FACC-3C23-4DF8-A427-672020DB5612}', '/sitecore/templates/Branches/Feature'),
		('{A1F6469D-16E1-4A5F-9E49-1AAD869A5D11}', '/sitecore/templates/Branches/Project'),
		('{F03DED1F-B02B-49A1-B4C0-793C6F092CFD}', '/sitecore/templates/Branches/User Defined')
	) rt(ID,path)
), ItemPaths as (
	select r.ID, r.Path
	from RootItems r
	union all
	select i.ID, p.Path + '/' + i.Name
	from ItemPaths p
	join dbo.Items i on i.ParentID = p.ID
)
select top 10 *
from ItemPaths
{% endhighlight %}
</noscript>

The `from (select ''n)t cross apply(...` part might surprise some people, but I find this the easiest way to define a hardcoded set of results that is easily extended even by people that aren't super familiar with SQL (rather than a bunch of `union all select`'s or having a separate `declare @table table (...)`).

By default this query is now able to get paths of items in the `content`, `Forms` and `Media Library` folders as well as the most common subfolders of `templates`. If you want to find items under, for instance, `/sitecore/layout/Renderings/Feature`, you'll have to add a line with that path and its ID to the list:

{% highlight sql %}
		('{DA61AD50-8FDB-4252-A68F-B4470B1C9FE8}', '/sitecore/layout/Renderings/Feature')
{% endhighlight %}

To find these paths and ID's you can just look at any working Sitecore instance, the IDs will be the same across installs.