import feedparser
import json
import hashlib
import html
import re

from datetime import datetime, timezone, timedelta
from pathlib import Path


# ============================================================
# CONFIGURATION
# ============================================================

FEEDS = [
    # ========================================================
    # CHANNEL NEWSASIA (CNA)
    # ========================================================

    {
        "source": "CNA",
        "category": "Latest News",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
    },
    {
        "source": "CNA",
        "category": "Asia",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511",
    },
    {
        "source": "CNA",
        "category": "Business",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936",
    },
    {
        "source": "CNA",
        "category": "Singapore",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416",
    },
    {
        "source": "CNA",
        "category": "Sports",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10296",
    },
    {
        "source": "CNA",
        "category": "World",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6311",
    },
    {
        "source": "CNA",
        "category": "Today",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=679471",
    },


    # ========================================================
    # FRANCE 24
    # ========================================================

    {
        "source": "France 24",
        "category": "World",
        "url": "https://www.france24.com/en/rss",
    },
    {
        "source": "France 24",
        "category": "Europe",
        "url": "https://www.france24.com/en/europe/rss",
    },
    {
        "source": "France 24",
        "category": "France",
        "url": "https://www.france24.com/en/france/rss",
    },
    {
        "source": "France 24",
        "category": "Africa",
        "url": "https://www.france24.com/en/africa/rss",
    },
    {
        "source": "France 24",
        "category": "Middle East",
        "url": "https://www.france24.com/en/middle-east/rss",
    },
    {
        "source": "France 24",
        "category": "Americas",
        "url": "https://www.france24.com/en/americas/rss",
    },
    {
        "source": "France 24",
        "category": "Asia/Pacific",
        "url": "https://www.france24.com/en/asia-pacific/rss",
    },


    # ========================================================
    # BBC
    # ========================================================

    {
        "source": "BBC",
        "category": "World",
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
    },
    {
        "source": "BBC",
        "category": "UK",
        "url": "https://feeds.bbci.co.uk/news/uk/rss.xml",
    },
    {
        "source": "BBC",
        "category": "England",
        "url": "https://feeds.bbci.co.uk/news/england/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Northern Ireland",
        "url": "https://feeds.bbci.co.uk/news/northern_ireland/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Scotland",
        "url": "https://feeds.bbci.co.uk/news/scotland/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Wales",
        "url": "https://feeds.bbci.co.uk/news/wales/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Business",
        "url": "https://feeds.bbci.co.uk/news/business/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Politics",
        "url": "https://feeds.bbci.co.uk/news/politics/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Health",
        "url": "https://feeds.bbci.co.uk/news/health/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Education & Family",
        "url": "https://feeds.bbci.co.uk/news/education/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Science & Environment",
        "url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Technology",
        "url": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    },
    {
        "source": "BBC",
        "category": "Entertainment & Arts",
        "url": "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
    },


    # ========================================================
    # SOUTH CHINA MORNING POST (SCMP)
    # ========================================================

    {
        "source": "SCMP",
        "category": "News",
        "url": "https://www.scmp.com/rss/91/feed",
    },
    {
        "source": "SCMP",
        "category": "Hong Kong",
        "url": "https://www.scmp.com/rss/2/feed",
    },
    {
        "source": "SCMP",
        "category": "China",
        "url": "https://www.scmp.com/rss/4/feed",
    },
    {
        "source": "SCMP",
        "category": "Asia",
        "url": "https://www.scmp.com/rss/3/feed",
    },
    {
        "source": "SCMP",
        "category": "World",
        "url": "https://www.scmp.com/rss/5/feed",
    },
]


# JSON database
DATA_FILE = Path("data/news.json")


# Keep articles for 30 days
RETENTION_DAYS = 30


# ============================================================
# HTML CLEANING
# ============================================================

def clean_html(text):
    """
    Convert the RSS description into plain text.

    RSS descriptions can contain HTML such as:

        <p>This is an article.</p>

    We remove the HTML before storing it.
    """

    if not text:
        return ""

    # Decode HTML entities
    text = html.unescape(text)

    # Remove HTML tags
    text = re.sub(
        r"<[^>]+>",
        "",
        text
    )

    # Normalize whitespace
    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# ============================================================
# DATE HANDLING
# ============================================================

def get_entry_date(entry):
    """
    Get the publication date from a feedparser entry.

    We check:

        published_parsed
        updated_parsed
        created_parsed

    in that order.

    If none exist, we use the current UTC time.
    """

    parsed = (
        entry.get("published_parsed")
        or entry.get("updated_parsed")
        or entry.get("created_parsed")
    )

    if parsed:

        try:

            return datetime(
                parsed.tm_year,
                parsed.tm_mon,
                parsed.tm_mday,
                parsed.tm_hour,
                parsed.tm_min,
                parsed.tm_sec,
                tzinfo=timezone.utc
            )

        except Exception:
            pass

    # Fallback
    return datetime.now(timezone.utc)


# ============================================================
# ARTICLE ID
# ============================================================

def make_article_id(entry):
    """
    Create a stable ID for an article.

    We prefer:

        id
        guid
        link
        title

    This prevents duplicate articles from being
    added every time the GitHub Action runs.
    """

    value = (
        entry.get("id")
        or entry.get("guid")
        or entry.get("link")
        or entry.get("title")
        or ""
    )

    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


# ============================================================
# PARSE ONE FEED
# ============================================================

def parse_feed(feed_info):

    print()
    print("=" * 70)
    print(
        f"Fetching: "
        f"{feed_info['source']} - "
        f"{feed_info['category']}"
    )
    print(feed_info["url"])
    print("=" * 70)

    feed = feedparser.parse(
        feed_info["url"]
    )


    # --------------------------------------------------------
    # Check for errors
    # --------------------------------------------------------

    if feed.bozo and not feed.entries:

        error = getattr(
            feed,
            "bozo_exception",
            "Unknown RSS error"
        )

        raise Exception(
            f"RSS feed could not be read: {error}"
        )


    articles = []


    # --------------------------------------------------------
    # Parse entries
    # --------------------------------------------------------

    for entry in feed.entries:

        # Title
        title = entry.get(
            "title",
            "No title"
        ).strip()


        # URL
        link = entry.get(
            "link",
            ""
        ).strip()


        # Description
        summary = entry.get(
            "summary",
            entry.get(
                "description",
                ""
            )
        )

        summary = clean_html(
            summary
        )


        # Publication date
        published = get_entry_date(
            entry
        )


        # Stable ID
        article_id = make_article_id(
            entry
        )


        # Create article
        article = {

            "id": article_id,

            "source": [
                feed_info["source"]
            ],

            "category": [
                feed_info["category"]
            ],

            "title": title,

            "url": link,

            "description": summary,

            "published_at":
                published.isoformat()

        }


        articles.append(
            article
        )


    print(
        f"Found {len(articles)} articles"
    )


    return articles


# ============================================================
# LOAD EXISTING DATABASE
# ============================================================

def load_news():

    if not DATA_FILE.exists():

        print(
            "No existing database found."
        )

        return {
            "last_updated": None,
            "articles": []
        }


    try:

        with open(
            DATA_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(
                file
            )


        # New format
        if isinstance(data, dict):

            return {

                "last_updated":
                    data.get(
                        "last_updated"
                    ),

                "articles":
                    data.get(
                        "articles",
                        []
                    )

            }


        # Support old format just in case
        if isinstance(data, list):

            return {

                "last_updated": None,

                "articles": data

            }


    except Exception as error:

        print(
            f"Could not load database: {error}"
        )


    return {
        "last_updated": None,
        "articles": []
    }


# ============================================================
# MERGE DUPLICATE ARTICLE
# ============================================================

def merge_article(
    existing,
    incoming
):
    """
    Merge an article that already exists.

    This is useful because the same article
    can appear in multiple feeds.

    Source and category are kept separate.

    Example:

        source:
        [
            "CNA"
        ]

        category:
        [
            "Latest News",
            "Singapore",
            "Today"
        ]
    """

    # --------------------------------------------------------
    # Merge sources
    # --------------------------------------------------------

    existing_sources = existing.get(
        "source",
        []
    )

    incoming_sources = incoming.get(
        "source",
        []
    )


    # Support old data where source may
    # have been stored as a string.
    if isinstance(
        existing_sources,
        str
    ):

        existing_sources = [
            existing_sources
        ]


    if isinstance(
        incoming_sources,
        str
    ):

        incoming_sources = [
            incoming_sources
        ]


    existing["source"] = sorted(
        set(existing_sources)
        |
        set(incoming_sources)
    )


    # --------------------------------------------------------
    # Merge categories
    # --------------------------------------------------------

    existing_categories = existing.get(
        "category",
        []
    )

    incoming_categories = incoming.get(
        "category",
        []
    )


    # Support old data where category may
    # have been stored as a string.
    if isinstance(
        existing_categories,
        str
    ):

        existing_categories = [
            existing_categories
        ]


    if isinstance(
        incoming_categories,
        str
    ):

        incoming_categories = [
            incoming_categories
        ]


    existing["category"] = sorted(
        set(existing_categories)
        |
        set(incoming_categories)
    )


    # --------------------------------------------------------
    # If incoming description is better,
    # use it.
    # --------------------------------------------------------

    if (
        len(
            incoming.get(
                "description",
                ""
            )
        )
        >
        len(
            existing.get(
                "description",
                ""
            )
        )
    ):

        existing["description"] = (
            incoming["description"]
        )


    # --------------------------------------------------------
    # Make sure URL exists
    # --------------------------------------------------------

    if not existing.get("url"):

        existing["url"] = (
            incoming.get(
                "url",
                ""
            )
        )


    # --------------------------------------------------------
    # Make sure title exists
    # --------------------------------------------------------

    if not existing.get("title"):

        existing["title"] = (
            incoming.get(
                "title",
                "No title"
            )
        )


    # --------------------------------------------------------
    # Make sure source/category exist
    # for older articles.
    # --------------------------------------------------------

    if not existing.get("source"):

        existing["source"] = (
            incoming.get(
                "source",
                []
            )
        )


    if not existing.get("category"):

        existing["category"] = (
            incoming.get(
                "category",
                []
            )
        )


    return existing


# ============================================================
# REMOVE OLD ARTICLES
# ============================================================

def remove_old_articles(
    articles
):
    """
    Delete articles older than RETENTION_DAYS.

    With RETENTION_DAYS = 30:

        Article from 29 days ago -> KEEP
        Article from 30 days ago -> KEEP
        Article from 31 days ago -> DELETE
    """

    cutoff = (
        datetime.now(timezone.utc)
        -
        timedelta(
            days=RETENTION_DAYS
        )
    )


    before = len(
        articles
    )


    kept = []


    for article in articles:

        try:

            published = datetime.fromisoformat(
                article["published_at"]
            )


            # Make sure the date is timezone-aware

            if published.tzinfo is None:

                published = published.replace(
                    tzinfo=timezone.utc
                )


        except Exception:

            # If the date cannot be understood,
            # don't delete the article.
            kept.append(
                article
            )

            continue


        if published >= cutoff:

            kept.append(
                article
            )


    removed = (
        before -
        len(kept)
    )


    print()
    print(
        f"Removed {removed} articles "
        f"older than {RETENTION_DAYS} days."
    )


    return kept


# ============================================================
# SAVE DATABASE
# ============================================================

def save_news(
    articles
):
    """
    Save the database in the format expected
    by app.js.
    """

    # Make sure data/ exists
    DATA_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )


    # Newest first
    articles.sort(
        key=lambda article:
            article.get(
                "published_at",
                ""
            ),
        reverse=True
    )


    data = {

        "last_updated":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "articles":
            articles

    }


    with open(
        DATA_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False
        )


    print()
    print(
        f"Saved {len(articles)} articles"
    )

    print(
        f"Database: {DATA_FILE}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 70)
    print("NEWS RSS COLLECTOR")
    print("=" * 70)

    print()

    print(
        f"Feeds configured: {len(FEEDS)}"
    )

    print(
        f"Retention period: {RETENTION_DAYS} days"
    )

    print()


    # --------------------------------------------------------
    # Load existing data
    # --------------------------------------------------------

    existing_data = load_news()

    existing_articles = (
        existing_data.get(
            "articles",
            []
        )
    )


    print(
        f"Existing articles: "
        f"{len(existing_articles)}"
    )


    # --------------------------------------------------------
    # Convert existing articles into dictionary
    #
    # This makes duplicate checking very fast.
    # --------------------------------------------------------

    articles_by_id = {}


    for article in existing_articles:

        article_id = article.get(
            "id"
        )

        if article_id:

            articles_by_id[
                article_id
            ] = article


    # --------------------------------------------------------
    # Fetch all feeds
    # --------------------------------------------------------

    successful_feeds = 0
    failed_feeds = 0


    for feed_info in FEEDS:

        try:

            articles = parse_feed(
                feed_info
            )


            successful_feeds += 1


            for article in articles:

                article_id = (
                    article["id"]
                )


                # Article already exists
                if article_id in articles_by_id:

                    articles_by_id[
                        article_id
                    ] = merge_article(
                        articles_by_id[
                            article_id
                        ],
                        article
                    )


                # New article
                else:

                    articles_by_id[
                        article_id
                    ] = article


        except Exception as error:

            failed_feeds += 1


            print()
            print(
                f"ERROR: "
                f"{feed_info['source']} - "
                f"{feed_info['category']}"
            )

            print(
                str(error)
            )


    # --------------------------------------------------------
    # Convert dictionary back into list
    # --------------------------------------------------------

    articles = list(
        articles_by_id.values()
    )


    print()
    print(
        f"Articles before cleanup: "
        f"{len(articles)}"
    )


    # --------------------------------------------------------
    # Delete articles older than 30 days
    # --------------------------------------------------------

    articles = remove_old_articles(
        articles
    )


    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    save_news(
        articles
    )


    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("FINISHED")
    print("=" * 70)

    print()

    print(
        f"Feeds successful: "
        f"{successful_feeds}/{len(FEEDS)}"
    )

    print(
        f"Feeds failed: "
        f"{failed_feeds}/{len(FEEDS)}"
    )

    print(
        f"Articles stored: "
        f"{len(articles)}"
    )

    print(
        "Updated:",
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    print()


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()
