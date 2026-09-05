const DATA_URL = "./data/news.json";

const REFRESH_INTERVAL = 5 * 60 * 1000;

let newsData = {
    last_updated: null,
    articles: []
};


// ============================================
// SOURCE / CATEGORY CONFIGURATION
// ============================================

const SOURCE_CATEGORIES = {

    "CNA": [
        "Latest News",
        "Asia",
        "Business",
        "Singapore",
        "Sports",
        "World",
        "Today"
    ],

    "France 24": [
        "World",
        "Europe",
        "France",
        "Africa",
        "Middle East",
        "Americas",
        "Asia/Pacific"
    ],

    "BBC": [
        "World",
        "UK",
        "England",
        "Northern Ireland",
        "Scotland",
        "Wales",
        "Business",
        "Politics",
        "Health",
        "Education & Family",
        "Science & Environment",
        "Technology",
        "Entertainment & Arts"
    ],

    "SCMP": [
        "News",
        "Hong Kong",
        "China",
        "Asia",
        "World"
    ]

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

const categoryFilter =
    document.getElementById("category-filter");

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
// CURRENT SOURCE
// ============================================

function getSelectedSource() {

    const activeButton =
        document.querySelector(
            ".category-button.active"
        );

    if (activeButton) {

        return activeButton.dataset.source;

    }

    return "CNA";

}


// ============================================
// SEARCH
// ============================================

const FUZZY_THRESHOLD = 0.60;


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

    const previousRow =
        Array.from(
            { length: b.length + 1 },
            (_, i) => i
        );

    for (let i = 1; i <= a.length; i++) {

        const currentRow = [i];

        for (let j = 1; j <= b.length; j++) {

            const insertCost =
                currentRow[j - 1] + 1;

            const deleteCost =
                previousRow[j] + 1;

            const replaceCost =
                previousRow[j - 1] +
                (
                    a[i - 1] === b[j - 1]
                        ? 0
                        : 1
                );

            currentRow[j] =
                Math.min(
                    insertCost,
                    deleteCost,
                    replaceCost
                );

        }

        for (
            let j = 0;
            j < currentRow.length;
            j++
        ) {

            previousRow[j] =
                currentRow[j];

        }

    }

    return previousRow[b.length];

}


// ============================================
// WORD SIMILARITY
// ============================================

function wordSimilarity(a, b) {

    if (!a || !b) {
        return 0;
    }

    if (a === b) {
        return 1;
    }


    // Partial match

    if (
        a.length >= 3 &&
        b.includes(a)
    ) {

        return 0.95;

    }


    if (
        b.length >= 3 &&
        a.includes(b)
    ) {

        return 0.90;

    }


    const distance =
        levenshteinDistance(
            a,
            b
        );


    const maxLength =
        Math.max(
            a.length,
            b.length
        );


    if (!maxLength) {
        return 0;
    }


    return 1 - (
        distance /
        maxLength
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


    // Empty search = everything matches

    if (!query) {
        return true;
    }


    // ========================================
    // SEARCHABLE ARTICLE TEXT
    // ========================================

    const categories =
        Array.isArray(
            article.categories
        )
            ? article.categories.join(" ")
            : "";


    const searchableText =
        normalizeText(
            [
                article.title || "",
                article.description || "",
                article.source || "",
                categories
            ].join(" ")
        );


    // ========================================
    // EXACT PHRASE MATCH
    // ========================================

    if (
        searchableText.includes(
            query
        )
    ) {

        return true;

    }


    // ========================================
    // SPLIT SEARCH QUERY
    // ========================================

    const queryWords =
        query
            .split(/\s+/)
            .filter(Boolean);


    const textWords =
        searchableText
            .split(/\s+/)
            .filter(Boolean);


    if (
        queryWords.length === 0
    ) {

        return true;

    }


    // ========================================
    // EVERY SEARCH WORD MUST MATCH
    // ========================================

    return queryWords.every(
        searchWord => {


            // Short words need exact matching

            if (
                searchWord.length <= 2
            ) {

                return textWords.some(
                    textWord =>
                        textWord ===
                        searchWord
                );

            }


            // Fuzzy matching

            return textWords.some(
                textWord => {

                    const similarity =
                        wordSimilarity(
                            searchWord,
                            textWord
                        );

                    return (
                        similarity >=
                        FUZZY_THRESHOLD
                    );

                }
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


        // ========================================
        // STORE DATA
        // ========================================

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


        // ========================================
        // NORMALIZE ARTICLES
        // ========================================

        newsData.articles.forEach(
            article => {

                if (
                    typeof article.source !==
                    "string"
                ) {

                    article.source = "";

                }


                if (
                    !Array.isArray(
                        article.categories
                    )
                ) {

                    article.categories = [];

                }

            }
        );


        // ========================================
        // NEWEST FIRST
        // ========================================

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


        // ========================================
        // UPDATE CATEGORY FILTER
        // ========================================

        const selectedSource =
            getSelectedSource();


        populateCategoryFilter(
            selectedSource,
            "all"
        );


        // ========================================
        // UPDATE DATE PICKER
        // ========================================

        setDatePickerLimits();


        // ========================================
        // UPDATE HEADER
        // ========================================

        updateLastUpdated();


        // ========================================
        // RENDER ARTICLES
        // ========================================

        renderArticles();


        // ========================================
        // STATUS
        // ========================================

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


        if (newsContainer) {

            newsContainer.innerHTML = `

                <div class="error-box">

                    <strong>
                        Unable to load the news
                    </strong>

                    <span>
                        ${escapeHtml(
                            error.message ||
                            "Unknown error"
                        )}
                    </span>

                </div>

            `;

        }


        if (articleCount) {

            articleCount.textContent =
                "Error";

        }


        if (summaryDescription) {

            summaryDescription.textContent =
                "";

        }

    }

}


// ============================================
// POPULATE CATEGORY DROPDOWN
// ============================================

function populateCategoryFilter(
    selectedSource,
    selectedCategory = "all"
) {

    if (!categoryFilter) {
        return;
    }


    const categories =
        SOURCE_CATEGORIES[
            selectedSource
        ] || [];


    // Clear existing categories

    categoryFilter.innerHTML = "";


    // ========================================
    // ALL CATEGORIES
    // ========================================

    const allOption =
        document.createElement(
            "option"
        );


    allOption.value =
        "all";


    allOption.textContent =
        "All categories";


    categoryFilter.appendChild(
        allOption
    );


    // ========================================
    // SOURCE CATEGORIES
    // ========================================

    categories.forEach(
        category => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category;


            option.textContent =
                category;


            categoryFilter.appendChild(
                option
            );

        }
    );


    // ========================================
    // RESTORE CATEGORY
    // ========================================

    if (
        categories.includes(
            selectedCategory
        )
    ) {

        categoryFilter.value =
            selectedCategory;

    } else {

        categoryFilter.value =
            "all";

    }

}


// ============================================
// DATE PICKER
// ============================================

function setDatePickerLimits() {

    if (!dateFilter) {
        return;
    }


    /*
     * Use Singapore date so that the date picker
     * matches the dates used by the article filter.
     */

    const today =
        getSingaporeDate(
            new Date().toISOString()
        );


    // Do not allow future dates

    dateFilter.max =
        today;

}


// ============================================
// GET SINGAPORE DATE
// ============================================

function getSingaporeDate(
    dateString
) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone:
                "Asia/Singapore",

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit"
        }
    ).format(
        new Date(dateString)
    );

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


    if (
        !newsData.last_updated
    ) {

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
        ).format(
            date
        );


    updateRelative.textContent =
        relativeTime(
            date
        );

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


    if (
        seconds < 60
    ) {

        return "just now";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if (
        minutes < 60
    ) {

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


    if (
        hours < 24
    ) {

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
        !dateFilter ||
        !searchInput
    ) {

        console.error(
            "Required article rendering elements are missing."
        );

        return;

    }


    // ========================================
    // CURRENT FILTER VALUES
    // ========================================

    const selectedSource =
        getSelectedSource();


    const selectedCategory =
        categoryFilter
            ? categoryFilter.value
            : "all";


    const selectedDate =
        dateFilter.value;


    const search =
        searchInput.value.trim();


    // ========================================
    // FILTER ARTICLES
    // ========================================

    const filtered =
        newsData.articles.filter(
            article => {


                // ========================================
                // SOURCE
                // ========================================

                if (
                    selectedSource !== "all" &&
                    article.source !==
                    selectedSource
                ) {

                    return false;

                }


                // ========================================
                // CATEGORY
                // ========================================

                if (
                    selectedCategory !==
                    "all"
                ) {

                    const categories =
                        Array.isArray(
                            article.categories
                        )
                            ? article.categories
                            : [];


                    if (
                        !categories.includes(
                            selectedCategory
                        )
                    ) {

                        return false;

                    }

                }


                // ========================================
                // DATE
                // ========================================

                /*
                 * dateFilter is now a normal
                 * <input type="date">.
                 *
                 * Empty = all dates.
                 */

                if (
                    selectedDate
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


                // ========================================
                // SEARCH
                // ========================================

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
    // RENDER ARTICLES
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

function updatePageTitle(
    source
) {

    const pageTitle =
        document.getElementById(
            "page-title"
        );


    if (!pageTitle) {
        return;
    }


    pageTitle.textContent =
        source;

}


// ============================================
// CREATE ARTICLE CARD
// ============================================

function createArticleCard(
    article
) {

    const categories =
        Array.isArray(
            article.categories
        )
            ? article.categories
            : [];


    // ========================================
    // FORMAT DATE
    // ========================================

    let formattedDate =
        "Unknown date";


    if (
        article.published_at
    ) {

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


    // ========================================
    // SOURCE BADGE
    // ========================================

    const sourceBadge = `

        <span class="source-badge">
            ${escapeHtml(
                article.source ||
                "Unknown source"
            )}
        </span>

    `;


    // ========================================
    // CATEGORY BADGES
    // ========================================

    const categoryBadges =
        categories
            .map(
                category => `

                    <span class="category-badge">
                        ${escapeHtml(
                            category
                        )}
                    </span>

                `
            )
            .join("");


    // ========================================
    // ARTICLE DATA
    // ========================================

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


    // ========================================
    // ARTICLE CARD
    // ========================================

    return `

        <article class="news-card">

            <div class="news-meta">

                ${sourceBadge}

                ${categoryBadges}

                <span class="article-time">
                    ${escapeHtml(
                        formattedDate
                    )}
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

function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}


// ============================================
// STATUS
// ============================================

function setStatus(
    success
) {

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
// SOURCE TABS
// ============================================

categoryButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const selectedSource =
                    button.dataset.source;


                // ========================================
                // UPDATE ACTIVE TAB
                // ========================================

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


                // ========================================
                // RESET CATEGORY
                // ========================================

                populateCategoryFilter(
                    selectedSource,
                    "all"
                );


                // ========================================
                // RENDER
                // ========================================

                renderArticles();

            }
        );

    }
);


// ============================================
// CATEGORY FILTER
// ============================================

if (categoryFilter) {

    categoryFilter.addEventListener(
        "change",
        () => {

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
        () => {

            renderArticles();

        }
    );

}


// ============================================
// SEARCH
// ============================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderArticles();

        }
    );

}


// ============================================
// CLEAR FILTERS
// ============================================

if (clearFilters) {

    clearFilters.addEventListener(
        "click",
        () => {

            // Keep current source

            const currentSource =
                getSelectedSource();


            // Reset category

            populateCategoryFilter(
                currentSource,
                "all"
            );


            // Reset date picker

            if (dateFilter) {

                dateFilter.value =
                    "";

            }


            // Reset search

            if (searchInput) {

                searchInput.value =
                    "";

            }


            // Render

            renderArticles();

        }
    );

}


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
