// ============================================================
// HyLauncher — Mods / Textures / Shaders catalog
// ============================================================

import type { ReactNode } from "react";
import { FaCheck, FaDownload, FaSearch } from "react-icons/fa";
import { ModIcon } from "./ModIcon";
import { ProgressBar } from "./ProgressBar";
import { ViewModeToggle, type CatalogViewMode } from "./ViewModeToggle";
import type { ModEntry, OptionalPackEntry, ProgressEvent, UpdateDiff } from "../lib/types";

interface CatalogTabsProps {
  activeTab: "mods" | "textures" | "shaders";
  catalogView: CatalogViewMode;
  onViewChange: (mode: CatalogViewMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatSize: (bytes: number) => string;
  // mods
  filteredMods: ModEntry[];
  modIcons: Record<string, string>;
  isModInstalled: (id: string) => boolean;
  updateDiff: UpdateDiff | null;
  isUpdating: boolean;
  progress: ProgressEvent | null;
  progressLabel: string;
  progressPercent: number;
  onInstallMods: () => void;
  // textures
  filteredResourcePacks: OptionalPackEntry[];
  textureIcons: Record<string, string>;
  installedTextures: Record<string, boolean>;
  // shaders
  filteredShaderPacks: OptionalPackEntry[];
  shaderIcons: Record<string, string>;
  installedShaders: Record<string, boolean>;
  optionalInstalling: Record<string, boolean>;
  onToggleOptional: (id: string, type: "resourcepack" | "shaderpack") => void;
}

export function CatalogTabs(props: CatalogTabsProps) {
  const {
    activeTab,
    catalogView,
    onViewChange,
    searchQuery,
    onSearchChange,
    t,
    formatSize,
    filteredMods,
    modIcons,
    isModInstalled,
    updateDiff,
    isUpdating,
    progress,
    progressLabel,
    progressPercent,
    onInstallMods,
    filteredResourcePacks,
    textureIcons,
    installedTextures,
    filteredShaderPacks,
    shaderIcons,
    installedShaders,
    optionalInstalling,
    onToggleOptional,
  } = props;

  const viewToggle = (
    <ViewModeToggle
      value={catalogView}
      onChange={onViewChange}
      listLabel={t("view.list")}
      gridLabel={t("view.grid")}
    />
  );

  if (activeTab === "mods") {
    return (
      <div className="mods-tab-content">
        <div className="mods-action-bar">
          <div className="mods-search-container" style={{ flex: 1 }}>
            <FaSearch size={14} className="mods-search-icon" />
            <input
              type="text"
              placeholder={t("mods.search")}
              className="mods-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          {viewToggle}
          {updateDiff && updateDiff.modsToDownload.length > 0 ? (
            <button
              className="btn btn--primary btn--bar"
              onClick={onInstallMods}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <span className="spinner" />
                  <span>{t("mods.installing", { percent: progressPercent })}</span>
                </>
              ) : (
                <>
                  <FaDownload size={14} />
                  <span>
                    {t("mods.installCount", { count: updateDiff.modsToDownload.length })}
                  </span>
                </>
              )}
            </button>
          ) : (
            <div className="btn btn--status btn--bar">
              <FaCheck size={14} />
              <span>{t("mods.upToDate")}</span>
            </div>
          )}
        </div>

        {isUpdating && progress && (
          <div className="mods-inline-progress">
            <ProgressBar progress={progress} label={progressLabel} percent={progressPercent} />
          </div>
        )}

        {filteredMods.length > 0 ? (
          catalogView === "grid" ? (
            <div className="mods-list-container">
              <div className="mods-list-scroll">
                <div className="pack-grid">
                  {filteredMods.map((mod) => {
                    const title = mod.id
                      .split("-")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ");
                    const installed = isModInstalled(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className={`pack-card ${installed ? "pack-card--ok" : "pack-card--missing"}`}
                      >
                        <div className="pack-card-icon">
                          <ModIcon modId={mod.id} iconUrl={modIcons[mod.id]} size={64} />
                        </div>
                        <strong className="pack-card-title" title={title}>
                          {title}
                        </strong>
                        <span className="pack-card-meta">{formatSize(mod.size)}</span>
                        <span
                          className={`pack-card-status ${
                            installed ? "pack-card-status--ok" : "pack-card-status--miss"
                          }`}
                        >
                          {installed ? "✓" : "✕"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mods-list-container">
              <div className="mods-list-scroll">
                <table className="mods-table" style={{ tableLayout: "fixed", width: "100%" }}>
                  <colgroup>
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "38%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>{t("mods.col.mod")}</th>
                      <th>{t("mods.col.file")}</th>
                      <th>{t("mods.col.size")}</th>
                      <th>{t("mods.col.type")}</th>
                      <th>{t("mods.col.side")}</th>
                      <th style={{ textAlign: "right" }}>{t("mods.col.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMods.map((mod) => (
                      <tr key={mod.id}>
                        <td>
                          <div className="mod-row-info">
                            <ModIcon modId={mod.id} iconUrl={modIcons[mod.id]} />
                            <div className="mod-row-name-container">
                              <span className="mod-row-name" title={mod.id}>
                                {mod.id
                                  .split("-")
                                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                  .join(" ")}
                              </span>
                              <span className="mod-row-id">{mod.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mod-row-filename" title={mod.filename}>
                            {mod.filename}
                          </span>
                        </td>
                        <td>
                          <span className="mod-size">{formatSize(mod.size)}</span>
                        </td>
                        <td>
                          <span
                            className={`mod-badge ${
                              mod.required ? "mod-badge--required" : "mod-badge--optional"
                            }`}
                          >
                            {mod.required ? t("mods.required") : t("mods.optional")}
                          </span>
                        </td>
                        <td>
                          <span className="mod-badge mod-badge--side">{mod.side}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {isModInstalled(mod.id) ? (
                            <span className="mod-status-ok">✓</span>
                          ) : (
                            <span className="mod-status-miss">✕</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="catalog-empty">
            <FaSearch size={32} />
            <span>{t("mods.empty")}</span>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === "textures") {
    return (
      <OptionalPackCatalog
        searchPlaceholder={t("textures.search")}
        emptyLabel={t("textures.empty")}
        nameCol={t("textures.col.name")}
        fileCol={t("mods.col.file")}
        sizeCol={t("mods.col.size")}
        actionCol={t("textures.col.action")}
        packs={filteredResourcePacks}
        icons={textureIcons}
        installed={installedTextures}
        installing={optionalInstalling}
        catalogView={catalogView}
        viewToggle={viewToggle}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        formatSize={formatSize}
        t={t}
        onToggle={(id) => onToggleOptional(id, "resourcepack")}
      />
    );
  }

  return (
    <OptionalPackCatalog
      searchPlaceholder={t("shaders.search")}
      emptyLabel={t("shaders.empty")}
      nameCol={t("shaders.col.name")}
      fileCol={t("mods.col.file")}
      sizeCol={t("mods.col.size")}
      actionCol={t("textures.col.action")}
      packs={filteredShaderPacks}
      icons={shaderIcons}
      installed={installedShaders}
      installing={optionalInstalling}
      catalogView={catalogView}
      viewToggle={viewToggle}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      formatSize={formatSize}
      t={t}
      onToggle={(id) => onToggleOptional(id, "shaderpack")}
    />
  );
}

function OptionalPackCatalog({
  searchPlaceholder,
  emptyLabel,
  nameCol,
  fileCol,
  sizeCol,
  actionCol,
  packs,
  icons,
  installed,
  installing,
  catalogView,
  viewToggle,
  searchQuery,
  onSearchChange,
  formatSize,
  t,
  onToggle,
}: {
  searchPlaceholder: string;
  emptyLabel: string;
  nameCol: string;
  fileCol: string;
  sizeCol: string;
  actionCol: string;
  packs: OptionalPackEntry[];
  icons: Record<string, string>;
  installed: Record<string, boolean>;
  installing: Record<string, boolean>;
  catalogView: CatalogViewMode;
  viewToggle: ReactNode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  formatSize: (n: number) => string;
  t: (key: string) => string;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mods-tab-content">
      <div className="mods-action-bar">
        <div className="mods-search-container" style={{ flex: 1 }}>
          <FaSearch size={14} className="mods-search-icon" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="mods-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {viewToggle}
      </div>

      {packs.length > 0 ? (
        catalogView === "grid" ? (
          <div className="mods-list-container">
            <div className="mods-list-scroll">
              <div className="pack-grid">
                {packs.map((pack) => {
                  const isInstalled = installed[pack.id];
                  const isInstalling = installing[pack.id];
                  return (
                    <div key={pack.id} className="pack-card">
                      <div className="pack-card-icon">
                        <ModIcon modId={pack.id} iconUrl={icons[pack.id]} size={72} />
                      </div>
                      <strong className="pack-card-title" title={pack.name}>
                        {pack.name}
                      </strong>
                      <span className="pack-card-meta">{formatSize(pack.size)}</span>
                      <button
                        className={`btn btn--sm pack-card-btn ${
                          isInstalled ? "btn--danger" : "btn--primary"
                        }`}
                        onClick={() => onToggle(pack.id)}
                        disabled={isInstalling}
                      >
                        {isInstalling
                          ? t("action.installing")
                          : isInstalled
                            ? t("action.uninstall")
                            : t("action.install")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mods-list-container">
            <div className="mods-list-scroll">
              <table className="mods-table" style={{ tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "17%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{nameCol}</th>
                    <th>{fileCol}</th>
                    <th>{sizeCol}</th>
                    <th style={{ textAlign: "right" }}>{actionCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {packs.map((pack) => {
                    const isInstalled = installed[pack.id];
                    const isInstalling = installing[pack.id];
                    return (
                      <tr key={pack.id}>
                        <td>
                          <div className="mod-row-info">
                            <ModIcon modId={pack.id} iconUrl={icons[pack.id]} size={36} />
                            <div className="mod-row-name-container">
                              <span className="mod-row-name pack-row-name">{pack.name}</span>
                              <span className="mod-row-id pack-row-desc">{pack.description}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mod-row-filename" title={pack.filename}>
                            {pack.filename}
                          </span>
                        </td>
                        <td>
                          <span className="mod-size">{formatSize(pack.size)}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className={`btn btn--sm ${isInstalled ? "btn--danger" : "btn--primary"}`}
                            onClick={() => onToggle(pack.id)}
                            disabled={isInstalling}
                          >
                            {isInstalling ? (
                              <>
                                <span className="spinner" />
                                <span>{t("action.installing")}</span>
                              </>
                            ) : isInstalled ? (
                              <span>{t("action.uninstall")}</span>
                            ) : (
                              <span>{t("action.install")}</span>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="catalog-empty">
          <FaSearch size={32} />
          <span>{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
