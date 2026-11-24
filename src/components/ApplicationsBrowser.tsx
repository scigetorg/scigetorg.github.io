import { useState, useMemo, useEffect } from "react";
import {
  displayName,
  eessiLaunchCommand,
  eessiLoadCommand,
  groupApps,
  groupEessiApps,
  isArm64Build,
  isEessiArm64Build,
  methodsText,
  type AppsCatalogPayload,
  type DomainBadgeInfo,
  type DomainCatalog,
  type DomainEntry,
  type EessiDomainEntry,
  type GroupedApp,
  type GroupedEessiApp,
} from "../lib/appsCatalog";

const CITATION_GUIDE_URL =
  "https://neurodesk.org/overview/how-to-cite-us/#citing-specific-tools";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ab-detail-row">
      <span className="ab-detail-label">{label}</span>
      <div className="ab-detail-content">{children}</div>
    </div>
  );
}

const CITATION_LINK = /(https?:\/\/[^\s<>"]+|\b10\.\d{4,9}\/[^\s<>"]+)/g;

function linkify(text: string): React.ReactNode[] {
  return text.split(CITATION_LINK).map((part, i) => {
    if (i % 2 === 0) return part;
    const target = part.replace(/[.,;:)\]]+$/, "");
    const trailing = part.slice(target.length);
    const href = target.startsWith("10.") ? `https://doi.org/${target}` : target;
    return (
      <span key={i}>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {target}
        </a>
        {trailing}
      </span>
    );
  });
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const copy = () => {
    if (!navigator.clipboard?.writeText) {
      setStatus("failed");
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2000);
      })
      .catch(() => {
        setStatus("failed");
      });
  };

  return (
    <>
      <button type="button" className="ab-copy-btn" onClick={copy}>
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Copy unavailable"
            : label}
      </button>
      {status === "failed" && (
        <div className="ab-copy-fallback" role="status">
          <span className="ab-muted">
            Clipboard access is blocked. Copy the text below manually:
          </span>
          <textarea
            className="ab-copy-textarea"
            readOnly
            value={text}
            rows={Math.min(6, text.split("\n").length + 1)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </>
  );
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "domain" | "eessi" | "gpu" | "muted";
}) {
  return (
    <span className={`ab-badge${variant ? ` ab-badge--${variant}` : ""}`}>
      {children}
    </span>
  );
}

function EessiAppCard({
  app,
  showCatalogRow,
}: {
  app: GroupedEessiApp;
  showCatalogRow: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latestBuild = app.builds[0];
  const hasMultiple = app.builds.length > 1;
  const licenses = app.builds.find((b) => b.license?.length)?.license ?? [];
  const loadCmd = eessiLoadCommand(latestBuild);
  const launchCmd = eessiLaunchCommand(latestBuild);

  return (
    <div className="ab-card">
      <div className="ab-card-header">
        <div className="ab-card-title-row">
          <h3 className="ab-card-title">{app.name}</h3>
          <Badge variant="eessi">EESSI</Badge>
          {app.hasGpu && <Badge variant="gpu">GPU</Badge>}
          {app.arm64 && <span className="ab-badge ab-badge--arm64">arm64</span>}
          <Badge variant="muted">No DOI</Badge>
        </div>
        <span className="ab-version-count">
          {app.builds.length} build{app.builds.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="ab-card-body">
        {app.description && <p className="ab-card-desc">{app.description}</p>}

        {showCatalogRow && (
          <DetailRow label={app.domains.length > 1 ? "Catalogs" : "Catalog"}>
            <div className="ab-badge-list">
              {app.domains.map((domain) => (
                <Badge key={domain.id} variant="domain">
                  {domain.label}
                </Badge>
              ))}
            </div>
          </DetailRow>
        )}

        <DetailRow label="Categories">
          <div className="ab-badge-list">
            {app.categories.length > 0 ? (
              app.categories.map((cat) => <Badge key={cat}>{cat}</Badge>)
            ) : (
              <span className="ab-muted">N/A</span>
            )}
          </div>
        </DetailRow>

        {licenses.length > 0 && (
          <DetailRow label="License">
            <div className="ab-badge-list">
              {licenses.map((l) => (
                <Badge key={l}>{l}</Badge>
              ))}
            </div>
          </DetailRow>
        )}

        <DetailRow label="Latest Module">
          <div className="ab-version-row">
            <code className="ab-code-inline">{latestBuild.module}</code>
            <span className="ab-muted">(EESSI/{latestBuild.stack})</span>
            {latestBuild.gpu && <Badge variant="gpu">GPU</Badge>}
            {app.homepage && (
              <a
                href={app.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="ab-doi-link"
              >
                Homepage
              </a>
            )}
          </div>
        </DetailRow>

        <DetailRow label="Load via Lmod">
          <div className="ab-eessi-cmd">
            <code className="ab-code-inline">{loadCmd}</code>
            <div className="ab-citation-actions">
              <CopyButton text={loadCmd} label="Copy module load" />
              {launchCmd && (
                <CopyButton text={launchCmd} label="Copy eessi-launch" />
              )}
            </div>
          </div>
        </DetailRow>

        {hasMultiple && (
          <DetailRow label="All Builds">
            <button
              type="button"
              className="ab-expand-btn"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "Show"} {app.builds.length} builds
              <svg
                className={`ab-chevron ${expanded ? "ab-chevron--open" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 12 12"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {expanded && (
              <div className="ab-versions-list">
                {app.builds.map((b) => (
                  <div
                    key={`${b.stack}-${b.module}-${b.exec.join(" ")}`}
                    className="ab-version-row"
                  >
                    <code className="ab-code-inline">{b.module}</code>
                    <span className="ab-muted">(EESSI/{b.stack})</span>
                    {b.gpu && <Badge variant="gpu">GPU</Badge>}
                    <CopyButton text={eessiLoadCommand(b)} label="Copy" />
                  </div>
                ))}
              </div>
            )}
          </DetailRow>
        )}
      </div>
    </div>
  );
}

function AppCard({
  app,
  activeDomainId,
  showCatalogRow,
}: {
  app: GroupedApp;
  activeDomainId: string | null;
  showCatalogRow: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latestVersion = app.versions[0];
  const hasMultiple = app.versions.length > 1;
  const licenses = app.versions.find((v) => v.license?.length)?.license ?? [];

  return (
    <div className="ab-card">
      <div className="ab-card-header">
        <div className="ab-card-title-row">
          <h3 className="ab-card-title">{app.name}</h3>
          {app.openrecon && (
            <span className="ab-badge ab-badge--openrecon">OpenRecon</span>
          )}
          {app.arm64 && <span className="ab-badge ab-badge--arm64">arm64</span>}
        </div>
        <span className="ab-version-count">
          {app.versions.length} version{app.versions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="ab-card-body">
        {app.description && <p className="ab-card-desc">{app.description}</p>}

        {showCatalogRow && (
          <DetailRow label={app.domains.length > 1 ? "Catalogs" : "Catalog"}>
            <div className="ab-badge-list">
              {app.domains.map((domain) => (
                <Badge key={domain.id} variant="domain">
                  {domain.label}
                </Badge>
              ))}
            </div>
          </DetailRow>
        )}

        <DetailRow label="Categories">
          <div className="ab-badge-list">
            {app.categories.length > 0 ? (
              app.categories.map((cat) => <Badge key={cat}>{cat}</Badge>)
            ) : (
              <span className="ab-muted">N/A</span>
            )}
          </div>
        </DetailRow>

        {licenses.length > 0 && (
          <DetailRow label="License">
            <div className="ab-badge-list">
              {licenses.map((l) => (
                <Badge key={l}>{l}</Badge>
              ))}
            </div>
          </DetailRow>
        )}

        <DetailRow label="Latest Version">
          <div className="ab-version-row">
            <span className="ab-version-num">{latestVersion.version}</span>
            <span className="ab-muted">({latestVersion.buildDate})</span>
            {latestVersion.doiUrl && (
              <a
                href={latestVersion.doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ab-doi-link"
              >
                Container DOI
              </a>
            )}
          </div>
        </DetailRow>

        <DetailRow label="Tool citations">
          {app.citation && (
            <div className="ab-citation">{linkify(app.citation)}</div>
          )}
          <div className="ab-citation-actions">
            {app.citation && (
              <CopyButton text={app.citation} label="Copy citation" />
            )}
            <CopyButton
              text={methodsText(app, activeDomainId)}
              label="Copy methods text"
            />
            <a
              href={CITATION_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {app.citation
                ? "Citation guide"
                : `Find the references for ${app.name}`}
            </a>
          </div>
        </DetailRow>

        {hasMultiple && (
          <DetailRow label="All Versions">
            <button
              type="button"
              className="ab-expand-btn"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "Show"} {app.versions.length} versions
              <svg
                className={`ab-chevron ${expanded ? "ab-chevron--open" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 12 12"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {expanded && (
              <div className="ab-versions-list">
                {app.versions.map((v) => (
                  <div
                    key={`${v.version}-${v.buildDate}`}
                    className="ab-version-row"
                  >
                    <span className="ab-version-num">{v.version}</span>
                    <span className="ab-muted">({v.buildDate})</span>
                    {v.doiUrl && (
                      <a
                        href={v.doiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ab-doi-link"
                      >
                        Container DOI
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DetailRow>
        )}
      </div>
    </div>
  );
}

export default function ApplicationsBrowser() {
  const [domains, setDomains] = useState<DomainCatalog[]>([]);
  // `null` represents the aggregate "All domains" view so it can never collide
  // with a domain slug in domains.json.
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  // Containers are always default; EESSI requires explicit selection.
  const [source, setSource] = useState<"containers" | "eessi">("containers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openreconOnly, setOpenreconOnly] = useState(false);
  // arm64 containers are hidden by default; ticking the filter shows only them.
  const [arm64Only, setArm64Only] = useState(false);
  const [gpuOnly, setGpuOnly] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/applist.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AppsCatalogPayload>;
      })
      .then((data) => {
        setDomains(data.domains);
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("domain");
        if (requested && data.domains.some((d) => d.id === requested)) {
          setSelectedDomain(requested);
        }
        if (
          params.get("source") === "eessi" &&
          data.domains.some((d) => (d.eessi?.length ?? 0) > 0)
        ) {
          setSource("eessi");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const updateUrlParams = (
    nextDomain: string | null,
    nextSource: "containers" | "eessi",
  ) => {
    const params = new URLSearchParams(window.location.search);
    if (nextDomain === null) {
      params.delete("domain");
    } else {
      params.set("domain", nextDomain);
    }
    if (nextSource === "containers") {
      params.delete("source");
    } else {
      params.set("source", nextSource);
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    );
  };

  const selectDomain = (domainId: string | null) => {
    setSelectedDomain(domainId);
    updateUrlParams(domainId, source);
  };

  const selectSource = (nextSource: "containers" | "eessi") => {
    setSource(nextSource);
    updateUrlParams(selectedDomain, nextSource);
  };

  const hasEessi = useMemo(
    () => domains.some((d) => (d.eessi?.length ?? 0) > 0),
    [domains],
  );

  const activeDomain = useMemo(
    () =>
      selectedDomain === null
        ? undefined
        : domains.find((d) => d.id === selectedDomain),
    [domains, selectedDomain],
  );

  // Per-domain and combined counts for the active source and architecture.
  const { allDomainCount, domainCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    const allNames = new Set<string>();

    for (const domain of domains) {
      const names = new Set<string>();
      if (source === "eessi") {
        for (const entry of domain.eessi ?? []) {
          if (arm64Only && !isEessiArm64Build(entry)) continue;
          names.add(entry.id);
          allNames.add(entry.id);
        }
      } else {
        for (const entry of domain.list) {
          if (isArm64Build(entry) !== arm64Only) continue;
          const name = displayName(entry.name);
          names.add(name);
          allNames.add(name);
        }
      }
      counts.set(domain.id, names.size);
    }

    return { allDomainCount: allNames.size, domainCounts: counts };
  }, [domains, source, arm64Only]);

  // Apps for the selected domain catalog and architecture: x86 by default, arm64 when ticked.
  const available = useMemo(() => {
    if (source !== "containers") return [];
    const selectedCatalogs =
      selectedDomain === null
        ? domains
        : domains.filter((d) => d.id === selectedDomain);

    const items: DomainEntry[] = [];
    for (const domain of selectedCatalogs) {
      const badge: DomainBadgeInfo = {
        id: domain.id,
        label: domain.label,
        defaultVersion: domain.defaultVersion,
      };
      for (const entry of domain.list) {
        if (isArm64Build(entry) !== arm64Only) continue;
        items.push({ entry, domain: badge });
      }
    }

    return groupApps(items, arm64Only);
  }, [domains, selectedDomain, source, arm64Only]);

  const availableEessi = useMemo(() => {
    if (source !== "eessi") return [];
    const selectedCatalogs =
      selectedDomain === null
        ? domains
        : domains.filter((d) => d.id === selectedDomain);

    const items: EessiDomainEntry[] = [];
    for (const domain of selectedCatalogs) {
      const badge: DomainBadgeInfo = {
        id: domain.id,
        label: domain.label,
        defaultVersion: domain.defaultVersion,
      };
      for (const entry of domain.eessi ?? []) {
        items.push({ entry, domain: badge });
      }
    }

    return groupEessiApps(items, arm64Only);
  }, [domains, selectedDomain, source, arm64Only]);

  const hasOpenrecon = useMemo(
    () => available.some((app) => app.openrecon),
    [available],
  );

  const hasGpuEessi = useMemo(
    () => availableEessi.some((app) => app.hasGpu),
    [availableEessi],
  );

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    const list = source === "eessi" ? availableEessi : available;
    for (const app of list) {
      for (const cat of app.categories) {
        cats.add(cat);
      }
    }
    return Array.from(cats).sort();
  }, [source, available, availableEessi]);

  // Drop selected categories or OpenRecon/GPU filter that the current domain,
  // source or architecture does not offer, so no hidden filter stays active.
  useEffect(() => {
    setSelectedCategories((prev) => {
      const kept = prev.filter((cat) => allCategories.includes(cat));
      return kept.length === prev.length ? prev : kept;
    });
  }, [allCategories]);

  useEffect(() => {
    if (!hasOpenrecon && openreconOnly) {
      setOpenreconOnly(false);
    }
  }, [hasOpenrecon, openreconOnly]);

  useEffect(() => {
    if (!hasGpuEessi && gpuOnly) {
      setGpuOnly(false);
    }
  }, [hasGpuEessi, gpuOnly]);

  const filtered = useMemo(() => {
    return available.filter((app) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          app.name,
          app.description || "",
          ...app.categories,
          ...app.domains.flatMap((d) => [d.id, d.label]),
          ...app.versions.map((v) => v.version),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      if (selectedCategories.length > 0) {
        if (!app.categories.some((c) => selectedCategories.includes(c))) {
          return false;
        }
      }

      if (openreconOnly && !app.openrecon) return false;

      return true;
    });
  }, [available, searchQuery, selectedCategories, openreconOnly]);

  const filteredEessi = useMemo(() => {
    return availableEessi.filter((app) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          app.id,
          app.name,
          app.description || "",
          ...app.categories,
          ...app.domains.flatMap((d) => [d.id, d.label]),
          ...app.builds.flatMap((b) => [b.module, b.version, b.stack]),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      if (selectedCategories.length > 0) {
        if (!app.categories.some((c) => selectedCategories.includes(c))) {
          return false;
        }
      }

      if (gpuOnly && !app.hasGpu) return false;

      return true;
    });
  }, [availableEessi, searchQuery, selectedCategories, gpuOnly]);

  const totalAvailable =
    source === "eessi" ? availableEessi.length : available.length;
  const totalFiltered =
    source === "eessi" ? filteredEessi.length : filtered.length;

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  if (loading) {
    return <div className="ab-status not-content">Loading applications...</div>;
  }

  if (error) {
    return (
      <div className="ab-status ab-status--error not-content">
        Failed to load applications: {error}
      </div>
    );
  }

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCategories.length > 0 ||
    openreconOnly ||
    arm64Only ||
    gpuOnly;

  return (
    <div className="ab-browser not-content">
      {hasEessi && (
        <div
          className="ab-domains"
          role="group"
          aria-labelledby="ab-source-label"
        >
          <div className="ab-domains-header">
            <span className="ab-domains-label" id="ab-source-label">
              Software source
            </span>
            <span className="ab-domains-desc">
              {source === "eessi"
                ? "EESSI tools are EasyBuild Lmod modules served from /cvmfs/software.eessi.io. Unlike containers, EESSI modules are not frozen images and do not have Zenodo DOIs."
                : "Versioned, DOI-backed Apptainer containers (default)."}
            </span>
          </div>
          <div className="ab-domains-options">
            <button
              type="button"
              className={`ab-domain-btn${source === "containers" ? " ab-domain-btn--active" : ""}`}
              aria-pressed={source === "containers"}
              onClick={() => selectSource("containers")}
            >
              <span>Containers (default)</span>
            </button>
            <button
              type="button"
              className={`ab-domain-btn${source === "eessi" ? " ab-domain-btn--active" : ""}`}
              aria-pressed={source === "eessi"}
              onClick={() => selectSource("eessi")}
            >
              <span>EESSI (CVMFS modules)</span>
            </button>
          </div>
        </div>
      )}

      {domains.length > 1 && (
        <div
          className="ab-domains"
          role="group"
          aria-labelledby="ab-domains-label"
        >
          <div className="ab-domains-header">
            <span className="ab-domains-label" id="ab-domains-label">
              Domain catalog
            </span>
            <span className="ab-domains-desc">
              {activeDomain?.description ??
                (source === "eessi"
                  ? "Browse curated EESSI modules across Sciget domain catalogs."
                  : "Browse containerised tools across all Sciget domain catalogs.")}
            </span>
          </div>
          <div className="ab-domains-options">
            <button
              type="button"
              className={`ab-domain-btn${selectedDomain === null ? " ab-domain-btn--active" : ""}`}
              aria-pressed={selectedDomain === null}
              onClick={() => selectDomain(null)}
            >
              <span>All domains</span>
              <span className="ab-domain-count">{allDomainCount}</span>
            </button>
            {domains.map((domain) => (
              <button
                key={domain.id}
                type="button"
                className={`ab-domain-btn${selectedDomain === domain.id ? " ab-domain-btn--active" : ""}`}
                aria-pressed={selectedDomain === domain.id}
                onClick={() => selectDomain(domain.id)}
              >
                <span>{domain.label}</span>
                <span className="ab-domain-count">
                  {(source === "eessi"
                    ? domain.eessiUnavailable
                    : domain.unavailable)
                    ? "!"
                    : (domainCounts.get(domain.id) ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ab-toolbar">
        <div className="ab-search-wrap">
          <svg
            className="ab-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className="ab-search"
            placeholder={
              source === "eessi"
                ? activeDomain
                  ? `Search ${activeDomain.label.toLowerCase()} EESSI modules...`
                  : "Search EESSI modules..."
                : activeDomain
                  ? `Search ${activeDomain.label.toLowerCase()} applications...`
                  : "Search applications..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="ab-result-count">
          {totalFiltered} of {totalAvailable}{" "}
          {source === "eessi" ? "module" : "application"}
          {totalAvailable !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="ab-layout">
        <aside className="ab-sidebar">
          <div className="ab-filter-header">
            <strong>{source === "eessi" ? "Module options" : "Container type"}</strong>
          </div>
          <div className="ab-filter-section">
            {source === "containers" && hasOpenrecon && (
              <label className="ab-filter-item ab-filter-item--tooltip">
                <input
                  type="checkbox"
                  checked={openreconOnly}
                  onChange={() => setOpenreconOnly((v) => !v)}
                />
                <div className="ab-openrecon-badge">
                  <span className="ab-badge ab-badge--openrecon">
                    OpenRecon
                  </span>
                  <span className="tooltip" title="Runs on MRI scanners">
                    &#9432;
                    <span className="tooltiptext">Runs on MRI scanners</span>
                  </span>
                </div>
              </label>
            )}
            {source === "eessi" && hasGpuEessi && (
              <label className="ab-filter-item ab-filter-item--tooltip">
                <input
                  type="checkbox"
                  checked={gpuOnly}
                  onChange={() => setGpuOnly((v) => !v)}
                />
                <div className="ab-openrecon-badge">
                  <span className="ab-badge ab-badge--gpu">GPU</span>
                  <span
                    className="tooltip"
                    title="Show only EESSI modules with CUDA GPU builds"
                  >
                    &#9432;
                    <span className="tooltiptext">
                      Show only EESSI modules with CUDA GPU builds
                    </span>
                  </span>
                </div>
              </label>
            )}
            <label className="ab-filter-item ab-filter-item--tooltip">
              <input
                type="checkbox"
                checked={arm64Only}
                onChange={() => setArm64Only((v) => !v)}
              />
              <div className="ab-openrecon-badge">
                <span className="ab-badge ab-badge--arm64">arm64</span>
                <span
                  className="tooltip"
                  title={
                    source === "eessi"
                      ? "Show only EESSI modules built for aarch64"
                      : "Show only containers built for ARM processors (e.g. Apple Silicon)"
                  }
                >
                  &#9432;
                  <span className="tooltiptext">
                    {source === "eessi"
                      ? "Show only EESSI modules built for aarch64"
                      : "Show only containers built for ARM processors (e.g. Apple Silicon)"}
                  </span>
                </span>
              </div>
            </label>
          </div>
          <div className="ab-filter-header">
            <strong>Categories</strong>
            {selectedCategories.length > 0 && (
              <button
                type="button"
                className="ab-clear-btn"
                onClick={() => setSelectedCategories([])}
              >
                Clear
              </button>
            )}
          </div>
          <div className="ab-filter-list">
            {allCategories.length > 0 ? (
              allCategories.map((cat) => (
                <label key={cat} className="ab-filter-item">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span>{cat}</span>
                </label>
              ))
            ) : (
              <span className="ab-muted">No categories available</span>
            )}
          </div>
        </aside>
        <div className="ab-grid">
          <div className="ab-grid-toolbar">
            <h3 className="ab-grid-toolbar-count">
              {totalFiltered} Tool{totalFiltered !== 1 ? "s" : ""}
            </h3>
            <a href="/contribute/" className="add-tool-button">
              Contribute a tool
            </a>
          </div>
          {source === "eessi"
            ? filteredEessi.map((app) => (
                <EessiAppCard
                  key={app.id}
                  app={app}
                  showCatalogRow={domains.length > 1}
                />
              ))
            : filtered.map((app) => (
                <AppCard
                  key={app.name}
                  app={app}
                  activeDomainId={selectedDomain}
                  showCatalogRow={domains.length > 1}
                />
              ))}
          {totalFiltered === 0 && (
            <div className="ab-empty">
              <p>
                {(source === "eessi"
                  ? activeDomain?.eessiUnavailable
                  : activeDomain?.unavailable)
                  ? `The ${activeDomain?.label} ${source === "eessi" ? "EESSI " : ""}catalog was unavailable during the latest site build.`
                  : activeDomain && totalAvailable === 0 && !hasActiveFilters
                    ? `No ${source === "eessi" ? "EESSI modules" : "applications"} are listed in the ${activeDomain.label} catalog yet.`
                    : `No ${source === "eessi" ? "EESSI modules" : "applications"} match your criteria.`}
              </p>
              <div className="ab-empty-actions">
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="ab-clear-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategories([]);
                      setOpenreconOnly(false);
                      setArm64Only(false);
                      setGpuOnly(false);
                    }}
                  >
                    Clear filters
                  </button>
                )}
                {selectedDomain !== null && (
                  <button
                    type="button"
                    className="ab-clear-btn"
                    onClick={() => selectDomain(null)}
                  >
                    Show all domains
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
