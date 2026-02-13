library(readxl)
library(jsonlite)
library(dplyr)
library(stringr)

salary_file <- "./NC salary project/Feb26_NC_salary.xlsx"
divisions_file <- "./NC salary project/Feb26_NC_Divisions.xlsx"

# Read Excel files
df <- read_excel(salary_file) |> as.data.frame()
divisions_df <- read_excel(divisions_file) |> as.data.frame()

# Standardize column names
names(df) <- toupper(names(df))
names(divisions_df) <- toupper(names(divisions_df))

# Rename to internal names
df <- df |> rename(
  Institution = `INSTITUTION NAME`,
  LastName = `LAST NAME`,
  FirstName = `FIRST NAME`,
  Init = INIT,
  Age = AGE,
  HireDate = `INITIAL HIRE DATE`,
  JobCategory = `JOB CATEGORY`,
  AnnualSalary = `EMPLOYEE ANNUAL BASE SALARY`,
  Department = `EMPLOYEE HOME DEPARTMENT`,
  Title = `PRIMARY WORKING TITLE`
)

# Clean names
df$FirstName <- toupper(df$FirstName)
df$LastName  <- toupper(df$LastName)

# Remove zero or missing salaries
df$AnnualSalary <- as.numeric(gsub("[^0-9.]", "", df$AnnualSalary))
df <- df |> filter(AnnualSalary > 1000)

# Join with divisions data to get School/College
# Assuming divisions_df has columns for Institution, Department, and School/College
# Adjust the column names based on your actual Excel file structure
divisions_df <- divisions_df |> rename(
  Institution = `INSTITUTION`,  # Adjust based on actual column name
  Department = `DIVISION/DEPARTMENT`,  # Adjust based on actual column name
  SchoolCollege = `SCHOOL/COLLEGE`  # Adjust based on actual column name
)

# Left join to add School/College to employees
df <- df |> 
  left_join(
    divisions_df |> select(Institution, Department, SchoolCollege),
    by = c("Institution", "Department")
  )

# Assign X_unassigned where there's no match
df <- df |>
  mutate(
    SchoolCollege = case_when(
      is.na(SchoolCollege) ~ paste0(Institution, "_unassigned"),
      TRUE ~ SchoolCollege
    )
  )

institutions <- unique(df$Institution)

# Prepare master lists
divisions_list <- list()
titles_list <- list()
salaries_list <- list()
salary_ranges_list <- list()
schools_list <- list()

for (inst in institutions) {
  
  inst_df <- df |> filter(Institution == inst)
  
  # Remove duplicates
  inst_df <- inst_df |> distinct()
  
  # Create jobcode from title
  inst_df$JobCode <- str_replace_all(toupper(inst_df$Title), "[^A-Z0-9]", "_")
  
  # 1. Divisions
  divisions_list[[inst]] <- sort(unique(inst_df$Department))
  
  # 2. Titles mapping
  title_map <- inst_df |> select(JobCode, Title) |> distinct()
  titles_list[[inst]] <- setNames(as.list(title_map$Title), title_map$JobCode)
  
  # 3. Salaries (full employee data) - now includes SchoolCollege
  salaries_list[[inst]] <- inst_df
  
  # 4. Salary ranges by JobCategory
  sr <- inst_df |>
    group_by(JobCategory) |>
    summarise(
      min = min(AnnualSalary, na.rm = TRUE),
      max = max(AnnualSalary, na.rm = TRUE)
    )
  
  salary_ranges_list[[inst]] <- setNames(
    lapply(1:nrow(sr), function(i) {
      list(min = sr$min[i], max = sr$max[i])
    }),
    sr$JobCategory
  )
  
  # # 4. Salary ranges by Title, not Job Category
  # sr <- inst_df |>
  #   group_by(JobCode) |>
  #   summarise(
  #     min = min(AnnualSalary, na.rm = TRUE),
  #     max = max(AnnualSalary, na.rm = TRUE)
  #   )
  # 
  # salary_ranges_list[[inst]] <- setNames(
  #   lapply(1:nrow(sr), function(i) {
  #     list(min = sr$min[i], max = sr$max[i])
  #   }),
  #   sr$JobCode
  # 5. Schools/Colleges list
  schools_list[[inst]] <- sort(unique(inst_df$SchoolCollege))
}

# Write the five JSON files
write(toJSON(divisions_list, auto_unbox = TRUE, pretty = TRUE), "./NC salary project/divisions.json")
write(toJSON(titles_list, auto_unbox = TRUE, pretty = TRUE), "./NC salary project/titles.json")
write(toJSON(salaries_list, auto_unbox = TRUE, pretty = TRUE), "./NC salary project/salaries.json")
write(toJSON(salary_ranges_list, auto_unbox = TRUE, pretty = TRUE), "./NC salary project/salary_ranges.json")
write(toJSON(schools_list, auto_unbox = TRUE, pretty = TRUE), "./NC salary project/schools.json")