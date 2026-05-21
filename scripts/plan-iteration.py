#!/usr/bin/env python3
"""Plan a balanced iteration with pages from Fandom, Wikipedia, and ComicVine."""

import csv
import random

def main():
    # Load CSV
    fandom = []
    wikipedia = []
    comicvine = []

    with open('ml-training-pages-full.csv', 'r') as f:
        reader = csv.DictReader(f)

        for row in reader:
            anilist_id = row.get('AniListID', '')
            if not anilist_id or anilist_id == 'DOES_NOT_EXIST':
                continue

            title = row.get('Title', '')
            fandom_urls = row.get('FandomDiscoveredURLs', '')
            wiki_urls = row.get('WikipediaDiscoveredURLs', '')
            cv_urls = row.get('ComicVineDiscoveredURLs', '')
            fandom_base = row.get('FandomURL', '')
            wiki_base = row.get('WikipediaURL', '')

            # Fandom with discovered URLs
            if fandom_urls and fandom_urls != 'DOES_NOT_EXIST' and fandom_base and fandom_base != 'DOES_NOT_EXIST':
                url_types = []
                if 'MANGA_PAGE' in fandom_urls:
                    url_types.append('MANGA_PAGE')
                if 'VOLUMES' in fandom_urls:
                    url_types.append('VOLUMES')
                if 'CHAPTERS' in fandom_urls:
                    url_types.append('CHAPTERS')
                if url_types:
                    fandom.append({
                        'title': title,
                        'anilist_id': anilist_id,
                        'url_types': url_types,
                        'base_url': fandom_base,
                        'discovered_urls': fandom_urls
                    })

            # Wikipedia
            if wiki_urls and wiki_urls != 'DOES_NOT_EXIST' and wiki_base and wiki_base != 'DOES_NOT_EXIST':
                wikipedia.append({
                    'title': title,
                    'anilist_id': anilist_id,
                    'url': wiki_base,
                    'discovered_urls': wiki_urls
                })

            # ComicVine
            if cv_urls and cv_urls != 'DOES_NOT_EXIST':
                first_url = cv_urls.split('|')[0]
                url_part = first_url.split(':', 1)[1] if ':' in first_url else first_url
                comicvine.append({
                    'title': title,
                    'anilist_id': anilist_id,
                    'sample_url': url_part,
                    'discovered_urls': cv_urls
                })

    # Select diverse samples
    random.seed(42)  # Reproducible

    # Fandom - prefer mix of URL types
    fandom_manga = [f for f in fandom if 'MANGA_PAGE' in f['url_types']][:3]
    fandom_volumes = [f for f in fandom if 'VOLUMES' in f['url_types'] and f not in fandom_manga][:2]
    selected_fandom = fandom_manga + fandom_volumes

    # Wikipedia - random selection
    selected_wiki = random.sample(wikipedia[:100], min(5, len(wikipedia)))

    # ComicVine - random selection
    selected_cv = random.sample(comicvine[:100], min(5, len(comicvine)))

    print('=' * 70)
    print('ITERATION PLAN: 15 Pages (5 Fandom + 5 Wikipedia + 5 ComicVine)')
    print('=' * 70)
    print()

    print('=== FANDOM PAGES (5) ===')
    for i, entry in enumerate(selected_fandom[:5], 1):
        print(f'{i}. {entry["title"]}')
        print(f'   AniList ID: {entry["anilist_id"]}')
        print(f'   URL Types: {", ".join(entry["url_types"])}')
        print(f'   Base URL: {entry["base_url"]}')
        print()

    print('=== WIKIPEDIA PAGES (5) ===')
    for i, entry in enumerate(selected_wiki[:5], 1):
        print(f'{i}. {entry["title"]}')
        print(f'   AniList ID: {entry["anilist_id"]}')
        print(f'   URL: {entry["url"]}')
        print()

    print('=== COMICVINE PAGES (5) ===')
    for i, entry in enumerate(selected_cv[:5], 1):
        url = entry["sample_url"]
        url_display = f'{url[:70]}...' if len(url) > 70 else url
        print(f'{i}. {entry["title"]}')
        print(f'   AniList ID: {entry["anilist_id"]}')
        print(f'   Sample URL: {url_display}')
        print()

    # Output AniList IDs for filtering
    all_ids = (
        [e['anilist_id'] for e in selected_fandom[:5]] +
        [e['anilist_id'] for e in selected_wiki[:5]] +
        [e['anilist_id'] for e in selected_cv[:5]]
    )
    print('=' * 70)
    print('AniList IDs for iteration filter:')
    print(', '.join(all_ids))

if __name__ == '__main__':
    main()
