const DATA_URL = "data/news.json";

const REFRESH_INTERVAL = 5 * 60 * 1000;

let newsData = {
    last_updated: null,
    articles: []
};


// DOM elements

const newsContainer =
    document.getElementById("news-container");

const articleCount =
    document.getElementById("article-count");

const summaryDescription =
    document.getElementById("summary-description");

const lastUpdated =
    document.getElementById("last-updated");

const updateRelative =
    document.getElementById("update-relative");

const sourceFilter =
    document.getElementById("source-filter");

const dateFilter =
    document.getElementById("date-filter");

const searchInput =
    document.getElementById("search");

const clearFilters =
    document.getElementById("clear-filters");

const refreshStatus =
    document.getElementById("refresh-status");


// Load news.json

async function loadNews() {

    try {

        const cacheBuster = `?t=${Date.now()}`;

        const response = await fetch(
            DATA_URL + cacheBuster
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        newsData = {
            last_updated: data.last_updated || null,

            articles: Array.isArray(data.articles)
                ? data.articles
                : []
        };


        // Sort newest articles first

        newsData.articles.sort(
            (a, b) =>
                new Date(b.published_at) -
                new Date(a.published_at)
        );


        populateDateFilter();

        updateLastUpdated();

        renderArticles();

        setStatus(true);

    } catch (error) {

        console.error(
            "Failed to load news:",
            error
        );

        setStatus(false);

        if (newsData.articles.length === 0) {

            newsContainer.innerHTML = `
                <div class="error-box">
                    <strong>
                        Unable to load the news
                    </strong>

                    <span>
                        The news database could not
                        be loaded. Please try again later.
                    </span>
                </div>
            `;

            articleCount.textContent =
                "Unable to load";

            summaryDescription.textContent = "";
        }
    }
}


// Populate date filter

function populateDateFilter() {

    const currentValue =
        dateFilter.value;

    const dates = new Set();


    newsData.articles.forEach(article => {

        if (!article.published_at) {
            return;
        }

        dates.add(
            getSingaporeDate(
                article.published_at
            )
        );

    });


    dateFilter.innerHTML = `
        <option value="all">
            All Dates
        </option>
    `;


    Array.from(dates)
        .sort()
        .reverse()
        .forEach(date => {

            const option =
                document.createElement("option");

            option.value = date;

            option.textContent =
                formatDateLabel(date);

            dateFilter.appendChild(option);

        });


    // Restore previous selection

    const optionExists =
        Array.from(
            dateFilter.options
        ).some(
            option =>
                option.value === currentValue
        );


    if (optionExists) {

        dateFilter.value =
            currentValue;

    }
}


// Get Singapore calendar date

function getSingaporeDate(dateString) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Singapore",

            year: "numeric",

            month: "2-digit",

            day: "2-digit"
        }
    ).format(
        new Date(dateString)
    );
}


// Format date for dropdown

function formatDateLabel(dateString) {

    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    return new Intl.DateTimeFormat(
        "en-SG",
        {
            weekday: "short",

            day: "numeric",

            month: "short",

            year: "numeric"
        }
    ).format(date);
}


// Display last updated time

function updateLastUpdated() {

    if (!newsData.last_updated) {

        lastUpdated.textContent =
            "Unknown";

        updateRelative.textContent =
            "";

        return;
    }


    const date =
        new Date(
            newsData.last_updated
        );


    lastUpdated.textContent =
        new Intl.DateTimeFormat(
            "en-SG",
            {
                timeZone: "Asia/Singapore",

                dateStyle: "medium",

                timeStyle: "short"
            }
        ).format(date);


    updateRelative.textContent =
        relativeTime(date);
}


// Relative time

function relativeTime(date) {

    const seconds =
        Math.floor(
            (
                Date.now() -
                date.getTime()
            ) / 1000
        );


    if (seconds < 60) {
        return "just now";
    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if (minutes < 60) {

        return (
            `${minutes} minute` +
            (minutes === 1 ? "" : "s") +
            " ago"
        );

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (hours < 24) {

        return (
            `${hours} hour` +
            (hours === 1 ? "" : "s") +
            " ago"
        );

    }


    const days =
        Math.floor(
            hours / 24
        );


    return (
        `${days} day` +
        (days === 1 ? "" : "s") +
        " ago"
    );
}


// Filter and render articles

function renderArticles() {

    const selectedSource =
        sourceFilter.value;

    const selectedDate =
        dateFilter.value;

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    const filtered =
        newsData.articles.filter(article => {

            // Source filter

            if (
                selectedSource !== "all"
            ) {

                const sources =
                    article.sources || [];

                if (
                    !sources.includes(
                        selectedSource
                    )
                ) {
                    return false;
                }
            }


            // Date filter

            if (
                selectedDate !== "all"
            ) {

                const articleDate =
                    getSingaporeDate(
                        article.published_at
                    );

                if (
                    articleDate !==
                    selectedDate
                ) {
                    return false;
                }
            }


            // Search

            if (search) {

                const sources =
                    (
                        article.sources || []
                    ).join(" ");


                const searchable = [

                    article.title || "",

                    article.description || "",

                    sources

                ]
                    .join(" ")
                    .toLowerCase();


                if (
                    !searchable.includes(search)
                ) {
                    return false;
                }
            }


            return true;

        });


    // Update count

    articleCount.textContent =
        filtered.length.toLocaleString();


    summaryDescription.textContent =
        filtered.length === 1
            ? "article"
            : "articles";


    // No results

    if (
        filtered.length === 0
    ) {

        newsContainer.innerHTML = `
            <div class="empty">

                <div class="empty-title">
                    No articles found
                </div>

                <div class="empty-description">
                    Try changing your filters
                    or search terms.
                </div>

            </div>
        `;

        return;
    }


    // Render articles

    newsContainer.innerHTML =
        filtered
            .map(
                article =>
                    createArticleCard(article)
            )
            .join("");
}


// Create article card

function createArticleCard(article) {

    const sources =
        Array.isArray(article.sources)
            ? article.sources
            : [];


    const published =
        new Date(
            article.published_at
        );


    const formattedDate =
        new Intl.DateTimeFormat(
            "en-SG",
            {
                timeZone: "Asia/Singapore",

                dateStyle: "medium",

                timeStyle: "short"
            }
        ).format(published);


    // Source badges

    const sourceBadges =
        sources
            .map(
                source => `
                    <span class="source-badge">
                        ${escapeHtml(source)}
                    </span>
                `
            )
            .join("");


    const title =
        escapeHtml(
            article.title ||
            "Untitled article"
        );


    const description =
        escapeHtml(
            article.description ||
            ""
        );


    const url =
        escapeAttribute(
            article.url ||
            "#"
        );


    return `
        <article class="news-card">

            <div class="news-meta">

                ${sourceBadges}

                <span class="article-time">
                    ${formattedDate}
                </span>

            </div>


            <h2 class="news-title">

                <a
                    href="${url}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    ${title}
                </a>

            </h2>


            ${
                description
                    ? `
                        <p class="news-description">
                            ${description}
                        </p>
                    `
                    : ""
            }

        </article>
    `;
}


// Escape HTML

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


// Escape URL

function escapeAttribute(value) {

    return escapeHtml(value);

}


// Update connection status

function setStatus(success) {

    if (success) {

        refreshStatus.classList.remove(
            "error"
        );

    } else {

        refreshStatus.classList.add(
            "error"
        );

    }
}


// Source filter

sourceFilter.addEventListener(
    "change",
    renderArticles
);


// Date filter

dateFilter.addEventListener(
    "change",
    renderArticles
);


// Search

searchInput.addEventListener(
    "input",
    renderArticles
);


// Clear filters

clearFilters.addEventListener(
    "click",
    () => {

        sourceFilter.value = "all";

        dateFilter.value = "all";

        searchInput.value = "";

        renderArticles();

    }
);


// Update relative time every minute

setInterval(
    () => {

        updateLastUpdated();

    },
    60 * 1000
);


// Check for new data every 5 minutes

setInterval(
    () => {

        loadNews();

    },
    REFRESH_INTERVAL
);


// Initial load

loadNews();
