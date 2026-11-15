---
id: data-modeling
title: For predictive modeling (Data page)
chapter: data
order: 40
dataHelp: data-modeling
keywords: predictive modeling, model, outcomes, burn time, training data, inputs, outputs
page: data
link: /data
highlight: [data-help="data-modeling"]
---
What it is: A section of the Data page for people who want to fit a model to PSI combustion data.

What it shows: Which measured outcomes the extraction holds per investigation (burn time, hot ignition, extinction diameter, oxygen after the test...), with their unit and how many values, counted live from data/conditions; inputs are the test conditions.

How to use it: Download the dataset, join conditions and outcomes on investigation and test id, and keep each row's source.

Example: FLEX (PSI-69) has burn times in seconds and visible flame extinction diameters in mm, per test.

What it does not do: It is not a validated training set; flagged rows are excluded, and a model fitted to microgravity or normal gravity says nothing direct about partial gravity.
