---
layout: post
title:  "A better way to do dynamic OrderBy() in C#"
tags: c# back-end
---

A common feature in various applications is to sort some collection by one of it's properties, dependent on some input like the column clicked by the user. An implementation might take a `string` or `enum` for the column plus a `bool` or `enum` for ascending vs. descending.

The code then looks something like this:

```c#
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
```

This turns into ugly spaghetti code fast. Lots of lines for something that should be trivial, and this is just three columns. Hard to read, hard to maintain, surely there _has_ to be a better way.

So, why can't you just do something like this?

```c#
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
```

The reason the above won't work is that the lambda expressions get types `Func<string, DateTime>` and `Func<string, string>` etc. which denotes a [delegate](https://docs.microsoft.com/en-us/dotnet/api/system.func-2?view=netframework-4.8) that is pretty much a pointer to a method, i.e. a compiled piece of code. In order to pass this logic on to a SQL Database or Sitecore ContentSearch, it needs to be an [expression tree](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/expression-trees/) that can then be converted to the equivalent SQL statement or other implementation of that domain.

As well, LINQ-to-SQL (and possibly other LINQ-to-Something) needs to know the return-type (`DateTime`, `string` and `int` above) of the `Func<>` at runtime, and this is hidden if the value-type of the `Dictionary<>` is `object`. To make this work, we need to explicitly state the type of each function and set the value-type of our `Dictionary<>` to `dynamic`:

```c#
private static readonly Dictionary<string, dynamic> OrderFunctions =
	new Dictionary<string, dynamic>
	{
		{ "hired", (Expression<Func<SearchResultItem, DateTime>>)(x => x.DateHired) },
		{ "name",  (Expression<Func<SearchResultItem, string>>)(x => x.Name) },
		{ "age",   (Expression<Func<SearchResultItem, int>>)(x => x.Age) }
	};
```

Alright, so far so good, but now the `.OrderBy()` and `.OrderByDescending()` extension methods seem kaput? The problem is that the extension method syntax doesn't play nice with our `dynamic` type, so finally these have to be rewritten like so:

```c#
queryable = desc
	? Queryable.OrderByDescending(queryable, OrderFunctions[orderByField])
	: Queryable.OrderBy(queryable, OrderFunctions[orderByField]);
```

Et voilà, from 34 lines of unreadable spaghetti to 9 lines of easily maintained and extendable code. Admittedly, the `Expression<Func<SearchResultItem, ` part is a bit lengthy and repetitive. Unfortunately `Expression<>` is a `sealed` class, but you can make a wrapper for it. The end result then looks like this:

```c#
namespace My.Projects.Namespace
{
    using System;
    using System.Linq.Expressions;

    public class OrderBy<T>
    {
        public OrderBy(Expression<Func<SearchResultItem, T>> expression)
        {
            this.Expression = expression;
        }

        public Expression<Func<SearchResultItem, T>> Expression { get; }
    }
}

// ...

private static readonly Dictionary<string, dynamic> OrderFunctions =
	new Dictionary<string, dynamic>
	{
		{ "hired", new OrderBy<DateTime>(x => x.DateHired) },
		{ "name",  new OrderBy<string>(x => x.Name) },
		{ "age",   new OrderBy<int>(x => x.Age) }
	};

// ...

queryable = desc
	? Queryable.OrderByDescending(queryable, OrderFunctions[orderByField].Expression)
	: Queryable.OrderBy(queryable, OrderFunctions[orderByField].Expression);
```

And the nice thing is you can pass the `dynamic` expression trees around like variables. The logic behind a sort-column like `"hired"` could be kept in a completely different assembly or namespace to keep a good separation of concerns.