import { NextRequest, NextResponse } from "next/server";

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION = "europe";

/**
 * Effectue une requête vers l'API Riot.
 */
async function riotFetch(url: string) {
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": RIOT_API_KEY!,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Riot API error ${response.status}: ${await response.text()}`
    );
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    // Vérification de la clé API
    if (!RIOT_API_KEY) {
      return NextResponse.json(
        {
          error: "RIOT_API_KEY manquante dans .env.local",
        },
        {
          status: 500,
        }
      );
    }

    // --------------------------------------------------
    // 1. RÉCUPÉRATION DU RIOT ID
    // --------------------------------------------------

    const { searchParams } = new URL(request.url);

    const gameName = searchParams.get("gameName");
    const tagLine = searchParams.get("tagLine");

    if (!gameName || !tagLine) {
      return NextResponse.json(
        {
          error: "gameName et tagLine sont obligatoires.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 2. RIOT ID → PUUID
    // --------------------------------------------------

    const account = await riotFetch(
      `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
        `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    // --------------------------------------------------
    // 3. RÉCUPÉRATION DES 5 DERNIÈRES GAMES
    // --------------------------------------------------

    const matchIds = await riotFetch(
      `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/` +
        `${account.puuid}/ids?start=0&count=5`
    );

    // --------------------------------------------------
    // 4. ANALYSE DES GAMES
    // --------------------------------------------------

    const games = await Promise.all(
      matchIds.map(async (matchId: string) => {
        // Informations générales de la game
        const match = await riotFetch(
          `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`
        );

        // Timeline de la game
        const timeline = await riotFetch(
          `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`
        );

        // --------------------------------------------------
        // 5. TROUVER NOTRE JOUEUR
        // --------------------------------------------------

        const participantIndex =
          match.metadata.participants.findIndex(
            (puuid: string) => puuid === account.puuid
          );

        if (participantIndex === -1) {
          return null;
        }

        // Les participantIds commencent à 1
        const participantId = participantIndex + 1;

        const player = match.info.participants.find(
          (p: any) => p.puuid === account.puuid
        );

        if (!player) {
          return null;
        }

        // --------------------------------------------------
        // 6. TROUVER LA FRAME À ~15 MINUTES
        // --------------------------------------------------

        const targetTime = 15 * 60 * 1000;

        const frame15 = timeline.info.frames.reduce(
          (closest: any, frame: any) => {
            const currentDifference = Math.abs(
              frame.timestamp - targetTime
            );

            const closestDifference = Math.abs(
              closest.timestamp - targetTime
            );

            if (currentDifference < closestDifference) {
              return frame;
            }

            return closest;
          },
          timeline.info.frames[0]
        );

        // --------------------------------------------------
        // 7. RÉCUPÉRER NOS STATS À 15 MIN
        // --------------------------------------------------

        const playerFrame =
          frame15.participantFrames[String(participantId)];

        if (!playerFrame) {
          return null;
        }

        // --------------------------------------------------
        // 8. TROUVER L'ADVERSAIRE AU MÊME RÔLE
        // --------------------------------------------------

        const enemy = match.info.participants.find(
          (p: any) =>
            p.teamId !== player.teamId &&
            p.teamPosition === player.teamPosition
        );

        let enemyFrame = null;

        if (enemy) {
          const enemyIndex =
            match.metadata.participants.findIndex(
              (puuid: string) => puuid === enemy.puuid
            );

          if (enemyIndex !== -1) {
            const enemyParticipantId = enemyIndex + 1;

            enemyFrame =
              frame15.participantFrames[
                String(enemyParticipantId)
              ];
          }
        }

        // --------------------------------------------------
        // 9. CALCUL DU CS À 15 MIN
        // --------------------------------------------------

        const cs15 =
          playerFrame.minionsKilled +
          playerFrame.jungleMinionsKilled;

        const enemyCS15 = enemyFrame
          ? enemyFrame.minionsKilled +
            enemyFrame.jungleMinionsKilled
          : null;

        // --------------------------------------------------
        // 10. CALCUL DES DIFFÉRENCES
        // --------------------------------------------------

        const csDiff =
          enemyCS15 !== null
            ? cs15 - enemyCS15
            : null;

        const goldDiff = enemyFrame
          ? playerFrame.totalGold - enemyFrame.totalGold
          : null;

        const xpDiff = enemyFrame
          ? playerFrame.xp - enemyFrame.xp
          : null;

        const levelDiff = enemyFrame
          ? playerFrame.level - enemyFrame.level
          : null;

        // --------------------------------------------------
        // 11. RÉSULTAT DE LA GAME
        // --------------------------------------------------

        return {
          matchId,

          champion: player.championName,

          role: player.teamPosition,

          win: player.win,

          // KDA
          kills: player.kills,
          deaths: player.deaths,
          assists: player.assists,

          // Durée totale de la partie
          gameDuration: match.info.gameDuration,

          // -----------------------------
          // STATS À 15 MINUTES
          // -----------------------------

          stats15: {
            timestamp: frame15.timestamp,

            // MES STATS

            cs: cs15,

            laneCS: playerFrame.minionsKilled,

            jungleCS:
              playerFrame.jungleMinionsKilled,

            gold: playerFrame.totalGold,

            xp: playerFrame.xp,

            level: playerFrame.level,

            // -----------------------------
            // ADVERSAIRE
            // -----------------------------

            enemy: enemy
              ? {
                  riotId:
                    `${enemy.riotIdGameName}` +
                    `#${enemy.riotIdTagline}`,

                  champion: enemy.championName,

                  cs: enemyCS15,

                  gold:
                    enemyFrame?.totalGold ?? null,

                  xp:
                    enemyFrame?.xp ?? null,

                  level:
                    enemyFrame?.level ?? null,
                }
              : null,

            // -----------------------------
            // DIFFÉRENCES
            // -----------------------------

            csDiff,

            goldDiff,

            xpDiff,

            levelDiff,
          },
        };
      })
    );

    // --------------------------------------------------
    // 12. RÉPONSE API
    // --------------------------------------------------

    return NextResponse.json({
      player: {
        gameName: account.gameName,
        tagLine: account.tagLine,
      },

      games: games.filter(Boolean),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue.",
      },
      {
        status: 500,
      }
    );
  }
}