document.addEventListener('DOMContentLoaded', () => {

    const sceneTitle = d3.select("#scene-title");
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");
    let currentPropertyType;
    let currentStatus = 'All';

    d3.csv("data/us_house_Sales_data.csv").then(loadedData => {

        const cleanedData = loadedData.map(d => ({
            Price: +d.Price.replace(/\$|,/g, ''),
            Area: +d['Area (Sqft)'].replace(/ sqft|,/g, ''),
            State: d.State,
            City: d.City,
            PropertyType: d['Property Type'],
            Status: d.Status,
            Bedrooms: d.Bedrooms,
            Bathrooms: d.Bathrooms,
            YearBuilt: +d['Year Built']
        })).filter(d => d.Price && d.Area && d.State && d.State.length === 2);

        const propertyTypes = [...new Set(cleanedData.map(d => d.PropertyType))].sort();
        const statuses = ['All', ...new Set(cleanedData.map(d => d.Status))];
        
        currentPropertyType = propertyTypes[0];

        setupNavigation(propertyTypes, statuses);
        updateScene();

        function updateScene() {
            d3.selectAll(".prop-button").classed("active", d => d === currentPropertyType);
            sceneTitle.text(`Market Analysis for ${currentPropertyType} Homes`);

            let filteredData = cleanedData.filter(d => d.PropertyType === currentPropertyType);

            if (currentStatus !== 'All') {
                filteredData = filteredData.filter(d => d.Status === currentStatus);
            }
            
            drawBarChart(filteredData);
            drawScatterPlot(filteredData);
        }
        
        function setupNavigation(propTypes, statuses) {
            d3.select("#property-type-buttons").selectAll("button")
                .data(propTypes)
                .join("button")
                .attr("class", "prop-button")
                .text(d => d)
                .on("click", (event, d) => {
                    currentPropertyType = d;
                    updateScene();
                });

            const statusContainer = d3.select("#status-filter-container");
            statuses.forEach(status => {
                const group = statusContainer.append("span").attr("class", "status-group");
                group.append("input")
                    .attr("type", "radio")
                    .attr("name", "status")
                    .attr("id", status)
                    .attr("value", status)
                    .property("checked", status === currentStatus)
                    .on("change", function() {
                        currentStatus = d3.select(this).property("value");
                        updateScene();
                    });
                group.append("label").attr("for", status).text(status);
            });
        }

    }).catch(error => console.error("Error loading data:", error));

    function drawBarChart(propertyTypeData) {
        const svg = d3.select("#bar-chart");
        svg.selectAll("*").remove();

        const margin = { top: 10, right: 20, bottom: 50, left: 100 };
        const width = 500 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const chart = svg.attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const stateStats = Array.from(d3.group(propertyTypeData, d => d.State), ([state, values]) => ({
            state,
            avgPrice: d3.mean(values, v => v.Price),
            listings: values.length
        })).sort((a, b) => d3.descending(a.avgPrice, b.avgPrice));

        const x = d3.scaleLinear().domain([0, d3.max(stateStats, d => d.avgPrice)]).nice().range([0, width]);
        const y = d3.scaleBand().domain(stateStats.map(d => d.state)).range([0, height]).padding(0.1);
        const color = d3.scaleOrdinal(d3.schemeTableau10).domain(stateStats.map(d => d.state));

        chart.append("g").call(d3.axisLeft(y));
        chart.append("g").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => `$${d/1000}k`));
        chart.append("text").attr("class", "axis-title").attr("x", width/2).attr("y", height + 40).text("Average Price");

        chart.selectAll(".bar").data(stateStats).join("rect")
            .attr("y", d => y(d.state)).attr("height", y.bandwidth())
            .attr("x", 0).attr("fill", d => color(d.state))
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", 0.9);
                tooltip.html(`<h3>${d.state}</h3><b>Avg. Price:</b> $${d3.format(",.0f")(d.avgPrice)}<br><b>Listings:</b> ${d.listings}`)
                    .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0))
            .transition().duration(800).attr("width", d => x(d.avgPrice));
    }

    function drawScatterPlot(propertyTypeData) {
        const svg = d3.select("#scatter-plot");
        svg.selectAll("*").remove();
        const legendContainer = d3.select("#scatter-legend");
        legendContainer.html("");

        const margin = { top: 10, right: 20, bottom: 50, left: 60 };
        const width = 400 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const chart = svg.attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
            
        const states = [...new Set(propertyTypeData.map(d => d.State).sort())];
        const stateColor = d3.scaleOrdinal(d3.schemeTableau10).domain(states);
        
        const legendItems = legendContainer.selectAll(".legend-item")
            .data(['All States', ...states])
            .join("div")
            .attr("class", "legend-item")
            .on("mouseover", (event, d) => updateScatter(d))
            .on("mouseout", () => updateScatter("All States"));

        legendItems.append("span").text(d => d);
        legendItems.append("div")
            .attr("class", "legend-color")
            .style("background-color", d => d === 'All States' ? '#ccc' : stateColor(d));
        

        const x = d3.scaleLinear().domain(d3.extent(propertyTypeData, d => d.Area)).nice().range([0, width]);
        const y = d3.scaleLog().domain(d3.extent(propertyTypeData, d => d.Price)).nice().range([height, 0]);

        chart.append("g").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).ticks(5));
        chart.append("g").call(d3.axisLeft(y).ticks(5, d3.format("~s")));
        chart.append("text").attr("class", "axis-title").attr("x", width/2).attr("y", height + 40).text("Area (Sqft)");
        chart.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("y", -margin.left + 15).attr("x", -height/2).text("Price (USD)");
        
        const circles = chart.selectAll("circle")
            .data(propertyTypeData, d => d.Address)
            .join("circle")
            .attr("cx", d => x(d.Area))
            .attr("cy", d => y(d.Price))
            .attr("r", 5)
            .attr("fill", d => stateColor(d.State))
            .on("mouseover", function(event, d) {
                d3.select(this).attr("fill", "red").raise();
                tooltip.transition().duration(200).style("opacity", 0.9);
                tooltip.html(`<h3>${d.City}, ${d.State}</h3>
                              <b>Price:</b> $${d3.format(",")(d.Price)}<br>
                              <b>Area:</b> ${d3.format(",")(d.Area)} sqft<br>
                              <b>Price/Sqft:</b> $${(d.Price / d.Area).toFixed(2)}<br>
                              <b>Beds:</b> ${d.Bedrooms} | <b>Baths:</b> ${d.Bathrooms}<br>
                              <b>Year Built:</b> ${d.YearBuilt}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("fill", stateColor(d.State));
                tooltip.transition().duration(500).style("opacity", 0);
            });

        function updateScatter(selectedState) {
            circles.transition().duration(300)
                .attr("opacity", d => (selectedState === 'All States' || d.State === selectedState) ? 0.7 : 0.05)
                .attr("r", d => (selectedState === 'All States' || d.State === selectedState) ? 5 : 2);
                
            chart.select(".annotation-group").remove();
            
            const filteredData = selectedState === 'All States' ? propertyTypeData : propertyTypeData.filter(d => d.State === selectedState);
            if (filteredData.length < 1) return;

            const mostExpensive = filteredData.reduce((prev, current) => (prev.Price > current.Price) ? prev : current);
            
            const annotations = [{
                note: { 
                    label: `${d3.format(",")(mostExpensive.Area)} sqft in ${mostExpensive.City}`,
                    title: `Most Expensive: $${d3.format(",.2s")(mostExpensive.Price)}`,
                    wrap: 150
                },
                x: x(mostExpensive.Area),
                y: y(mostExpensive.Price),
                dy: -30,
                dx: mostExpensive.Area > x.domain()[1] / 2 ? -30 : 30
            }];
            
            const makeAnnotations = d3.annotation()
                .type(d3.annotationCallout)
                .annotations(annotations);
                
            chart.append("g")
                .attr("class", "annotation-group")
                .call(makeAnnotations)
                .raise();
        }

        updateScatter('All States');
    }
});