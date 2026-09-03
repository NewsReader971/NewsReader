import feedparser
import json
import hashlib
import html
import re

from datetime import datetime, timezone, timedelta
from pathlib import Path


FEEDS = [
    {
        "name": "Latest News",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
    },
    {
        "name": "Asia",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511",
    },
    {
        "name": "Business",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936",
    },
    {
        "name": "Singapore",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416",
    },
    {
        "name": "World",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6311",
    },
    {
        "name": "Today",
        "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=679471",
    },
]


DATA_FILE = Path("data/articles.json")

# Keep articles for 30 days
RETENTION_DAYS = 30


def clean_html(text):
    """
    Remove HTML from RSS descriptions.

    Your Flask version uses:
        {{ article.summary | safe }}

    For the JSON database, we'll store a clean text version instead.
    """

    if not text:
        return ""

    text = html.unescape(text)

    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def get_entry_date(entry):
    """
    Get the publication date from feedparser.

    feedparser provides *_parsed fields as time.struct_time.
    """

    parsed = (
        entry.get("published_parsed")
        or entry.get("updated_parsed")
        or entry.get("created_parsed")
    )

    if parsed:

        dt = datetime(
            parsed.tm_year,
            parsed.tm_mon,
            parsed.tm_mday,
            parsed.tm_hour,
            parsed.tm_min,
            parsed.tm_sec,
            tzinfo=timezone.utc,
        )

        return dt

    # If the RSS feed has no usable date,
    # use the current time.
    return datetime.now(timezone.utc)


def make_article_id(entry):
    """
    Generate a stable ID.

    Prefer:
        guid

    Then:
        link

    Then:
        title

    This prevents the same article being added every
    time GitHub Actions runs.
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


def parse_feed(feed_info):

    print()
    print("=" * 60)
    print(f"Fetching: {feed_info['name']}")
    print(feed_info["url"])
    print("=" * 60)

    feed = feedparser.parse(
        feed_info["url"]
    )

    if feed.bozo and not feed.entries:

        raise Exception(
            f"RSS feed could not be read: "
            f"{getattr(feed, 'bozo_exception', 'Unknown error')}"
        )

    articles = []

    for entry in feed.entries:

        title = entry.get(
            "title",
            "No title"
        ).strip()

        link = entry.get(
            "link",
            ""
        ).strip()

        summary = entry.get(
            "summary",
            entry.get(
                "description",
                ""
            )
        )

        summary = clean_html(summary)

        published = get_entry_date(entry)

        article_id = make_article_id(entry)

        articles.append(
            {
                "id": article_id,

                "title": title,

                "url": link,

                "description": summary,

                "published_at": published.isoformat(),

                "sources": [
                    feed_info["name"]
                ],
            }
        )

    print(
        f"Found {len(articles)} articles"
    )

    return articles


def load_articles():

    if not DATA_FILE.exists():

        return []

    try:

        with open(
            DATA_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

            if isinstance(data, list):
                return data

    except Exception as error:

        print(
            f"Could not load database: {error}"
        )

    return []


def merge_article(existing, incoming):

    """
    If the same article appears in multiple CNA feeds,
    keep one article but remember all the feeds it appeared in.
    """

    existing_sources = set(
        existing.get(
            "sources",
            []
        )
    )

    incoming_sources = set(
        incoming.get(
            "sources",
            []
        )
    )

    existing["sources"] = sorted(
        existing_sources | incoming_sources
    )

    # If the incoming article has a better description,
    # use it.
    if (
        len(incoming.get("description", ""))
        >
        len(existing.get("description", ""))
    ):
        existing["description"] = incoming["description"]

    # Make sure we don't lose a URL
    if not existing.get("url"):
        existing["url"] = incoming.get("url", "")

    return existing


def remove_old_articles(articles):

    cutoff = (
        datetime.now(timezone.utc)
        -
        timedelta(days=RETENTION_DAYS)
    )

    before = len(articles)

    kept = []

    for article in articles:

        try:

            published = datetime.fromisoformat(
                article["published_at"]
            )

            if published.tzinfo is None:

                published = published.replace(
                    tzinfo=timezone.utc
                )

        except Exception:

            # If an article has a bad date,
            # don't delete it automatically.
            kept.append(article)
            continue

        if published >= cutoff:
            kept.append(article)

    removed = before - len(kept)

    print()
    print(
        f"Removed {removed} articles "
        f"older than {RETENTION_DAYS} days."
    )

    return kept


def save_articles(articles):

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

    with open(
        DATA_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            articles,
            file,
            indent=2,
            ensure_ascii=False
        )


def main():

    print()
    print("CNA RSS NEWS COLLECTOR")
    print("======================")

    existing = load_articles()

    print(
        f"Existing articles: "
        f"{len(existing)}"
    )

    # Use article ID as the key.
    articles_by_id = {
        article["id"]: article
        for article in existing
    }

    successful_feeds = 0
    failed_feeds = 0

    for feed_info in FEEDS:

        try:

            articles = parse_feed(
                feed_info
            )

            successful_feeds += 1

            for article in articles:

                article_id = article["id"]

                if article_id in articles_by_id:

                    articles_by_id[
                        article_id
                    ] = merge_article(
                        articles_by_id[article_id],
                        article
                    )

                else:

                    articles_by_id[
                        article_id
                    ] = article

        except Exception as error:

            failed_feeds += 1

            print()
            print(
                f"ERROR: {feed_info['name']}"
            )
            print(error)

    # Remove anything older than 30 days
    articles = remove_old_articles(
        list(articles_by_id.values())
    )

    save_articles(
        articles
    )

    print()
    print("======================")
    print("FINISHED")
    print("======================")

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


if __name__ == "__main__":
    main()
