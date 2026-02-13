# Multi-Job Comparison Page - User Guide

## Overview
The Multi-Job Comparison page allows users to compare salaries for multiple job titles within a single institution, with optional filtering by schools/colleges and departments.

## Features

### 1. Institution Selection
- Select one institution from the dropdown menu
- All institutions in the NC system are available

### 2. Job Title Selection
- Type in the search box to find job titles
- Autocomplete shows up to 30 matching titles
- Click on a title to add it to your comparison
- Multiple titles can be selected
- Remove titles by clicking the × on any tag

### 3. Optional Filters

#### School/College Filter
- Multi-select listbox (hold Ctrl/Cmd to select multiple)
- When selected, the chart will show:
  - Institution-wide data for each job title
  - School/college-specific data for each job title

#### Department/Division Filter
- Multi-select listbox (hold Ctrl/Cmd to select multiple)
- When selected, the chart will show:
  - Institution-wide data for each job title
  - Department-specific data for each job title

### 4. Display Options

#### Group by Title Checkbox
- **Unchecked (default)**: Groups data by institution level
  - All institution-wide jobs together
  - All school-specific jobs together (alphabetically)
  - All department-specific jobs together (alphabetically)
  
- **Checked**: Groups data by job title
  - All levels for Job Title A
  - All levels for Job Title B
  - etc.

### 5. Visualization

The chart displays:
- **Horizontal dot plot**: Each dot represents one employee
- **Color coding**: Each job title has a unique color
- **Box plots**: Show quartile ranges for each group
  - Min, 25th percentile, median, 75th percentile, max
- **Flexible height**: Chart grows vertically to accommodate all data
- **Interactive tooltips**: Hover over points to see employee details
- **Legend**: Shows which color corresponds to which job title

### 6. Summary Statistics
Below the chart, summary statistics are provided for each data group:
- Number of employees
- Mean salary
- Median salary
- Salary range (min to max)

## Example Use Cases

1. **Compare multiple faculty ranks at one university**
   - Select: Assistant Professor, Associate Professor, Professor
   - View institution-wide salaries for all three ranks

2. **Compare salaries across different colleges**
   - Select: Professor
   - Filter by: College of Engineering, College of Science
   - See institution-wide professors AND college-specific breakdowns

3. **Analyze department-level variations**
   - Select: Research Scientist
   - Filter by: Biology Department, Chemistry Department
   - Compare salaries across departments

## Technical Implementation

### Data Sources
- `salaries.json`: Individual salary records
- `titles.json`: Job title mappings
- `schools.json`: School/college listings
- `divisions.json`: Department/division listings

### Visualization Library
- D3.js for data manipulation and DOM updates
- d3panels for chart generation
- Horizontal dot charts for better label readability

### Chart Sizing
- Minimum height: 600px
- Dynamic height: 40px per data group
- Ensures all labels are readable regardless of data volume
