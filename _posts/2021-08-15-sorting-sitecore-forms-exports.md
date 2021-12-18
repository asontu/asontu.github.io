---
layout: post
title:  "Sorting Sitecore Forms exports"
tags: c# back-end sitecore
---

If you've ever exported form submissions as CSV file from Sitecore 9+ Forms, you might've noticed the order in which the columns are exported seems completely random. We can fix this by implementing our own `IExportDataProvider`.

#### _It seems that as of Sitecore 10.2+ the export **does** properly sort the columns and the solution below is no longer needed_

The way I've implemented this is by decompiling the Sitecore native `CsvExportProvider` and adding the sorting code to that, but I'm not gonna post the decompiled code here publicly. So instead I'll describe how to do that part of it.

Firstly decompile `Sitecore.ExperienceForms.Client.Data.CsvExportProvider` and take all the code needed to replicate the existing CSV export. The Sitecore 9.3 version of that has a `GenerateFileContent(IEnumerable<FormEntry> formEntries)` method that needs the sorting code added. Add the `Guid formId` from the `IExportDataProvider`'s `Export()` method to the signature.

`GenerateFileContent()` consists of two parts, one that determines which columns to export and one that iterates the submissions to generate the rows. Sorting needs to happen in between those parts, after the code checks whether `fieldDatas` has a `.Count` higher than 0, add the line `SortFieldData(formId, ref fieldDatas);`.

The implementation of `SortFieldData()` then looks like this:

{% highlight c# linenos %}
private static void SortFieldData(Guid formId, ref List<FieldData> fieldDatas)
{
	var formFieldIds = fieldDatas.Select(fd => fd.FieldItemId).ToList();
	var sortingDictionary = Context.Database.GetItem(new Sitecore.Data.ID(formId))
		.Descendants(i => formFieldIds.Contains(i.ID.Guid))
		.Select((item, index) => new KeyValuePair<Guid, int>(item.ID.Guid, index))
		.ToDictionary();

	var idCount = sortingDictionary.Count;
	var missingIds = formFieldIds
		.Where(id => !sortingDictionary.ContainsKey(id))
		.Select((id, index) => new KeyValuePair<Guid, int>(id, index + idCount));

	sortingDictionary.AddRange(missingIds);

	fieldDatas = fieldDatas.OrderBy(fd => sortingDictionary[fd.FieldItemId]).ToList();
}
{% endhighlight %}

This code uses a couple of extension methods that I use a lot in my code, so I'll share them here too:

{% highlight c# linenos %}
public static class MyExtensions
{
	public static IEnumerable<Item> Descendants(this Item root, Func<Item, bool> where)
	{
		if (root is null || where is null)
		{
			yield break;
		}

		foreach (Item i in root.Children)
		{
			if (where(i))
			{
				yield return i;
			}

			foreach (Item c in i.Descendants(where))
			{
				yield return c;
			}
		}
	}

	public static Dictionary<TKey, TValue> ToDictionary<TKey, TValue>(this IEnumerable<KeyValuePair<TKey, TValue>> collection)
	{
		return collection.ToDictionary(c => c.Key, c => c.Value);
	}

	public static void AddRange<TKey, TValue>(this IDictionary<TKey, TValue> source, IEnumerable<KeyValuePair<TKey, TValue>> collection)
	{
		if (source is null)
		{
			throw new ArgumentNullException(nameof(source));
		}

		if (collection != null)
		{
			foreach (var (key, value) in collection)
			{
				if (!source.ContainsKey(key))
				{
					source.Add(key, value);
				}
			}
		}
	}

	public static void Deconstruct<TKey, TValue>(this KeyValuePair<TKey, TValue> source, out TKey key, out TValue value)
	{
		key = source.Key;
		value = source.Value;
	}
}
{% endhighlight %}

The sorting magic really happens in the `.Descendants()` extension method, since `Item.Children` returns an `item`'s children in the order that they appear in the Content Editor, which is also the order in which they appear on the form.

After that it's simply translating that order to a `Dictionary<Guid, int>` to be able to `.OrderBy()` and adding the fields that weren't found at the end, so form fields that have been removed since the first submissions will become the last columns.