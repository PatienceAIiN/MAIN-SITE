import os
from pathlib import Path
import tweepy


def _get_client() -> tweepy.Client:
    return tweepy.Client(
        bearer_token=os.getenv("TWITTER_BEARER_TOKEN"),
        consumer_key=os.getenv("TWITTER_API_KEY"),
        consumer_secret=os.getenv("TWITTER_API_SECRET"),
        access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
        access_token_secret=os.getenv("TWITTER_ACCESS_SECRET"),
    )


def _get_api_v1() -> tweepy.API:
    auth = tweepy.OAuth1UserHandler(
        os.getenv("TWITTER_API_KEY"),
        os.getenv("TWITTER_API_SECRET"),
        os.getenv("TWITTER_ACCESS_TOKEN"),
        os.getenv("TWITTER_ACCESS_SECRET"),
    )
    return tweepy.API(auth)


def post_tweet(text: str, image_path: str = None) -> dict:
    client = _get_client()
    media_ids = None

    if image_path:
        abs_path = Path(__file__).parent.parent.parent / image_path.lstrip("/")
        if abs_path.exists():
            api_v1 = _get_api_v1()
            media = api_v1.media_upload(str(abs_path))
            media_ids = [media.media_id]

    resp = client.create_tweet(text=text, media_ids=media_ids)
    tweet_id = str(resp.data["id"])
    tweet_url = f"https://twitter.com/i/web/status/{tweet_id}"
    return {"tweet_id": tweet_id, "tweet_url": tweet_url}


def delete_tweet(tweet_id: str):
    client = _get_client()
    client.delete_tweet(int(tweet_id))


def get_tweet_metrics(tweet_id: str) -> dict:
    client = _get_client()
    resp = client.get_tweet(
        int(tweet_id),
        tweet_fields=["public_metrics"],
    )
    if resp.data and resp.data.public_metrics:
        return resp.data.public_metrics
    return {}
