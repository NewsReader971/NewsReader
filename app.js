const DATA_URL = "./data/news.json";

const REFRESH_INTERVAL = 5 * 60 * 1000;

let newsData = {
    last_updated: null,
    articles: []
};


// ============================================
// DOM ELEMENTS
// ============================================

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

const statusDot =
    document.getElementById("status-dot");

const categoryButtons =
    document.querySelectorAll(".category-button");


// ============================================
// SEARCH SETTINGS
// ============================================

const FUZZY_THRESHOLD = 0.65;


// ============================================
// NORMALIZE SEARCH TEXT
// ============================================

function normalizeText(text) {

    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


// ============================================
// LEVENSHTEIN DISTANCE
// ============================================

function levenshteinDistance(a, b) {

    if (a === b) {
        return 0;
    }


    if (!a.length) {
        return b.length;
    }


    if (!b.length) {
        return a.length;
    }


    const matrix = [];


    for (
        let i = 0;
        i <= b.length;
        i++
    ) {

        matrix[i] = [i];

    }


    for (
        let j = 0;
        j <= a.length;
        j++
    ) {

        matrix[0][j] = j;

    }


    for (
        let i = 1;
        i <= b.length;
        i++
    ) {

        for (
            let j = 1;
            j <= a.length;
            j++
        ) {

            if (
                b.charAt(i - 1) ===
                a.charAt(j - 1)
            ) {

                matrix[i][j] =
                    matrix[i - 1][j - 1];

            } else {

                matrix[i][j] =
                    Math.min(

                        matrix[i - 1][j] + 1,

                        matrix[i][j - 1] + 1,

                        matrix[i - 1][j - 1] + 1

                    );

            }

        }

    }


    return matrix[b.length][a.length];

}


// ============================================
// FUZZY WORD MATCH
// ============================================

function fuzzyWordMatch(
    searchWord,
    textWord
) {

    if (!searchWord || !textWord) {
        return false;
    }


    // Exact match

    if (
        textWord.includes(
            searchWord
        )
    ) {

        return true;

    }


    // Very short words need stricter matching

    if (
        searchWord.length <= 2
    ) {

        return false;

    }


    const distance =
        levenshteinDistance(
            searchWord,
            textWord
        );


    const maxLength =
        Math.max(
            searchWord.length,
            textWord.length
        );


    const similarity =
        1 -
        (
            distance /
            maxLength
        );


    return (
        similarity >=
        FUZZY_THRESHOLD
    );

}


// ============================================
// FUZZY SEARCH
// ============================================

function fuzzySearch(
    searchQuery,
    article
) {

    const query =
        normalizeText(
            searchQuery
        );


    if (!query) {
        return true;
    }


    const sources =
        Array.isArray(
            article.sources
        )
            ? article.sources.join(" ")
            : "";


    const searchableText =
        normalizeText(
            [
                article.title || "",
                article.description || "",
                sources
            ].join(" ")
        );


    // Exact phrase match

    if (
        searchableText.includes(
            query
        )
    ) {

        return true;

    }


    const queryWords =
        query.split(" ")
            .filter(Boolean);


    const textWords =
        searchableText.split(" ")
            .filter(Boolean);


    if (
        queryWords.length === 0
    ) {

        return true;

    }


    // Every search word must have
    // a reasonably close match

    return queryWords.every(
        searchWord => {

            return textWords.some(
                textWord =>
                    fuzzyWordMatch(
                        searchWord,
                        textWord
                    )
            );

        }
    );

}


// ============================================
// LOAD NEWS.JSON
// ============================================

async function loadNews() {

    try {

        if (refreshStatus) {

            refreshStatus.textContent =
                "Updating...";

        }


        const cacheBuster =
            `?t=${Date.now()}`;


        const response =
            await fetch(
                DATA_URL +
                cacheBuster,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        newsData = {

            last_updated:
                data.last_updated ||
                null,

            articles:
                Array.isArray(
                    data.articles
                )
                    ? data.articles
                    : []

        };


        // Newest first

        newsData.articles.sort(
            (a, b) => {

                const dateA =
                    new Date(
                        a.published_at ||
                        0
                    );

                const dateB =
                    new Date(
                        b.published_at ||
                        0
                    );

                return dateB - dateA;

            }
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


        if (refreshStatus) {

            refreshStatus.textContent =
                "Unable to update";

        }


        if (
            newsData.articles.length === 0 &&
            newsContainer
        ) {

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


            if (articleCount) {

                articleCount.textContent =
                    "Unable to load";

            }


            if (summaryDescription) {

                summaryDescription.textContent =
                    "";

            }

        }

    }

}


// ============================================
// POPULATE DATE FILTER
// ============================================

function populateDateFilter() {

    if (!dateFilter) {
        return;
    }


    const currentValue =
        dateFilter.value;


    const dates =
        new Set();


    newsData.articles.forEach(
        article => {

            if (!article.published_at) {
                return;
            }


            try {

                dates.add(
                    getSingaporeDate(
                        article.published_at
                    )
                );

            } catch (error) {

                console.warn(
                    "Invalid article date:",
                    article.published_at
                );

            }

        }
    );


    dateFilter.innerHTML = `

        <option value="all">
            All dates
        </option>

    `;


    Array.from(dates)
        .sort()
        .reverse()
        .forEach(
            date => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    date;


                option.textContent =
                    formatDateLabel(
                        date
                    );


                dateFilter.appendChild(
                    option
                );

            }
        );


    const optionExists =
        Array.from(
            dateFilter.options
        ).some(
            option =>
                option.value ===
                currentValue
        );


    if (optionExists) {

        dateFilter.value =
            currentValue;

    }

}


// ============================================
// GET SINGAPORE DATE
// ============================================

function getSingaporeDate(dateString) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone:
                "Asia/Singapore",

            year: "numeric",

            month: "2-digit",

            day: "2-digit"
        }
    ).format(
        new Date(dateString)
    );

}


// ============================================
// FORMAT DATE LABEL
// ============================================

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


// ============================================
// UPDATE LAST UPDATED
// ============================================

function updateLastUpdated() {

    if (
        !lastUpdated ||
        !updateRelative
    ) {

        return;

    }


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


    if (
        isNaN(
            date.getTime()
        )
    ) {

        lastUpdated.textContent =
            "Unknown";

        updateRelative.textContent =
            "";

        return;

    }


    lastUpdated.textContent =
        new Intl.DateTimeFormat(
            "en-SG",
            {
                timeZone:
                    "Asia/Singapore",

                dateStyle:
                    "medium",

                timeStyle:
                    "short"
            }
        ).format(date);


    updateRelative.textContent =
        relativeTime(date);

}


// ============================================
// RELATIVE TIME
// ============================================

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
            (
                minutes === 1
                    ? ""
                    : "s"
            ) +
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
            (
                hours === 1
                    ? ""
                    : "s"
            ) +
            " ago"
        );

    }


    const days =
        Math.floor(
            hours / 24
        );


    return (
        `${days} day` +
        (
            days === 1
                ? ""
                : "s"
        ) +
        " ago"
    );

}


// ============================================
// FILTER AND RENDER ARTICLES
// ============================================

function renderArticles() {

    if (
        !newsContainer ||
        !sourceFilter ||
        !dateFilter ||
        !searchInput
    ) {

        return;

    }


    const selectedSource =
        sourceFilter.value;


    const selectedDate =
        dateFilter.value;


    const search =
        searchInput.value.trim();


    const filtered =
        newsData.articles.filter(
            article => {


                // Source

                if (
                    selectedSource !==
                    "all"
                ) {

                    const sources =
                        Array.isArray(
                            article.sources
                        )
                            ? article.sources
                            : [];


                    if (
                        !sources.includes(
                            selectedSource
                        )
                    ) {

                        return false;

                    }

                }


                // Date

                if (
                    selectedDate !==
                    "all"
                ) {

                    if (
                        !article.published_at
                    ) {

                        return false;

                    }


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


                // Fuzzy search

                if (search) {

                    if (
                        !fuzzySearch(
                            search,
                            article
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    // ========================================
    // COUNT
    // ========================================

    if (articleCount) {

        articleCount.textContent =
            filtered.length.toLocaleString();

    }


    if (summaryDescription) {

        summaryDescription.textContent =
            filtered.length === 1
                ? "article"
                : "articles";

    }


    // ========================================
    // PAGE TITLE
    // ========================================

    updatePageTitle(
        selectedSource
    );


    // ========================================
    // NO RESULTS
    // ========================================

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


    // ========================================
    // RENDER
    // ========================================

    newsContainer.innerHTML =
        filtered
            .map(
                article =>
                    createArticleCard(
                        article
                    )
            )
            .join("");

}


// ============================================
// UPDATE PAGE TITLE
// ============================================

function updatePageTitle(source) {

    const pageTitle =
        document.getElementById(
            "page-title"
        );


    if (!pageTitle) {
        return;
    }


    pageTitle.textContent =
        source === "all"
            ? "All News"
            : source;

}


// ============================================
// CREATE ARTICLE CARD
// ============================================

function createArticleCard(article) {

    const sources =
        Array.isArray(
            article.sources
        )
            ? article.sources
            : [];


    let formattedDate =
        "Unknown date";


    if (article.published_at) {

        const published =
            new Date(
                article.published_at
            );


        if (
            !isNaN(
                published.getTime()
            )
        ) {

            formattedDate =
                new Intl.DateTimeFormat(
                    "en-SG",
                    {
                        timeZone:
                            "Asia/Singapore",

                        dateStyle:
                            "medium",

                        timeStyle:
                            "short"
                    }
                ).format(
                    published
                );

        }

    }


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


// ============================================
// ESCAPE HTML
// ============================================

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


// ============================================
// ESCAPE URL
// ============================================

function escapeAttribute(value) {

    return escapeHtml(value);

}


// ============================================
// STATUS
// ============================================

function setStatus(success) {

    if (refreshStatus) {

        refreshStatus.textContent =
            success
                ? "Live"
                : "Connection error";

    }


    if (statusDot) {

        if (success) {

            statusDot.classList.remove(
                "error"
            );

        } else {

            statusDot.classList.add(
                "error"
            );

        }

    }

}


// ============================================
// SOURCE DROPDOWN
// ============================================

if (sourceFilter) {

    sourceFilter.addEventListener(
        "change",
        () => {

            const selectedSource =
                sourceFilter.value;


            categoryButtons.forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.source ===
                            selectedSource
                    );

                }
            );


            renderArticles();

        }
    );

}


// ============================================
// DATE FILTER
// ============================================

if (dateFilter) {

    dateFilter.addEventListener(
        "change",
        renderArticles
    );

}


// ============================================
// SEARCH
// ============================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        renderArticles
    );

}


// ============================================
// CLEAR FILTERS
// ============================================

if (clearFilters) {

    clearFilters.addEventListener(
        "click",
        () => {

            if (sourceFilter) {

                sourceFilter.value =
                    "all";

            }


            if (dateFilter) {

                dateFilter.value =
                    "all";

            }


            if (searchInput) {

                searchInput.value =
                    "";

            }


            categoryButtons.forEach(
                button => {

                    button.classList.remove(
                        "active"
                    );

                }
            );


            const allButton =
                document.querySelector(
                    '.category-button[data-source="all"]'
                );


            if (allButton) {

                allButton.classList.add(
                    "active"
                );

            }


            renderArticles();

        }
    );

}


// ============================================
// CATEGORY TABS
// ============================================

categoryButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const selectedSource =
                    button.dataset.source ||
                    "all";


                categoryButtons.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add(
                    "active"
                );


                if (sourceFilter) {

                    sourceFilter.value =
                        selectedSource;

                }


                renderArticles();

            }
        );

    }
);


// ============================================
// UPDATE RELATIVE TIME EVERY MINUTE
// ============================================

setInterval(
    updateLastUpdated,
    60 * 1000
);


// ============================================
// CHECK FOR NEW DATA EVERY 5 MINUTES
// ============================================

setInterval(
    loadNews,
    REFRESH_INTERVAL
);


// ============================================
// INITIAL LOAD
// ============================================

loadNews();
