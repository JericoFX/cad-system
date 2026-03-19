
import { createSignal, createMemo, For, Show, onMount, lazy } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import {
  newsState,
  newsActions,
  type NewsArticle,
  type NewsCategory,
} from '~/stores/newsStore';
import type { PhotoMetadata } from '~/stores/photoStore';
import { Button, Modal, Tabs } from '~/components/ui';

const NewsPhotoImporter = lazy(() => import('./NewsPhotoImporter').then(m => ({ default: m.NewsPhotoImporter })));

export function NewsManager() {
  const [activeTab, setActiveTab] = createSignal<'list' | 'editor'>('list');
  const [showPhotoImporter, setShowPhotoImporter] = createSignal(false);

  onMount(() => {
    newsActions.setCurrentUser({
      id: 'NEWS_001',
      name: 'Reportero LSNN',
      grade: 'EDITOR',
      badge: 'LSNN-001'
    });
  });

  const publishedArticles = createMemo(() =>
    Object.values(newsState.articles)
      .filter(a => a.status === 'PUBLISHED')
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime();
      })
  );

  const getCategoryLabel = (cat: NewsCategory) => {
    const labels: Record<NewsCategory, string> = {
      BREAKING: 'URGENTE',
      POLICE: 'POLICIA',
      EMS: 'EMS',
      COMMUNITY: 'COMUNIDAD',
      TRAFFIC: 'TRAFICO',
      WEATHER: 'CLIMA',
      OFFICIAL: 'OFICIAL'
    };
    return labels[cat] || cat;
  };

  const normalizeMediaUrl = (raw: string) => {
    const value = raw.trim();
    if (value === '') return '';
    if (value.startsWith('//')) return `https:${value}`;
    if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    return `https://${value}`;
  };

  const handlePhotosImported = (photos: PhotoMetadata[]) => {
    if (photos.length > 0) {
      newsActions.setDraft({ featuredImageUrl: photos[0].photoUrl });
      terminalActions.addLine(`Photo imported from camera`, 'output');
    }
    setShowPhotoImporter(false);
  };

  const handlePublish = () => {
    const draft = newsState.draft;
    if (!draft.headline.trim()) {
      terminalActions.addLine('Headline is required', 'error');
      return;
    }
    if (!draft.lead.trim()) {
      terminalActions.addLine('Body text is required', 'error');
      return;
    }

    const imageUrl = normalizeMediaUrl(draft.featuredImageUrl);
    const article = newsActions.quickPublish(
      draft.headline,
      draft.lead,
      draft.category,
      imageUrl || undefined,
    );

    if (article) {
      terminalActions.addLine(`Article published: ${article.headline}`, 'output');
      setActiveTab('list');
    }
  };

  const handleDelete = (articleId: string) => {
    if (confirm('Delete this article?')) {
      newsActions.deleteArticle(articleId);
      terminalActions.addLine('Article deleted', 'output');
    }
  };

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const openEditor = () => {
    newsActions.resetDraft();
    setActiveTab('editor');
  };

  return (
    <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content news-manager" onClick={e => e.stopPropagation()}>
        <Modal.Header>
          <Modal.Title>NEWS CENTRAL - Los Santos News Network</Modal.Title>
          <Modal.Close />
        </Modal.Header>

        <Tabs.Root
          value={activeTab()}
          onValueChange={(value) => setActiveTab(value as 'list' | 'editor')}
          bracketed={false}
          uppercase={false}
        >
          <Tabs.List>
            <Tabs.Trigger value='list' label='ARTICLES' badge={publishedArticles().length} />
            <Tabs.Trigger value='editor' label='QUICK PUBLISH' />
          </Tabs.List>
        </Tabs.Root>

        <div class="modal-body">
          <Show when={activeTab() === 'list'}>
            <div class="news-list">
              <div class="section-header">
                <h3>[PUBLISHED ARTICLES]</h3>
                <Button.Root class="btn btn-primary" onClick={openEditor}>
                  [+ NEW ARTICLE]
                </Button.Root>
              </div>

              <Show when={publishedArticles().length === 0}>
                <div class="empty-state">No published articles yet</div>
              </Show>

              <div class="articles-grid">
                <For each={publishedArticles()}>
                  {(article) => (
                    <div class={`article-card ${article.isPinned ? 'pinned' : ''}`}>
                      <div class="article-header">
                        <span class={`category-badge category-${article.category.toLowerCase()}`}>
                          {getCategoryLabel(article.category)}
                        </span>
                        {article.isPinned && <span class="pin-badge">PINNED</span>}
                      </div>

                      <h4 class="article-title">{article.headline}</h4>
                      <p class="article-subtitle">{article.lead.substring(0, 120)}{article.lead.length > 120 ? '...' : ''}</p>

                      <Show when={article.featuredImage?.url}>
                        <div class="article-thumb">
                          <img src={normalizeMediaUrl(article.featuredImage!.url)} alt={article.headline} />
                        </div>
                      </Show>

                      <div class="article-meta">
                        <span>By: {article.author.name}</span>
                        <span>{new Date(article.publishedAt || article.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div class="article-actions">
                        <Button.Root
                          class="btn btn-small btn-danger"
                          onClick={() => handleDelete(article.articleId)}
                        >
                          [DELETE]
                        </Button.Root>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'editor'}>
            <div class="news-editor">
              <div class="editor-section">
                <h3>[QUICK PUBLISH]</h3>

                <div class="form-group">
                  <label>Headline *</label>
                  <input
                    type="text"
                    value={newsState.draft.headline}
                    onInput={(e) => newsActions.setDraft({ headline: e.currentTarget.value })}
                    placeholder="Article headline (max 140 chars)"
                    maxlength={140}
                  />
                  <small>{newsState.draft.headline.length}/140</small>
                </div>

                <div class="form-group">
                  <label>Body *</label>
                  <textarea
                    value={newsState.draft.lead}
                    onInput={(e) => newsActions.setDraft({ lead: e.currentTarget.value })}
                    placeholder="Full article body text (max 2000 chars)"
                    rows={8}
                    maxlength={2000}
                  />
                  <small>{newsState.draft.lead.length}/2000</small>
                </div>

                <div class="form-group">
                  <label>Category</label>
                  <select
                    value={newsState.draft.category}
                    onChange={(e) => newsActions.setDraft({ category: e.currentTarget.value as NewsCategory })}
                  >
                    <option value="BREAKING">URGENTE</option>
                    <option value="POLICE">POLICIA</option>
                    <option value="EMS">EMS</option>
                    <option value="COMMUNITY">COMUNIDAD</option>
                    <option value="TRAFFIC">TRAFICO</option>
                    <option value="WEATHER">CLIMA</option>
                    <option value="OFFICIAL">OFICIAL</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Photo URL (optional)</label>
                  <input
                    type="text"
                    value={newsState.draft.featuredImageUrl}
                    onInput={(e) => newsActions.setDraft({ featuredImageUrl: e.currentTarget.value })}
                    placeholder="https://i.imgur.com/..."
                  />
                  <Show when={normalizeMediaUrl(newsState.draft.featuredImageUrl)}>
                    <div class="image-preview">
                      <img src={normalizeMediaUrl(newsState.draft.featuredImageUrl)} alt="Preview" />
                    </div>
                  </Show>
                  <Button.Root
                    class="btn btn-primary"
                    onClick={() => setShowPhotoImporter(true)}
                    style={{ 'margin-top': '8px', width: '100%' }}
                  >
                    [IMPORT FROM CAMERA]
                  </Button.Root>
                </div>
              </div>

              <div class="editor-actions">
                <Button.Root class="btn" onClick={() => { newsActions.resetDraft(); setActiveTab('list'); }}>
                  [CANCEL]
                </Button.Root>
                <Button.Root class="btn btn-success" onClick={handlePublish}>
                  [PUBLISH NOW]
                </Button.Root>
              </div>
            </div>
          </Show>
        </div>
      </div>

      <Show when={showPhotoImporter()}>
        <NewsPhotoImporter
          onPhotosSelected={handlePhotosImported}
          onCancel={() => setShowPhotoImporter(false)}
          maxPhotos={1}
        />
      </Show>
    </Modal.Root>
  );
}
