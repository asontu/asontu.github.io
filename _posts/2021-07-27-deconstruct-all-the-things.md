---
layout: post
title:  "Deconstruct ALL THE THINGS!"
tags: c# back-end
---

Quickly getting the matches and captured groups from a regex with a more eligant syntax? Deconstruct them!

Since C# 7 you can write your own extension methods to deconstruct any type into a [ValueTuple](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-tuples) like [this example](https://gist.github.com/emoacht/e15808a8c2ef36d9154e2ea3f4e49c78) deconstructing a `KeyValuePair<TKey, TValue>` into the individual `key` and `value`.

And recently I came across [this approach](https://stackoverflow.com/questions/47815660/does-c-sharp-7-have-array-enumerable-destructuring/47816647#47816647) to deconstruct any `IEnumerable<T>`. Since the length of the `IEnumerable` can be anything, the syntax is a bit different. But combined with the C# [discard](https://docs.microsoft.com/en-us/dotnet/csharp/discards) it still works pretty eligantly.

{% highlight c# linenos %}
// Add this somewhere in your solution:
public static void Deconstruct<T>(this IEnumerable<T> list, out T first, out IEnumerable<T> rest)
{
	bool none = (list is null) || !list.Any();
	first = none ? default(T) : list.First();
	rest = none ? new T[0] : list.Skip(1);
}

// Now you can do:
{
	var solfege = new List<string> { "Do", "Re", "Mi" };
	
	var (first, (second, (third, _))) = solfege;
	
	Console.log($"After {first} and {second} comes {third}");
	// prints: "After Do and Re comes Mi"
}
{% endhighlight %}

Performance
-----------

Now if you care about performance, you might wanna look at [this project](https://github.com/DavidArno/SuccincT) in stead of the above implementation. Naively doing `.First()` and `.Skip(1)` for every element means the `IEnumerable` gets traversed multiple times, which is not ideal for performance and might also have unintended side-effects depending on how the `IEnumerable` is implemented. The methods to deconstruct regex matches work with both the code above as well as David Arno's library.

I find that often enough when using regular expressions, I know how many regex matches I care about and how many captured groups they'll return, and I just want those values into variables. So I made Deconstruct extension methods for `MatchCollection` and `Match` as they are not Typed IEnumerables.

{% highlight c# linenos %}
public static void Deconstruct(this MatchCollection matches, out Match firstMatch, out IEnumerable<Match> furtherMatches)
{
	(firstMatch, furtherMatches) = matches?.Cast<Match>();
}

public static void Deconstruct(this Match match, out string firstGroup, out IEnumerable<string> furtherGroups)
{
	(firstGroup, furtherGroups) = match?.Groups?.Cast<Group>().Skip(1).Select(grp => grp.Value);
}
{% endhighlight %}

The `.Skip(1)` of the `Match` deconstruction is needed because the first `Group` always contains the entire match.

These methods can also work together, as demonstrated in this UnitTest:

{% highlight c# linenos %}
[TestMethod]
public void DeconstructRegexTest_MatchAndGroupsCombine()
{
	var ((key1, (val1, _)),
		((key2, (val2, _)),
		((key3, (val3, _)), _))) = Regex.Matches("?regex=match&query=string&param=values", @"([^?&=]+)=([^&=#]*)");

	Assert.AreEqual("regex", key1);
	Assert.AreEqual("match", val1);
	Assert.AreEqual("query", key2);
	Assert.AreEqual("string", val2);
	Assert.AreEqual("param", key3);
	Assert.AreEqual("values", val3);
}
{% endhighlight %}