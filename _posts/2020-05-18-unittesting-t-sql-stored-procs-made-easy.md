---
layout: post
title: "UnitTesting T-SQL stored procs made easy"
tags: t-sql
---

A while back I was tasked with making a complicated stored procedure that would run somewhere between two applications that were themselves in active development and not stable or live yet. It wasn't feasible to have a human tester test just the stored procedure. In stead, it would be very nice to be able to UnitTest my T-SQL code, but how?

There turned out to be solutions for this, but the requirements and set-up didn't match with the environment I was working on. The client had a single Azure SQL-Server instance where the QA Testing, User Acceptance Testing and Production (!!) tables all were housed<sup>[1](#reason)</sup> with `_test_` and `_acc_` prefixes before the table name.

Not wanting to make 3 or 4 copies of the same stored proc manually I dug around some and realized I can use `object_definition(object_id('MyStoredProc'))` to get the stored proc body and replace prefixes and suffixes programatically. So a `DeployObjects` stored proc was born, which now lives [here](https://github.com/asontu/PureSQLUnitTesting/blob/master/procs/DeployObjects.sql).

I then realized that I might as well "deploy" a version called `MyStoredProc_UTST` where `_test_` gets replaced with `#unittest_`, which would allow me to insert exactly the scenario I wanted to test in these temporary tables. So I expanded on this idea and have since been using [`RunUnitTests`](https://github.com/asontu/PureSQLUnitTesting/blob/master/procs/RunUnitTests.sql) to test the my code for this client.

And I figured there might be others that could use a small, pure T-SQL UnitTesting "framework" (I mean it's literally just two stored procedures, can I even call it a library?) so I gave it its own repo here on [GitHub](https://github.com/asontu/PureSQLUnitTesting).

Ideas, feedback, bugs and PR's welcome, happy testing!

<a name="reason">**1:**</a> <sub><sup>_The reason to have the tables for all environments on the same Azure database is that the Replication-functionality that was being used only works on the highest tier (and thus most expensive) Azure SQL-Server. And since the application that was being replicated from wouldn't go offline if the replication database was suddenly unavailable, the choice was made to have the Testing and Acceptance environment tables in the same database, with a prefix before the table name like `_test_` or `_acc_`._</sup></sub>