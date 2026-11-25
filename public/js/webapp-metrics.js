// Renders SCIGET Webapps GA4 usage metrics across domain catalogues from
// /data/webapp-metrics.json (and enriches with all-time user counts if
// /data/user-metrics.json contains live GA4 webapp segments).
(function () {
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

  function renderStatus(block, message) {
    block.textContent = "";
    var status = document.createElement("span");
    status.className = "user-metrics__status";
    status.textContent = message;
    block.append(status);
  }

  function addMetric(container, value, label) {
    var metric = document.createElement("span");
    metric.className = "user-metrics__metric";
    var num = document.createElement("strong");
    num.textContent = value;
    var text = document.createElement("span");
    text.textContent = label;
    metric.append(num, text);
    container.append(metric);
  }

  function buildAllTimeLookup(userMetrics) {
    var lookup = new Map();
    if (!userMetrics || userMetrics.unavailable || !Array.isArray(userMetrics.segments)) {
      return lookup;
    }
    userMetrics.segments.forEach(function (segment) {
      if (!segment || typeof segment.url !== "string") return;
      lookup.set(segment.url.replace(/\/+$/, ""), segment);
    });
    return lookup;
  }

  function renderCatalogPanel(panel, catalog, allTimeLookup) {
    panel.textContent = "";

    if (!catalog || catalog.unavailable || !Array.isArray(catalog.apps) || !catalog.apps.length) {
      var status = document.createElement("span");
      status.className = "user-metrics__status";
      status.textContent = "Usage statistics for this catalogue are not available in this build.";
      panel.append(status);
      return;
    }

    var periodDays = catalog.periodDays || 30;
    var hasAllTime = catalog.apps.some(function (app) {
      return allTimeLookup.has(app.url.replace(/\/+$/, ""));
    });

    var summary = document.createElement("div");
    summary.className = "uptime-metrics__summary";
    addMetric(summary, formatNumber(catalog.totals.users), "users (" + periodDays + " days)");
    addMetric(summary, formatNumber(catalog.totals.pageViews), "page views (" + periodDays + " days)");
    addMetric(summary, formatNumber(catalog.apps.length), "hosted webapps");
    panel.append(summary);

    var meta = document.createElement("p");
    meta.className = "user-metrics__details";
    var hostLink = document.createElement("a");
    hostLink.href = catalog.url;
    hostLink.target = "_blank";
    hostLink.rel = "noopener noreferrer";
    hostLink.textContent = catalog.host;
    meta.append(
      document.createTextNode("Catalogue: "),
      hostLink,
      document.createTextNode(" · Source: " + (catalog.source || "Google Analytics 4") + " · last " + periodDays + " days")
    );
    var updated = formatDate(catalog.generatedAt);
    if (updated) {
      meta.append(document.createTextNode(" · updated " + updated));
    }
    panel.append(meta);

    var wrapper = document.createElement("div");
    wrapper.className = "user-metrics__table-wrapper";

    var table = document.createElement("table");
    table.className = "user-metrics__table td-initial";

    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    var columns = hasAllTime
      ? ["Webapp", "Users to date", "Users (" + periodDays + " days)", "Page views (" + periodDays + " days)"]
      : ["Webapp", "Users (" + periodDays + " days)", "Page views (" + periodDays + " days)"];
    columns.forEach(function (text, index) {
      var th = document.createElement("th");
      th.textContent = text;
      th.scope = "col";
      if (index > 0) {
        th.className = "user-metrics__num";
      }
      headRow.append(th);
    });
    head.append(headRow);
    table.append(head);

    var body = document.createElement("tbody");
    catalog.apps.forEach(function (app) {
      var row = document.createElement("tr");

      var nameCell = document.createElement("th");
      nameCell.scope = "row";
      var link = document.createElement("a");
      link.href = app.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = app.title;
      nameCell.append(link);
      row.append(nameCell);

      if (hasAllTime) {
        var seg = allTimeLookup.get(app.url.replace(/\/+$/, ""));
        var totalCell = document.createElement("td");
        totalCell.className = "user-metrics__num";
        totalCell.textContent = seg ? formatNumber(seg.totalUsers) : "—";
        row.append(totalCell);
      }

      var usersCell = document.createElement("td");
      usersCell.className = "user-metrics__num";
      usersCell.textContent = formatNumber(app.users);
      row.append(usersCell);

      var viewsCell = document.createElement("td");
      viewsCell.className = "user-metrics__num";
      viewsCell.textContent = formatNumber(app.pageViews);
      row.append(viewsCell);

      body.append(row);
    });
    table.append(body);
    wrapper.append(table);
    panel.append(wrapper);
  }

  function render(block, data, allTimeLookup) {
    var catalogs = Array.isArray(data.catalogs) ? data.catalogs : [];
    var available = catalogs.filter(function (c) { return !c.unavailable; });
    if (!available.length) {
      renderStatus(block, "Webapp usage statistics are not available in this build.");
      return;
    }

    block.textContent = "";

    var activeId = available[0].id;
    var tabs = document.createElement("div");
    tabs.className = "webapp-metrics__tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Webapp catalogues");

    var panel = document.createElement("div");
    panel.className = "webapp-metrics__panel";
    panel.setAttribute("role", "tabpanel");

    var buttons = [];
    catalogs.forEach(function (catalog) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ab-domain-btn" + (catalog.id === activeId ? " ab-domain-btn--active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", catalog.id === activeId ? "true" : "false");
      btn.dataset.catalogId = catalog.id;

      var label = document.createElement("span");
      label.textContent = catalog.label;
      btn.append(label);

      if (!catalog.unavailable) {
        var count = document.createElement("span");
        count.className = "ab-domain-count";
        count.textContent = formatNumber(catalog.totals.users);
        btn.append(count);
      }

      btn.addEventListener("click", function () {
        activeId = catalog.id;
        buttons.forEach(function (other) {
          var isSelected = other.dataset.catalogId === activeId;
          other.classList.toggle("ab-domain-btn--active", isSelected);
          other.setAttribute("aria-selected", isSelected ? "true" : "false");
        });
        renderCatalogPanel(panel, catalog, allTimeLookup);
      });

      buttons.push(btn);
      tabs.append(btn);
    });

    block.append(tabs, panel);
    renderCatalogPanel(panel, available[0], allTimeLookup);
  }

  var blocks = document.querySelectorAll("[data-webapp-metrics-url]");
  if (!blocks.length) return;

  var primaryUrl = blocks[0].dataset.webappMetricsUrl;
  var userMetricsUrl = blocks[0].dataset.userMetricsUrl || "";

  var primaryPromise = fetch(primaryUrl, { credentials: "same-origin" }).then(function (response) {
    if (!response.ok) throw new Error("Webapp metrics request failed: " + response.status);
    return response.json();
  });

  var userMetricsPromise = userMetricsUrl
    ? fetch(userMetricsUrl, { credentials: "same-origin" })
        .then(function (response) { return response.ok ? response.json() : null; })
        .catch(function () { return null; })
    : Promise.resolve(null);

  Promise.all([primaryPromise, userMetricsPromise])
    .then(function (results) {
      var data = results[0];
      var allTimeLookup = buildAllTimeLookup(results[1]);
      blocks.forEach(function (block) {
        render(block, data, allTimeLookup);
      });
    })
    .catch(function () {
      blocks.forEach(function (block) {
        renderStatus(block, "Webapp usage statistics could not be loaded.");
      });
    });
}());
