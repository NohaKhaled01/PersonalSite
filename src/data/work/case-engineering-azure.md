---
title: Engineering Simulation Data Pipeline - Part II, Azure Migration & dbt layer
description: A continuation of the previous MySQL database and Python ETL pipeline project; Migrating the database to Azure MySQL server, and building a staging - marts - analyses dbt layer on top of it.
tags: ["Azure", "dbt Core", "MySQL", "Data Migration"]
order: 1
---

## TL;DR

- Migrated a MySQL database from my laptop to an Azure Database for MySQL Flexible Server.
- Built a complementary dbt layer on top of the data (staging + a denormalized, question-oriented marts layer).
- Created an analyses layer and a connection guide for the team.
- Attempted event-driven automation using Azure Event Grid triggers and Azure Functions.

*Solo build, post-company closure · 2026 · MySQL, Azure, dbt Core, Event Driven*

## The Problem: Giving the team database access

The database, as built, lived strictly on my laptop. Had the project continued, the next step would have been to incorporate it into the company's ecosystem and make it friendlier for the team and managers.

Our ecosystem at the firm was Microsoft, particularly Azure. We used Azure Boards for high-level management and Azure Blob Storage for data storage. So I decided to stay inside Azure for this stage.

*This is the continuation of the Engineering Simulation Data Pipeline project, where I built a database from scratch using MySQL and Python, consolidating multi-year simulation data from multiple sources into one relational MySQL database. Check it out [here](https://nohakhaled.com/work/case-engineering-pipeline/)*.

## My Role & Constraints

By the time I built this, the company had already closed. I wanted to continue as though the team were still there.

The next steps of the project, had the company not shut down, would have been:

1. Migrate the database and the whole ETL to Azure.
2. Connect the database to the systems in use — Azure Boards and Blob Storage.
3. Automate data ingestion and processing.
4. Ease the database's usage through documentation and tutorials.

I decided to work on migrating the data to Azure, automating ingestion and processing, and easing usage through documentation. I planned the last part around dbt's marts and analyses layers.

## How I Built It: Approach & Key Decisions

### Migrating to Azure

I created a resource group, a resource, and a MySQL Server, then connected MySQL Workbench to the Azure Server. I updated the Python scripts to load data to the new connection, ran them, and loaded the data into the database.

### Building the dbt layer: Staging layer

The staging layer read from the Azure MySQL Server and performed lightweight transformations — data formats and column names. Most transformation had already been done in the Python scripts, so the staging layer served more as a validation layer: testing that start dates preceded end dates and testing PK–FK relationships.

I used one test file and created one macro at this stage. The test file covered the projects table, ensuring the project abbreviation column was in the correct format:

```sql
## Test that the project abb is only two characters [could contain digits]

SELECT project_abbreviation
FROM {{ ref('stg_simmysql__projects') }}
WHERE project_abbreviation not regexp '^[A-Za-z0-9]{2}$'
```

The macro was used across multiple tables to check that start dates were before end dates. It also handled null cases: if either column is null, the result is unknown and those records are dropped — not flagged, and not producing false results:

```sql
{% test date_order(model, column_name, earlier_column) %}

SELECT *
FROM {{ model }}
WHERE {{ column_name }} < {{ earlier_column }}

{% endtest %}
```

### Building the dbt layer: Marts layer
I built the marts layer in a denormalized, question-oriented fashion, keeping in mind how the team and management would use the database. I did not follow a strict star schema design.

I wrote the mart SQL files, then documented them in the YAML file. Below is an example for the mart file querying the last time a project was active and its details, along with its description: 

```sql
with flat_mart as (
    SELECT *
    FROM {{ref('mart_project_stage_request')}}
),
final as (
    SELECT project_id, project_title, 
        stage_title, 
        request_start, request_ending
    FROM (
        SELECT project_id, project_title, stage_title, request_start, request_ending,
            ROW_NUMBER() over (partition by project_id order by request_ending DESC) as row_num
        FROM flat_mart
    ) as sub_table
    WHERE row_num = 1
)
SELECT *
FROM final
```

```yaml
- name: mart_lastactive_projects
  description: 'Last request date for project, with start date and stage title - one row per project. Mart derived from mart_project_stage_request'
  columns:
    - name: project_id
      description: 'project identifier - unique'
      tests:
        - unique
        - not_null
    - name: project_title
      description: 'project title'
      tests:
        - unique
        - not_null
    - name: stage_title
      description: 'stage title for last active request'
      tests:
        - unique
        - not_null
    - name: request_start
      description: 'Request start date'
    - name: request_ending
      description: 'Request ending date'
```

### Building the dbt layer: Analyses
I built the analyses files on top of the mart layer. I wrote down the most frequent queries so the team could access and use them easily. Inside each file, I explained the query's usage and how to create it manually. Below are two examples for *Number of parts in each project* and *Finding the last time a project was active*:

```sql
-- Number of parts in each project in DB
    -- Filter-able using project ID OR project title
    -- Replace X with ID required and/or Replace example with required title

    -- Without the mart: join projects + parts, group using project_id, project_title, count part IDs
    -- OR: using mart_parts_project, group using project_id, project_title, count part IDs

SELECT *
FROM {{ref('aggmart_parts_in_projects')}}
WHERE project_id = 'X' OR project_title LIKE '%example%'
ORDER BY number_of_parts
;
```

```sql
-- Finding the last time a project was active, on which stage, and date
    -- Filter-able using project id OR project title
    -- Replace 'X' with ID required. Replace example with required title

    -- Without the mart: 
    -- use row_number window function over project id, 
    -- ordering request end date descendingly, and include only row numbers = 1

SELECT *
FROM {{ref('mart_lastactive_projects')}}
WHERE project_id = 'X' OR project_title LIKE '%example%'
ORDER BY project_id, project_title
;
```

### Automating Data Ingestion
The planned automation sequence was:

1. JSON file lands in Blob Storage.

2. Azure Function gets triggered.

3. Function runs the Python scripts.

4. Scripts push the new data into the database.

I attempted the automation using a Flex Consumption plan Azure Function and an Azure Event Grid blob trigger. I quickly ran into a compatibility issue between the Flex plan and Event Grid: the deployed function code couldn't be recognized by Event Grid through the platform or Azure's CLI. I went back and forth, but eventually had to abandon this part of the project.

**Something worth noting:** At the time, I was a complete novice at Azure and was still struggling with its basic terminology and setup — which didn't help me try switching hosting plans or changing the kind of blob trigger. After finishing this project, I went back to the basics and started auditing Microsoft's Azure courses on Microsoft Learn. That helped me understand what I'd done in the project and the possible ways I could have researched the compatibility issue and solved it.

## What Changed/What I Learnt
1. A new aspect of dbt: using it as a complementary stage, tailored to direct team use.

2. A solid intro to Azure's cloud services that helped later when I started the introductory course.

## What I'd Do Differently
1. Start with Azure's intro course before diving into this project — it would have helped a lot with understanding and troubleshooting.

2. At scale, or in a more professional setting, I would have opted for Azure Data Factory instead of Functions for the automation.

## See the code

[View the public rebuild on GitHub](https://github.com/NohaKhaled01/EngineeringSimulationDataWarehouse_Azure_MySql)