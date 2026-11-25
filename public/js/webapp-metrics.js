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

  function safeWebappUrl(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      var parsed = new URL(raw.trim());
      if (parsed.protocol !== "https:") return null;
      var host = parsed.hostname.toLowerCase();
      var allowed =
        host === "sciget.org" ||
        host.endsWith(".sciget.org") ||
        host === "webapps.neurodesk.org";
      return allowed ? parsed.href : null;
    } catch (e) {
      return null;
    }
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
    var safeCatalogHref = safeWebappUrl(catalog.url);
    if (safeCatalogHref) {
      var hostLink = document.createElement("a");
      hostLink.href = safeCatalogHref;
      hostLink.target = "_blank";
      hostLink.rel = "noopener noreferrer";
      hostLink.textContent = catalog.host;
      meta.append(document.createTextNode("Catalogue: "), hostLink);
    } else {
      meta.append(document.createTextNode("Catalogue: " + catalog.host));
    }
    meta.append(
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
      var safeAppHref = safeWebappUrl(app.url);
      if (safeAppHref) {
        var link = document.createElement("a");
        link.href = safeAppHref;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = app.title;
        nameCell.append(link);
      } else {
        nameCell.textContent = app.title;
      }
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

  function render(block, data, allTimeLookup, blockIndex) {
    var catalogs = Array.isArray(data.catalogs) ? data.catalogs : [];
    var available = catalogs.filter(function (c) { return !c.unavailable; });
    if (!available.length) {
      renderStatus(block, "Webapp usage statistics are not available in this build.");
      return;
    }

    block.textContent = "";

    var activeId = available[0].id;
    var panelId = "webapp-metrics-panel-" + blockIndex;
    var tabs = document.createElement("div");
    tabs.className = "webapp-metrics__tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Webapp catalogues");

    var panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "webapp-metrics__panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("tabindex", "0");

    var buttons = [];

    function activateCatalog(index, focusTab) {
      var catalog = catalogs[index];
      if (!catalog) return;
      activeId = catalog.id;
      buttons.forEach(function (other, otherIndex) {
        var isSelected = otherIndex === index;
        other.classList.toggle("ab-domain-btn--active", isSelected);
        other.setAttribute("aria-selected", isSelected ? "true" : "false");
        other.setAttribute("tabindex", isSelected ? "0" : "-1");
      });
      panel.setAttribute("aria-labelledby", buttons[index].id);
      renderCatalogPanel(panel, catalog, allTimeLookup);
      if (focusTab) {
        buttons[index].focus();
      }
    }

    catalogs.forEach(function (catalog, index) {
      var isInitial = catalog.id === activeId;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "webapp-metrics-tab-" + blockIndex + "-" + catalog.id;
      btn.className = "ab-domain-btn" + (isInitial ? " ab-domain-btn--active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isInitial ? "true" : "false");
      btn.setAttribute("aria-controls", panelId);
      btn.setAttribute("tabindex", isInitial ? "0" : "-1");
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
        activateCatalog(index, false);
      });

      btn.addEventListener("keydown", function (event) {
        var nextIndex = null;
        if (event.key === "ArrowRight") {
          nextIndex = (index + 1) % catalogs.length;
        } else if (event.key === "ArrowLeft") {
          nextIndex = (index - 1 + catalogs.length) % catalogs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = catalogs.length - 1;
        }
        if (nextIndex !== null) {
          event.preventDefault();
          activateCatalog(nextIndex, true);
        }
      });

      buttons.push(btn);
      tabs.append(btn);
    });

    block.append(tabs, panel);
    var initialIndex = catalogs.findIndex(function (c) { return c.id === activeId; });
    activateCatalog(initialIndex >= 0 ? initialIndex : 0, false);
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
      blocks.forEach(function (block, blockIndex) {
        render(block, data, allTimeLookup, blockIndex);
      });
    })
    .catch(function () {
      blocks.forEach(function (block) {
        renderStatus(block, "Webapp usage statistics could not be loaded.");
      });
    });
}());
