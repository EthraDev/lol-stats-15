"use client";

import {
  FormEvent,
  useState,
} from "react";

type PlayerSearchProps = {
  loading: boolean;
  error: string | null;

  onSearch: (
    gameName: string,
    tagLine: string
  ) => void;
};

export default function PlayerSearch({
  loading,
  error,
  onSearch,
}: PlayerSearchProps) {
  const [gameName, setGameName] =
    useState("");

  const [tagLine, setTagLine] =
    useState("");

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanGameName =
      gameName.trim();

    const cleanTagLine =
      tagLine
        .replace("#", "")
        .trim();

    if (
      !cleanGameName ||
      !cleanTagLine
    ) {
      return;
    }

    onSearch(
      cleanGameName,
      cleanTagLine
    );
  }

  function fillExample() {
    setGameName("MKA Ethra");
    setTagLine("tlv");
  }

  return (
    <section className="searchHero">

      <div className="searchGlow searchGlowOne" />

      <div className="searchGlow searchGlowTwo" />

      <div className="searchHeroContent">

        {/* LOGO */}

        <div className="brandMark">
          <span>15</span>
        </div>

        {/* HEADER */}

        <p className="searchEyebrow">
          LEAGUE OF LEGENDS ANALYTICS
        </p>

        <h1>
          Ton early game,
          <span>
            {" "}
            en un coup d&apos;œil.
          </span>
        </h1>

        <p className="searchDescription">
          Compare ton CS, ton gold et
          ton expérience avec ton
          adversaire direct à
          15 minutes.
        </p>

        {/* FORM */}

        <form
          className="playerSearchForm"
          onSubmit={handleSubmit}
        >

          <div className="searchInputs">

            <div className="gameNameField">

              <label htmlFor="gameName">
                Riot ID
              </label>

              <input
                id="gameName"
                type="text"
                value={gameName}
                onChange={(event) =>
                  setGameName(
                    event.target.value
                  )
                }
                placeholder="MKA Ethra"
                autoComplete="off"
              />

            </div>

            <div className="tagSeparator">
              #
            </div>

            <div className="tagField">

              <label htmlFor="tagLine">
                Tag
              </label>

              <input
                id="tagLine"
                type="text"
                value={tagLine}
                onChange={(event) =>
                  setTagLine(
                    event.target.value
                  )
                }
                placeholder="tlv"
                autoComplete="off"
              />

            </div>

          </div>

          <button
            className="searchButton"
            type="submit"
            disabled={
              loading ||
              !gameName.trim() ||
              !tagLine.trim()
            }
          >

            {loading ? (
              <>
                <span className="loader" />

                Analyse...
              </>
            ) : (
              <>
                <span>
                  ⌕
                </span>

                Analyser
              </>
            )}

          </button>

        </form>

        {/* ERROR */}

        {error && (
          <div className="searchError">

            <span>!</span>

            <div>

              <strong>
                Impossible de charger
                ce joueur
              </strong>

              <p>
                {error}
              </p>

            </div>

          </div>
        )}

        {/* EXAMPLE */}

        <div className="searchExample">

          <span>
            Essaie par exemple
          </span>

          <button
            type="button"
            onClick={fillExample}
          >
            MKA Ethra

            <strong>
              #tlv
            </strong>

          </button>

        </div>

        {/* FEATURES */}

        <div className="featuresPreview">

          <Feature
            value="CS"
            label="CS @15"
          />

          <div className="featureDivider" />

          <Feature
            value="G"
            label="Gold @15"
          />

          <div className="featureDivider" />

          <Feature
            value="XP"
            label="XP @15"
          />

          <div className="featureDivider" />

          <Feature
            value="Δ"
            label="Lane Diff"
          />

        </div>

      </div>

    </section>
  );
}

function Feature({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="feature">

      <div className="featureIcon">
        {value}
      </div>

      <span>
        {label}
      </span>

    </div>
  );
}