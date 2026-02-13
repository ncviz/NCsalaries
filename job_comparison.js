// Load all data
Promise.all([
  d3.json("salaries.json"),
  d3.json("titles.json")
]).then(function([salaries_all, titles_all]) {

  var institutions = Object.keys(salaries_all);
  
  // Color scheme for institutions
  var colorScheme = [
    "#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00",
    "#ffff33", "#a65628", "#f781bf", "#999999", "#66c2a5"
  ];
  var institutionColors = {};
  institutions.forEach(function(inst, i) {
    institutionColors[inst] = colorScheme[i % colorScheme.length];
  });

  // State management for selected jobs
  var selectedJobs = {}; // { institution: [{ title, jobCodes }] }
  institutions.forEach(function(inst) {
    selectedJobs[inst] = [];
  });

  // Render institution forms
  var formsContainer = d3.select("#institution-forms");
  
  institutions.forEach(function(inst) {
    var section = formsContainer.append("div")
      .attr("class", "institution-section")
      .attr("data-institution", inst);
    
    section.append("div")
      .attr("class", "institution-title")
      .style("color", institutionColors[inst])
      .text(inst);
    
    section.append("input")
      .attr("type", "text")
      .attr("class", "job-search-box")
      .attr("placeholder", "Search for job title...")
      .attr("data-institution", inst);
    
    var suggestions = section.append("div")
      .attr("class", "job-suggestions")
      .attr("data-institution", inst);
    
    section.append("div")
      .attr("class", "selected-jobs")
      .attr("data-institution", inst);
  });

  // Setup search functionality
  d3.selectAll(".job-search-box").on("input", function() {
    var inst = d3.select(this).attr("data-institution");
    var query = this.value.toLowerCase().trim();
    
    var suggestionsDiv = d3.select(`.job-suggestions[data-institution="${inst}"]`);
    
    if (query.length < 2) {
      suggestionsDiv.style("display", "none");
      return;
    }
    
    // Get unique job titles for this institution
    var titles = titles_all[inst];
    var uniqueTitles = Object.values(titles).filter(function(value, index, self) {
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
    
    matches.slice(0, 20).forEach(function(title) {
      suggestionsDiv.append("div")
        .attr("class", "job-suggestion-item")
        .text(title)
        .on("click", function() {
          addJobTitle(inst, title);
          d3.select(`.job-search-box[data-institution="${inst}"]`).property("value", "");
          suggestionsDiv.style("display", "none");
        });
    });
  });

  // Hide suggestions when clicking outside
  d3.select("body").on("click", function(event) {
    var target = event.target;
    if (!target.classList.contains("job-search-box") && 
        !target.classList.contains("job-suggestion-item")) {
      d3.selectAll(".job-suggestions").style("display", "none");
    }
  });

  function addJobTitle(inst, title) {
    // Check if already added
    var alreadyAdded = selectedJobs[inst].some(function(job) {
      return job.title === title;
    });
    
    if (alreadyAdded) {
      return;
    }
    
    // Get job codes for this title
    var titles = titles_all[inst];
    var jobCodes = Object.keys(titles).filter(function(code) {
      return titles[code] === title;
    });
    
    // Add to selected jobs
    selectedJobs[inst].push({ title: title, jobCodes: jobCodes });
    
    // Render selected job tag
    var selectedDiv = d3.select(`.selected-jobs[data-institution="${inst}"]`);
    
    var tag = selectedDiv.append("span")
      .attr("class", "selected-job-tag")
      .style("background-color", institutionColors[inst])
      .text(title);
    
    tag.append("span")
      .attr("class", "remove-job")
      .text("×")
      .on("click", function() {
        removeJobTitle(inst, title);
      });
  }

  function removeJobTitle(inst, title) {
    selectedJobs[inst] = selectedJobs[inst].filter(function(job) {
      return job.title !== title;
    });
    
    // Re-render selected jobs
    renderSelectedJobs(inst);
  }

  function renderSelectedJobs(inst) {
    var selectedDiv = d3.select(`.selected-jobs[data-institution="${inst}"]`);
    selectedDiv.selectAll("*").remove();
    
    selectedJobs[inst].forEach(function(job) {
      var tag = selectedDiv.append("span")
        .attr("class", "selected-job-tag")
        .style("background-color", institutionColors[inst])
        .text(job.title);
      
      tag.append("span")
        .attr("class", "remove-job")
        .text("×")
        .on("click", function() {
          removeJobTitle(inst, job.title);
        });
    });
  }

  // Submit button handler
  d3.select("#submit-comparison").on("click", function() {
    generateComparison();
  });

  function generateComparison() {
    // Clear previous chart
    d3.select("#comparison-chart").selectAll("*").remove();
    d3.selectAll("g.d3panels-tooltip").remove();
    d3.select("#text_output").html("");

    // Collect all selected jobs across institutions
    var hasSelections = false;
    institutions.forEach(function(inst) {
      if (selectedJobs[inst].length > 0) {
        hasSelections = true;
      }
    });

    if (!hasSelections) {
      d3.select("#comparison-chart").text("Please select at least one job title from any institution.");
      return;
    }

    // Prepare data for plotting
    var allData = [];
    var institutionIndex = 1;
    var institutionPositions = {};
    
    institutions.forEach(function(inst) {
      if (selectedJobs[inst].length === 0) {
        return; // Skip institutions with no selections
      }
      
      institutionPositions[inst] = institutionIndex;
      
      selectedJobs[inst].forEach(function(job) {
        // Get all salaries for this job title in this institution
        var salaries = salaries_all[inst];
        var titles = titles_all[inst];
        
        var matchingSalaries = salaries.filter(function(d) {
          return job.jobCodes.indexOf(d.JobCode) >= 0;
        });
        
        matchingSalaries.forEach(function(person) {
          allData.push({
            institution: inst,
            jobTitle: job.title,
            name: person.FirstName + " " + person.LastName,
            salary: person.AnnualSalary,
            xpos: institutionIndex
          });
        });
      });
      
      institutionIndex++;
    });

    if (allData.length === 0) {
      d3.select("#comparison-chart").text("No salary data found for selected job titles.");
      return;
    }

    // X-axis categories (institutions with selections) - moved up to calculate before plotData
    var xcategories = [];
    var xcatlabels = [];
    var activeInstitutions = [];
    
    institutions.forEach(function(inst) {
      if (selectedJobs[inst].length > 0) {
        xcategories.push(institutionPositions[inst]);
        xcatlabels.push(inst);
        activeInstitutions.push(inst);
      }
    });

    // Create data structure for dotchart
    var plotData = {
      x: allData.map(d => d.xpos),
      y: allData.map(d => d.salary),
      indID: allData.map(d => `${d.name}, ${d.jobTitle}, ${d.institution}`),
      group: allData.map(d => {
        // Assign group based on activeInstitutions for coloring to match pointcolor array
        return activeInstitutions.indexOf(d.institution) + 1;
      })
    };

    // Calculate y-axis range
    var ymin = d3.min(plotData.y);
    var ymax = d3.max(plotData.y);

    // SVG dimensions - increased by 25% for better visibility
    var height = 750;
    var width = height * 1.5;

    // Create chart
    var mychart = d3panels.dotchart({
      xlab: "Institution",
      ylab: "Annual Salary ($)",
      title: "Job Title Comparison Across Institutions",
      height: height,
      width: width,
      ylim: [ymin * 0.95, ymax * 1.05],
      margin: {
        left: 160,
        top: 40,
        right: 160,
        bottom: 80,
        inner: 3
      },
      xcategories: xcategories,
      xcatlabels: xcatlabels,
      horizontal: true,
      pointcolor: activeInstitutions.map(inst => institutionColors[inst]),
      pointsize: 3
    });

    mychart(d3.select("#comparison-chart"), plotData);
    d3.select("#comparison-chart svg").attr("viewBox", `0 0 ${width} ${height}`);

    // Update point sizes on hover
    mychart.points()
      .on("mouseover", function(d) {
        d3.select(this).attr("r", 6);
      })
      .on("mouseout", function(d) {
        d3.select(this).attr("r", 3);
      });

    // Add box plots for each institution
    activeInstitutions.forEach(function(inst) {
      var instData = allData.filter(d => d.institution === inst);
      var instSalaries = instData.map(d => d.salary);
      
      var summary = five_number_summary(instSalaries);
      var xpos = institutionPositions[inst];
      var ypos = mychart.yscale()(xpos);
      
      // Calculate box width based on spacing
      var boxWidth = 50;
      if (activeInstitutions.length > 1) {
        var y1 = mychart.yscale()(xcategories[0]);
        var y2 = mychart.yscale()(xcategories[1]);
        boxWidth = Math.abs(y2 - y1) / 3;
      }
      
      // Offset the box plot below the employee dots to prevent overlap
      // Use 60% of box width to visually separate box plots from dots while maintaining readability
      var boxOffset = boxWidth * 0.75;
      var adjustedYpos = ypos + boxOffset;
      
      make_boxplot(summary, d3.select("#comparison-chart svg"), mychart.xscale(), 
                    adjustedYpos, boxWidth, 3, institutionColors[inst]);
    });

    // Generate text output
    var textOutput = "<h4>Comparison Summary</h4>";
    activeInstitutions.forEach(function(inst) {
      var jobs = selectedJobs[inst].map(j => j.title).join(", ");
      var instData = allData.filter(d => d.institution === inst);
      textOutput += `<p><strong style="color: ${institutionColors[inst]}">${inst}</strong>: `;
      textOutput += `${instData.length} employee(s) with selected job title(s): ${jobs}</p>`;
    });
    
    textOutput += "<p>The colored dots represent individual employees, with each color corresponding to an institution. ";
    textOutput += "The colored boxes show the interquartile range (25th to 75th percentile) for each institution, ";
    textOutput += "with the median line inside. Hover over any point to see employee details.</p>";
    
    d3.select("#text_output").html(textOutput);
  }

  // Utility functions (copied from script.js)
  function five_number_summary(x) {
    if (!x) return null;

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

    var lower = x[below] * weight2 + x[below + 1] * weight1;
    var upper = x[n - below - 2] * weight1 + x[n - below - 1] * weight2;

    return [min, lower, median, upper, max];
  }

  function make_boxplot(values, selection, xscale, xpos, boxwidth, stroke_width, stroke) {
    var g = selection.append("g").attr("class", "boxplot");

    g.append("line")
      .attr("x1", xscale(values[0]))
      .attr("x2", xscale(values[1]))
      .attr("y1", xpos)
      .attr("y2", xpos)
      .style("stroke-width", stroke_width)
      .style("stroke", stroke);
      
    g.append("line")
      .attr("x1", xscale(values[3]))
      .attr("x2", xscale(values[4]))
      .attr("y1", xpos)
      .attr("y2", xpos)
      .style("stroke-width", stroke_width)
      .style("stroke", stroke);
    
    g.append("rect")
      .attr("x", xscale(values[1]))
      .attr("y", xpos - boxwidth / 4)
      .attr("width", xscale(values[3]) - xscale(values[1]))
      .attr("height", boxwidth / 2)
      .style("fill", stroke)
      .style("fill-opacity", 0.3)
      .style("stroke", stroke)
      .style("stroke-width", stroke_width);
      
    g.append("line")
      .attr("x1", xscale(values[2]))
      .attr("x2", xscale(values[2]))
      .attr("y1", xpos - boxwidth / 4)
      .attr("y2", xpos + boxwidth / 4)
      .style("stroke-width", stroke_width)
      .style("stroke", stroke);

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
        if (i === 0 || i === 4) {
          return xpos - boxwidth / 8;
        } else {
          return xpos - boxwidth / 4;
        }
      })
      .attr("y2", function(d, i) {
        if (i === 0 || i === 4) {
          return xpos + boxwidth / 8;
        } else {
          return xpos + boxwidth / 4;
        }
      });

    var vert_lines_tooltip = d3panels.tooltip_create(
      d3.select("body"),
      vert_lines,
      {tipclass: "tooltip"},
      function(d, i) {
        return `${vert_line_labels[i]} = $${Math.round(d)}`;
      }
    );
  }

});
