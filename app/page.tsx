"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import PlayerSearch from "@/components/PlayerSearch";

/* ==========================================
   TYPES
========================================== */

type Enemy = {
  riotId: string;
  champion: string;
  cs: number | null;
  gold: number | null;
  xp: number | null;
  level: number | null;
};

type Stats15 = {
  timestamp: number;

  cs: number;
  laneCS: number;
  jungleCS: number;

  gold: number;
  xp: number;
  level: number;

  enemy: Enemy | null;

  csDiff: number | null;
  goldDiff: number | null;
  xpDiff: number | null;
  levelDiff: number | null;
};

type Game = {
  matchId: string;

  champion: string;
  role: string;

  win: boolean;

  kills: number;
  deaths: number;
  assists: number;

  gameDuration: number;

  stats15: Stats15;
};

type PlayerData = {
  player: {
    gameName: string;
    tagLine: string;
  };

  games: Game[];
};

type CacheData = {
  gameName: string;
  tagLine: string;

  data: PlayerData;

  timestamp: number;
};

/* ==========================================
   CACHE
========================================== */

const CACHE_KEY = "lol15_player_cache";

/*
 * 5 minutes
 */
const CACHE_DURATION =
  5 * 60 * 1000;

/* ==========================================
   PAGE
========================================== */

export default function Home() {
  const [data, setData] =
    useState<PlayerData | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    initialSearchChecked,
    setInitialSearchChecked,
  ] = useState(false);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState<number | null>(null);

  /* ========================================
     CACHE HELPERS
  ======================================== */

  function getCache(
    gameName: string,
    tagLine: string
  ): CacheData | null {
    try {
      const rawCache =
        localStorage.getItem(
          CACHE_KEY
        );

      if (!rawCache) {
        return null;
      }

      const cache: CacheData =
        JSON.parse(rawCache);

      /*
       * Vérifie que le cache appartient
       * bien au joueur demandé.
       */

      const samePlayer =
        cache.gameName.toLowerCase() ===
          gameName.toLowerCase() &&
        cache.tagLine.toLowerCase() ===
          tagLine.toLowerCase();

      if (!samePlayer) {
        return null;
      }

      /*
       * Vérifie l'âge du cache.
       */

      const cacheAge =
        Date.now() -
        cache.timestamp;

      if (
        cacheAge >
        CACHE_DURATION
      ) {
        localStorage.removeItem(
          CACHE_KEY
        );

        return null;
      }

      return cache;
    } catch {
      localStorage.removeItem(
        CACHE_KEY
      );

      return null;
    }
  }

  function saveCache(
    gameName: string,
    tagLine: string,
    playerData: PlayerData
  ) {
    const timestamp =
      Date.now();

    const cache: CacheData = {
      gameName,
      tagLine,
      data: playerData,
      timestamp,
    };

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(cache)
    );

    localStorage.setItem(
      LAST_SEARCH_KEY,
      JSON.stringify({
        gameName,
        tagLine,
      })
    );

    setLastUpdated(timestamp);
  }

  /* ========================================
     URL
  ======================================== */

  function updateUrl(
    gameName: string,
    tagLine: string
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "gameName",
      gameName
    );

    params.set(
      "tagLine",
      tagLine
    );

    window.history.replaceState(
      {},
      "",
      `${
        window.location.pathname
      }?${params.toString()}`
    );
  }

  /* ========================================
     SEARCH PLAYER
  ======================================== */

  const searchPlayer = useCallback(
    async (
      gameName: string,
      tagLine: string,
      options?: {
        forceRefresh?: boolean;
        updateBrowserUrl?: boolean;
      }
    ) => {
      const forceRefresh =
        options?.forceRefresh ??
        false;

      const updateBrowserUrl =
        options?.updateBrowserUrl ??
        true;

      setError(null);

      /*
       * ==============================
       * CACHE
       * ==============================
       */

      if (!forceRefresh) {
        try {
          const rawCache =
            localStorage.getItem(
              CACHE_KEY
            );

          if (rawCache) {
            const cache: CacheData =
              JSON.parse(rawCache);

            const samePlayer =
              cache.gameName.toLowerCase() ===
                gameName.toLowerCase() &&
              cache.tagLine.toLowerCase() ===
                tagLine.toLowerCase();

            const cacheAge =
              Date.now() -
              cache.timestamp;

            if (
              samePlayer &&
              cacheAge <
                CACHE_DURATION
            ) {
              console.log(
                "Utilisation du cache Riot"
              );

              setData(
                cache.data
              );

              setLastUpdated(
                cache.timestamp
              );

              if (
                updateBrowserUrl
              ) {
                const params =
                  new URLSearchParams();

                params.set(
                  "gameName",
                  gameName
                );

                params.set(
                  "tagLine",
                  tagLine
                );

                window.history.replaceState(
                  {},
                  "",
                  `${
                    window.location
                      .pathname
                  }?${params.toString()}`
                );
              }

              return;
            }
          }
        } catch {
          localStorage.removeItem(
            CACHE_KEY
          );
        }
      }

      /*
       * ==============================
       * API RIOT
       * ==============================
       */

      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response =
          await fetch(
            `/api/player?gameName=${encodeURIComponent(
              gameName
            )}&tagLine=${encodeURIComponent(
              tagLine
            )}`
          );

        const result =
          await response.json();

        if (!response.ok) {
          /*
           * Message plus propre
           * pour le rate limit Riot.
           */

          if (
            response.status === 429 ||
            JSON.stringify(
              result
            ).includes("429")
          ) {
            throw new Error(
              "L'API Riot reçoit trop de requêtes. Réessaie dans quelques instants."
            );
          }

          if (
            response.status === 401 ||
            JSON.stringify(
              result
            ).includes("401")
          ) {
            throw new Error(
              "La connexion à l'API Riot n'est plus valide."
            );
          }

          throw new Error(
            result.error ??
              "Impossible de récupérer ce joueur."
          );
        }

        setData(result);

        /*
         * Sauvegarde du résultat complet.
         */

        const timestamp =
          Date.now();

        const cache: CacheData = {
          gameName,
          tagLine,
          data: result,
          timestamp,
        };

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify(cache)
        );

        localStorage.setItem(
          LAST_SEARCH_KEY,
          JSON.stringify({
            gameName,
            tagLine,
          })
        );

        setLastUpdated(
          timestamp
        );

        if (
          updateBrowserUrl
        ) {
          const params =
            new URLSearchParams();

          params.set(
            "gameName",
            gameName
          );

          params.set(
            "tagLine",
            tagLine
          );

          window.history.replaceState(
            {},
            "",
            `${
              window.location.pathname
            }?${params.toString()}`
          );
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  /* ========================================
     RESTORE AFTER F5
  ======================================== */

useEffect(() => {
  async function restoreFromUrl() {
    const params = new URLSearchParams(
      window.location.search
    );

    const gameName =
      params.get("gameName");

    const tagLine =
      params.get("tagLine");

    /*
     * Pas de joueur dans l'URL :
     * on reste sur la page d'accueil.
     */
    if (!gameName || !tagLine) {
      setInitialSearchChecked(true);
      return;
    }

    /*
     * Un joueur est présent dans l'URL :
     * on restaure son dashboard.
     *
     * searchPlayer vérifiera d'abord
     * le cache avant d'appeler Riot.
     */
    await searchPlayer(
      gameName,
      tagLine,
      {
        forceRefresh: false,
        updateBrowserUrl: false,
      }
    );

    setInitialSearchChecked(true);
  }

  restoreFromUrl();
}, [searchPlayer]);

  /* ========================================
     RESET SEARCH
  ======================================== */

function resetSearch() {
  setData(null);
  setError(null);
  setLastUpdated(null);

  /*
   * On enlève seulement le joueur de l'URL.
   *
   * On NE supprime PAS le cache :
   * si on recherche à nouveau le même joueur,
   * les données pourront être réutilisées.
   */
  window.history.replaceState(
    {},
    "",
    window.location.pathname
  );
}

  /* ========================================
     MANUAL REFRESH
  ======================================== */

  async function refreshData() {
    if (!data) {
      return;
    }

    await searchPlayer(
      data.player.gameName,
      data.player.tagLine,
      {
        forceRefresh: true,
        updateBrowserUrl: false,
      }
    );
  }

  /* ========================================
     CALCULS
  ======================================== */

  function average(
    values: (number | null)[]
  ) {
    const validValues =
      values.filter(
        (
          value
        ): value is number =>
          value !== null
      );

    if (
      validValues.length === 0
    ) {
      return null;
    }

    return Math.round(
      validValues.reduce(
        (
          total,
          value
        ) =>
          total + value,
        0
      ) /
        validValues.length
    );
  }

  function formatDiff(
    value: number | null
  ) {
    if (value === null) {
      return "—";
    }

    if (value > 0) {
      return `+${value.toLocaleString(
        "fr-FR"
      )}`;
    }

    return value.toLocaleString(
      "fr-FR"
    );
  }

  function formatNumber(
    value: number | null
  ) {
    if (value === null) {
      return "—";
    }

    return value.toLocaleString(
      "fr-FR"
    );
  }

  function diffClass(
    value: number | null
  ) {
    if (
      value === null ||
      value === 0
    ) {
      return "neutral";
    }

    return value > 0
      ? "positive"
      : "negative";
  }

  function formatDuration(
    seconds: number
  ) {
    const minutes =
      Math.floor(
        seconds / 60
      );

    const remainingSeconds =
      Math.floor(
        seconds % 60
      );

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  function formatTimestamp(
    milliseconds: number
  ) {
    const totalSeconds =
      Math.round(
        milliseconds / 1000
      );

    const minutes =
      Math.floor(
        totalSeconds / 60
      );

    const seconds =
      totalSeconds % 60;

    return `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  function formatRole(
    role: string
  ) {
    const roles: Record<
      string,
      string
    > = {
      TOP: "Top",
      JUNGLE: "Jungle",
      MIDDLE: "Mid",
      BOTTOM: "ADC",
      UTILITY: "Support",
    };

    return (
      roles[role] ??
      role
    );
  }

  function formatLastUpdated() {
    if (!lastUpdated) {
      return "";
    }

    const difference =
      Date.now() -
      lastUpdated;

    const minutes =
      Math.floor(
        difference /
          60000
      );

    if (minutes <= 0) {
      return "À l'instant";
    }

    if (minutes === 1) {
      return "Il y a 1 minute";
    }

    return `Il y a ${minutes} minutes`;
  }

  /* ========================================
     AVERAGES
  ======================================== */

  const averageCs = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.cs
        )
      )
    : null;

  const averageGold = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.gold
        )
      )
    : null;

  const averageXp = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.xp
        )
      )
    : null;

  const averageLevel = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.level
        )
      )
    : null;

  const averageCsDiff = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.csDiff
        )
      )
    : null;

  const averageGoldDiff = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.goldDiff
        )
      )
    : null;

  const averageXpDiff = data
    ? average(
        data.games.map(
          (game) =>
            game.stats15.xpDiff
        )
      )
    : null;

  const averageLevelDiff =
    data
      ? average(
          data.games.map(
            (game) =>
              game.stats15
                .levelDiff
          )
        )
      : null;

  /* ========================================
     WINRATE
  ======================================== */

  const victories = data
    ? data.games.filter(
        (game) =>
          game.win
      ).length
    : 0;

  const defeats = data
    ? data.games.length -
      victories
    : 0;

  const winrate =
    data &&
    data.games.length > 0
      ? Math.round(
          (victories /
            data.games.length) *
            100
        )
      : 0;

  /* ========================================
     INITIAL LOADING
  ======================================== */

  if (!initialSearchChecked) {
    return (
      <main className="page">

        <div className="initialLoader">

          <span className="loader" />

          <p>
            Chargement de ton
            analyse...
          </p>

        </div>

      </main>
    );
  }

  /* ========================================
     SEARCH
  ======================================== */

  if (!data) {
    return (
      <main className="page">

        <PlayerSearch
          loading={loading}
          error={error}
          onSearch={(
            gameName,
            tagLine
          ) =>
            searchPlayer(
              gameName,
              tagLine
            )
          }
        />

      </main>
    );
  }

  /* ========================================
     DASHBOARD
  ======================================== */

  return (
    <main className="dashboardPage">

      <div className="dashboardContainer">

        {/* NAV */}

        <nav className="dashboardNav">

          <button
            className="dashboardLogo"
            onClick={
              resetSearch
            }
            type="button"
          >
            15
          </button>

          <button
            className="newSearchButton"
            onClick={
              resetSearch
            }
            type="button"
          >
            <span>⌕</span>

            Rechercher un joueur
          </button>

        </nav>

        {/* PLAYER */}

        <header className="dashboardPlayer">

          <div className="playerIdentity">

            <div className="playerAvatar">

              {data.player
                .gameName
                .charAt(0)
                .toUpperCase()}

            </div>

            <div>

              <p className="dashboardEyebrow">
                JOUEUR
              </p>

              <h1>

                {
                  data.player
                    .gameName
                }

                <span>
                  #
                  {
                    data.player
                      .tagLine
                  }
                </span>

              </h1>

              <p className="playerSubtitle">

                Analyse des{" "}
                {
                  data.games
                    .length
                }{" "}
                dernières parties

              </p>

              {/* CACHE INFO */}

              <div className="dataUpdate">

                <span className="dataUpdateDot" />

                <span>
                  Données mises à jour{" "}
                  {formatLastUpdated()}
                </span>

                <button
                  type="button"
                  onClick={
                    refreshData
                  }
                  disabled={
                    refreshing
                  }
                >

                  {refreshing
                    ? "Actualisation..."
                    : "↻ Actualiser"}

                </button>

              </div>

              {error && (
                <p className="refreshError">
                  {error}
                </p>
              )}

            </div>

          </div>

          <div className="playerRecord">

            <RecordItem
              label="Parties"
              value={
                data.games.length
              }
            />

            <RecordItem
              label="Victoires"
              value={
                victories
              }
            />

            <RecordItem
              label="Défaites"
              value={
                defeats
              }
            />

            <RecordItem
              label="Winrate"
              value={`${winrate}%`}
            />

          </div>

        </header>

        {/* EARLY GAME */}

        <section className="dashboardSection">

          <div className="dashboardSectionHeader">

            <div>

              <p className="dashboardEyebrow">
                EARLY GAME
              </p>

              <h2>
                Avantage moyen à
                15 minutes
              </h2>

              <p>
                Comparaison avec ton
                adversaire direct sur
                les{" "}
                {
                  data.games
                    .length
                }{" "}
                dernières parties.
              </p>

            </div>

            <div className="minuteBadge">
              @ 15:00
            </div>

          </div>

          {/* DIFFERENCES */}

          <div className="primaryStatsGrid">

            <DifferenceCard
              shortLabel="CS"
              title="CSD @15"
              value={
                averageCsDiff
              }
              description="Différence moyenne de CS"
              formatDiff={
                formatDiff
              }
              diffClass={
                diffClass
              }
            />

            <DifferenceCard
              shortLabel="G"
              title="GD @15"
              value={
                averageGoldDiff
              }
              description="Différence moyenne de gold"
              formatDiff={
                formatDiff
              }
              diffClass={
                diffClass
              }
            />

            <DifferenceCard
              shortLabel="XP"
              title="XPD @15"
              value={
                averageXpDiff
              }
              description="Différence moyenne d'XP"
              formatDiff={
                formatDiff
              }
              diffClass={
                diffClass
              }
            />

          </div>

          {/* RAW STATS */}

          <div className="rawStatsGrid">

            <RawStat
              label="CS @15"
              value={
                formatNumber(
                  averageCs
                )
              }
            />

            <RawStat
              label="Gold @15"
              value={
                formatNumber(
                  averageGold
                )
              }
            />

            <RawStat
              label="XP @15"
              value={
                formatNumber(
                  averageXp
                )
              }
            />

            <RawStat
              label="Niveau @15"
              value={
                formatNumber(
                  averageLevel
                )
              }
            />

            <RawStat
              label="Level Diff"
              value={
                formatDiff(
                  averageLevelDiff
                )
              }
              valueClass={
                diffClass(
                  averageLevelDiff
                )
              }
            />

          </div>

        </section>

        {/* MATCH HISTORY */}

        <section className="dashboardSection matchSection">

          <div className="dashboardSectionHeader">

            <div>

              <p className="dashboardEyebrow">
                MATCH HISTORY
              </p>

              <h2>
                Tes dernières parties
              </h2>

              <p>
                Tes statistiques
                comparées à ton
                adversaire à
                15 minutes.
              </p>

            </div>

          </div>

          <div className="matchList">

            {data.games.map(
              (
                game,
                index
              ) => (

                <article
                  className={`matchCard ${
                    game.win
                      ? "matchVictory"
                      : "matchDefeat"
                  }`}
                  key={
                    game.matchId
                  }
                >

                  {/* TOP */}

                  <div className="matchTop">

                    <div className="matchChampion">

                      <div
                        className={`matchIndex ${
                          game.win
                            ? "matchIndexWin"
                            : "matchIndexLoss"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div>

                        <div className="championTitle">

                          <h3>
                            {
                              game.champion
                            }
                          </h3>

                          <span
                            className={
                              game.win
                                ? "victoryBadge"
                                : "defeatBadge"
                            }
                          >

                            {game.win
                              ? "Victoire"
                              : "Défaite"}

                          </span>

                        </div>

                        <p>

                          {formatRole(
                            game.role
                          )}

                          <span>
                            •
                          </span>

                          {formatDuration(
                            game.gameDuration
                          )}

                        </p>

                      </div>

                    </div>

                    <div className="matchKda">

                      <span>
                        KDA
                      </span>

                      <strong>

                        {
                          game.kills
                        }

                        <small>
                          /
                        </small>

                        {
                          game.deaths
                        }

                        <small>
                          /
                        </small>

                        {
                          game.assists
                        }

                      </strong>

                    </div>

                  </div>

                  {/* VS */}

                  <div className="matchVersus">

                    <div className="versusPlayer">

                      <span>
                        TOI
                      </span>

                      <strong>
                        {
                          game.champion
                        }
                      </strong>

                      <small>
                        {
                          data.player
                            .gameName
                        }
                      </small>

                    </div>

                    <div className="versusIcon">
                      VS
                    </div>

                    <div className="versusEnemy">

                      <span>
                        ADVERSAIRE
                      </span>

                      <strong>

                        {game.stats15
                          .enemy
                          ?.champion ??
                          "Inconnu"}

                      </strong>

                      <small>

                        {game.stats15
                          .enemy
                          ?.riotId ??
                          "—"}

                      </small>

                    </div>

                  </div>

                  {/* COMPARISON */}

                  <div className="matchComparison">

                    <ComparisonRow
                      label="CS"
                      player={
                        game.stats15
                          .cs
                      }
                      enemy={
                        game.stats15
                          .enemy
                          ?.cs ??
                        null
                      }
                      difference={
                        game.stats15
                          .csDiff
                      }
                      formatNumber={
                        formatNumber
                      }
                      formatDiff={
                        formatDiff
                      }
                      diffClass={
                        diffClass
                      }
                    />

                    <ComparisonRow
                      label="Gold"
                      player={
                        game.stats15
                          .gold
                      }
                      enemy={
                        game.stats15
                          .enemy
                          ?.gold ??
                        null
                      }
                      difference={
                        game.stats15
                          .goldDiff
                      }
                      formatNumber={
                        formatNumber
                      }
                      formatDiff={
                        formatDiff
                      }
                      diffClass={
                        diffClass
                      }
                    />

                    <ComparisonRow
                      label="XP"
                      player={
                        game.stats15
                          .xp
                      }
                      enemy={
                        game.stats15
                          .enemy
                          ?.xp ??
                        null
                      }
                      difference={
                        game.stats15
                          .xpDiff
                      }
                      formatNumber={
                        formatNumber
                      }
                      formatDiff={
                        formatDiff
                      }
                      diffClass={
                        diffClass
                      }
                    />

                    <ComparisonRow
                      label="Niveau"
                      player={
                        game.stats15
                          .level
                      }
                      enemy={
                        game.stats15
                          .enemy
                          ?.level ??
                        null
                      }
                      difference={
                        game.stats15
                          .levelDiff
                      }
                      formatNumber={
                        formatNumber
                      }
                      formatDiff={
                        formatDiff
                      }
                      diffClass={
                        diffClass
                      }
                    />

                  </div>

                  {/* DETAILS */}

                  <div className="matchDetails">

                    <MatchDetail
                      label="Lane CS"
                      value={
                        game.stats15
                          .laneCS
                      }
                    />

                    <MatchDetail
                      label="Jungle CS"
                      value={
                        game.stats15
                          .jungleCS
                      }
                    />

                    <MatchDetail
                      label="Total CS"
                      value={
                        game.stats15
                          .cs
                      }
                    />

                    <MatchDetail
                      label="Frame"
                      value={
                        formatTimestamp(
                          game.stats15
                            .timestamp
                        )
                      }
                    />

                  </div>

                </article>

              )
            )}

          </div>

        </section>

      </div>

    </main>
  );
}

/* ==========================================
   COMPONENTS
========================================== */

function RecordItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="recordItem">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

function DifferenceCard({
  shortLabel,
  title,
  value,
  description,
  formatDiff,
  diffClass,
}: {
  shortLabel: string;
  title: string;
  value: number | null;
  description: string;

  formatDiff: (
    value: number | null
  ) => string;

  diffClass: (
    value: number | null
  ) => string;
}) {
  return (
    <div className="differenceCard">

      <div className="differenceCardTop">

        <div className="differenceIcon">
          {shortLabel}
        </div>

        <span>
          {title}
        </span>

      </div>

      <strong
        className={`differenceValue ${diffClass(
          value
        )}`}
      >
        {formatDiff(
          value
        )}
      </strong>

      <p>
        {description}
      </p>

    </div>
  );
}

function RawStat({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rawStat">

      <span>
        {label}
      </span>

      <strong
        className={
          valueClass
        }
      >
        {value}
      </strong>

    </div>
  );
}

function ComparisonRow({
  label,
  player,
  enemy,
  difference,
  formatNumber,
  formatDiff,
  diffClass,
}: {
  label: string;

  player: number | null;
  enemy: number | null;
  difference: number | null;

  formatNumber: (
    value: number | null
  ) => string;

  formatDiff: (
    value: number | null
  ) => string;

  diffClass: (
    value: number | null
  ) => string;
}) {
  return (
    <div className="matchComparisonRow">

      <strong className="comparisonPlayerValue">

        {formatNumber(
          player
        )}

      </strong>

      <div className="comparisonMiddle">

        <span>
          {label} @15
        </span>

        <strong
          className={
            diffClass(
              difference
            )
          }
        >

          {formatDiff(
            difference
          )}

        </strong>

      </div>

      <strong className="comparisonEnemyValue">

        {formatNumber(
          enemy
        )}

      </strong>

    </div>
  );
}

function MatchDetail({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="matchDetail">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}