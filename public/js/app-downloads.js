// Interactive SVG chart and release breakdown for Sciget App / Neurodesk App
// downloads from GitHub Releases (scigetorg/neurodesk-app).
(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SERIES = [
    { key: "windows", label: "Windows", color: "#3b82f6" },
    { key: "linux", label: "Linux", color: "#e6833a" },
    { key: "macos", label: "macOS", color: "#22c55e" }
  ];

  function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }

  function formatShortDate(value) {
    return String(value || "").slice(0, 10);
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function classifyAsset(name) {
    if (/windows.*\.exe$/i.test(name)) return "windows";
    if (/(debian|fedora).*\.(deb|rpm)$/i.test(name)) return "linux";
    if (/macos.*\.(dmg|zip)$/i.test(name)) return "macos";
    return null;
  }

  function summarizeRawReleases(rawReleases, repo) {
    var releases = [];
    (Array.isArray(rawReleases) ? rawReleases : []).forEach(function (release) {
      if (!release || release.draft || !release.published_at || !release.tag_name) return;
      var counts = { windows: 0, linux: 0, macos: 0 };
      (Array.isArray(release.assets) ? release.assets : []).forEach(function (asset) {
        var platform = classifyAsset(String(asset.name || ""));
        if (platform) {
          counts[platform] += Number(asset.download_count || 0);
        }
      });
      releases.push({
        tag: release.tag_name,
        publishedAt: release.published_at,
        windows: counts.windows,
        linux: counts.linux,
        macos: counts.macos,
        total: counts.windows + counts.linux + counts.macos
      });
    });
    releases.sort(function (a, b) {
      return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
    });
    var totals = releases.reduce(function (acc, r) {
      acc.windows += r.windows;
      acc.linux += r.linux;
      acc.macos += r.macos;
      acc.all += r.total;
      return acc;
    }, { windows: 0, linux: 0, macos: 0, all: 0 });
    return {
      generatedAt: new Date().toISOString(),
      repo: repo,
      repoUrl: "https://github.com/" + repo,
      unavailable: releases.length === 0,
      totals: totals,
      releases: releases
    };
  }

  // Symlog transform matching neurodesk's chart: linear on [0, 1], log10 above 1.
  function symlog(value) {
    var v = Math.max(0, Number(value || 0));
    if (v <= 1) return v * 0.6;
    return 0.6 + Math.log10(v);
  }

  function renderStatus(block, message) {
    block.textContent = "";
    var status = document.createElement("span");
    status.className = "user-metrics__status";
    status.textContent = message;
    block.append(status);
  }

  function addMetric(container, value, label, accentColor) {
    var metric = document.createElement("span");
    metric.className = "user-metrics__metric";
    var num = document.createElement("strong");
    num.textContent = value;
    var text = document.createElement("span");
    if (accentColor) {
      var dot = document.createElement("span");
      dot.className = "app-downloads__swatch";
      dot.style.background = accentColor;
      text.append(dot, document.createTextNode(label));
    } else {
      text.textContent = label;
    }
    metric.append(num, text);
    container.append(metric);
  }

  function renderChart(releases) {
    var width = 760;
    var height = 340;
    var margin = { top: 24, right: 24, bottom: 52, left: 56 };
    var plotWidth = width - margin.left - margin.right;
    var plotHeight = height - margin.top - margin.bottom;

    var maxValue = 10;
    releases.forEach(function (r) {
      maxValue = Math.max(maxValue, r.windows, r.linux, r.macos);
    });

    var yTicks = [0, 1, 10, 100, 1000, 10000, 100000].filter(function (t, i, arr) {
      if (t <= 10) return true;
      return t <= maxValue * 2 && (i === 0 || arr[i - 1] < maxValue);
    });
    var yMaxVal = yTicks[yTicks.length - 1];
    var yMaxTrans = symlog(yMaxVal);

    function x(index) {
      return releases.length > 1
        ? margin.left + (plotWidth * index) / (releases.length - 1)
        : margin.left + plotWidth / 2;
    }

    function y(value) {
      return margin.top + plotHeight - (plotHeight * symlog(value)) / (yMaxTrans || 1);
    }

    var figure = document.createElement("figure");
    figure.className = "user-metrics__chart app-downloads__chart";
    figure.setAttribute("tabindex", "0");
    figure.setAttribute(
      "aria-label",
      "Sciget App downloads per release by operating system (Windows, Linux, macOS) across " +
        releases.length + " releases. Release values are listed in the table below."
    );

    var svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-hidden": "true"
    });

    // Horizontal gridlines & ticks
    yTicks.forEach(function (tickVal) {
      var py = y(tickVal);
      svg.append(svgEl("line", {
        x1: margin.left,
        x2: width - margin.right,
        y1: py,
        y2: py,
        class: tickVal === 0 ? "user-metrics__baseline" : "user-metrics__gridline"
      }));
      var label = svgEl("text", {
        x: margin.left - 8,
        y: py + 4,
        "text-anchor": "end",
        class: "user-metrics__tick"
      });
      label.textContent = formatNumber(tickVal);
      svg.append(label);
    });

    // X ticks (spaced cleanly so labels never overlap)
    var stride = Math.max(1, Math.ceil(releases.length / 8));
    releases.forEach(function (release, index) {
      if (index % stride !== 0 && index !== releases.length - 1) {
        return;
      }
      if (index !== releases.length - 1 && releases.length - 1 - index < Math.ceil(stride / 2)) {
        return;
      }
      var px = x(index);
      var tagLabel = svgEl("text", {
        x: px,
        y: height - margin.bottom + 20,
        "text-anchor": "middle",
        class: "user-metrics__tick"
      });
      tagLabel.textContent = release.tag;
      svg.append(tagLabel);

      var dateLabel = svgEl("text", {
        x: px,
        y: height - margin.bottom + 35,
        "text-anchor": "middle",
        class: "user-metrics__tick app-downloads__subtick"
      });
      dateLabel.textContent = formatShortDate(release.publishedAt).slice(0, 7);
      svg.append(dateLabel);
    });

    // Series lines and dots
    var hoverDots = {};
    SERIES.forEach(function (series) {
      var points = releases.map(function (r, idx) {
        return x(idx) + " " + y(r[series.key]);
      });
      if (points.length > 1) {
        svg.append(svgEl("path", {
          d: "M " + points.join(" L "),
          fill: "none",
          stroke: series.color,
          "stroke-width": "2.2",
          "stroke-linejoin": "round",
          "stroke-linecap": "round"
        }));
      }
      releases.forEach(function (r, idx) {
        svg.append(svgEl("circle", {
          cx: x(idx),
          cy: y(r[series.key]),
          r: 2.8,
          fill: series.color,
          stroke: "var(--um-surface)",
          "stroke-width": "1"
        }));
      });
    });

    // Crosshair & active dots
    var crosshair = svgEl("line", {
      y1: margin.top,
      y2: height - margin.bottom,
      class: "user-metrics__crosshair"
    });
    crosshair.style.display = "none";
    svg.append(crosshair);

    SERIES.forEach(function (series) {
      var dot = svgEl("circle", {
        r: 5,
        fill: series.color,
        stroke: "var(--um-surface)",
        "stroke-width": "2"
      });
      dot.style.display = "none";
      dot.style.pointerEvents = "none";
      svg.append(dot);
      hoverDots[series.key] = dot;
    });

    figure.append(svg);

    // Legend below SVG
    var legend = document.createElement("div");
    legend.className = "user-metrics__legend";
    SERIES.forEach(function (series) {
      var item = document.createElement("span");
      item.className = "user-metrics__legend-item";
      var swatch = document.createElement("span");
      swatch.className = "user-metrics__legend-swatch";
      swatch.style.background = series.color;
      var text = document.createElement("span");
      text.textContent = series.label;
      item.append(swatch, text);
      legend.append(item);
    });
    var scaleNote = document.createElement("span");
    scaleNote.className = "app-downloads__scale-note";
    scaleNote.textContent = "Log scale (y-axis)";
    legend.append(scaleNote);
    figure.append(legend);

    // Tooltip
    var tooltip = document.createElement("div");
    tooltip.className = "user-metrics__tooltip";
    tooltip.style.display = "none";
    var tooltipTitle = document.createElement("div");
    tooltipTitle.className = "user-metrics__tooltip-title";
    tooltip.append(tooltipTitle);

    var valueNodes = {};
    SERIES.forEach(function (series) {
      var row = document.createElement("div");
      row.className = "user-metrics__tooltip-row";
      var key = document.createElement("span");
      key.className = "user-metrics__tooltip-key";
      key.style.borderTopColor = series.color;
      var val = document.createElement("strong");
      var lbl = document.createElement("span");
      lbl.textContent = series.label;
      row.append(key, val, lbl);
      tooltip.append(row);
      valueNodes[series.key] = val;
    });
    figure.append(tooltip);

    var lastIndex = releases.length - 1;
    var focusIndex = lastIndex;

    function showIndex(index) {
      var release = releases[index];
      var px = x(index);
      crosshair.setAttribute("x1", px);
      crosshair.setAttribute("x2", px);
      crosshair.style.display = "";

      SERIES.forEach(function (series) {
        hoverDots[series.key].setAttribute("cx", px);
        hoverDots[series.key].setAttribute("cy", y(release[series.key]));
        hoverDots[series.key].style.display = "";
        valueNodes[series.key].textContent = formatNumber(release[series.key]);
      });

      tooltipTitle.textContent = release.tag + " · " + formatShortDate(release.publishedAt);
      tooltip.style.display = "";

      var rect = figure.getBoundingClientRect();
      var scale = rect.width / width;
      var left = px * scale + 12;
      if (left + tooltip.offsetWidth + 8 > rect.width) {
        left = px * scale - tooltip.offsetWidth - 12;
      }
      tooltip.style.left = Math.max(0, left) + "px";
      tooltip.style.top = "16px";
    }

    function hide() {
      crosshair.style.display = "none";
      SERIES.forEach(function (series) {
        hoverDots[series.key].style.display = "none";
      });
      tooltip.style.display = "none";
    }

    svg.addEventListener("pointermove", function (event) {
      var rect = svg.getBoundingClientRect();
      var px = ((event.clientX - rect.left) / rect.width) * width;
      var ratio = (px - margin.left) / (plotWidth || 1);
      var index = Math.round(ratio * (releases.length - 1));
      focusIndex = Math.min(releases.length - 1, Math.max(0, index));
      showIndex(focusIndex);
    });
    svg.addEventListener("pointerleave", hide);
    figure.addEventListener("focus", function () {
      showIndex(focusIndex);
    });
    figure.addEventListener("blur", hide);
    figure.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        focusIndex = event.key === "ArrowLeft"
          ? Math.max(0, focusIndex - 1)
          : Math.min(releases.length - 1, focusIndex + 1);
        showIndex(focusIndex);
      }
    });

    return figure;
  }

  function renderTable(releases) {
    var details = document.createElement("details");
    var summary = document.createElement("summary");
    summary.textContent = "Downloads per release (table)";
    details.append(summary);

    var wrapper = document.createElement("div");
    wrapper.className = "user-metrics__table-wrapper";

    var table = document.createElement("table");
    table.className = "user-metrics__table td-initial";

    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    ["Release", "Published", "Windows", "Linux", "macOS", "Total"].forEach(function (text, index) {
      var th = document.createElement("th");
      th.textContent = text;
      th.scope = "col";
      if (index >= 2) {
        th.className = "user-metrics__num";
      }
      headRow.append(th);
    });
    head.append(headRow);
    table.append(head);

    var body = document.createElement("tbody");
    releases.slice().reverse().forEach(function (r) {
      var row = document.createElement("tr");
      var tagCell = document.createElement("th");
      tagCell.scope = "row";
      tagCell.textContent = r.tag;
      row.append(tagCell);

      var dateCell = document.createElement("td");
      dateCell.textContent = formatShortDate(r.publishedAt);
      row.append(dateCell);

      [r.windows, r.linux, r.macos, r.total].forEach(function (val) {
        var td = document.createElement("td");
        td.className = "user-metrics__num";
        td.textContent = formatNumber(val);
        row.append(td);
      });
      body.append(row);
    });
    table.append(body);
    wrapper.append(table);
    details.append(wrapper);
    return details;
  }

  function render(block, data) {
    if (!data || data.unavailable || !Array.isArray(data.releases) || !data.releases.length) {
      renderStatus(block, "App download metrics are not available right now.");
      return;
    }

    block.textContent = "";

    var summary = document.createElement("div");
    summary.className = "uptime-metrics__summary";
    addMetric(summary, formatNumber(data.totals.all), "platform downloads");
    addMetric(summary, formatNumber(data.releases.length), "published releases");
    addMetric(summary, formatNumber(data.totals.macos), "macOS (DMG + ZIP)", "#22c55e");
    addMetric(summary, formatNumber(data.totals.windows), "Windows (EXE)", "#3b82f6");
    addMetric(summary, formatNumber(data.totals.linux), "Linux (DEB + RPM)", "#e6833a");
    block.append(summary);

    var details = document.createElement("p");
    details.className = "user-metrics__details";
    details.textContent = "Source: GitHub Releases (" + (data.repo || "scigetorg/neurodesk-app") +
      ") · metadata assets excluded";
    var updated = formatDate(data.generatedAt);
    if (updated) {
      details.textContent += " · updated " + updated;
    }
    block.append(details);

    block.append(renderChart(data.releases), renderTable(data.releases));
  }

  var blocks = document.querySelectorAll("[data-app-downloads-url]");
  if (!blocks.length) return;

  var primaryUrl = blocks[0].dataset.appDownloadsUrl;
  var fallbackRepo = blocks[0].dataset.appDownloadsRepo || "scigetorg/neurodesk-app";
  var fallbackApiUrl = "https://api.github.com/repos/" + fallbackRepo + "/releases?per_page=100";

  fetch(primaryUrl, { credentials: "same-origin" })
    .then(function (response) {
      if (!response.ok) throw new Error("App downloads request failed: " + response.status);
      return response.json();
    })
    .then(function (data) {
      if (data && !data.unavailable && Array.isArray(data.releases) && data.releases.length) {
        blocks.forEach(function (block) {
          render(block, data);
        });
        return;
      }
      return fetch(fallbackApiUrl, {
        credentials: "omit",
        headers: { Accept: "application/vnd.github+json" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error("GitHub API returned " + res.status);
          return res.json();
        })
        .then(function (rawReleases) {
          var liveData = summarizeRawReleases(rawReleases, fallbackRepo);
          blocks.forEach(function (block) {
            render(block, liveData);
          });
        });
    })
    .catch(function () {
      blocks.forEach(function (block) {
        renderStatus(block, "App download metrics could not be loaded.");
      });
    });
}());
