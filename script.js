Promise.all([
  d3.json("salaries.json"),
  d3.json("titles.json"),
  d3.json("salary_ranges.json"),
  d3.json("schools.json")
]).then(function([salaries_all, titles_all, salary_ranges_all, schools_all]) {

  var institutions = Object.keys(salaries_all);

  // institution dropdown
  var inst_dropdown = d3.select("select#institution");
  inst_dropdown.selectAll("option")
    .data(institutions)
    .enter()
    .append("option")
    .text(d => d)
    .attr("value", d => d);

  // state variables
  var salaries, titles, salary_ranges, schools, jobcodes, person_index;

  function loadInstitution(inst) {
    salaries = salaries_all[inst];
    titles = titles_all[inst];
    salary_ranges = salary_ranges_all[inst];
    
    // FIX: Normalize salary ranges to ensure min < max
    for (var category in salary_ranges) {
      var range = salary_ranges[category];
      if (range.min !== "NA" && range.max !== "NA" && range.min > range.max) {
        // Swap them
        var temp = range.min;
        range.min = range.max;
        range.max = temp;
      }
    }
    
    schools = schools_all[inst];

    // populate school dropdown
    var school_dropdown = d3.select("select#school");
    school_dropdown.selectAll("option").remove();
    school_dropdown.selectAll("option")
      .data(schools)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);

    // insert title into salaries dataset
    salaries.forEach(function(d) {
      d.title = titles[d.JobCode];
    });

    // build jobcodes mapping
    jobcodes = {};
    for (var code in titles) {
      var title = titles[code];
      if (!jobcodes[title]) jobcodes[title] = [];
      jobcodes[title].push(code);
    }

    // build person index
    person_index = salaries.map((d, i) => ({
      name: [d.FirstName, d.LastName, d.Department].join("|"),
      index: i
    }));
  }

  // load default institution (first one)
  loadInstitution(institutions[0]);

  // institution change -> reload data
  d3.select("select#institution").on("change", function() {
    var inst = d3.select("select#institution").property("value");
    loadInstitution(inst);
  });

  // button click -> plot
  d3.select("button").on("click", function() {
    plot_data(salaries, schools, jobcodes, salary_ranges, person_index);
  });
});

function plot_data(salaries, schools, jobcodes, salary_ranges, person_index) {
    d3.select("div#chart svg").remove();
    d3.selectAll("g.d3panels-tooltip").remove();
    d3.select("div#text_output").html("");

    // grab form data
    var last_name = d3.select("input#last_name").property("value").toUpperCase().trim();
    var first_name = d3.select("input#first_name").property("value").toUpperCase().trim();
    
    // Get selected schools (multi-select)
    var selected_schools = [];
    d3.selectAll("select#school option:checked").each(function() {
      selected_schools.push(d3.select(this).text());
    });
    
    // If no schools selected, use all schools
    if (selected_schools.length === 0) {
      selected_schools = schools;
    }

    // Filter salaries by selected schools
    var filtered_salaries = salaries.filter(function(d) {
      return selected_schools.indexOf(d.SchoolCollege) >= 0;
    });

    // Try to find the person in the filtered data
    var this_record = null;
    var person_found = false;
    
    if (first_name.length > 0 && last_name.length > 0) {
      // Look for the person in filtered salaries
      var matching_people = filtered_salaries.filter(function(d) {
        return d.FirstName === first_name && d.LastName === last_name;
      });
      
      if (matching_people.length > 0) {
        // Pick first match or random if multiple
        this_record = matching_people[Math.floor(Math.random() * matching_people.length)];
        person_found = true;
      }
    }
    
    // Determine what to plot
    var title, salary, target_jobcodes;
    
    if (person_found) {
      // Person found - use their data
      title = this_record.title;
      salary = this_record.AnnualSalary;
      target_jobcodes = jobcodes[title];
    } else if (filtered_salaries.length > 0) {
      // Person not found - show ALL jobs in selected schools
      title = "All Positions";
      // Get all job codes from filtered salaries
      target_jobcodes = [];
      filtered_salaries.forEach(function(d) {
        if (target_jobcodes.indexOf(d.JobCode) < 0) {
          target_jobcodes.push(d.JobCode);
        }
      });
      salary = null; // No specific person's salary
    } else {
      d3.select("div#chart").text("No data available for selected schools/colleges");
      return;
    }

    d3.select("div#chart").text(""); // clear text in div

    var data_to_plot, comp_salaries, comp_salaries_school, comp_salaries_dept;
    
    if (person_found) {
      // Person found - show comparison across institution, school, department, and individual
      
      // across campus/institution
      var salaries_subset = salaries.filter(function(d) {
        return target_jobcodes.indexOf(d.JobCode) >= 0;
      });

      comp_salaries = salaries_subset.map(d => d.AnnualSalary);
      var labels = salaries_subset.map(d => d.FirstName + " " + d.LastName + " $" + d.AnnualSalary);
      var group = salaries_subset.map(d => 2);
      
      var this_index = salaries_subset.findIndex(d => d.FirstName === first_name && d.LastName === last_name);
      if (this_index >= 0) {
        group[this_index] = 1;
      }

      data_to_plot = {
        x: comp_salaries.map(d => 1),
        y: comp_salaries,
        indID: labels,
        group: group
      };

      // within school/college (selected schools)
      var salaries_school = salaries_subset.filter(function(d) {
        return selected_schools.indexOf(d.SchoolCollege) >= 0;
      });

      data_to_plot.x = data_to_plot.x.concat(salaries_school.map(d => 2));
      comp_salaries_school = salaries_school.map(d => d.AnnualSalary);
      data_to_plot.y = data_to_plot.y.concat(comp_salaries_school);
      data_to_plot.indID = data_to_plot.indID.concat(salaries_school.map(d => d.FirstName + " " + d.LastName + " $" + d.AnnualSalary));
      var group_school = salaries_school.map(d => 2);
      this_index = salaries_school.findIndex(d => d.FirstName === first_name && d.LastName === last_name);
      if (this_index >= 0) {
        group_school[this_index] = 1;
      }
      data_to_plot.group = data_to_plot.group.concat(group_school);

      // within department
      var salaries_dept = salaries_subset.filter(function(d) {
        return d.Department === this_record.Department;
      });

      data_to_plot.x = data_to_plot.x.concat(salaries_dept.map(d => 3));
      comp_salaries_dept = salaries_dept.map(d => d.AnnualSalary);
      data_to_plot.y = data_to_plot.y.concat(comp_salaries_dept);
      data_to_plot.indID = data_to_plot.indID.concat(salaries_dept.map(d => d.FirstName + " " + d.LastName + " $" + d.AnnualSalary));
      var group_dept = salaries_dept.map(d => 2);
      this_index = salaries_dept.findIndex(d => d.FirstName === first_name && d.LastName === last_name);
      if (this_index >= 0) {
        group_dept[this_index] = 1;
      }
      data_to_plot.group = data_to_plot.group.concat(group_dept);

      // this individual
      if (salary) {
        data_to_plot.x.push(4);
        data_to_plot.y.push(salary);
        data_to_plot.indID.push(first_name + " " + last_name + " $" + salary);
        data_to_plot.group.push(1);
      }
    } else {
      // No person found - show only all people in selected schools
      comp_salaries = filtered_salaries.map(d => d.AnnualSalary);
      var labels_all = filtered_salaries.map(d => d.FirstName + " " + d.LastName + " $" + d.AnnualSalary);
      var group_all = filtered_salaries.map(d => 2);
      
      data_to_plot = {
        x: comp_salaries.map(d => 1),
        y: comp_salaries,
        indID: labels_all,
        group: group_all
      };
    }

    // Calculate approximate salary range from filtered institution data
    // Calculate approximate salary range from job title/category data
    var salary_range;
    if (person_found && target_jobcodes && target_jobcodes.length > 0) {
      // Get salaries for the same job title across the institution
      var job_title_salaries = salaries.filter(function(d) {
        return target_jobcodes.indexOf(d.JobCode) >= 0;
      }).map(d => d.AnnualSalary);
      
      if (job_title_salaries.length > 0) {
        salary_range = {
          min: d3.min(job_title_salaries),
          max: d3.max(job_title_salaries)
        };
      } else {
        salary_range = {min: "NA", max: "NA"};
      }
    } else {
      // When no person found, use all filtered salaries
      if (filtered_salaries.length > 0) {
        var institution_salaries = filtered_salaries.map(d => d.AnnualSalary);
        salary_range = {
          min: d3.min(institution_salaries),
          max: d3.max(institution_salaries)
        };
      } else {
        salary_range = {min: "NA", max: "NA"};
      }
    }

    var ymin = d3.min(data_to_plot.y);
    if (salary_range.min !== "NA") {
      ymin = d3.min([ymin, salary_range.min]);
    }
    var ymax = d3.max(data_to_plot.y);
    if (salary_range.max !== "NA") {
      ymax = d3.max([ymax, salary_range.max]);
    }

    // svg height and width
    var height = 600;
    var width = 600 * 1.5;

    // Determine x-axis labels based on whether person was found
    var xcategories, xcatlabels;
    if (person_found) {
      xcategories = [1, 2, 3, 4];
      xcatlabels = ["everyone", "your school/college", "your department", "you"];
    } else {
      xcategories = [1];
      xcatlabels = ["everyone"];
    }

    var mychart = d3panels.dotchart({
      xlab: "",
      ylab: "Annual Salary ($)",
      title: title,
      height: height,
      width: width,
      ylim: [ymin * 0.95, ymax * 1.05],
      margin: {
        left: 160,
        top: 40,
        right: 160,
        bottom: 40,
        inner: 3
      },
      xcategories: xcategories,
      xcatlabels: xcatlabels,
      horizontal: true
    });

    mychart(d3.select("div#chart"), data_to_plot);
    d3.select("svg").attr("viewBox", `0 0 ${width} ${height}`);

    mychart.points()
      .on("mouseover", function(d) {
        d3.select(this).attr("r", 6);
      })
      .on("mouseout", function(d) {
        d3.select(this).attr("r", 3);
      });

    var green = "#2ECC40";
    var orange = "#FF851B";
    var orange_text = "#dF650B";
    
    // Boxplot width when no person is found (single category display)
    var BOXPLOT_WIDTH_NO_PERSON = 50;

    var summary = five_number_summary(comp_salaries);
    var y1 = mychart.yscale()(1);
    
    if (person_found) {
      var y2 = mychart.yscale()(2);
      // Use xscale for salary values (horizontal chart)
      make_boxplot(summary, d3.select("div#chart svg"), mychart.xscale(), y1 * 0.67 + y2 * 0.33, (y2 - y1) / 3, 3, green);

      var summary_school = five_number_summary(comp_salaries_school);
      var y3 = mychart.yscale()(3);
      // Use xscale for salary values (horizontal chart)
      make_boxplot(summary_school, d3.select("div#chart svg"), mychart.xscale(), y2 * 0.67 + y3 * 0.33, (y3 - y2) / 3, 3, green);

      var summary_dept = five_number_summary(comp_salaries_dept);
      var y4 = mychart.yscale()(4);

      // Use xscale for salary values (horizontal chart)
      make_boxplot(summary_dept, d3.select("div#chart svg"), mychart.xscale(), y3 * 0.67 + y4 * 0.33, (y4 - y3) / 3, 3, green);
    } else {
      // When no person is found, only show the "everyone" boxplot centered on y1
      var offset = BOXPLOT_WIDTH_NO_PERSON + 20
      make_boxplot(summary, d3.select("div#chart svg"), mychart.xscale(), y1 + offset, BOXPLOT_WIDTH_NO_PERSON, 3, green);
    }

    var yd, ypos;
    if (person_found) {
      var y2_pf = mychart.yscale()(2);
      yd = (y2_pf - y1) / 24;
      ypos = mychart.yscale()(4) + yd * 3;
    } else {
      yd = BOXPLOT_WIDTH_NO_PERSON / 24;  // Use same ratio as boxplot width
      ypos = y1 + yd * 3;
    }

  if (person_found){
    var g_range = d3.select("div#chart svg").append("g").attr("id", "salary_range");
    var range_min = salary_range.min === "NA" ? summary[0] : salary_range.min;
    var range_max = salary_range.max === "NA" ? summary[4] : salary_range.max;
    
    g_range.append("line")
      .style("stroke-width", 3)
      .style("stroke", orange)
      // Use xscale for salary values (horizontal chart)
      .attr("x1", function(d) { return mychart.xscale()(range_min); })
      .attr("x2", function(d) { return mychart.xscale()(range_max); })
      .attr("y1", ypos)
      .attr("y2", ypos);

    var range = [range_min, range_max];
    var sr_range = [salary_range.min, salary_range.max];
    
    for (var i = 0; i < 2; i++) {
      var val = range[i];
      if (sr_range[i] !== "NA") {
        g_range.append("line")
          .style("stroke-width", 3)
          .style("stroke", orange)
          // Use xscale for salary values (horizontal chart)
          .attr("x1", mychart.xscale()(val))
          .attr("x2", mychart.xscale()(val))
          .attr("y1", ypos - yd)
          .attr("y2", ypos + yd);
      } else {
        g_range.append("line")
          .style("stroke-width", 3)
          .style("stroke", orange)
          // Use xscale for salary values (horizontal chart)
          .attr("x1", mychart.xscale()(val))
          .attr("x2", mychart.xscale()(val) + (1 - i * 2) * (y2 - y1) * 0.1)
          .attr("y1", ypos)
          .attr("y2", ypos + yd);
        g_range.append("line")
          .style("stroke-width", 3)
          .style("stroke", orange)
          // Use xscale for salary values (horizontal chart)
          .attr("x1", mychart.xscale()(val))
          .attr("x2", mychart.xscale()(val) + (1 - i * 2) * (y2 - y1) * 0.1)
          .attr("y1", ypos)
          .attr("y2", ypos - yd);
      }
    }

    g_range.append("text")
      .text("Approx. salary range")
      .attr("fill", orange_text)
      // Use xscale for salary values (horizontal chart)
      .attr("x", mychart.xscale()((range[0] + range[1]) / 2))
      .attr("y", ypos + 3 * yd)
      .style("dominant-baseline", "middle")
      .style("text-anchor", "middle");
  }

    // min and max salary for title
    var start_range_text, end_range_text, range_text;
    if (person_found) {
      if (salary_range.min === "NA") {
        start_range_text = "There is no minimum salary at your institution;";
      } else {
        start_range_text = `The approximate minimum salary at your institution is $${salary_range.min};`;
      }
      if (salary_range.max === "NA") {
        end_range_text = " there is no maximum salary at your institution.";
      } else {
        end_range_text = ` the approximate maximum salary at your institution is $${salary_range.max}.`;
      }
      if (salary_range.min === "NA" && salary_range.max === "NA") {
        range_text = "No salary range information available.";
      } else {
        range_text = start_range_text + end_range_text;
      }
    } else {
      if (salary_range.min === "NA") {
        start_range_text = "There is no minimum salary at your institution;";
      } else {
        start_range_text = `The approximate minimum salary at your institution is $${salary_range.min};`;
      }
      if (salary_range.max === "NA") {
        end_range_text = " there is no maximum salary at your institution.";
      } else {
        end_range_text = ` the approximate maximum salary at your institution is $${salary_range.max}.`;
      }
      if (salary_range.min === "NA" && salary_range.max === "NA") {
        range_text = "No salary range information available.";
      } else {
        range_text = start_range_text + end_range_text;
      }
    }

    // Generate text output based on whether person was found
    var text_output;
    if (person_found) {
      text_output = `<p>Your title is ${title} in ${this_record.Department} (${this_record.SchoolCollege}). ` +
        `Your annual salary is $${salary}. ` +
        range_text +
        "<p>On top, the plot shows the actual salaries of all other employees (blue dots) " +
        "that have the same job title as you " +
        "(across the institution, in your school/college, and in your department). " +
        "<p>The green boxes represent the range from the 25th to 75th percentile with " +
        "a central line at the median, across the institution, within your school/college, and within your department. " +
        "<p>The orange line indicates the approximate salary range at your institution; " +
        "arrowheads on the left or right indicate no minimum or maximum salary, respectively.";
    } else {
      var school_list = selected_schools.join(", ");
      text_output = `<p>Showing salary comparison for all positions in selected school(s): ${school_list}. ${range_text}` +
        `<p>The plot shows the actual salaries of all employees (blue dots) in the selected school(s). ` +
        `<p>The green box represents the range from the 25th to 75th percentile with a central line at the median. ` +
        `<p>The orange line indicates the approximate salary range at your institution; ` +
        `arrowheads on the left or right indicate no minimum or maximum salary, respectively.`;
    }

    d3.select("div#text_output").html(text_output);
}

// calculate min, 25 %ile, median, 75 %ile, max
function five_number_summary(x) {
    if (!x) return null;

    // drop missing values
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

    // calculate lower and upper quartile
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

    // Use xscale for salary values (horizontal chart)
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
    
    // Add the box rectangle (25th to 75th percentile)
    g.append("rect")
      .attr("x", xscale(values[1]))
      .attr("y", xpos - boxwidth / 4)
      .attr("width", xscale(values[3]) - xscale(values[1]))
      .attr("height", boxwidth / 2)
      .style("fill", stroke)
      .style("fill-opacity", 0.3)
      .style("stroke", stroke)
      .style("stroke-width", stroke_width);
      
    // Add median line (inside the box)
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

    // add tool tip
    var vert_lines_tooltip = d3panels.tooltip_create(
      d3.select("body"),
      vert_lines,
      {tipclass: "tooltip"},
      function(d, i) {
        return `${vert_line_labels[i]} = $${Math.round(d)}`;
      }
    );
}
