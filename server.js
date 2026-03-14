const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // must be node-fetch v2

const app = express();
const PORT = '3000';

const TMDB_KEY = '2958cf52147b1e175b6e327d9e0c2621';

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Watch page route
app.get('/watch', (req, res) => {
  res.sendFile(__dirname + '/public/watch.html');
});

/* ----------------------------------------------------
   TMDB HELPERS
---------------------------------------------------- */

async function tmdb(url) {
  const res = await fetch(url);
  return res.json();
}

// Convert TMDB ID → IMDB ID
async function getIMDBfromTMDB(tmdbId, type) {
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`;
  const data = await tmdb(url);
  return data.imdb_id || null;
}

// Correct TV show lookup (IMDB → TMDB)
async function getShow(imdb) {
  const url = `https://api.themoviedb.org/3/find/${imdb}?api_key=${TMDB_KEY}&external_source=imdb_id`;
  const data = await tmdb(url);
  return (data.tv_results && data.tv_results[0]) || null;
}

async function getSeasonEpisodes(tvid, season) {
  const url = `https://api.themoviedb.org/3/tv/${tvid}/season/${season}?api_key=${TMDB_KEY}`;
  return tmdb(url);
}

/* ----------------------------------------------------
   API: TV SHOW (SEASONS + EPISODES)
---------------------------------------------------- */

app.get("/api/show/:imdb", async (req, res) => {
  const imdb = req.params.imdb;

  try {
    // Step 1: Find TMDB TV ID
    const find = await tmdb(
      `https://api.themoviedb.org/3/find/${imdb}?api_key=${TMDB_KEY}&external_source=imdb_id`
    );

    const tv = find.tv_results?.[0];
    if (!tv) return res.status(404).json({ error: "Show not found" });

    const tmdbId = tv.id;

    // Step 2: Fetch full TV details (this contains number_of_seasons)
    const details = await tmdb(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}`
    );

    const seasons = {};

    // Step 3: Fetch each season
    for (let s = 1; s <= details.number_of_seasons; s++) {
      const seasonData = await tmdb(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${s}?api_key=${TMDB_KEY}`
      );

      if (!seasonData?.episodes?.length) continue;

      seasons[s] = seasonData.episodes.map(ep => ({
        ep: ep.episode_number,
        title: ep.name,
        overview: ep.overview,
        still: ep.still_path,
        src: `https://vidsrc.to/embed/tv/${imdb}/${s}/${ep.episode_number}`
      }));
    }

    // Step 4: Default episode (S1E1)
    const defaultSeason = seasons[1];
    const defaultEpisode = defaultSeason[0];

    res.json({
      title: details.name,
      imdb,
      poster: details.poster_path,
      overview: details.overview,
      seasons,
      default: {
        season: 1,
        episode: 1,
        src: `https://vidsrc.to/embed/tv/${imdb}/1/1`
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load show" });
  }
});

/* ----------------------------------------------------
   API: TRENDING MOVIES
---------------------------------------------------- */

app.get("/api/trending/movies", async (req, res) => {
  try {
    const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}`;
    const data = await tmdb(url);

    const results = await Promise.all(
      data.results.map(async m => {
        const imdb = await getIMDBfromTMDB(m.id, "movie");

        return {
          title: m.title,
          year: m.release_date?.slice(0,4),
          meta: "Movie",
          description: m.overview,
          image: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
          imdb,
          trailer: `https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + " trailer")}`
        };
      })
    );

    res.json(results.filter(item => item.imdb));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load trending movies" });
  }
});

/* ----------------------------------------------------
   API: TRENDING TV SHOWS
---------------------------------------------------- */

app.get("/api/trending/tv", async (req, res) => {
  try {
    const url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}`;
    const data = await tmdb(url);

    const results = await Promise.all(
      data.results.map(async s => {
        const imdb = await getIMDBfromTMDB(s.id, "tv");

        return {
          title: s.name,
          year: s.first_air_date?.slice(0,4),
          meta: "TV Series",
          description: s.overview,
          image: `https://image.tmdb.org/t/p/w500${s.poster_path}`,
          imdb,
          trailer: `https://www.youtube.com/results?search_query=${encodeURIComponent(s.name + " trailer")}`
        };
      })
    );

    res.json(results.filter(item => item.imdb));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load trending TV" });
  }
});

/* ----------------------------------------------------
   API: SEARCH (MOVIES + TV)
---------------------------------------------------- */

app.get("/api/search", async (req, res) => {
  const q = req.query.q;

  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`;
    const data = await tmdb(url);

    const results = await Promise.all(
      data.results
        .filter(x => x.media_type === "movie" || x.media_type === "tv")
        .map(async x => {
          const imdb = await getIMDBfromTMDB(x.id, x.media_type);

          return {
            title: x.title || x.name,
            year: (x.release_date || x.first_air_date || "").slice(0,4),
            meta: x.media_type === "movie" ? "Movie" : "TV Series",
            description: x.overview,
            image: `https://image.tmdb.org/t/p/w500${x.poster_path}`,
            imdb,
            trailer: `https://www.youtube.com/results?search_query=${encodeURIComponent((x.title || x.name) + " trailer")}`
          };
        })
    );

    res.json(results.filter(item => item.imdb));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

/* ----------------------------------------------------
   API: MOVIE (SINGLE PLAY BUTTON)
---------------------------------------------------- */

app.get("/api/movie/:imdb", async (req, res) => {
  const imdb = req.params.imdb;

  try {
    const url = `https://api.themoviedb.org/3/find/${imdb}?api_key=${TMDB_KEY}&external_source=imdb_id`;
    const data = await tmdb(url);

    const movie = data.movie_results[0];

    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    res.json({
      title: movie.title,
      imdb,
      src: `https://vidsrc.me/embed/movie?imdb=${imdb}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load movie" });
  }
});

/* ----------------------------------------------------
   START SERVER
---------------------------------------------------- */

app.listen(PORT, () => {
  console.log(`NovaFlix running at http://localhost:${PORT}`);
});
