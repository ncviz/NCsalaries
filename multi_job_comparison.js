// Load all data
Promise.all([
  d3.json("salaries.json"),
  d3.json("titles.json"),
  d3.json("schools.json"),
  d3.json("divisions.json")
]).then(function([salaries_all, titles_all, schools_all, divisions_all]) {

  var institutions = Object.keys(salaries_all);

  // Color scheme for job titles
  var colorScheme = [
    "#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00",
    "#ffff33", "#a65628", "#f781bf", "#999999", "#66c2a5",
    "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"
  ];

  // State variables
  var currentInstitution = institutions[0];
  var selectedJobs = [];
  var currentSalaries = null;
  var currentTitles = null;
  var currentSchools = null;
  var currentDivisions = null;

  // Populate institution dropdown
  var instDropdown = d3.select("#institution");
  instDropdown.selectAll("option")
    .data(institutions)
    .enter()
    .append("option")
    .text(d => d)
    .attr("value", d => d);

  // Load institution data
  function loadInstitution(inst) {
    currentInstitution = inst;
    currentSalaries = salaries_all[inst];
    currentTitles = titles_all[inst];
    currentSchools = schools_all[inst];
    currentDivisions = divisions_all[inst];

    // Populate school dropdown
    var schoolDropdown = d3.select("#school-filter");
    schoolDropdown.selectAll("option").remove();
    schoolDropdown.selectAll("option")
      .data(currentSchools)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);

    // Populate department dropdown
    var deptDropdown = d3.select("#department-filter");
    deptDropdown.selectAll("option").remove();
    deptDropdown.selectAll("option")
      .data(currentDivisions)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);

    // Clear selected jobs when switching institutions
    selectedJobs = [];
    renderSelectedJobs();
  }

  // Load default institution
  loadInstitution(currentInstitution);

  // Institution change handler
  d3.select("#institution").on("change", function() {
    var inst = d3.select(this).property("value");
    loadInstitution(inst);
  });

  // Job title autocomplete functionality
  var jobInput = d3.select("#job-title-input");
  var suggestionsDiv = d3.select("#job-suggestions");

  jobInput.on("input", function() {
    var query = this.value.toLowerCase().trim();

    if (query.length < 2) {
      suggestionsDiv.style("display", "none");
      return;
    }

    // Get unique job titles for this institution
    var uniqueTitles = Object.values(currentTitles).filter(function(value, index, self) {
      return self.indexOf(value) === index;
    }).sort();

    // Filter titles based on query
    var matches = uniqueTitles.filter(function(title) {
      return title.toLowerCase().includes(query);
    });

    if (matches.length === 0) {
      suggestionsDiv.style("display", "none");
      return;
    }

    // Display suggestions
    suggestionsDiv.style("display", "block");
    suggestionsDiv.selectAll("div").remove();

    matches.slice(0, 30).forEach(function(title) {
      suggestionsDiv.append("div")
        .attr("class", "job-suggestion-item")
        .text(title)
        .on("click", function() {
          addJobTitle(title);
          jobInput.property("value", "");
          suggestionsDiv.style("display", "none");
        });
    });
  });

  // Hide suggestions when clicking outside
  d3.select("body").on("click", function(event) {
    var target = event.target;
    if (target.id !== "job-title-input" && 
        !target.classList.contains("job-suggestion-item")) {
      suggestionsDiv.style("display", "none");
    }
  });

  function addJobTitle(title) {
    // Check if already added
    if (selectedJobs.some(job => job.title === title)) {
      return;
    }

    // Get job codes for this title
    var jobCodes = Object.keys(currentTitles).filter(function(code) {
      return currentTitles[code] === title;
    });

    selectedJobs.push({ 
      title: title, 
      jobCodes: jobCodes,
      color: colorScheme[selectedJobs.length % colorScheme.length]
    });

    renderSelectedJobs();
  }

  function removeJobTitle(title) {
    selectedJobs = selectedJobs.filter(job => job.title !== title);
    
    // Reassign colors
    selectedJobs.forEach((job, index) => {
      job.color = colorScheme[index % colorScheme.length];
    });
    
    renderSelectedJobs();
  }

  function renderSelectedJobs() {
    var selectedDiv = d3.select("#selected-jobs");
    selectedDiv.selectAll("*").remove();

    selectedJobs.forEach(function(job) {
      var tag = selectedDiv.append("span")
        .attr("class", "selected-job-tag")
        .style("background-color", job.color)
        .text(job.title);

      tag.append("span")
        .attr("class", "remove-job")
        .text("×")
        .on("click", function() {
          removeJobTitle(job.title);
        });
    });
  }

  // Submit button handler
  d3.select("#submit-comparison").on("click", function() {
    generateComparison();
  });

  function generateComparison() {
    // Clear previous chart
    d3.select("#chart").selectAll("*").remove();
    d3.selectAll("g.d3panels-tooltip").remove();
    d3.select("#text_output").html("");
    d3.select("#legend").html("");

    if (selectedJobs.length === 0) {
      d3.select("#chart").html("<p>Please select at least one job title.</p>");
      return;
    }

    // Get selected filters
    var selectedSchools = [];
    d3.selectAll("#school-filter option:checked").each(function() {
      selectedSchools.push(d3.select(this).text());
    });

    var selectedDepartments = [];
    d3.selectAll("#department-filter option:checked").each(function() {
      selectedDepartments.push(d3.select(this).text());
    });

    var groupByTitle = d3.select("#group-by-title").property("checked");

    // Prepare data
    var dataGroups = [];
    
    // Always include institution-wide data for each job
    selectedJobs.forEach(function(job) {
      var matchingSalaries = currentSalaries.filter(function(person) {
        return job.jobCodes.indexOf(person.JobCode) >= 0;
      });

      if (matchingSalaries.length > 0) {
        dataGroups.push({
          label: job.title,
          jobTitle: job.title,
          level: "Institution-wide",
          salaries: matchingSalaries,
          color: job.color
        });
      }
    });

    // If schools are selected, add school-level data
    if (selectedSchools.length > 0) {
      selectedJobs.forEach(function(job) {
        selectedSchools.forEach(function(school) {
          var matchingSalaries = currentSalaries.filter(function(person) {
            return job.jobCodes.indexOf(person.JobCode) >= 0 && 
                   person.SchoolCollege === school;
          });

          if (matchingSalaries.length > 0) {
            dataGroups.push({
              label: `${job.title} - ${school}`,
              jobTitle: job.title,
              level: school,
              salaries: matchingSalaries,
              color: job.color
            });
          }
        });
      });
    }

    // If departments are selected, add department-level data
    if (selectedDepartments.length > 0) {
      selectedJobs.forEach(function(job) {
        selectedDepartments.forEach(function(dept) {
          var matchingSalaries = currentSalaries.filter(function(person) {
            return job.jobCodes.indexOf(person.JobCode) >= 0 && 
                   person.Department === dept;
          });

          if (matchingSalaries.length > 0) {
            dataGroups.push({
              label: `${job.title} - ${dept}`,
              jobTitle: job.title,
              level: dept,
              salaries: matchingSalaries,
              color: job.color
            });
          }
        });
      });
    }

    if (dataGroups.length === 0) {
      d3.select("#chart").html("<p>No data found for the selected job titles and filters.</p>");
      return;
    }

    // Sort data groups
    if (groupByTitle) {
      // Group by title first, then by level
      dataGroups.sort((a, b) => {
        if (a.jobTitle !== b.jobTitle) {
          return selectedJobs.findIndex(j => j.title === a.jobTitle) - 
                 selectedJobs.findIndex(j => j.title === b.jobTitle);
        }
        return a.level.localeCompare(b.level);
      });
    } else {
      // Group by level (institution-wide first, then alphabetically)
      dataGroups.sort((a, b) => {
        if (a.level === "Institution-wide" && b.level !== "Institution-wide") return -1;
        if (a.level !== "Institution-wide" && b.level === "Institution-wide") return 1;
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        return selectedJobs.findIndex(j => j.title === a.jobTitle) - 
               selectedJobs.findIndex(j => j.title === b.jobTitle);
      });
    }

    // Create chart data
    var plotData = {
      x: [],
      y: [],
      indID: [],
      group: []
    };

    var categories = [];
    var categoryLabels = [];

    dataGroups.forEach(function(group, groupIndex) {
      categories.push(groupIndex + 1);
      categoryLabels.push(group.label);

      group.salaries.forEach(function(person) {
        plotData.x.push(groupIndex + 1);
        plotData.y.push(person.AnnualSalary);
        plotData.indID.push(`${person.FirstName} ${person.LastName} - $${person.AnnualSalary}`);
        plotData.group.push(selectedJobs.findIndex(j => j.title === group.jobTitle) + 1);
      });
    });

    // Calculate dimensions - make flexible based on number of groups
    var baseHeight = 600;
    var heightPerGroup = 40;
    var height = Math.max(baseHeight, dataGroups.length * heightPerGroup);
    var width = 900;

    // Create chart
    var ymin = d3.min(plotData.y);
    var ymax = d3.max(plotData.y);

    var mychart = d3panels.dotchart({
      xlab: "Annual Salary ($)",
      ylab: "",
      title: `Job Title Comparison at ${currentInstitution}`,
      height: height,
      width: width,
      ylim: [ymin * 0.95, ymax * 1.05],
      margin: {
        left: 300,
        top: 60,
        right: 60,
        bottom: 100,
        inner: 5
      },
      xcategories: categories,
      xcatlabels: categoryLabels,
      horizontal: true,
      pointcolor: selectedJobs.map(job => job.color),
      pointsize: 4,
      xcatlabels_angle: 45
    });

    mychart(d3.select("#chart"), plotData);

    // Make SVG responsive
    d3.select("#chart svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("max-width", "100%")
      .style("height", "auto");

    // Update point sizes on hover
    mychart.points()
      .on("mouseover", function(d) {
        d3.select(this).attr("r", 8);
      })
      .on("mouseout", function(d) {
        d3.select(this).attr("r", 4);
      });

    // Add box plots for each group
    dataGroups.forEach(function(group, groupIndex) {
      var salaryValues = group.salaries.map(s => s.AnnualSalary);
      var summary = fiveNumberSummary(salaryValues);
      
      if (summary) {
        var ypos = mychart.yscale()(groupIndex + 1);
        var boxWidth = 30;
        
        makeBoxplot(summary, d3.select("#chart svg"), mychart.xscale(), 
                    ypos, boxWidth, 2, group.color);
      }
    });

    // Create legend
    var legendDiv = d3.select("#legend");
    legendDiv.html("<h4>Color Legend (by Job Title)</h4>");

    selectedJobs.forEach(function(job) {
      var item = legendDiv.append("div")
        .attr("class", "legend-item");

      item.append("span")
        .attr("class", "legend-color")
        .style("background-color", job.color);

      item.append("span")
        .text(job.title);
    });

    // Generate text output
    var textOutput = "<h4>Summary Statistics</h4>";
    
    dataGroups.forEach(function(group) {
      var salaryValues = group.salaries.map(s => s.AnnualSalary);
      var summary = fiveNumberSummary(salaryValues);
      var mean = d3.mean(salaryValues);
      
      textOutput += `<p><strong style="color: ${group.color}">${group.label}</strong>: `;
      textOutput += `${group.salaries.length} employee(s), `;
      textOutput += `Mean: $${Math.round(mean).toLocaleString()}, `;
      if (summary) {
        textOutput += `Median: $${Math.round(summary[2]).toLocaleString()}, `;
        textOutput += `Range: $${Math.round(summary[0]).toLocaleString()} - $${Math.round(summary[4]).toLocaleString()}`;
      }
      textOutput += `</p>`;
    });

    d3.select("#text_output").html(textOutput);
  }

  // Utility functions
  function fiveNumberSummary(x) {
    if (!x || x.length === 0) return null;

    x = x.filter(xv => xv != null);
    var n = x.length;
    
    if (n === 0) return null;
    if (n === 1) return [x[0], x[0], x[0], x[0], x[0]];

    x.sort((a, b) => a - b);

    var median;
    if (n % 2 === 1) {
      median = x[(n - 1) / 2];
    } else {
      median = (x[n / 2] + x[(n / 2) - 1]) / 2;
    }

    var min = x[0];
    var max = x[n - 1];

    var quarter = (n - 1) * 0.25;
    var below = Math.floor(quarter);
    var above = Math.ceil(quarter);
    var weight1 = quarter - below;
    var weight2 = 1 - weight1;

    var lower = x[below] * weight2 + x[above] * weight1;
    var upper = x[n - above - 1] * weight1 + x[n - below - 1] * weight2;

    return [min, lower, median, upper, max];
  }

  function makeBoxplot(values, selection, xscale, ypos, boxwidth, stroke_width, stroke) {
    var g = selection.append("g").attr("class", "boxplot");

    // Min to Q1 line
    g.append("line")
      .attr("x1", xscale(values[0]))
      .attr("x2", xscale(values[1]))
      .attr("y1", ypos)
      .attr("y2", ypos)
      .style("stroke-width", stroke_width)
      .style("stroke", stroke);

    // Q3 to Max line
    g.append("line")
      .attr("x1", xscale(values[3]))
      .attr("x2", xscale(values[4]))
      .attr("y1", ypos)
      .attr("y2", ypos)
      .style("stroke-width", stroke_width)
      .style("stroke", stroke);

    // Box (Q1 to Q3)
    g.append("rect")
      .attr("x", xscale(values[1]))
      .attr("y", ypos - boxwidth / 4)
      .attr("width", xscale(values[3]) - xscale(values[1]))
      .attr("height", boxwidth / 2)
      .style("fill", stroke)
      .style("fill-opacity", 0.3)
      .style("stroke", stroke)
      .style("stroke-width", stroke_width);

    // Median line
    g.append("line")
      .attr("x1", xscale(values[2]))
      .attr("x2", xscale(values[2]))
      .attr("y1", ypos - boxwidth / 4)
      .attr("y2", ypos + boxwidth / 4)
      .style("stroke-width", stroke_width)
      .style("stroke", stroke);

    // Vertical lines for min, Q1, median, Q3, max
    var vert_line_labels = ["min", "25th %ile", "median", "75th %ile", "max"];

    var vert_lines = g.append("g")
      .selectAll("empty")
      .data(values)
      .enter()
      .append("line")
      .style("stroke-width", stroke_width)
      .style("stroke", stroke)
      .attr("x1", xscale)
      .attr("x2", xscale)
      .attr("y1", function(d, i) {
        return (i === 0 || i === 4) ? ypos - boxwidth / 8 : ypos - boxwidth / 4;
      })
      .attr("y2", function(d, i) {
        return (i === 0 || i === 4) ? ypos + boxwidth / 8 : ypos + boxwidth / 4;
      });

    // Add tooltips to box plot lines
    d3panels.tooltip_create(
      d3.select("body"),
      vert_lines,
      {tipclass: "tooltip"},
      function(d, i) {
        return `${vert_line_labels[i]} = $${Math.round(d).toLocaleString()}`;
      }
    );
  }

});
