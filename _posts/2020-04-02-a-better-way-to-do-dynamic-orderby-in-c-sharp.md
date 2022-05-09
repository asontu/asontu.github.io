---
layout: post
title:  "A better way to do dynamic OrderBy() in C#"
tags: c# back-end
---

A common feature in various applications is to sort some collection by one of it's properties, dependent on some input like the column clicked by the user. An implementation might take a `string` or `enum` for the column plus a `bool` or `enum` for ascending vs. descending.

The code then looks something like this:

{% highlight c# linenos %}
switch (orderByField)
{
	case "hired":
		if (desc)
		{
			queryable = queryable.OrderByDescending(x => x.DateHired);
		}
		else
		{
			queryable = queryable.OrderBy(x => x.DateHired);
		}
		break;
	case "name":
		if (desc)
		{
			queryable = queryable.OrderByDescending(x => x.Name);
		}
		else
		{
			queryable = queryable.OrderBy(x => x.Name);
		}
		break;
	case "age":
		if (desc)
		{
			queryable = queryable.OrderByDescending(x => x.Age);
		}
		else
		{
			queryable = queryable.OrderBy(x => x.Age);
		}
		break;
	// etc.
}
{% endhighlight %}

This turns into ugly spaghetti code fast. Lots of lines for something that should be trivial, and this is just three columns. Hard to read, hard to maintain, surely there _has_ to be a better way.

So, why can't you just do something like this?

<div class="pseudo-code">
{% highlight c# linenos %}
private static readonly Dictionary<string, object> OrderFunctions =
	new Dictionary<string, object>
	{
		{ "hired", x => x.DateHired },
		{ "name", x => x.Name },
		{ "age", x => x.Age }
	};
// ...
queryable = desc
	? queryable.OrderByDescending(OrderFunctions[orderByField])
	: queryable.OrderBy(OrderFunctions[orderByField]);
{% endhighlight %}
</div>

The reason the above won't work is that the lambda expressions get types `Func<string, DateTime>` and `Func<string, string>` etc. which denotes a [delegate](https://docs.microsoft.com/en-us/dotnet/api/system.func-2?view=netframework-4.8) that is pretty much a pointer to a method, i.e. a compiled piece of code. In order to pass this logic on to a SQL Database or Sitecore ContentSearch, it needs to be an [expression tree](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/expression-trees/) that can then be converted to the equivalent SQL statement or other implementation of that domain.

As well, LINQ-to-SQL (and possibly other LINQ-to-Something) needs to know the return-type (`DateTime`, `string` and `int` above) of the `Func<>` at runtime, and this is hidden if the value-type of the `Dictionary<>` is `object`. To make this work, we need to explicitly state the type of each function and set the value-type of our `Dictionary<>` to `dynamic`:

{% highlight c# linenos %}
private static readonly Dictionary<string, dynamic> OrderFunctions =
	new Dictionary<string, dynamic>
	{
		{ "hired", (Expression<Func<SearchResultItem, DateTime>>)(x => x.DateHired) },
		{ "name",  (Expression<Func<SearchResultItem, string>>)(x => x.Name) },
		{ "age",   (Expression<Func<SearchResultItem, int>>)(x => x.Age) }
	};
{% endhighlight %}

Alright, so far so good, but now the `.OrderBy()` and `.OrderByDescending()` extension methods seem kaput? The problem is that the extension method syntax doesn't play nice with our `dynamic` type, so finally these have to be rewritten like so:

{% highlight c# linenos %}
queryable = desc
	? Queryable.OrderByDescending(queryable, OrderFunctions[orderByField])
	: Queryable.OrderBy(queryable, OrderFunctions[orderByField]);
{% endhighlight %}

Et voilà, from 34 lines of unreadable spaghetti to 10 lines of easily maintained and extendable code!

This works, but the `Expression<Func<SearchResultItem,`  part is a bit lengthy and repetitive. Unfortunately `Expression<>` is a `sealed` class, but you can make a wrapper for it. This wrapper has the actual `Expression<Func<>>` as a property, and I like to make an interface that defines the property, so you could have multiple implementations like `OrderSitecoreBy<T>` and `OrderSqlBy<T>` based on their input-type (`SearchResultItem` in our case). As well this allows the `Dictionary<>` to return type `IOrderBy` rather than `dynamic`.

**Update May 9th 2022:** To keep the nicer syntax of `something.OrderBy(func)`, I've added the some extension methods that work with the aforementioned `IOrderBy` interface. This cleans up the calls, particularly when stringing together multiple `.ThenBy()` calls. The end result then looks like this:

{% highlight c# linenos %}
// OrderByExtensions.cs

public static class OrderByExtensions
{
	public static IOrderedQueryable<T> OrderBy<T>(this IQueryable<T> source, IOrderBy orderBy)
	{
		return Queryable.OrderBy(source, orderBy.Expression);
	}

	public static IOrderedQueryable<T> OrderByDescending<T>(this IQueryable<T> source, IOrderBy orderBy)
	{
		return Queryable.OrderByDescending(source, orderBy.Expression);
	}

	public static IOrderedQueryable<T> ThenBy<T>(this IOrderedQueryable<T> source, IOrderBy orderBy)
	{
		return Queryable.ThenBy(source, orderBy.Expression);
	}

	public static IOrderedQueryable<T> ThenByDescending<T>(this IOrderedQueryable<T> source, IOrderBy orderBy)
	{
		return Queryable.ThenByDescending(source, orderBy.Expression);
	}
}

// IOrderBy.cs

public interface IOrderBy
{
	dynamic Expression { get; }
}

// OrderBy.cs

using System;
using System.Linq.Expressions;

public class OrderBy<T> : IOrderBy
{
	private readonly Expression<Func<SearchResultItem, T>> expression;
	
	public OrderBy(Expression<Func<SearchResultItem, T>> expression)
	{
		this.expression = expression;
	}

	public dynamic Expression => this.expression;
}

// Code that needs mapping from string to ordering-expression.

private static readonly Dictionary<string, IOrderBy> OrderFunctions =
	new Dictionary<string, IOrderBy>
	{
		{ "hired", new OrderBy<DateTime>(x => x.DateHired) },
		{ "name",  new OrderBy<string>(x => x.Name) },
		{ "age",   new OrderBy<int>(x => x.Age) }
	};

// ...

queryable = desc
	? queryable.OrderByDescending(OrderFunctions[orderByField])
	: queryable.OrderBy(OrderFunctions[orderByField]);
{% endhighlight %}

And the nice thing is you can pass the `IOrderBy` expression trees around like variables. The logic behind a sort-column like `"hired"` could be kept in a completely different assembly or namespace to keep a good separation of concerns.