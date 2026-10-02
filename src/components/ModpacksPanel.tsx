// ============================================================
// HyLauncher — Modpacks Panel (elegir modpack)
// ============================================================
//
// Cada modpack trae sus propios mods, texturas y shaders en una
// instancia aislada. Nada se instala por default: el usuario elige
// un pack y solo entonces se sincroniza ese contenido.

import { FaCheckCircle, FaCube } from "react-icons/fa";
import type { ModpackSummary } from "../lib/types";
import { useI18n } from "../lib/i18n";

interface ModpacksPanelProps {
  packs: ModpackSummary[];
  activePackId: string | null;
  isLoading: boolean;
  selectingId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
}

export function ModpacksPanel({
  packs,
  activePackId,
  isLoading,
  selectingId,
  searchQuery,
  onSearchChange,
  onSelect,
}: ModpacksPanelProps) {
  const { t } = useI18n();

  const filtered = packs.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="packs-wrap">
      <div className="packs-search">
        <input
          type="text"
          className="packs-search-input"
          placeholder={t("packs.search")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="packs-hint">{t("packs.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="packs-hint">{t("packs.empty")}</p>
      ) : (
        <div className="packs-grid">
          {filtered.map((pack) => {
            const isActive = pack.id === activePackId;
            const isSelecting = selectingId === pack.id;
            return (
              <article
                key={pack.id}
                className={`pack-card${isActive ? " pack-card--active" : ""}`}
              >
                <div className="pack-card-head">
                  <span className="pack-card-icon">
                    {pack.iconUrl ? (
                      <img src={pack.iconUrl} alt="" />
                    ) : (
                      <FaCube size={20} />
                    )}
                  </span>
                  <div className="pack-card-titles">
                    <h3 className="pack-card-name">{pack.name}</h3>
                    <span className="pack-card-id">{pack.id}</span>
                  </div>
                  {isActive && (
                    <span className="pack-card-badge">
                      <FaCheckCircle size={12} /> {t("packs.active")}
                    </span>
                  )}
                </div>

                {pack.description && (
                  <p className="pack-card-desc">{pack.description}</p>
                )}

                <div className="pack-card-pills">
                  {pack.minecraft && (
                    <span className="hy-pill">MC {pack.minecraft}</span>
                  )}
                  {(pack.fabricLoader || pack.packVersion) && (
                    <span className="hy-pill">
                      {[pack.fabricLoader ? `Fabric ${pack.fabricLoader}` : null,
                        pack.packVersion ? `v${pack.packVersion}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className={`btn ${isActive ? "btn--ghost" : "btn--primary"} btn--sm pack-card-btn`}
                  disabled={isActive || isSelecting}
                  onClick={() => onSelect(pack.id)}
                >
                  {isActive
                    ? t("packs.selected")
                    : isSelecting
                      ? t("packs.selecting")
                      : t("packs.use")}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}