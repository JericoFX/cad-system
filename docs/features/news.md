# News System

In-game press/news system for reporters and news organizations.

## Overview

- **Create** news articles with title, body, and photos
- **Import** photos from evidence or press cameras
- **Publish** articles (with or without confirmation)
- **Browse** published articles in the NewsFeed

## Access

Available to jobs: `reporter`, `weazelnews`, `admin`

## Configuration

```lua
CAD.Config.News = {
    PublishWithoutConfirm = false,  -- true in 'simple' profile
}
```

## Workflow

1. Reporter captures photos with the press camera (`news_camera` item)
2. Opens NewsManager modal to compose article
3. Imports captured photos via NewsPhotoImporter
4. Publishes article — visible to all CAD users in the NewsFeed

## Components

| Component | Description |
|-----------|-------------|
| NewsManager | Article creation and editing |
| NewsFeed | Published article browser |
| NewsPhotoImporter | Import photos into articles |
