---
layout: post
title:  "Sitecore path in SQL Query"
tags: sitecore t-sql back-end
---

When trouble-shooting Sitecore issues, sometimes you wanna dive directly into the SQL Database and query around in `dbo.Items`. But you might want to query an item's Sitecore-path, like in the `where` clause. This recursive common table expression makes that very easy:

<script src="https://gist.github.com/asontu/0feb1c592a42dd0cea34bbf0c9eee806/6ced10f4be8f34231321bbcc554c47488a7b69b8.js"></script>
<noscript>
{% highlight sql linenos %}
;with ItemPaths as (
	select r.ID, r.Name, cast('/' + r.Name as nvarchar(max)) path
	from dbo.Items r
	where r.ParentID = '00000000-0000-0000-0000-000000000000'
	union all
	select i.ID, i.Name, p.path + '/' + i.Name
	from ItemPaths p
	join dbo.Items i on i.ParentID = p.ID
)
select top 10 *
from ItemPaths
{% endhighlight %}
</noscript>

For instance, I used this to find items that were mistakenly set to never publish by a client of ours:

{% highlight sql linenos %}
;with ItemPaths as (
	select r.ID, r.Name, cast('/' + r.Name as nvarchar(max)) path
	from dbo.Items r
	where r.ParentID = '00000000-0000-0000-0000-000000000000'
	union all
	select i.ID, i.Name, p.path + '/' + i.Name
	from ItemPaths p
	join dbo.Items i on i.ParentID = p.ID
)
select ip.*, fi.Name, sf.Value
from dbo.SharedFields sf
join dbo.Items fi on fi.id = sf.FieldId
join ItemPaths ip on ip.ID = sf.ItemId
where fi.Name like '%never%publish%'
  and sf.Value = '1'
{% endhighlight %}

I'm sure the true Sitecore guru's can tell me how to do this with Sitecore Search. But the above also works when Sitecore isn't working so long as you can query the Database.

_**Update:** Since Sitecore 10.1 a lot of the OOTB Sitecore items are no longer stored in the database, see [this article](/2022/05/09/revisited-sitecore-path-in-sql-query.html) about how to adjust your query for this._